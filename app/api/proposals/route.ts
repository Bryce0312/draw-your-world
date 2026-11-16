import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mutateSession } from "@/lib/studio/store";
import { acquire, eventIdSchema, failure, HttpError, readJson, requireSession, snapshot } from "@/lib/studio/http";

export const runtime = "nodejs";
const input = z.object({ proposalId: z.string().uuid(), changes: z.array(z.string().trim().min(1).max(400)).min(1).max(12), preserve: z.array(z.string().trim().min(1).max(400)).max(12), summary: z.string().trim().min(1).max(800).optional(), baseVersion: z.number().int().nonnegative().optional(), eventId: eventIdSchema.optional() }).strict();
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    const session = requireSession(request); const body = input.parse(await readJson(request)); release = acquire(session.id);
    mutateSession(session.id, s => {
      if (body.baseVersion !== undefined && body.baseVersion > s.version) throw new HttpError("会话已更新，请刷新后重试。", 409);
      if (s.status !== "active") throw new HttpError("这次体验已经结束。");
      const p = s.proposals.find(p => p.id === body.proposalId);
      if (!p || p.status !== "draft" || p.artworkVersion !== s.artworkVersion || p.sourceAssetId !== s.activeAssetId) throw new HttpError("这份建议已经变化，请根据当前画面重新整理。", 409);
      // A preview is immutable: another tab cannot approve a request that changed
      // after it was displayed. Editing produces a new authorization identity.
      p.status = "stale";
      s.proposals.push({ ...p, id: crypto.randomUUID(), status: "draft", changes: body.changes, preserve: body.preserve, summary: body.summary ?? body.changes.join("；"), createdAt: new Date().toISOString() });
    });
    return NextResponse.json(snapshot(session.id));
  } catch (error) { return failure(error); } finally { release?.(); }
}
