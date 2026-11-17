export type WallMode = "live" | "demo";
export interface WallMessage { id: string; role: "user" | "assistant"; content: string; createdAt: string }
export interface DrawingKind { code: string; name: string; description: string; reason: string; source?: "user" | "ai" | "demo" }
export interface WallWork {
  id: string; title: string; image: string; originalImage: string; mode: "draw" | "shapes"; createdAt: string; updatedAt: string;
  revision: number; aiConsent: boolean; saveConsent: boolean; conversationConsent: boolean;
  observation: { status: "idle" | "ready" | "failed" | "demo"; items: string[]; uncertainties: string[] };
  messages: WallMessage[]; summary: { text: string; confirmed: boolean; revision: number };
  kind?: DrawingKind; mood?: number; reflection: string; status: "draft" | "saved";
  interview?: { answers: Record<string, string>; consent: true; submittedAt: string };
}
export interface WallShare {
  id: string; workId: string; includeArtwork: boolean; includeSummary: boolean;
  revision: number; createdAt: string; revokedAt?: string;
}
export interface WallSession { id: string; name: string; works: WallWork[]; activeWorkId: string | null; shares: WallShare[]; createdAt: string }
export interface WallSnapshot {
  session: WallSession; mode: WallMode;
  capabilities: { ai: boolean; observation: boolean; professionalDemo: true };
  error?: string;
}
export interface ProfessionalPacket {
  id: string; createdAt: string; title: string; image?: string; summary?: string;
  label: "Local professional preview · not sent to a real professional";
}
export type WallAction =
  | { action: "profile"; name: string }
  | { action: "create_work"; image: string; title?: string; mode: "draw" | "shapes" }
  | { action: "consent"; workId: string; aiConsent: boolean; saveConsent: boolean; conversationConsent?: boolean }
  | { action: "observe" | "summarize" | "suggest_kind" | "save" | "delete_work" | "select_work"; workId: string }
  | { action: "message"; workId: string; text: string }
  | { action: "confirm_summary"; workId: string; text: string }
  | { action: "choose_kind"; workId: string; code: string | null }
  | { action: "update_work"; workId: string; title?: string; mood?: number | null; reflection?: string; image?: string; mode?: "draw" | "shapes" }
  | { action: "share"; workId: string; includeArtwork: boolean; includeSummary: boolean; confirmed: true; expectedRevision: number }
  | { action: "revoke_share"; shareId: string }
  | { action: "interview"; workId: string; answers: Record<string, string>; consent: true };

/** Fictional drawing postcards, never personality classes or image-derived diagnoses. */
const kindNames = ["Pocket Observatory", "Cloud Inspection Office", "Tiny Detour Department", "Window Seat Weather", "One More Line Club", "Quiet Confetti", "Mossy Moon Station", "Unfinished Parade", "Pebble Think Tank", "Midnight Pencil Meeting", "Soft Edges Society", "Sideways Sunshine", "Little Orbit Workshop", "Daydream Postmark", "Careful Chaos Corner", "Room for One More Dot"];
export const DRAWING_KINDS: DrawingKind[] = kindNames.map((name, i) => ({
  code: `${i & 8 ? "O" : "U"}${i & 4 ? "G" : "C"}${i & 2 ? "D" : "A"}${i & 1 ? "Z" : "V"}`,
  name, description: "A playful name for this drawing visit, not a fixed label for you.", reason: "Choose it if it fits today, change it, or leave it out.",
}));
