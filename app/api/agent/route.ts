import { NextRequest } from "next/server";
import { z } from "zod";
import { converse } from "@/lib/studio/conversation";
import { cancelJob, acceptJobResult, discardJobResult } from "@/lib/studio/jobs";
import { claimEvent, finishEvent, abandonEvent, mutateSession, getSession } from "@/lib/studio/store";
import { acquire, eventIdSchema, failure, HttpError, readJson, requireSession, snapshot } from "@/lib/studio/http";
import type { StudioEvent, StudioStreamEvent } from "@/lib/studio/types";

export const runtime = "nodejs";
const id = z.string().uuid();
const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), text: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ type: z.literal("request_change"), kind: z.enum(["image", "video"]) }).strict(),
  z.object({ type: z.literal("reject_proposal"), proposalId: id }).strict(),
  z.object({ type: z.literal("accept_understanding"), proposalId: id }).strict(),
  z.object({ type: z.literal("accept_result"), jobId: id }).strict(),
  z.object({ type: z.literal("discard_result"), jobId: id }).strict(),
  z.object({ type: z.literal("cancel_job"), jobId: id }).strict(),
  z.object({ type: z.literal("complete"), text: z.string().trim().max(2000).optional(), mood: z.number().int().min(1).max(5).optional() }).strict(),
  z.object({ type: z.literal("record_mood"), mood: z.number().int().min(1).max(5) }).strict(),
]);
const input = z.object({ event: eventSchema, eventId: eventIdSchema, baseVersion: z.number().int().nonnegative() }).strict();
function appendReply(sessionId: string, content: string) {
  mutateSession(sessionId, s => { s.messages.push({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString() }); });
}
async function applyEvent(sessionId: string, event: StudioEvent, emit: (event: StudioStreamEvent) => void) {
  if (event.type === "message") { await converse(sessionId, event.text, emit); return; }
  if (event.type === "request_change") { await converse(sessionId, "", emit, { requestKind: event.kind }); return; }
  if (event.type === "cancel_job") { cancelJob(sessionId, event.jobId); return; }
  if (event.type === "accept_result") { acceptJobResult(sessionId, event.jobId); appendReply(sessionId, "This version is kept. We can talk about it a little more, or leave it here."); return; }
  if (event.type === "discard_result") { discardJobResult(sessionId, event.jobId); appendReply(sessionId, "That version is set aside. Your original is still here, just as you made it."); return; }
  mutateSession(sessionId, s => {
    if (event.type === "record_mood") { s.feedback = { ...s.feedback, moodBefore: event.mood }; return; }
    if (event.type === "complete") {
      s.feedback = { ...s.feedback, moodAfter: event.mood, text: event.text }; s.status = "complete";
      for (const job of s.jobs) if (["queued", "submitted", "running"].includes(job.status)) { job.status = "cancelled"; job.updatedAt = new Date().toISOString(); }
      for (const p of s.proposals) if (p.status === "draft" || p.status === "approved") p.status = "stale";
      s.messages.push({ id: crypto.randomUUID(), role: "assistant", content: "Thank you for sharing a little of your world. However you feel, this is a good place to pause if it feels right to you.", createdAt: new Date().toISOString() }); return;
    }
    const proposal = s.proposals.find(p => p.id === event.proposalId);
    if (!proposal || proposal.status !== "draft" || proposal.artworkVersion !== s.artworkVersion || proposal.sourceAssetId !== s.activeAssetId) throw new HttpError("这份建议已更新，请查看当前画面。", 409);
    if (event.type === "reject_proposal") {
      proposal.status = "rejected";
      if (proposal.kind === "understanding") s.rejectedInterpretations.push(proposal.summary);
      s.messages.push({ id: crypto.randomUUID(), role: "assistant", content: "We can leave that idea aside. Let's follow what matters to you.", createdAt: new Date().toISOString() });
    } else {
      if (proposal.kind !== "understanding") throw new HttpError("视觉变化需要在改动预览中单独确认。");
      proposal.status = "approved";
    }
  });
}
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    const initialSession = requireSession(request); const body = input.parse(await readJson(request));
    release = acquire(initialSession.id);
    const session = getSession(initialSession.id);
    const claim = claimEvent(session.id, body.eventId);
    if (claim === "pending") throw new HttpError("这条消息正在整理，请稍后查看。", 409);
    if (claim === "new") {
      try {
        if (session.status !== "active" && body.event.type !== "discard_result") throw new HttpError("这次体验已经结束。作品仍然可以查看和下载。");
        if (body.baseVersion > session.version) throw new HttpError("会话版本不一致，请刷新后重试。", 409);
      } catch (error) { abandonEvent(session.id, body.eventId); throw error; }
    }
    const unlock = release; release = undefined;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder(); let open = true;
        const emit = (event: StudioStreamEvent) => { if (open) { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch { open = false; } } };
        try {
          if (claim === "new") { await applyEvent(session.id, body.event, emit); finishEvent(session.id, body.eventId); }
          emit({ type: "state", session: snapshot(session.id).session });
        } catch (error) {
          abandonEvent(session.id, body.eventId);
          const response = failure(error); const payload = await response.json();
          emit({ type: "error", message: payload.error });
          emit({ type: "state", session: snapshot(session.id).session });
        } finally { unlock(); if (open) controller.close(); }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  } catch (error) { return failure(error); } finally { release?.(); }
}
