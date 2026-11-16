import { describe, expect, it } from "vitest";
import { initialState, readStored, saveDraft, sharingPreview, STORAGE_KEY, writeStored } from "./model";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

describe("front-end prototype privacy boundaries", () => {
  it("never persists a temporary draft, conversation, post or booking context", () => {
    const store = memoryStorage();
    const state = initialState(); state.draft.image = "data:image/png;base64,YQ==";
    state.draft.messages.push({ id: "m", role: "user", text: "private thought" });
    state.booking = { id: "b", serviceId: "sample", format: "text", date: "2026-11-16", time: "10:00", price: 30, status: "draft", consent: false, shareFields: [], context: structuredClone(state.draft) };
    expect(writeStored(state, store).ok).toBe(true);
    expect(store.getItem(STORAGE_KEY)).not.toContain("private thought");
    expect(store.getItem(STORAGE_KEY)).not.toContain("base64");
    expect(readStored(store).draft.messages).toEqual([]);
    expect(readStored(store).booking).toBeNull();
  });

  it("requires explicit save consent and keeps the prior image when a revision is saved", () => {
    let state = initialState(); state.draft.image = "data:image/png;base64,YQ==";
    expect(saveDraft(state).gallery).toHaveLength(0);
    state.draft.saveConsent = true; state = saveDraft(state);
    state.draft.image = "data:image/png;base64,Yg=="; state = saveDraft(state);
    expect(state.gallery).toHaveLength(2);
    expect(state.gallery[1].image).toBe("data:image/png;base64,YQ==");
    expect(saveDraft(state).gallery).toHaveLength(2);
    const store = memoryStorage(); expect(writeStored(state, store).ok).toBe(true);
    expect(readStored(store).gallery).toHaveLength(2);
  });

  it("reveals only currently selected fields and never labels AI messages as user words", () => {
    const { draft } = initialState(); draft.image = "data:image/png;base64,YQ==";
    draft.messages = [{ id: "user", role: "user", text: "My own words" }, { id: "ai", role: "assistant", text: "A suggestion" }];
    draft.confirmedWords = ["A reviewed summary"];
    expect(sharingPreview(draft, ["words"])).toEqual({ words: ["My own words"] });
    expect(sharingPreview(draft, [])).toEqual({});
    expect(sharingPreview(draft, ["summary"])).toEqual({ summary: ["A reviewed summary"] });
  });

  it("reports failed storage instead of claiming that an archive was saved", () => {
    const store = memoryStorage(); store.setItem = () => { throw new Error("quota"); };
    expect(writeStored(initialState(), store).ok).toBe(false);
  });
});
