import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { analyzeArtwork } from "../src/lib/studio/providers";
import { converse, deleteConversationThread } from "../src/lib/studio/conversation";
import { createStudioSession, getCapabilities, getSession, getStudioDataDirectory, mutateSession, saveAsset, closeStudioStores, deleteSession } from "../src/lib/studio/store";
import { enqueueJob, runWorkerOnce } from "../src/lib/studio/jobs";
import type { StudioProposal } from "../src/lib/studio/types";

async function main() {
  if (process.env.STUDIO_MODE === "demo") throw new Error("请在 live 模式下进行 API 检查；模拟结果不计为真实联通。");
  const session = createStudioSession("live");
  const report: Record<string, unknown> = { checkedAt: new Date().toISOString(), vision: "not_checked", chat: "not_checked", image: "not_requested", video: "not_requested" };
  const bytes = await sharp(Buffer.from('<svg width="640" height="440" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="440" fill="#fffdf8"/><g fill="none" stroke="#29332d" stroke-width="4"><path d="M100 320V180L180 110L260 180V320ZM80 180L180 95L280 180M155 320V240H205V320M115 205H145V235H115ZM385 320V180M385 270L355 230M385 250L420 205"/><circle cx="385" cy="150" r="55"/><circle cx="520" cy="235" r="18"/><path d="M520 253V300M490 272H550M520 300L500 335M520 300L540 335M60 337H570"/></g></svg>')).png().toBuffer();
  const asset = saveAsset(session.id, bytes, { kind: "original", artworkVersion: 1, mimeType: "image/png" });
  mutateSession(session.id, s => { s.artworkVersion = 1; s.originalAssetId = asset.id; s.activeAssetId = asset.id; });
  const capabilities = getCapabilities();
  if (capabilities.vision) {
    const start = Date.now();
    try {
      const result = await analyzeArtwork(bytes, "image/png");
      mutateSession(session.id, s => { s.observation = { artworkVersion: 1, status: "ready", ...result }; });
      report.vision = { status: "passed", elapsedMs: Date.now() - start, observationCount: result.items.length };
    } catch { report.vision = { status: "failed", elapsedMs: Date.now() - start }; }
  } else report.vision = "missing_configuration";
  if (capabilities.chat) {
    const start = Date.now(); let deltas = 0; let failed = false;
    await converse(session.id, "这只是我随手画的房子、树和人，没有特别含义，我想先看看它。", e => { if (e.type === "text.delta") deltas++; if (e.type === "error") failed = true; });
    report.chat = { status: !failed && deltas > 0 ? "passed" : "failed", elapsedMs: Date.now() - start, streamedChunks: deltas };
    const draftStart = Date.now(); let draftError = false;
    await converse(session.id, "我只想在房子左边的窗内增加一点暖光，其他内容和笔触都保留。请先整理成供我核对的改动建议，不要生成。", e => { if (e.type === "error") draftError = true; });
    const drafted = getSession(session.id);
    report.agentDraft = { status: !draftError && drafted.proposals.some(p => p.kind === "image" && p.status === "draft") && drafted.jobs.length === 0 ? "passed" : "failed", elapsedMs: Date.now() - draftStart, generatedJobs: drafted.jobs.length };
    await converse(session.id, "不是这个意思，我现在不想改变画面了，请把刚才的建议放下。", () => {});
    const corrected = getSession(session.id);
    report.correction = { status: !corrected.proposals.some(p => p.status === "draft") && corrected.jobs.length === 0 ? "passed" : "failed", generatedJobs: corrected.jobs.length };
  } else report.chat = "missing_configuration";
  for (const kind of ["image", "video"] as const) {
    if (!process.argv.includes(`--${kind}`)) continue;
    if (!capabilities[kind]) { report[kind] = "missing_configuration"; continue; }
    const proposal: StudioProposal = { id: crypto.randomUUID(), kind, artworkVersion: 1, sourceAssetId: asset.id, summary: "API 合成测试画", changes: [kind === "image" ? "只在房子的窗内增加一点暖光" : "只让树叶轻轻摆动，固定镜头"], preserve: ["保留原画笔触、构图和其他对象"], status: "draft", createdAt: new Date().toISOString() };
    mutateSession(session.id, s => { s.proposals.push(proposal); });
    const job = enqueueJob(session.id, proposal.id); const start = Date.now();
    for (;;) {
      await runWorkerOnce();
      const current = getSession(session.id).jobs.find(j => j.id === job.id)!;
      if (!["queued", "submitted", "running"].includes(current.status) || Date.now() - start > 600_000) { report[kind] = { status: current.status, elapsedMs: Date.now() - start }; break; }
      await new Promise(resolve => setTimeout(resolve, 15_000));
    }
  }
  const reportDirectory = path.join(getStudioDataDirectory(), "checks"); fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(path.join(reportDirectory, "latest.json"), JSON.stringify(report, null, 2));
  console.info(JSON.stringify(report, null, 2));
  // This check uses only a synthetic drawing; it leaves no conversation or artwork behind.
  await deleteConversationThread(session.id); deleteSession(session.id); closeStudioStores();
}
main().catch(() => { console.error("API 检查未完成；未输出服务端凭据或响应原文。"); process.exitCode = 1; });
