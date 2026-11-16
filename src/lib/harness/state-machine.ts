import type { HtpPhase, HtpSession, HtpEvent, UiAction } from "./types";

export const phaseUiAction: Record<HtpPhase, UiAction> = {
  mood_check: "show_mood_check",
  drawing: "show_canvas",
  vision_check: "show_vision_check",
  exploration: "show_object_picker",
  confirmation: "show_confirmation",
  transformation_request: "show_transformation",
  transforming: "show_before_after",
  reflection: "show_reflection",
  complete: "show_reflection",
};

export const toolsForPhase = (phase: HtpPhase) => {
  if (phase === "vision_check") return ["analyze_drawing"] as const;
  if (phase === "transforming") return ["transform_world"] as const;
  return [] as const;
};

export const assertEventAllowed = (session: HtpSession, event: HtpEvent) => {
  const allowed: Record<HtpPhase, HtpEvent["type"][]> = {
    mood_check: ["start", "mood_recorded"],
    drawing: ["drawing_submitted"],
    vision_check: ["vision_continue", "vision_redraw", "vision_retry"],
    exploration: ["object_selected"],
    confirmation: ["meaning_submitted", "meaning_confirmed", "meaning_edit"],
    transformation_request: ["changes_submitted"],
    transforming: [],
    reflection: ["reflection_submitted"],
    complete: [],
  };
  if (!allowed[session.phase].includes(event.type)) {
    throw new Error(`Event ${event.type} is not allowed during ${session.phase}.`);
  }
};

export const initialAssistantText = "欢迎来到 Draw Your World。这里没有正确或错误的画法。此体验帮助你表达和反思，不提供心理诊断。现在的心情如何？";
