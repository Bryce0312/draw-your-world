import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { saveAsset, mutateSession, claimEvent, finishEvent, abandonEvent, getSession } from "@/lib/studio/store";
import { analyzeArtwork } from "@/lib/studio/providers";
import { acquire, eventIdSchema, failure, HttpError, readJson, requireSession, snapshot } from "@/lib/studio/http";

export const runtime = "nodejs";
const upload = z.object({ imageBase64: z.string().max(12_000_000), baseVersion: z.number().int().nonnegative(), eventId: eventIdSchema }).strict();
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined; let eventId: string | undefined; let sessionId: string | undefined; let claimed = false;
  try {
    const initialSession = requireSession(request); sessionId = initialSession.id;
    const body = upload.parse(await readJson(request, 12_100_000)); eventId = body.eventId;
    release = acquire(initialSession.id);
    const claim = claimEvent(initialSession.id, body.eventId);
    if (claim === "done") return NextResponse.json(snapshot(initialSession.id));
    if (claim === "pending") throw new HttpError("这张作品正在整理，请稍后查看。", 409);
    claimed = true;
    const session = getSession(initialSession.id);
    if (session.artworkVersion !== initialSession.artworkVersion) throw new HttpError("读取作品时画面已经更新，请检查当前画面后再提交。", 409);
    if (session.status !== "active") throw new HttpError("这次体验已经结束，请开启新的画室。");
    if (body.baseVersion > session.version) throw new HttpError("会话版本不一致，请刷新后重试。", 409);
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.imageBase64);
    if (!match) throw new HttpError("请提交 PNG、JPEG 或 WebP 作品。");
    let bytes: Buffer;
    try { bytes = await sharp(Buffer.from(match[2], "base64"), { limitInputPixels: 16_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#fffdf8" }).png().toBuffer(); }
    catch { throw new HttpError("这张作品无法读取，请回到画布重试。"); }
    const artworkVersion = session.artworkVersion + 1;
    const asset = saveAsset(session.id, bytes, { kind: "original", artworkVersion, mimeType: "image/png" });
    mutateSession(session.id, s => {
      if (!s.assets.some(a => a.id === asset.id)) s.assets.push(asset);
      s.artworkVersion = artworkVersion; s.originalAssetId = asset.id; s.activeAssetId = asset.id;
      s.observation = undefined; s.userStatements = []; s.rejectedInterpretations = [];
      for (const p of s.proposals) if (p.status === "draft" || p.status === "approved") p.status = "stale";
      for (const j of s.jobs) if (["queued", "submitted", "running"].includes(j.status)) { j.status = "cancelled"; j.updatedAt = new Date().toISOString(); }
    });
    let observation: { items: string[]; uncertainties: string[] } | undefined;
    if (session.mode === "live") {
      try { observation = await analyzeArtwork(bytes, "image/png"); } catch { /* An unavailable observer never blocks self-expression. */ }
    }
    mutateSession(session.id, s => {
      s.observation = { artworkVersion, status: observation ? "ready" : "failed", items: observation?.items ?? [], uncertainties: observation?.uncertainties ?? [] };
      s.messages.push({ id: crypto.randomUUID(), role: "assistant", content: session.mode === "demo" ? "作品留在这里了。当前是模拟演示，我不会假装识别到画里的内容。你愿意从哪一处开始聊？" : observation ? "我们一起看看这幅画。你愿意先从哪一处说起？也可以只是画一画，不解释它。" : "原画已经保留。这次画面观察没有完成，你仍然可以用自己的话讲讲，或直接停在这里。", createdAt: new Date().toISOString() });
    });
    finishEvent(session.id, body.eventId);
    return NextResponse.json(snapshot(session.id));
  } catch (error) { if (claimed && sessionId && eventId) abandonEvent(sessionId, eventId); return failure(error); }
  finally { release?.(); }
}
