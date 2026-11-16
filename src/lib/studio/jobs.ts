import { randomUUID } from "node:crypto";
import { claimNextJob, commitJobResultAsset, mutateSession, readAsset, recordWorkerHeartbeat, releaseJobClaim, StudioStoreError } from "./store";
import { downloadGeneratedMedia, generateImage, pollVideo, ProviderError, submitVideo } from "./providers";
import type { GenerationJob, StudioSession } from "./types";

const workerOwner = `${process.pid}-${randomUUID()}`;
const activeStatuses = ["queued", "submitted", "running"];
function findJob(session: StudioSession, jobId: string) {
  const job = session.jobs.find((item) => item.id === jobId);
  if (!job) throw new StudioStoreError("找不到这次生成请求。", 404);
  return job;
}
function updateJob(sessionId: string, jobId: string, change: (job: GenerationJob, session: StudioSession) => void) {
  return mutateSession(sessionId, (session) => { const job = findJob(session, jobId); change(job, session); job.updatedAt = new Date().toISOString(); });
}
function current(job: GenerationJob, session: StudioSession) {
  return session.status === "active" && job.artworkVersion === session.artworkVersion && job.sourceAssetId === session.activeAssetId && activeStatuses.includes(job.status);
}

export function enqueueJob(sessionId: string, proposalId: string): GenerationJob {
  const session = mutateSession(sessionId, (state) => {
    const existing = state.jobs.find((job) => job.proposalId === proposalId);
    if (existing) return;
    const proposal = state.proposals.find((item) => item.id === proposalId);
    if (!proposal || proposal.status !== "draft" || proposal.kind === "understanding") throw new StudioStoreError("请先确认当前画面的变化建议。", 409);
    if (state.status !== "active" || proposal.artworkVersion !== state.artworkVersion || proposal.sourceAssetId !== state.activeAssetId) throw new StudioStoreError("作品已更新，请重新确认这次变化。", 409);
    const source = state.assets.find((asset) => asset.id === proposal.sourceAssetId);
    if (!source || source.kind === "video" || source.artworkVersion !== state.artworkVersion) throw new StudioStoreError("这次变化没有有效的原画。", 409);
    if (!proposal.changes.length || proposal.changes.some((value) => typeof value !== "string" || !value.trim() || value.length > 1000)) throw new StudioStoreError("请先说明希望改变什么。", 400);
    if (state.mode === "demo" && proposal.kind === "video") throw new StudioStoreError("模拟模式没有视频生成能力，不会将静态预览当作动画。", 409);
    const now = new Date().toISOString();
    proposal.status = "approved";
    state.jobs.push({ id: randomUUID(), proposalId, kind: proposal.kind, artworkVersion: state.artworkVersion, sourceAssetId: proposal.sourceAssetId, status: "queued", createdAt: now, updatedAt: now, mode: state.mode });
  });
  return session.jobs.find((job) => job.proposalId === proposalId)!;
}
export function cancelJob(sessionId: string, jobId: string): StudioSession {
  return updateJob(sessionId, jobId, (job) => {
    if (activeStatuses.includes(job.status)) { job.status = "cancelled"; job.error = "已停止等待这次结果；已经提交的服务任务可能仍会执行。"; }
  });
}
export function acceptJobResult(sessionId: string, jobId: string): StudioSession {
  return updateJob(sessionId, jobId, (job, session) => {
    if (job.accepted === true && job.resultAssetId === session.activeAssetId) return;
    if (session.status !== "active" || job.status !== "succeeded" || !job.resultAssetId || job.artworkVersion !== session.artworkVersion || job.sourceAssetId !== session.activeAssetId) throw new StudioStoreError("作品已更新，这个结果不能替代当前作品。", 409);
    job.accepted = true;
    // A video is a leaf result; keep its still image as the source for later edits.
    if (job.kind === "image") session.activeAssetId = job.resultAssetId;
    for (const proposal of session.proposals) if (proposal.status === "draft") proposal.status = "stale";
  });
}
export function discardJobResult(sessionId: string, jobId: string): StudioSession {
  return updateJob(sessionId, jobId, (job, session) => {
    if (job.status !== "succeeded") throw new StudioStoreError("这次请求还没有可舍弃的结果。", 409);
    job.accepted = false;
    if (session.activeAssetId === job.resultAssetId) session.activeAssetId = job.sourceAssetId;
    for (const proposal of session.proposals) if (proposal.status === "draft" && proposal.sourceAssetId === job.resultAssetId) proposal.status = "stale";
  });
}

function finishJob(sessionId: string, jobId: string, output: { bytes: Buffer; mimeType: string }) {
  commitJobResultAsset(sessionId, jobId, output.bytes, output.mimeType);
}

/** One bounded unit of background work. No paid request is automatically resubmitted. */
export async function runWorkerOnce(): Promise<boolean> {
  recordWorkerHeartbeat();
  const claim = claimNextJob(workerOwner);
  if (!claim) return false;
  const { session, job } = claim;
  let nextPoll = 0;
  try {
    const proposal = session.proposals.find((item) => item.id === job.proposalId);
    if (!proposal || !current(job, session)) {
      updateJob(session.id, job.id, (latest) => { latest.status = "cancelled"; latest.error = "作品或变化请求已更新。"; });
      return true;
    }
    if (job.kind === "image") {
      const source = readAsset(session.id, job.sourceAssetId);
      finishJob(session.id, job.id, await generateImage(source.bytes, source.asset.mimeType, proposal, job.mode));
    } else if (!job.providerTaskId) {
      if (job.mode === "demo") throw new ProviderError("模拟模式没有视频生成能力。");
      const source = readAsset(session.id, job.sourceAssetId);
      const { taskId } = await submitVideo(source.bytes, source.asset.mimeType, proposal);
      updateJob(session.id, job.id, (latest, state) => {
        latest.providerTaskId = taskId;
        if (current(latest, state)) latest.status = "running";
      });
      nextPoll = 15_000;
    } else {
      if (Date.now() - Date.parse(job.createdAt) > 30 * 60_000) {
        updateJob(session.id, job.id, (latest, state) => { if (current(latest, state)) { latest.status = "unknown"; latest.error = "等待超过30分钟，任务状态需要人工核对，没有自动重发。"; } });
        return true;
      }
      const result = await pollVideo(job.providerTaskId);
      if (result.status === "pending") nextPoll = 15_000;
      else if (result.status === "failed") updateJob(session.id, job.id, (latest, state) => { if (current(latest, state)) { latest.status = "failed"; latest.error = result.error; } });
      else if (result.url) finishJob(session.id, job.id, await downloadGeneratedMedia(result.url, "video"));
    }
  } catch (error) {
    // Provider payloads, artwork and user narratives must never enter worker logs.
    try {
      if (job.kind === "video" && job.providerTaskId && error instanceof ProviderError && error.ambiguous) {
        nextPoll = 15_000;
        updateJob(session.id, job.id, (latest, state) => { if (current(latest, state)) latest.error = "动画状态查询暂时中断，将继续查询同一任务。"; });
      } else {
        updateJob(session.id, job.id, (latest, state) => {
          if (!current(latest, state)) return;
          latest.status = error instanceof ProviderError && error.ambiguous ? "unknown" : "failed";
          latest.error = error instanceof ProviderError ? error.message : "这次生成未能完成，原画已保留。";
        });
      }
    } catch { /* A session deleted while work was running must stay deleted. */ }
  } finally { releaseJobClaim(job.id, workerOwner, nextPoll); }
  return true;
}
