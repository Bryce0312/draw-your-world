import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { emptyCheckpoint } from "@langchain/langgraph-checkpoint";
import { converse, deleteConversationThread } from "./conversation";
import { StudioCheckpointSaver } from "./checkpoint";
import { createStudioSession, getSession, mutateSession, saveAsset } from "./store";
import type { GenerationJob, StudioProposal, StudioStreamEvent } from "./types";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "draw-world-conversation-"));
  vi.stubEnv("STUDIO_DATA_DIR", directory);
  vi.stubEnv("STUDIO_MODE", "live");
  vi.stubEnv("DEEPSEEK_API_KEY", "test-chat-key");
  vi.stubEnv("DEEPSEEK_CHAT_MODEL", "");
  vi.stubEnv("DEEPSEEK_MODEL", "deepseek-flash");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function artwork(mode: "live" | "demo" = "live") {
  const session = createStudioSession(mode);
  const asset = saveAsset(session.id, Buffer.from("private-test-image"), { kind: "original", artworkVersion: 1, mimeType: "image/png" });
  return mutateSession(session.id, (current) => {
    current.artworkVersion = 1;
    current.originalAssetId = asset.id;
    current.activeAssetId = asset.id;
    current.observation = { artworkVersion: 1, status: "ready", items: ["夜色里的一棵树"], uncertainties: [] };
  });
}
function streamedResponse(parts: Array<Record<string, unknown>>) {
  const body = [...parts.map((part) => `data: ${JSON.stringify({ id: "chat-test", choices: [part] })}\n\n`), "data: [DONE]\n\n"].join("");
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
function textResponse(text: string) { return streamedResponse([{ index: 0, delta: { content: text }, finish_reason: null }, { index: 0, delta: {}, finish_reason: "stop" }]); }
function toolResponse(name: string, args: Record<string, unknown>) {
  return streamedResponse([{ index: 0, delta: { tool_calls: [{ index: 0, id: "call-draft", type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: null }, { index: 0, delta: {}, finish_reason: "tool_calls" }]);
}
function events() { const captured: StudioStreamEvent[] = []; return { captured, emit: (event: StudioStreamEvent) => captured.push(event) }; }

describe("studio conversational agent authorization and durable memory", () => {
  it("retains the user input and reports unavailable chat honestly without calling any model", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const session = artwork(); const stream = events();
    await converse(session.id, "树没有特别含义", stream.emit);
    const current = getSession(session.id);
    expect(current.messages.filter((message) => message.role === "user").map((message) => message.content)).toEqual(["树没有特别含义"]);
    expect(current.userStatements).toEqual(["树没有特别含义"]);
    expect(stream.captured).toContainEqual({ type: "error", message: expect.stringContaining("尚未配置") });
    expect(current.proposals).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams a response and uses the persisted conversation only once in the next model context", async () => {
    const session = artwork();
    const requestBodies: Array<{ messages: Array<{ role: string; content: string }>; thinking: unknown; model: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requestBodies.push(JSON.parse(init.body));
      return textResponse(requestBodies.length === 1 ? "你愿意先从树讲起吗？" : "可以，不需要给每个部分一个含义。");
    }));
    const stream = events();
    await converse(session.id, "我先看这棵树", stream.emit);
    await converse(session.id, "它只是树", stream.emit);
    expect(requestBodies[0].thinking).toEqual({ type: "disabled" });
    expect(requestBodies[0].model).toBe("deepseek-flash");
    expect(requestBodies[1].messages.filter((message) => message.role === "user" && message.content === "我先看这棵树")).toHaveLength(1);
    expect(getSession(session.id).messages.map((message) => message.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(stream.captured).toContainEqual({ type: "text.delta", text: "你愿意先从树讲起吗？" });
  });

  it("requires a concrete user action after a shortcut even if the model tries to invent a draft", async () => {
    const session = artwork(); let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ++calls === 1
      ? toolResponse("propose_video_motion", { summary: "让树叶轻轻摇动", userIntentQuote: "试试动画", changes: ["树叶轻轻摇动"], preserve: ["夜色"] })
      : textResponse("你希望哪一部分动起来，怎样动？")));
    await converse(session.id, "", events().emit, { requestKind: "video" });
    expect(getSession(session.id).proposals).toHaveLength(0);
    expect(getSession(session.id).jobs).toHaveLength(0);
    expect(calls).toBe(2);
  });

  it("creates a version-bound draft from explicit user changes without starting a paid generation job", async () => {
    const session = artwork(); let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ++calls === 1
      ? toolResponse("propose_image_change", { summary: "只给树加一片叶子", userIntentQuote: "树加一片叶子", changes: ["树加一片叶子"], preserve: ["保留夜色", "保留手绘笔触"] })
      : textResponse("草稿已列出改动和保留项，你可以先核对。")));
    await converse(session.id, "请给树加一片叶子，保留夜色", events().emit);
    const current = getSession(session.id);
    expect(current.proposals).toHaveLength(1);
    expect(current.proposals[0]).toMatchObject({ kind: "image", status: "draft", artworkVersion: 1, sourceAssetId: session.originalAssetId, changes: ["树加一片叶子"], preserve: ["保留夜色", "保留手绘笔触"] });
    expect(current.userStatements).toEqual(["请给树加一片叶子，保留夜色"]);
    expect(current.jobs).toHaveLength(0);
  });

  it("does not turn an AI-authored interpretation into a user statement", async () => {
    const session = artwork(); let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ++calls === 1
      ? toolResponse("propose_understanding", { summary: "你缺乏安全感", userQuote: "你缺乏安全感" })
      : textResponse("画面的意思由你决定。")));
    await converse(session.id, "房子画在这里是因为右边没地方了", events().emit);
    const current = getSession(session.id);
    expect(current.proposals).toHaveLength(0);
    expect(current.userStatements).toEqual(["房子画在这里是因为右边没地方了"]);
  });

  it("accepts denial and invalidates pending drafts without overwriting original user words", async () => {
    const session = artwork("demo");
    const proposal: StudioProposal = { id: randomUUID(), kind: "understanding", artworkVersion: 1, sourceAssetId: session.originalAssetId!, summary: "树代表孤独", changes: [], preserve: [], status: "approved", createdAt: new Date().toISOString() };
    mutateSession(session.id, (current) => { current.proposals.push(proposal); current.userStatements.push("这棵树让我想起小时候"); });
    await converse(session.id, "不是这个意思，树没有代表孤独", events().emit);
    const current = getSession(session.id);
    expect(current.proposals[0].status).toBe("stale");
    expect(current.rejectedInterpretations).toContain("不是这个意思，树没有代表孤独");
    expect(current.userStatements).toEqual(["这棵树让我想起小时候", "不是这个意思，树没有代表孤独"]);
    expect(current.messages.at(-1)?.content).toContain("[Demo mode · local simulation]");
  });

  it("does not reuse a previous artwork's conversation as evidence for a new draft", async () => {
    const session = artwork(); let calls = 0;
    mutateSession(session.id, (current) => current.messages.push({ id: randomUUID(), role: "user", content: "给树加阳光", createdAt: "2000-01-01T00:00:00.000Z" }));
    const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return ++calls === 1 ? toolResponse("propose_image_change", { summary: "给树加阳光", userIntentQuote: "给树加阳光", changes: ["给树加阳光"], preserve: [] }) : textResponse("这幅新画的变化由你决定。");
    }));
    await converse(session.id, "这是我的新画", events().emit);
    expect(requests[0].messages.some((message) => message.role === "user" && message.content === "给树加阳光")).toBe(false);
    expect(getSession(session.id).proposals).toHaveLength(0);
  });

  it("rechecks a specific visible detail even when a general observation is already ready", async () => {
    const session = artwork(); let calls = 0;
    const providers = await import("./providers");
    const inspect = vi.spyOn(providers, "analyzeArtwork").mockResolvedValue({ items: ["树旁可见一条小路"], uncertainties: [] });
    vi.stubGlobal("fetch", vi.fn(async () => ++calls === 1 ? toolResponse("inspect_artwork", { question: "树旁是否有一条小路？" }) : textResponse("补看后能看见树旁有一条小路。")));
    await converse(session.id, "你能再看看树旁是不是小路吗？", events().emit);
    expect(inspect).toHaveBeenCalledOnce();
    expect(inspect.mock.calls[0].slice(1)).toEqual(["image/png", "live", "树旁是否有一条小路？"]);
    expect(getSession(session.id).observation?.items).toContain("树旁可见一条小路");
  });

  it("merges assistant output into latest state while a worker completes a job", async () => {
    const session = artwork();
    const job: GenerationJob = { id: randomUUID(), proposalId: randomUUID(), kind: "image", artworkVersion: 1, sourceAssetId: session.originalAssetId!, status: "running", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), mode: "live" };
    mutateSession(session.id, (current) => current.jobs.push(job));
    vi.stubGlobal("fetch", vi.fn(async () => {
      mutateSession(session.id, (current) => { current.jobs[0].status = "succeeded"; current.jobs[0].resultAssetId = "worker-result"; });
      return textResponse("你可以继续看自己的原作。");
    }));
    await converse(session.id, "我想先看看原作", events().emit);
    expect(getSession(session.id).jobs[0]).toMatchObject({ status: "succeeded", resultAssetId: "worker-result" });
    expect(getSession(session.id).messages.at(-1)?.content).toBe("你可以继续看自己的原作。");
  });

  it("persists graph state across saver instances and erases thread checkpoints when requested", async () => {
    const session = artwork("demo");
    await converse(session.id, "我先看看画面", events().emit);
    const reopened = new StudioCheckpointSaver(join(directory, "checkpoints.sqlite"));
    const checkpoint = await reopened.getTuple({ configurable: { thread_id: session.id } });
    expect(checkpoint?.checkpoint.channel_values.input).toBe("我先看看画面");
    await deleteConversationThread(session.id);
    expect(await reopened.getTuple({ configurable: { thread_id: session.id } })).toBeUndefined();
    reopened.close();
  });

  it("persists pending writes in deterministic task order and supports checkpoint history", async () => {
    const saver = new StudioCheckpointSaver(join(directory, "history.sqlite"));
    const config = { configurable: { thread_id: "checkpoint-test" } };
    const first = emptyCheckpoint();
    const firstConfig = await saver.put(config, first, { source: "input", step: -1, parents: {} });
    await saver.putWrites(firstConfig, [["value", "later"]], "z-task", "path-b");
    await saver.putWrites(firstConfig, [["value", "first"]], "a-task", "path-a");
    const stored = await saver.getTuple(firstConfig);
    expect(stored?.pendingWrites?.map((write) => write[2])).toEqual(["first", "later"]);
    const second = emptyCheckpoint();
    await saver.put(firstConfig, second, { source: "loop", step: 0, parents: {} });
    const history = [];
    for await (const item of saver.list(config)) history.push(item);
    expect(history).toHaveLength(2);
    expect(history[0].parentConfig?.configurable?.checkpoint_id).toBe(first.id);
    saver.close();
  });
});
