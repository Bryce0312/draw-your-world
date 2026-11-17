import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DRAWING_KINDS, type WallSession, type WallWork, type WallShare, type ProfessionalPacket, type WallMode } from "./types";

export class WallError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const wallMode = (): WallMode => process.env.STUDIO_MODE === "demo" ? "demo" : "live";
const runtime = globalThis as typeof globalThis & { wallMem?: Map<string, WallSession>; wallDbs?: Map<string, DatabaseSync> };
const memory = runtime.wallMem ??= new Map<string, WallSession>();
const databases = runtime.wallDbs ??= new Map<string, DatabaseSync>();
function location() { return path.resolve(process.env.STUDIO_DATA_DIR || path.join(process.cwd(), ".data"), `wall-${wallMode()}.sqlite`); }
function database() {
  const file = location(); let db = databases.get(file);
  if (!db) { fs.mkdirSync(path.dirname(file), { recursive: true }); db = new DatabaseSync(file); db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS wall_sessions(id TEXT PRIMARY KEY, payload TEXT NOT NULL)"); databases.set(file, db); }
  return db;
}
const key = (id: string) => `${location()}:${id}`;
export function loadWall(id?: string): WallSession | undefined {
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return;
  const cached = memory.get(key(id)); if (cached) return structuredClone(cached);
  const row = database().prepare("SELECT payload FROM wall_sessions WHERE id = ?").get(id) as {payload: string} | undefined;
  if (!row) return;
  const result = JSON.parse(row.payload) as WallSession; memory.set(key(id), result); return structuredClone(result);
}
/** Raw conversation persistence has its own permission, separate from retaining a drawing record. */
export function persistedWall(session: WallSession): WallSession {
  const works = session.works.filter(w => w.status === "saved" && w.saveConsent).map(w => ({ ...structuredClone(w), messages: w.conversationConsent ? structuredClone(w.messages) : [], summary: w.summary.confirmed ? structuredClone(w.summary) : {text:"",confirmed:false,revision:w.revision}, kind: w.summary.confirmed ? w.kind : undefined }));
  return { ...session, works, activeWorkId: works.some(w => w.id === session.activeWorkId) ? session.activeWorkId : null, shares: session.shares.filter(s => works.some(w => w.id === s.workId)) };
}
export function writeWall(session: WallSession) {
  database().prepare("INSERT INTO wall_sessions(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(session.id, JSON.stringify(persistedWall(session)));
  memory.set(key(session.id), structuredClone(session));
}
export function newWall(): WallSession {
  const session: WallSession = { id: randomUUID(), name: "", works: [], activeWorkId: null, shares: [], createdAt: new Date().toISOString() }; writeWall(session); return session;
}
export function workOf(session: WallSession, id: string): WallWork {
  const work = session.works.find(w => w.id === id); if (!work) throw new WallError("This drawing is not in your collection.", 404); return work;
}
export function createWork(session: WallSession, image: string, mode: "draw" | "shapes", title?: string) {
  if (session.works.length >= 40) throw new WallError("Your local collection holds 40 drawings. Remove one before adding another.", 409);
  const now = new Date().toISOString();
  const work: WallWork = { id: randomUUID(), title: title || "An untitled drawing", image, originalImage: image, mode, createdAt: now, updatedAt: now, revision: 0, aiConsent: false, saveConsent: false, conversationConsent: false, observation: { status: "idle", items: [], uncertainties: [] }, messages: [], summary: { text: "", confirmed: false, revision: 0 }, reflection: "", status: "draft" };
  session.works.unshift(work); session.activeWorkId = work.id; return work;
}
export function invalidateSummary(session: WallSession, work: WallWork) {
  work.revision++; work.summary.confirmed = false; work.kind = undefined; work.updatedAt = new Date().toISOString();
  for (const share of session.shares) if (share.workId === work.id && !share.revokedAt) share.revokedAt = work.updatedAt;
}
export function shareWork(session: WallSession, id: string, includeArtwork: boolean, includeSummary: boolean, confirmed: boolean, expectedRevision: number): WallShare {
  const work = workOf(session, id);
  if (!confirmed || (!includeArtwork && !includeSummary)) throw new WallError("Review and confirm at least one item to share.");
  if (expectedRevision !== work.revision) throw new WallError("This drawing record changed after your preview. Review the current version before sharing.", 409);
  if (includeSummary && (!work.summary.confirmed || work.summary.revision !== work.revision || !work.summary.text.trim())) throw new WallError("Review and confirm the current summary before sharing it.", 409);
  const existing = session.shares.find(s => s.workId === id && s.revision === work.revision && s.includeArtwork === includeArtwork && s.includeSummary === includeSummary && !s.revokedAt);
  // A confirmation replaces this work's scope; narrowing it must remove prior fields.
  // Validate first so a stale or incomplete preview never revokes a valid share.
  const now = new Date().toISOString();
  for (const share of session.shares) if (share.workId === id && !share.revokedAt && share.id !== existing?.id) share.revokedAt = now;
  if (existing) return existing;
  const share = { id: randomUUID(), workId: id, includeArtwork, includeSummary, revision: work.revision, createdAt: now }; session.shares.push(share); return share;
}
export function professionalPackets(session: WallSession): ProfessionalPacket[] {
  return session.shares.flatMap(share => {
    const work = session.works.find(w => w.id === share.workId);
    if (!work || share.revokedAt || share.revision !== work.revision) return [];
    if (share.includeSummary && (!work.summary.confirmed || work.summary.revision !== work.revision)) return [];
    return [{ id: share.id, createdAt: share.createdAt, title: "Shared drawing record", ...(share.includeArtwork ? { image: work.image } : {}), ...(share.includeSummary ? { summary: work.summary.text } : {}), label: "Local professional preview · not sent to a real professional" as const }];
  });
}
export function chooseKind(work: WallWork, code: string | null) {
  if (code === null) { work.kind = undefined; return; }
  const selected = DRAWING_KINDS.find(k => k.code === code); if (!selected) throw new WallError("Choose one of the drawing names, or skip this step.");
  if (!work.summary.confirmed) throw new WallError("Confirm your own record before choosing a drawing name.", 409);
  work.kind = { ...selected, source: "user", reason: "Chosen by you for this visit. You can change or remove this name." };
}
