import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { createStudioSession, getSession, saveAsset, closeStudioStores, mutateSession } from "./store";
import { enqueueJob } from "./jobs";
import { COOKIE, busySessions, sameOrigin } from "./http";
import { GET as loadSession, POST as resetSession } from "../../../app/api/session/route";
import { GET as loadAsset } from "../../../app/api/assets/[id]/route";
import { POST as agentEvent } from "../../../app/api/agent/route";
import { POST as uploadArtwork } from "../../../app/api/artworks/route";
import { POST as editProposal } from "../../../app/api/proposals/route";

vi.mock("./conversation", () => ({ converse: vi.fn(), deleteConversationThread: vi.fn() }));
vi.mock("./providers", () => ({ analyzeArtwork: vi.fn(async () => ({ items: ["画面中有线条。"], uncertainties: [] })) }));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "draw-world-http-"));
beforeAll(() => { vi.stubEnv("STUDIO_DATA_DIR", directory); vi.stubEnv("STUDIO_MODE", "demo"); });
afterAll(() => { closeStudioStores(); busySessions.clear(); vi.unstubAllEnvs(); fs.rmSync(directory, { recursive: true, force: true }); });
function request(url: string, sessionId?: string, body?: unknown, extra?: Record<string, string>) {
  return new NextRequest(`http://localhost:3000${url}`, { method: body ? "POST" : "GET", headers: { ...(sessionId ? { cookie: `${COOKIE}=${sessionId}` } : {}), ...(body ? { "content-type": "application/json" } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
describe("anonymous studio HTTP boundary", () => {
  it("accepts the browser Host when Next normalizes 127.0.0.1 to localhost", () => {
    expect(() => sameOrigin(new Request("http://localhost:3000/api/artworks", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }))).not.toThrow();
    expect(() => sameOrigin(new Request("http://localhost:3000/api/artworks", { headers: { host: "127.0.0.1:3000", origin: "https://other.example" } }))).toThrow();
  });
  it("creates a private cookie session and repairs stale cookies", async () => {
    const first = await loadSession(request("/api/session"));
    expect(first.headers.get("set-cookie")).toContain("HttpOnly");
    expect((await first.json()).session.mode).toBe("demo");
    const stale = await loadSession(request("/api/session", crypto.randomUUID()));
    expect(stale.status).toBe(200);
  });
  it("starts a separate session when the server changes between live and demo", async () => {
    const old = createStudioSession("live");
    const response = await loadSession(request("/api/session", old.id));
    const current = (await response.json()).session;
    expect(current.mode).toBe("demo"); expect(current.id).not.toBe(old.id);
    expect(getSession(old.id).mode).toBe("live");
  });
  it("rejects cross-origin mutations without deleting the owner's data", async () => {
    const session = createStudioSession();
    const response = await resetSession(request("/api/session", session.id, { action: "reset" }, { origin: "https://other.example" }));
    expect(response.status).toBe(403); expect(getSession(session.id).id).toBe(session.id);
  });
  it("never accepts client-supplied session state", async () => {
    const session = createStudioSession();
    const response = await agentEvent(request("/api/agent", session.id, { session: { ...session, status: "complete" }, event: { type: "record_mood", mood: 4 }, eventId: crypto.randomUUID(), baseVersion: 0 }));
    expect(response.status).toBe(400); expect(getSession(session.id).feedback).toBeUndefined();
  });
  it("commits a duplicate event once and streams the authoritative state", async () => {
    const session = createStudioSession();
    const body = { event: { type: "record_mood", mood: 2 }, eventId: crypto.randomUUID(), baseVersion: 0 };
    const first = await agentEvent(request("/api/agent", session.id, body));
    expect(await first.text()).toContain('"moodBefore":2');
    const version = getSession(session.id).version;
    const second = await agentEvent(request("/api/agent", session.id, body));
    expect(await second.text()).toContain('"type":"state"');
    expect(getSession(session.id).version).toBe(version);
  });
  it("does not grant access to another session's asset", async () => {
    const owner = createStudioSession(); const other = createStudioSession();
    const asset = saveAsset(owner.id, Buffer.from("private artwork"), { kind: "original", artworkVersion: 1, mimeType: "image/png" });
    const denied = await loadAsset(request(`/api/assets/${asset.id}`, other.id), { params: Promise.resolve({ id: asset.id }) });
    expect(denied.status).toBe(404);
    const granted = await loadAsset(request(`/api/assets/${asset.id}`, owner.id), { params: Promise.resolve({ id: asset.id }) });
    expect(await granted.text()).toBe("private artwork");
  });
  it("validates actual image bytes before any observation", async () => {
    const session = createStudioSession();
    const bad = await uploadArtwork(request("/api/artworks", session.id, { imageBase64: "data:image/png;base64,bm90LWFuLWltYWdl", baseVersion: 0, eventId: crypto.randomUUID() }));
    expect(bad.status).toBe(400); expect(getSession(session.id).assets).toHaveLength(0);
  });
  it("preserves a submitted original and deduplicates upload events", async () => {
    const session = createStudioSession();
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#fffdf8" } }).png().toBuffer();
    const body = { imageBase64: `data:image/png;base64,${png.toString("base64")}`, baseVersion: 0, eventId: crypto.randomUUID() };
    expect((await uploadArtwork(request("/api/artworks", session.id, body))).status).toBe(200);
    expect((await uploadArtwork(request("/api/artworks", session.id, body))).status).toBe(200);
    const saved = getSession(session.id);
    expect(saved.artworkVersion).toBe(1); expect(saved.assets).toHaveLength(1);
    expect(saved.observation?.status).toBe("failed");
    expect(saved.messages.at(-1)?.content).toContain("模拟");
  });
  it("gives edited previews a new identity so an old tab cannot authorize new changes", async () => {
    const session = createStudioSession();
    const asset = saveAsset(session.id, Buffer.from("original"), { kind: "original", artworkVersion: 1, mimeType: "image/png" });
    const proposalId = crypto.randomUUID();
    const prepared = mutateSession(session.id, s => {
      s.artworkVersion = 1; s.originalAssetId = asset.id; s.activeAssetId = asset.id;
      s.proposals.push({ id: proposalId, sourceAssetId: asset.id, artworkVersion: 1, kind: "image", summary: "添叶子", changes: ["添一片叶子"], preserve: ["夜色"], status: "draft", createdAt: new Date().toISOString() });
    });
    const response = await editProposal(request("/api/proposals", session.id, { proposalId, changes: ["只点亮窗内"], preserve: ["保留夜色"], baseVersion: prepared.version, eventId: crypto.randomUUID() }));
    expect(response.status).toBe(200);
    const latest = getSession(session.id);
    expect(latest.proposals[0].status).toBe("stale");
    expect(latest.proposals[1].id).not.toBe(proposalId);
    expect(latest.proposals[1].changes).toEqual(["只点亮窗内"]);
    expect(() => enqueueJob(session.id, proposalId)).toThrow();
    expect(enqueueJob(session.id, latest.proposals[1].id).status).toBe("queued");
  });
});
