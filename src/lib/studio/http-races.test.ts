import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { closeStudioStores, createStudioSession, getSession } from "./store";
import { busySessions, COOKIE } from "./http";
import { POST as uploadArtwork } from "../../../app/api/artworks/route";
import { POST as agentEvent } from "../../../app/api/agent/route";

vi.mock("./conversation", () => ({ converse: vi.fn(), deleteConversationThread: vi.fn() }));
vi.mock("./providers", () => ({ analyzeArtwork: vi.fn() }));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "draw-world-races-"));
beforeAll(() => { vi.stubEnv("STUDIO_DATA_DIR", directory); vi.stubEnv("STUDIO_MODE", "demo"); });
afterAll(() => {
  closeStudioStores(); busySessions.clear(); vi.unstubAllEnvs();
  const resolved = path.resolve(directory);
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("draw-world-races-")) fs.rmSync(resolved, { recursive: true, force: true });
});
function request(endpoint: string, sessionId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${endpoint}`, { method: "POST", headers: { cookie: `${COOKIE}=${sessionId}`, "content-type": "application/json" }, body: JSON.stringify(body) });
}
function delayedRequest(endpoint: string, sessionId: string, body: unknown) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  const init = { method: "POST", headers: { cookie: `${COOKIE}=${sessionId}`, "content-type": "application/json" }, body: stream, duplex: "half" as const };
  const req = new NextRequest(`http://localhost:3000${endpoint}`, init);
  return { request: req, finish: () => { controller.enqueue(new TextEncoder().encode(JSON.stringify(body))); controller.close(); } };
}

describe("slow request body concurrency", () => {
  it("does not reuse an artwork version if another upload finished while reading a request", async () => {
    const session = createStudioSession();
    const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#fff" } }).png().toBuffer();
    const imageBase64 = `data:image/png;base64,${bytes.toString("base64")}`;
    const slow = delayedRequest("/api/artworks", session.id, { imageBase64, baseVersion: 0, eventId: crypto.randomUUID() });
    const pending = uploadArtwork(slow.request);
    const fast = await uploadArtwork(request("/api/artworks", session.id, { imageBase64, baseVersion: 0, eventId: crypto.randomUUID() }));
    expect(fast.status).toBe(200);
    slow.finish();
    const rejected = await pending;
    expect(rejected.status).toBe(409);
    expect(getSession(session.id).artworkVersion).toBe(1);
    expect(getSession(session.id).assets).toHaveLength(1);
  });
  it("checks latest completion state after reading a delayed mutation", async () => {
    const session = createStudioSession();
    const slow = delayedRequest("/api/agent", session.id, { event: { type: "record_mood", mood: 5 }, eventId: crypto.randomUUID(), baseVersion: 0 });
    const pending = agentEvent(slow.request);
    const complete = await agentEvent(request("/api/agent", session.id, { event: { type: "complete" }, eventId: crypto.randomUUID(), baseVersion: 0 }));
    await complete.text();
    slow.finish();
    expect((await pending).status).toBe(400);
    expect(getSession(session.id).feedback?.moodBefore).toBeUndefined();
  });
  it("replaying a completed finish event remains idempotent", async () => {
    const session = createStudioSession();
    const body = { event: { type: "complete", text: "到这里就好" }, eventId: crypto.randomUUID(), baseVersion: 0 };
    const first = await agentEvent(request("/api/agent", session.id, body)); await first.text();
    const version = getSession(session.id).version;
    const duplicate = await agentEvent(request("/api/agent", session.id, body));
    expect(duplicate.status).toBe(200);
    expect(await duplicate.text()).toContain('"type":"state"');
    expect(getSession(session.id).version).toBe(version);
  });
});
