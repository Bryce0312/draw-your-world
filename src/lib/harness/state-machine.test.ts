import { describe, expect, it } from "vitest";
import { assertEventAllowed, toolsForPhase } from "./state-machine";
import { createSession } from "./types";

describe("HTP state machine", () => {
  it("does not allow direct transformation from drawing", () => {
    const session = createSession(); session.phase = "drawing";
    expect(() => assertEventAllowed(session, { type: "changes_submitted", changes: ["add sunlight"] })).toThrow();
  });

  it("only exposes image analysis during vision check", () => {
    expect(toolsForPhase("drawing")).toEqual([]);
    expect(toolsForPhase("vision_check")).toEqual(["analyze_drawing"]);
  });

  it("only exposes image transformation during transformation", () => {
    expect(toolsForPhase("transformation_request")).toEqual([]);
    expect(toolsForPhase("transforming")).toEqual(["transform_world"]);
  });

  it("allows a user to submit meaning before confirming it", () => {
    const session = createSession(); session.phase = "confirmation";
    expect(() => assertEventAllowed(session, { type: "meaning_submitted", meaning: "这棵树像我自己" })).not.toThrow();
  });
});
