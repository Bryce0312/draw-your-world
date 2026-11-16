import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { acceptJobResult, cancelJob, enqueueJob, runWorkerOnce } from "./jobs";
import { abandonEvent, claimEvent, claimNextJob, closeStudioStores, commitJobResultAsset, createStudioSession, finishEvent, getCapabilities, getSession, mutateSession, readAsset, recordWorkerHeartbeat, releaseJobClaim, saveAsset } from "./store";
import type { StudioProposal } from "./types";

let directory: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "draw-world-job-test-"));
  vi.stubEnv("STUDIO_DATA_DIR", directory);
  vi.stubEnv("STUDIO_MODE", "demo");
});
afterEach(() => {
  closeStudioStores(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  const resolved = path.resolve(directory);
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("draw-world-job-test-")) fs.rmSync(resolved, { recursive: true, force: true });
});
async function fixture(mode: "demo" | "live" = "demo") {
  vi.stubEnv("STUDIO_MODE", mode);
  const session = createStudioSession(mode);
  const bytes = await sharp({ create: { width: 400, height: 300, channels: 4, background: "#faf8f4" } }).png().toBuffer();
  const asset = saveAsset(session.id, bytes, { kind: "original", artworkVersion: 1, mimeType: "image/png" });
  const proposal: StudioProposal = { id: randomUUID(), kind: "image", artworkVersion: 1, sourceAssetId: asset.id, summary: "添一片叶子", changes: ["只添一片叶子"], preserve: ["保留夜色"], status: "draft", createdAt: new Date().toISOString() };
  mutateSession(session.id, (state) => { state.artworkVersion = 1; state.originalAssetId = asset.id; state.activeAssetId = asset.id; state.proposals.push(proposal); });
  return { session, asset, proposal };
}

describe("persistent studio jobs", () => {
  it.each(["demo", "live"] as const)("a %s worker never claims another mode's queued work", async (workerMode) => {
    const sessionMode = workerMode === "demo" ? "live" : "demo";
    const { session, proposal } = await fixture(sessionMode);
    enqueueJob(session.id, proposal.id);
    vi.stubEnv("STUDIO_MODE", workerMode);
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await runWorkerOnce()).toBe(false);
    expect(getSession(session.id).jobs[0].status).toBe("queued");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("saves assets privately and keeps latest mutations across reopened database", async () => {
    const { session, asset } = await fixture();
    mutateSession(session.id, (state) => { state.userStatements.push("自己的说法"); });
    closeStudioStores();
    expect(getSession(session.id).userStatements).toEqual(["自己的说法"]);
    expect(readAsset(session.id, asset.id).bytes.length).toBeGreaterThan(0);
    expect(() => readAsset(createStudioSession().id, asset.id)).toThrow("找不到");
  });
  it("deduplicates approved jobs and rejects understanding or stale proposals", async () => {
    const { session, proposal } = await fixture();
    const first = enqueueJob(session.id, proposal.id);
    expect(enqueueJob(session.id, proposal.id).id).toBe(first.id);
    expect(getSession(session.id).jobs).toHaveLength(1);
    mutateSession(session.id, (state) => { state.proposals.push({ ...proposal, id: "understanding", kind: "understanding" }, { ...proposal, id: "old", artworkVersion: 0 }); });
    expect(() => enqueueJob(session.id, "understanding")).toThrow();
    expect(() => enqueueJob(session.id, "old")).toThrow("作品已更新");
  });
  it("runs a clearly simulated image without paid calls and preserves original until accepted", async () => {
    const { session, asset, proposal } = await fixture();
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const job = enqueueJob(session.id, proposal.id);
    expect(await runWorkerOnce()).toBe(true);
    const result = getSession(session.id);
    expect(result.jobs[0].status).toBe("succeeded");
    expect(result.jobs[0].mode).toBe("demo");
    expect(result.activeAssetId).toBe(asset.id);
    expect(fetchMock).not.toHaveBeenCalled();
    const accepted = acceptJobResult(session.id, job.id);
    expect(accepted.activeAssetId).toBe(result.jobs[0].resultAssetId);
    expect(accepted.originalAssetId).toBe(asset.id);
  });
  it("cancellation prevents work and old artwork jobs cannot overwrite a new version", async () => {
    const one = await fixture();
    const job = enqueueJob(one.session.id, one.proposal.id);
    cancelJob(one.session.id, job.id);
    expect(await runWorkerOnce()).toBe(false);
    expect(getSession(one.session.id).jobs[0].status).toBe("cancelled");
    const two = await fixture();
    enqueueJob(two.session.id, two.proposal.id);
    mutateSession(two.session.id, (state) => { state.artworkVersion = 2; });
    await runWorkerOnce();
    expect(getSession(two.session.id).jobs[0].status).toBe("cancelled");
    expect(getSession(two.session.id).activeAssetId).toBe(two.asset.id);
  });
  it("a crashed submission becomes unknown and is never automatically submitted twice", async () => {
    const { session, proposal } = await fixture("live");
    const job = enqueueJob(session.id, proposal.id);
    const claimed = claimNextJob("old-worker");
    expect(claimed?.job.status).toBe("submitted");
    releaseJobClaim(job.id, "old-worker");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await runWorkerOnce();
    expect(getSession(session.id).jobs[0].status).toBe("unknown");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("missing live configuration fails honestly and keeps the source image", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "");
    const { session, asset, proposal } = await fixture("live");
    enqueueJob(session.id, proposal.id);
    await runWorkerOnce();
    expect(getSession(session.id).jobs[0].status).toBe("failed");
    expect(getSession(session.id).activeAssetId).toBe(asset.id);
    expect(getSession(session.id).jobs[0].resultAssetId).toBeUndefined();
  });
  it("uncertain provider submission is not automatically retried", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    vi.stubEnv("DASHSCOPE_IMAGE_ENDPOINT", "https://example.com/image-api");
    const { session, proposal } = await fixture("live");
    enqueueJob(session.id, proposal.id);
    const fetchMock = vi.fn(async () => { throw new TypeError("connection lost after send"); });
    vi.stubGlobal("fetch", fetchMock);
    await runWorkerOnce(); await runWorkerOnce();
    expect(getSession(session.id).jobs[0].status).toBe("unknown");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("atomically commits only current, uncancelled results into the asset gallery", async () => {
    const { session, asset, proposal } = await fixture();
    const job = enqueueJob(session.id, proposal.id);
    claimNextJob("test-worker");
    cancelJob(session.id, job.id);
    expect(commitJobResultAsset(session.id, job.id, Buffer.from("late result"), "image/png")).toBeUndefined();
    expect(getSession(session.id).assets.map((item) => item.id)).toEqual([asset.id]);
    const other = await fixture();
    const otherJob = enqueueJob(other.session.id, other.proposal.id);
    claimNextJob("test-worker");
    mutateSession(other.session.id, (state) => { state.activeAssetId = "a-new-source"; });
    expect(commitJobResultAsset(other.session.id, otherJob.id, Buffer.from("stale result"), "image/png")).toBeUndefined();
    expect(getSession(other.session.id).jobs[0].status).toBe("cancelled");
    expect(getSession(other.session.id).assets).toHaveLength(1);
  });
  it("ends honestly when a completed video is invalid instead of redownloading forever", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    vi.stubEnv("DASHSCOPE_VIDEO_ENDPOINT", "https://example.com/video-api");
    const { session, proposal } = await fixture("live");
    mutateSession(session.id, (state) => { state.proposals[0].kind = "video"; });
    const job = enqueueJob(session.id, proposal.id);
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ output: { task_id: "video-task" } }));
      if (String(url).includes("/tasks/")) return new Response(JSON.stringify({ output: { task_status: "SUCCEEDED", video_url: "https://example.com/result.mp4" } }));
      return new Response("not an mp4");
    });
    vi.stubGlobal("fetch", fetchMock);
    await runWorkerOnce();
    expect(getSession(session.id).jobs[0].status).toBe("running");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16_000);
    await runWorkerOnce(); await runWorkerOnce();
    const result = getSession(session.id).jobs.find((item) => item.id === job.id)!;
    expect(result.status).toBe("failed");
    expect(result.error).toContain("MP4");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("ignores a result that arrives after the user cancels", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    vi.stubEnv("DASHSCOPE_IMAGE_ENDPOINT", "https://example.com/image-api");
    const { session, proposal, asset } = await fixture("live");
    const png = readAsset(session.id, asset.id).bytes;
    let finishSubmission!: (response: Response) => void;
    const waiting = new Promise<Response>((resolve) => { finishSubmission = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => String(url).includes("image-api") ? waiting : new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } })));
    const job = enqueueJob(session.id, proposal.id);
    const work = runWorkerOnce();
    cancelJob(session.id, job.id);
    finishSubmission(new Response(JSON.stringify({ output: { choices: [{ message: { content: [{ image: "https://example.com/result.png" }] } }] } }), { headers: { "Content-Type": "application/json" } }));
    await work;
    const result = getSession(session.id);
    expect(result.jobs[0].status).toBe("cancelled");
    expect(result.jobs[0].resultAssetId).toBeUndefined();
    expect(result.activeAssetId).toBe(asset.id);
  });
  it("tracks worker heartbeat and persistent event idempotency", () => {
    const session = createStudioSession();
    expect(getCapabilities().worker).toBe(false);
    recordWorkerHeartbeat();
    expect(getCapabilities().worker).toBe(true);
    vi.stubEnv("STUDIO_MODE", "live");
    expect(getCapabilities().worker).toBe(false);
    vi.stubEnv("STUDIO_MODE", "demo");
    expect(claimEvent(session.id, "example-event")).toBe("new");
    expect(claimEvent(session.id, "example-event")).toBe("pending");
    closeStudioStores();
    expect(claimEvent(session.id, "example-event")).toBe("pending");
    abandonEvent(session.id, "example-event");
    expect(claimEvent(session.id, "example-event")).toBe("new");
    finishEvent(session.id, "example-event");
    expect(claimEvent(session.id, "example-event")).toBe("done");
  });
});
