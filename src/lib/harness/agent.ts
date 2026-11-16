import OpenAI from "openai";
import { analyzeDrawing, drawingAnalysisErrorMessage, transformWorld } from "./tools";
import { assertEventAllowed, initialAssistantText, phaseUiAction } from "./state-machine";
import type { AgentTurn, HtpEvent, HtpSession } from "./types";

const dangerPattern = /自杀|自残|伤害自己|不想活|结束生命|suicide|kill myself|self-harm/i;

const safeTurn = (): AgentTurn => ({
  assistantText: "听起来你正在经历很难承受的感受。此刻请优先联系身边可信任的人，并在有即时危险时联系当地紧急服务或危机支持热线。你不需要独自面对。",
  uiAction: "show_reflection",
  isSafetyRedirect: true,
});

const localCopy = (session: HtpSession): AgentTurn => {
  const action = phaseUiAction[session.phase];
  switch (session.phase) {
    case "mood_check": return { assistantText: initialAssistantText, uiAction: action, suggestedChoices: ["1", "2", "3", "4", "5"] };
    case "drawing": return { assistantText: "请画一棵树、一所房子和一个人。你可以按自己的方式画，没有正确答案。", uiAction: action };
    case "vision_check": return { assistantText: "我先整理了画面中能看见的内容。你可以选择补画，或直接继续告诉我这个世界的故事。", uiAction: action, suggestedChoices: ["继续体验", "回到画布"] };
    case "exploration": return { assistantText: "你想先从房子、树、人物，还是画面中的其他东西开始聊？", uiAction: action, suggestedChoices: ["房子", "树", "人物", "其他"] };
    case "confirmation": return { assistantText: `我理解你提到的意思是：“${session.draftMeaning ?? ""}”。这样理解对吗？`, uiAction: action, suggestedChoices: ["确认", "修改"] };
    case "transformation_request": return { assistantText: "如果能让这个世界有一点点不同，你希望改变什么？可以是添加、移动或改变画面里的任何元素。", uiAction: action };
    case "reflection": return { assistantText: "现在再看这两个世界，你此刻的心情如何？", uiAction: action, suggestedChoices: ["1", "2", "3", "4", "5"] };
    default: return { assistantText: "谢谢你完成这次表达。", uiAction: action };
  }
};

function append(session: HtpSession, role: "user" | "assistant", content: string) {
  session.messages = [...session.messages, { role, content }].slice(-12);
}

async function askChatModel(session: HtpSession, userText: string): Promise<string | undefined> {
  if (!process.env.DEEPSEEK_API_KEY) return undefined;
  const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
  const response = await client.chat.completions.create({
    model: "deepseek-flash",
    messages: [
      { role: "system", content: "你是 Draw Your World 的温和中文陪伴 Agent。只能陈述视觉工具提供的可见事实；含义必须来自用户并等待确认；绝不诊断、贴人格标签、承诺治疗或替用户决定什么更积极。每次最多两句，优先提出一个开放问题。" },
      ...session.messages,
      { role: "user", content: userText },
    ],
  });
  return response.choices[0]?.message.content ?? undefined;
}

type ToolName = "analyze_drawing" | "transform_world";

async function executeTool(session: HtpSession, tool: ToolName) {
  if (tool === "analyze_drawing") {
    if (!session.beforeImage) throw new Error("没有可供识别的绘画图片。");
    return analyzeDrawing(session.beforeImage);
  }
  return transformWorld(session);
}

/**
 * The agent never receives the image base64 in tool arguments. It asks for the
 * current session asset, and the server resolves that private asset itself.
 */
async function invokeToolThroughAgent(session: HtpSession, tool: ToolName): Promise<{ result: unknown }> {
  if (!process.env.DEEPSEEK_API_KEY) return { result: await executeTool(session, tool) };

  const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
  const tools = [{
    type: "function" as const,
    function: {
      name: tool,
      description: tool === "analyze_drawing" ? "Inspect the current drawing and return only visible HTP features." : "Create the user's requested visual transformation from the current drawing.",
      parameters: {
        type: "object",
        properties: { asset: { type: "string", enum: ["current_drawing"] } },
        required: ["asset"],
        additionalProperties: false,
      },
    },
  }];
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: "You are the Draw Your World orchestration agent. Call the required tool exactly once using asset=current_drawing. Do not infer psychological meaning. After the tool result, write one short, warm Chinese sentence." },
    { role: "user", content: tool === "analyze_drawing" ? "The user has submitted a drawing. Inspect it now." : "The user confirmed the requested visual changes. Create the transformed image now." },
  ];
  const first = await client.chat.completions.create({
    model: "deepseek-flash",
    messages,
    tools,
    tool_choice: { type: "function", function: { name: tool } },
    // Keep the forced tool turn fast and deterministic.
    reasoning_effort: "none" as never,
  });
  const call = first.choices[0]?.message.tool_calls?.[0];
  if (!call || call.type !== "function" || call.function.name !== tool) return { result: await executeTool(session, tool) };

  // The tool result becomes session state. The UI renders it from the validated
  // schema instead of displaying an unconstrained model paraphrase.
  return { result: await executeTool(session, tool) };
}

export async function runHtpAgent(session: HtpSession, event: HtpEvent): Promise<{ session: HtpSession; turn: AgentTurn }> {
  assertEventAllowed(session, event);
  const next: HtpSession = structuredClone(session);
  let turn: AgentTurn;

  if (event.type === "start") return { session: next, turn: localCopy(next) };
  if (event.type === "mood_recorded") {
    next.moodBefore = event.mood; next.phase = "drawing"; append(next, "user", `体验前心情：${event.mood}/5`); turn = localCopy(next);
  } else if (event.type === "drawing_submitted" || event.type === "vision_retry") {
    if (event.type === "drawing_submitted") {
      next.beforeImage = event.imageBase64;
      append(next, "user", "我完成了绘画。");
    }
    next.phase = "vision_check";
    next.toolError = undefined;
    next.drawingFeatures = undefined;
    try {
      // The state machine has already selected this tool; no extra model call is needed.
      next.drawingFeatures = await analyzeDrawing(next.beforeImage ?? "");
    }
    catch (error) {
      next.toolError = drawingAnalysisErrorMessage(error);
      // Log metadata only: provider messages can contain image data or credentials.
      console.error("analyze_drawing failed", { kind: error instanceof Error ? error.name : "Unknown", status: error instanceof OpenAI.APIError ? error.status : undefined });
    }
    turn = { ...localCopy(next), ...(next.toolError ? { assistantText: "这次未能完成画面观察。你可以重试、回到画布，或直接继续讲述它的意义。" } : {}), usedTool: "analyze_drawing" };
  } else if (event.type === "vision_redraw") {
    next.phase = "drawing"; turn = localCopy(next);
  } else if (event.type === "vision_continue") {
    next.phase = "exploration"; turn = localCopy(next);
  } else if (event.type === "object_selected") {
    next.selectedObject = event.object; next.phase = "confirmation"; next.draftMeaning = undefined;
    turn = { assistantText: `当你看着画里的${event.object === "house" ? "房子" : event.object === "tree" ? "树" : event.object === "person" ? "人物" : "其他部分"}，它对你意味着什么？`, uiAction: "show_confirmation" };
  } else if (event.type === "meaning_submitted") {
    if (dangerPattern.test(event.meaning)) return { session: next, turn: safeTurn() };
    next.draftMeaning = event.meaning; append(next, "user", event.meaning);
    turn = localCopy(next);
  } else if (event.type === "meaning_edit") {
    next.phase = "exploration"; next.draftMeaning = undefined; turn = localCopy(next);
  } else if (event.type === "meaning_confirmed") {
    if (!next.selectedObject || !next.draftMeaning) throw new Error("确认前需要选择对象并写下自己的解释。");
    next.confirmedMeanings.push({ object: next.selectedObject, meaning: next.draftMeaning, source: "user_confirmed" });
    next.phase = "transformation_request"; turn = localCopy(next);
  } else if (event.type === "changes_submitted") {
    if (!next.confirmedMeanings.length) throw new Error("需要先确认至少一个由用户表达的含义。");
    if (event.changes.some((item) => dangerPattern.test(item))) return { session: next, turn: safeTurn() };
    next.transformationRequest = { requestedChanges: event.changes.filter(Boolean), preserveHandDrawnStyle: true, preserveComposition: true, preserveObjectIdentity: true };
    next.phase = "transforming";
    try {
      const toolResult = await invokeToolThroughAgent(next, "transform_world");
      const output = toolResult.result as { imageUrl: string };
      next.afterImage = output.imageUrl;
    }
    catch (error) { next.toolError = error instanceof Error ? error.message : "图像编辑失败。"; }
    next.phase = "reflection"; turn = { assistantText: next.afterImage ? "这是根据你亲自提出的改变生成的新世界。现在再看它，你有什么感觉？" : "我保留了你的原始作品，并用轻量效果呈现你想要的改变。现在再看它，你有什么感觉？", uiAction: "show_before_after", usedTool: "transform_world" };
  } else {
    next.moodAfter = event.mood; next.reflection = event.reflection; next.phase = "complete"; append(next, "user", `体验后心情：${event.mood}/5。${event.reflection ?? ""}`); turn = { assistantText: "谢谢你把这个世界画出来，也谢谢你愿意回看它。", uiAction: "show_reflection" };
  }

  if (!["drawing_submitted", "vision_retry", "changes_submitted"].includes(event.type) && !turn.isSafetyRedirect) {
    const modelText = await askChatModel(next, turn.assistantText).catch(() => undefined);
    if (modelText) turn.assistantText = modelText;
  }
  append(next, "assistant", turn.assistantText);
  return { session: next, turn };
}
