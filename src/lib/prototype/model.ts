import { z } from "zod";

/** State for the front-end-only walkthrough. Never send this to the live studio API. */
export type CreativeMode = "draw" | "shapes";
export type ShareField = "artwork" | "words" | "summary";
export interface Profile { name: string; createdAt: string }
export interface Message { id: string; role: "user" | "assistant"; text: string }
export interface Draft {
  id: string;
  title: string;
  mode: CreativeMode;
  image?: string;
  createdAt: string;
  aiConsent: boolean | null;
  saveConsent: boolean | null;
  messages: Message[];
  notes: string[];
  confirmedWords: string[];
  mood?: number;
  feedbackStyle: "words" | "quiet" | "letter";
  reflection: string;
  cardText: string;
}
export interface SavedWork extends Draft { savedAt: string; saveConsent: true; sourceDraftId?: string }
export interface DemoPost {
  id: string;
  text: string;
  anonymousName: string;
  createdAt: string;
  workId?: string;
  includeArtwork: boolean;
  includeWords: boolean;
  includeSummary: boolean;
  published: boolean;
}
export interface Booking {
  id: string;
  serviceId: string;
  format: "text" | "voice" | "inperson";
  date: string;
  time: string;
  shareFields: ShareField[];
  consent: boolean;
  status: "draft" | "confirmed" | "cancelled";
  price: number;
  contextWorkId?: string;
  context?: Draft;
}
export interface PrototypeState {
  profile: Profile | null;
  draft: Draft;
  gallery: SavedWork[];
  posts: DemoPost[];
  booking: Booking | null;
  bookings: Booking[];
  storageWarning?: string;
}

export const STORAGE_KEY = "dyw-story-prototype-v3";
type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createDraft(mode: CreativeMode = "draw"): Draft {
  return {
    id: crypto.randomUUID(), title: "An untitled postcard", mode,
    createdAt: new Date().toISOString(), aiConsent: null, saveConsent: null,
    messages: [], notes: [], confirmedWords: [], feedbackStyle: "words",
    reflection: "", cardText: "",
  };
}

export function initialState(): PrototypeState {
  return { profile: null, draft: createDraft(), gallery: [], posts: [], booking: null, bookings: [] };
}

const shortText = z.string().max(4000);
const savedWorkSchema = z.object({
  id: z.string().max(100), title: z.string().max(160), mode: z.enum(["draw", "shapes"]),
  image: z.string().max(8_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/).optional(),
  createdAt: z.string().datetime(), savedAt: z.string().datetime(), sourceDraftId: z.string().max(100).optional(),
  aiConsent: z.boolean().nullable(), saveConsent: z.literal(true),
  messages: z.array(z.object({ id: z.string().max(100), role: z.enum(["user", "assistant"]), text: shortText })).max(100),
  notes: z.array(shortText).max(30), confirmedWords: z.array(shortText).max(30),
  mood: z.number().int().min(1).max(5).optional(),
  feedbackStyle: z.enum(["words", "quiet", "letter"]), reflection: shortText, cardText: shortText,
});
const storedSchema = z.object({
  version: z.literal(3),
  profile: z.object({ name: z.string().trim().min(1).max(60), createdAt: z.string().datetime() }).nullable(),
  gallery: z.array(savedWorkSchema).max(30),
});

function browserStorage(): BrowserStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

/** Reload restores explicitly archived works, never an unconsented working draft. */
export function readStored(storage?: BrowserStorage): PrototypeState {
  const fresh = initialState();
  try {
    const raw = (storage ?? browserStorage())?.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const stored = storedSchema.safeParse(JSON.parse(raw));
    if (!stored.success) return { ...fresh, storageWarning: "The saved prototype data could not be read. You can start a new visit." };
    return { ...fresh, profile: stored.data.profile, gallery: stored.data.gallery };
  } catch {
    return { ...fresh, storageWarning: "Browser storage is unavailable. Download anything you want to keep before leaving." };
  }
}

/** Explicit allowlist: transient conversation, community and bookings are not persisted. */
export function writeStored(state: PrototypeState, storage?: BrowserStorage): { ok: boolean; error?: string } {
  try {
    const target = storage ?? browserStorage();
    if (!target) return { ok: false, error: "Browser storage is unavailable." };
    const validated = storedSchema.safeParse({ version: 3, profile: state.profile, gallery: state.gallery });
    if (!validated.success) return { ok: false, error: "This visit could not be saved. Keep a downloaded copy before leaving." };
    target.setItem(STORAGE_KEY, JSON.stringify(validated.data));
    return { ok: true };
  } catch {
    return { ok: false, error: "There is not enough browser storage. Download this picture, or remove an older saved postcard." };
  }
}

/** The Save page is a separate action; merely checking permission never archives a work. */
export function saveDraft(state: PrototypeState): PrototypeState {
  if (!state.draft.saveConsent || !state.draft.image) return state;
  const matching = state.gallery.find(work => (work.id === state.draft.id || work.sourceDraftId === state.draft.id) && work.image === state.draft.image);
  const revised = state.gallery.some(work => work.id === state.draft.id || work.sourceDraftId === state.draft.id);
  const saved: SavedWork = {
    ...structuredClone(state.draft), id: matching?.id ?? (revised ? crypto.randomUUID() : state.draft.id),
    sourceDraftId: state.draft.id, saveConsent: true, savedAt: new Date().toISOString(),
  };
  const withoutCurrent = state.gallery.filter(work => work.id !== saved.id);
  if (withoutCurrent.length >= 30) return { ...state, storageWarning: "Your local box holds 30 postcards. Download or remove one before adding another." };
  return { ...state, gallery: [saved, ...withoutCurrent], storageWarning: undefined };
}

/** Professional/community previews derive from current permission on every render. */
export function sharingPreview(draft: Draft, fields: ShareField[]) {
  return {
    ...(fields.includes("artwork") && draft.image ? { artwork: draft.image } : {}),
    ...(fields.includes("words") ? { words: draft.messages.filter(message => message.role === "user").map(message => message.text) } : {}),
    ...(fields.includes("summary") ? { summary: [...draft.confirmedWords] } : {}),
  };
}

/** A saved work opens as a new visit, without inheriting previous AI/storage authorization. */
export function revisitWork(work: SavedWork): Draft {
  // Saved artwork is a flattened image; reopen it on the drawing surface as a new copy.
  return { ...createDraft("draw"), title: work.title, image: work.image, mood: work.mood };
}
