import { getStore } from "@netlify/blobs";
import type { WallSession } from "./types";

export class WallError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function wallMode(): "demo" | "live" {
  if (process.env.STUDIO_MODE === "live") return "live";
  if (process.env.STUDIO_MODE === "demo") return "demo";
  return storageMode() === "cloud" ? "demo" : "live";
}

export function storageMode(): "local" | "cloud" {
  const runtime = globalThis as typeof globalThis & { netlifyBlobsContext?: unknown };
  const cloud = process.env.WALL_STORAGE === "netlify" || process.env.NETLIFY === "true" || process.env.DYW_NETLIFY_BUILD === "1" || Boolean(process.env.NETLIFY_BLOBS_CONTEXT) || Boolean(runtime.netlifyBlobsContext);
  return cloud ? "cloud" : "local";
}

export const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1_000;

export interface CloudWallRecord {
  schema: 1;
  expiresAt: string | null;
  working?: WallSession;
  retained: WallSession;
}

export interface CloudWallRead {
  record: CloudWallRecord;
  version: string;
}

function boundedStorageFetch(deadline: number): typeof fetch {
  return async (input, init) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return new Response("Storage time budget reached.", { status: 408 });
    try {
      const response = await fetch(input, { ...init, signal: AbortSignal.timeout(Math.min(4_000, remaining)) });
      // Avoid the SDK's automatic retries after an ambiguous storage response.
      // The caller reloads the current record before explicitly trying again.
      if (response.status === 403 || response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        return new Response("Storage request is temporarily unavailable.", { status: 408 });
      }
      return response;
    } catch {
      return new Response("Storage request timed out.", { status: 408 });
    }
  };
}

export function wallBlobStore(kind: "sessions" | "images", mode = wallMode(), deadline?: number) {
  const namespace = (process.env.WALL_STORAGE_NAMESPACE || "white-wall").replace(/[^a-zA-Z0-9_-]/g, "-");
  return getStore({ name: `draw-your-world-${namespace}-${mode}-${kind}`, consistency: "strong", fetch: boundedStorageFetch(deadline ?? Date.now() + 3_000) });
}

export async function readCloudWall(id: string, mode = wallMode(), deadline?: number): Promise<CloudWallRead | undefined> {
  let result;
  try {
    result = await wallBlobStore("sessions", mode, deadline).getWithMetadata(id, { type: "json", consistency: "strong" });
  } catch {
    throw new WallError("Drawing storage is temporarily unavailable. Please try loading your collection again.", 503);
  }
  if (!result) return;
  const record = result.data as CloudWallRecord | null;
  if (!result.etag || record?.schema !== 1 || record.retained?.id !== id || (record.working && record.working.id !== id)) {
    throw new WallError("This drawing collection could not be loaded. Please try again.", 503);
  }
  return { record, version: result.etag };
}

export async function writeCloudWall(id: string, record: CloudWallRecord, version: string | null, mode = wallMode(), deadline?: number): Promise<string> {
  const condition = version === null ? { onlyIfNew: true as const } : { onlyIfMatch: version };
  let result;
  try {
    result = await wallBlobStore("sessions", mode, deadline).setJSON(id, record, condition);
  } catch {
    throw new WallError("Storage did not confirm these changes. Reload the collection to check what was saved before trying again.", 503);
  }
  if (!result.modified) {
    throw new WallError("This drawing collection changed in another request. Reload the current version and try again.", 409);
  }
  if (!result.etag) {
    throw new WallError("The storage response was incomplete. Reload to check whether your changes were saved.", 503);
  }
  return result.etag;
}
