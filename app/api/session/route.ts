import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createStudioSession, deleteSession, getSession, getCapabilities } from "@/lib/studio/store";
import { deleteConversationThread } from "@/lib/studio/conversation";
import { COOKIE, acquire, failure, readJson, snapshot } from "@/lib/studio/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function respond(id: string, request: NextRequest) {
  const response = NextResponse.json(snapshot(id), { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(COOKIE, id, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 86_400 });
  return response;
}
export async function GET(request: NextRequest) {
  try {
    const oldId = request.cookies.get(COOKIE)?.value;
    let existing: string | undefined;
    try { if (oldId && getSession(oldId).mode === getCapabilities().mode) existing = oldId; } catch { /* Expired data starts again. */ }
    return respond(existing ?? createStudioSession().id, request);
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    z.object({ action: z.literal("reset") }).strict().parse(await readJson(request));
    const oldId = request.cookies.get(COOKIE)?.value;
    let existing: string | undefined;
    try { if (oldId && getSession(oldId)) existing = oldId; } catch { /* Reset repairs stale cookies. */ }
    if (existing) { release = acquire(existing); await deleteConversationThread(existing); deleteSession(existing); }
    return respond(createStudioSession().id, request);
  } catch (error) { return failure(error); }
  finally { release?.(); }
}
