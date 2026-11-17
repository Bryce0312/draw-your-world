import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadWall, newWall, storageMode, wallMode, WallError } from "./store";
import type { WallSession, WallSnapshot } from "./types";

export const wallCookie = () => `drawing_wall_${wallMode()}`;

export async function currentWall(request: NextRequest) {
  return await loadWall(request.cookies.get(wallCookie())?.value) ?? await newWall();
}

export function wallSnapshot(session: WallSession): WallSnapshot {
  const available = wallMode() === "demo" || !!process.env.DEEPSEEK_API_KEY;
  return { session, mode: wallMode(), storage: storageMode(), capabilities: { ai: available, observation: available, professionalDemo: true } };
}

export function wallResponse(request: NextRequest, session: WallSession, payload: unknown, status = 200) {
  const result = NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
  result.cookies.set(wallCookie(), session.id, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return result;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const target = new URL(request.url);
  const host = request.headers.get("host") || target.host;
  try {
    const source = new URL(origin);
    if (source.host.toLowerCase() === host.toLowerCase() && source.protocol === target.protocol) return;
  } catch { /* Malformed origins cannot authorize a mutation. */ }
  throw new WallError("Open this action from the drawing page.", 403);
}

export async function boundedBody(request: Request, maximum: number) {
  sameOrigin(request);
  if (Number(request.headers.get("content-length")) > maximum) throw new WallError("This upload is too large. Try a smaller picture.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WallError("This action is empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new WallError("This upload is too large. Try a smaller picture.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function readWallJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new WallError("Send this action as JSON.", 415);
  // Legacy local callers may still send data URLs. Cloud UI uploads binary files separately.
  const bytes = await boundedBody(request, storageMode() === "cloud" ? 4_000_000 : 9_000_000);
  try { return JSON.parse(bytes.toString("utf8")) as unknown; }
  catch { throw new WallError("This action could not be read. Please retry."); }
}

const singleton = globalThis as typeof globalThis & { wallBusy?: Set<string> };
const busy = singleton.wallBusy ??= new Set<string>();
export function acquireWall(id: string) {
  if (busy.has(id)) throw new WallError("The previous action is still finishing. Your input is kept; try again shortly.", 409);
  busy.add(id);
  return () => busy.delete(id);
}

export async function wallFailure(request: NextRequest, error: unknown, session?: WallSession) {
  const message = error instanceof WallError ? error.message : error instanceof z.ZodError
    ? "This action is incomplete. Check your choices and try again."
    : "The action did not finish. Keep this page open and try again.";
  const status = error instanceof WallError ? error.status : error instanceof z.ZodError ? 400 : 503;
  if (session) {
    // A CAS conflict must return the current stored state, never retry an obsolete write.
    try {
      const latest = await loadWall(session.id);
      if (latest) return wallResponse(request, latest, { ...wallSnapshot(latest), error: message }, status);
    } catch { /* A storage outage cannot be presented as a successful save. */ }
  }
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
