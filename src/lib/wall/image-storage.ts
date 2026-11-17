import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { WallSession } from "./types";
import { DRAFT_LIFETIME_MS, readCloudWall, storageMode, WallError, wallBlobStore, wallMode, writeCloudWall, type CloudWallRecord } from "./wall-storage";

const SESSION_ID = /^[a-f0-9-]{36}$/i;
const IMAGE_ID = /^[a-f0-9]{64}$/;
const IMAGE_PATH = /^\/api\/wall\/images\/([a-f0-9]{64})$/;
const extensions = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" } as const;
type ImageType = keyof typeof extensions;

function localDirectory(sessionId: string) {
  return path.resolve(process.env.STUDIO_DATA_DIR || path.join(process.cwd(), ".data"), `wall-images-${wallMode()}`, sessionId);
}

function references(session: WallSession): Set<string> {
  return new Set(session.works.flatMap(work => [work.image, work.originalImage]));
}

export async function storeWallImage(sessionId: string, dataUrl: string): Promise<string> {
  if (!SESSION_ID.test(sessionId)) throw new WallError("This drawing collection could not be found.", 404);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  if (!match) throw new WallError("Upload a PNG, JPEG, or WebP drawing.");
  const contentType = match[1] as ImageType;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new WallError("This drawing file is too large. Try a smaller image.", 413);
  // Each upload is immutable, including a later upload of identical pixels.
  const id = createHash("sha256").update(sessionId).update(randomUUID()).update(bytes).digest("hex");
  if (storageMode() === "cloud") {
    const result = await wallBlobStore("images").set(`${sessionId}/${id}`, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
      onlyIfNew: true,
      metadata: { contentType, createdAt: new Date().toISOString(), sessionId },
    });
    if (!result.modified || !result.etag) throw new WallError("This drawing image could not be saved. Please try uploading it again.", 503);
  } else {
    const directory = localDirectory(sessionId);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `${id}.${extensions[contentType]}`), bytes, { flag: "wx" });
  }
  return `/api/wall/images/${id}`;
}

export async function readWallImage(session: WallSession, imageId: string): Promise<{ bytes: Uint8Array; contentType: string } | undefined> {
  if (!SESSION_ID.test(session.id) || !IMAGE_ID.test(imageId) || !references(session).has(`/api/wall/images/${imageId}`)) return;
  if (storageMode() === "cloud") {
    const result = await wallBlobStore("images").getWithMetadata(`${session.id}/${imageId}`, { type: "arrayBuffer", consistency: "strong" });
    if (!result || result.metadata.sessionId !== session.id) return;
    const contentType = result.metadata.contentType;
    if (typeof contentType !== "string" || !Object.hasOwn(extensions, contentType)) return;
    return { bytes: new Uint8Array(result.data), contentType };
  }
  for (const [contentType, extension] of Object.entries(extensions)) {
    try {
      const bytes = await fs.readFile(path.join(localDirectory(session.id), `${imageId}.${extension}`));
      return { bytes, contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function resolveWallImage(session: WallSession, image: string): Promise<string> {
  if (/^data:image\/(?:png|jpeg|webp);base64,/.test(image)) return image;
  const match = IMAGE_PATH.exec(image);
  const result = match ? await readWallImage(session, match[1]) : undefined;
  if (!result) throw new WallError("This drawing image is unavailable. Reopen the drawing or upload it again.", 404);
  return `data:${result.contentType};base64,${Buffer.from(result.bytes).toString("base64")}`;
}

function expired(record: CloudWallRecord, now: number) {
  return Boolean(record.working && (!record.expiresAt || !Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= now));
}

async function cleanupBatch(kind: "sessions" | "images", mode: "demo" | "live", offset: number, deadline: number, visit: (key: string) => Promise<void>) {
  if (Date.now() >= deadline) return { offset, limited: true };
  let index = 0;
  let processed = 0;
  for await (const page of wallBlobStore(kind, mode, deadline).list({ paginate: true })) {
    for (const blob of page.blobs) {
      if (Date.now() >= deadline) return { offset: Math.max(offset, index), limited: true };
      if (index++ < offset) continue;
      await visit(blob.key);
      processed++;
      if (processed >= 100) return { offset: index, limited: true };
    }
  }
  return { offset: 0, limited: false };
}

async function pruneMode(mode: "demo" | "live", now: number, deadline: number) {
  if (Date.now() >= deadline) return { sessions: 0, images: 0, limited: true };
  const stateStore = wallBlobStore("sessions", mode, deadline);
  const cursor = await stateStore.get("_cleanup", { type: "json", consistency: "strong" }) as { sessions?: number; images?: number } | null;
  const sessionOffset = typeof cursor?.sessions === "number" && Number.isSafeInteger(cursor.sessions) && cursor.sessions >= 0 ? cursor.sessions : 0;
  const imageOffset = typeof cursor?.images === "number" && Number.isSafeInteger(cursor.images) && cursor.images >= 0 ? cursor.images : 0;
  let cleanedSessions = 0;
  let cleanedImages = 0;
  const sessionBatch = await cleanupBatch("sessions", mode, sessionOffset, deadline - 5_000, async key => {
    if (!SESSION_ID.test(key)) return;
    const current = await readCloudWall(key, mode, deadline);
    if (current && expired(current.record, now)) {
      const retained: CloudWallRecord = { schema: 1, expiresAt: null, retained: current.record.retained };
      try {
        await writeCloudWall(key, retained, current.version, mode, deadline);
        cleanedSessions++;
      } catch (error) {
        if (error instanceof WallError && error.status === 409) return;
        throw error;
      }
    }
  });
  const images = wallBlobStore("images", mode, deadline);
  const imageBatch = await cleanupBatch("images", mode, imageOffset, deadline - 500, async key => {
    const [sessionId, imageId, extra] = key.split("/");
    if (extra || !SESSION_ID.test(sessionId) || !IMAGE_ID.test(imageId)) return;
    const current = await readCloudWall(sessionId, mode, deadline);
    const session = current && (current.record.working ?? current.record.retained);
    if (session && references(session).has(`/api/wall/images/${imageId}`)) return;
    const metadata = await images.getMetadata(key, { consistency: "strong" });
    const createdAt = metadata?.metadata.createdAt;
    if (typeof createdAt !== "string" || Date.parse(createdAt) > now - DRAFT_LIFETIME_MS || !Number.isFinite(Date.parse(createdAt))) return;
    await images.delete(key);
    cleanedImages++;
  });
  await stateStore.setJSON("_cleanup", { sessions: sessionBatch.offset, images: imageBatch.offset });
  return { sessions: cleanedSessions, images: cleanedImages, limited: sessionBatch.limited || imageBatch.limited };
}

/** Processes both namespaces with a shared 20-second budget and stored cursors. */
export async function pruneWallDrafts(): Promise<{ sessions: number; images: number; limited: boolean }> {
  if (storageMode() !== "cloud") return { sessions: 0, images: 0, limited: false };
  const now = Date.now();
  const demo = await pruneMode("demo", now, now + 10_000);
  const live = await pruneMode("live", now, now + 20_000);
  return { sessions: demo.sessions + live.sessions, images: demo.images + live.images, limited: demo.limited || live.limited };
}
