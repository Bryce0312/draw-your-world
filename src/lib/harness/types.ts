export const HTP_PHASES = [
  "mood_check",
  "drawing",
  "vision_check",
  "exploration",
  "confirmation",
  "transformation_request",
  "transforming",
  "reflection",
  "complete",
] as const;

export type HtpPhase = (typeof HTP_PHASES)[number];
export type UiAction =
  | "show_mood_check"
  | "show_canvas"
  | "show_vision_check"
  | "show_object_picker"
  | "show_confirmation"
  | "show_transformation"
  | "show_before_after"
  | "show_reflection";

export type DrawingObjectState = "present" | "absent" | "uncertain";
export type HorizontalPosition = "left" | "center" | "right" | "uncertain";

export interface DrawingFeatures {
  source: "vision_observation";
  objects: { house: DrawingObjectState; tree: DrawingObjectState; person: DrawingObjectState };
  observations: string[];
  layout: {
    housePosition: HorizontalPosition;
    treePosition: HorizontalPosition;
    personPosition: HorizontalPosition;
    relativeSizes: string[];
    objectRelations: string[];
  };
  visibleDetails: string[];
  uncertainties: string[];
}

export interface ConfirmedMeaning {
  object: "house" | "tree" | "person" | "other";
  meaning: string;
  source: "user_confirmed";
}

export interface TransformationRequest {
  requestedChanges: string[];
  preserveHandDrawnStyle: true;
  preserveComposition: true;
  preserveObjectIdentity: true;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface HtpSession {
  id: string;
  phase: HtpPhase;
  moodBefore?: number;
  moodAfter?: number;
  beforeImage?: string;
  afterImage?: string;
  drawingFeatures?: DrawingFeatures;
  selectedObject?: ConfirmedMeaning["object"];
  draftMeaning?: string;
  confirmedMeanings: ConfirmedMeaning[];
  transformationRequest?: TransformationRequest;
  reflection?: string;
  messages: ChatMessage[];
  toolError?: string;
}

export interface AgentTurn {
  assistantText: string;
  suggestedChoices?: string[];
  uiAction: UiAction;
  usedTool?: "analyze_drawing" | "transform_world";
  isSafetyRedirect?: boolean;
}

export type HtpEvent =
  | { type: "start" }
  | { type: "mood_recorded"; mood: number }
  | { type: "drawing_submitted"; imageBase64: string }
  | { type: "vision_continue" }
  | { type: "vision_redraw" }
  | { type: "vision_retry" }
  | { type: "object_selected"; object: ConfirmedMeaning["object"] }
  | { type: "meaning_submitted"; meaning: string }
  | { type: "meaning_confirmed" }
  | { type: "meaning_edit" }
  | { type: "changes_submitted"; changes: string[] }
  | { type: "reflection_submitted"; mood: number; reflection?: string };

export const createSession = (): HtpSession => ({
  id: crypto.randomUUID(),
  phase: "mood_check",
  confirmedMeanings: [],
  messages: [],
});
