import { randomUUID } from "node:crypto";
import { DRAWING_KINDS, type WallSession, type WallWork, type WallShare, type ProfessionalPacket } from "./types";
import { DRAFT_LIFETIME_MS, readCloudWall, storageMode, WallError, wallMode, writeCloudWall, type CloudWallRecord } from "./wall-storage";
export { storageMode, WallError, wallMode } from "./wall-storage";
export { storeWallImage, readWallImage, resolveWallImage, pruneWallDrafts } from "./image-storage";

const versions = new WeakMap<WallSession, { version: string | null; storage: "local" | "cloud"; id: string; mode: "demo" | "live" }>();

export async function loadWall(id?: string): Promise<WallSession | undefined> {
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return;
  const storage = storageMode();
  if (storage === "local") {
    const { readLocalWall } = await import("./sqlite-storage");
    const result = readLocalWall(id);
    if (!result) return;
    versions.set(result.session, { version: result.version, storage, id, mode: wallMode() });
    return result.session;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await readCloudWall(id);
    if (!result) return;
    let version = result.version;
    let session = result.record.working ?? result.record.retained;
    if (result.record.working && (!result.record.expiresAt || !Number.isFinite(Date.parse(result.record.expiresAt)) || Date.parse(result.record.expiresAt) <= Date.now())) {
      const expired: CloudWallRecord = { schema: 1, expiresAt: null, retained: result.record.retained };
      try {
        version = await writeCloudWall(id, expired, version);
        session = expired.retained;
      } catch (error) {
        // A request that refreshed the draft wins over this cleanup attempt.
        if (error instanceof WallError && error.status === 409) continue;
        throw error;
      }
    }
    versions.set(session, { version, storage, id, mode: wallMode() });
    return session;
  }
  throw new WallError("This drawing collection is being updated. Try loading it again.", 409);
}
/** Raw conversation persistence has its own permission, separate from retaining a drawing record. */
export function persistedWall(session: WallSession): WallSession {
  const works = session.works.filter(w => w.status === "saved" && w.saveConsent).map(w => ({ ...structuredClone(w), messages: w.conversationConsent ? structuredClone(w.messages) : [], summary: w.summary.confirmed ? structuredClone(w.summary) : {text:"",confirmed:false,revision:w.revision}, kind: w.summary.confirmed ? w.kind : undefined }));
  return { ...session, works, activeWorkId: works.some(w => w.id === session.activeWorkId) ? session.activeWorkId : null, shares: session.shares.filter(s => works.some(w => w.id === s.workId)) };
}
export async function writeWall(session: WallSession): Promise<void> {
  const state = versions.get(session);
  if (!state || state.storage !== storageMode() || state.id !== session.id || state.mode !== wallMode()) {
    throw new WallError("Reload this drawing collection before saving changes.", 409);
  }
  const retained = persistedWall(session);
  let version: string;
  if (state.storage === "cloud") {
    const record: CloudWallRecord = {
      schema: 1,
      expiresAt: new Date(Date.now() + DRAFT_LIFETIME_MS).toISOString(),
      working: session,
      retained,
    };
    if (Buffer.byteLength(JSON.stringify(record)) > 3 * 1024 * 1024) {
      throw new WallError("This drawing collection is full. Remove a drawing or shorten the current conversation before saving more.", 413);
    }
    version = await writeCloudWall(session.id, record, state.version);
  } else {
    const { writeLocalWall } = await import("./sqlite-storage");
    version = writeLocalWall(session, retained, state.version);
  }
  versions.set(session, { ...state, version });
}
export async function newWall(): Promise<WallSession> {
  const session: WallSession = { id: randomUUID(), name: "", works: [], activeWorkId: null, shares: [], createdAt: new Date().toISOString() };
  versions.set(session, { version: null, storage: storageMode(), id: session.id, mode: wallMode() });
  await writeWall(session);
  return session;
}
export function workOf(session: WallSession, id: string): WallWork {
  const work = session.works.find(w => w.id === id); if (!work) throw new WallError("This drawing is not in your collection.", 404); return work;
}
export function createWork(session: WallSession, image: string, mode: "draw" | "shapes", title?: string) {
  if (session.works.length >= 40) throw new WallError("Your collection holds 40 drawings. Remove one before adding another.", 409);
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
