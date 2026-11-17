import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { GET as getWall, POST as wallAction } from "../../../app/api/wall/route";
import { POST as uploadArtwork } from "../../../app/api/wall/artwork/route";
import { GET as getArtwork } from "../../../app/api/wall/images/[id]/route";
import { wallFailure } from "./http";
import { loadWall, WallError, writeWall } from "./store";
import type { WallSnapshot } from "./types";

const origin = "http://localhost:3000";
let picture: Uint8Array;
let otherPicture: Uint8Array;

beforeAll(async () => {
  vi.stubEnv("NETLIFY", "");
  vi.stubEnv("DYW_NETLIFY_BUILD", "");
  vi.stubEnv("WALL_STORAGE", "local");
  vi.stubEnv("STUDIO_MODE", "demo");
  vi.stubEnv("STUDIO_DATA_DIR", fs.mkdtempSync(path.join(process.cwd(), ".data-wall-artwork-test-")));
  picture = new Uint8Array(await sharp({ create: { width: 16, height: 12, channels: 3, background: "#ce8c60" } }).png().toBuffer());
  otherPicture = new Uint8Array(await sharp({ create: { width: 16, height: 12, channels: 3, background: "#71836a" } }).png().toBuffer());
});

afterAll(() => vi.unstubAllEnvs());

async function visitor() {
  const response = await getWall(new NextRequest(`${origin}/api/wall`));
  return response.headers.get("set-cookie")!.split(";")[0];
}

async function action(cookie: string, body: unknown) {
  const response = await wallAction(new NextRequest(`${origin}/api/wall`, {
    method: "POST", headers: { cookie, origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  return { response, body: await response.json() as WallSnapshot };
}

function uploadRequest(cookie?: string, options: { bytes?: Uint8Array; workId?: string; sourceOrigin?: string } = {}) {
  const form = new FormData();
  form.set("action", options.workId ? "update" : "create");
  form.set("mode", "draw");
  form.set("title", "A warm afternoon");
  if (options.workId) form.set("workId", options.workId);
  form.set("image", new File([Uint8Array.from(options.bytes ?? picture)], "drawing.png", { type: "image/png" }));
  return new NextRequest(`${origin}/api/wall/artwork`, {
    method: "POST", headers: { ...(cookie ? { cookie } : {}), origin: options.sourceOrigin ?? origin }, body: form,
  });
}

async function upload(cookie: string, options: Parameters<typeof uploadRequest>[1] = {}) {
  const response = await uploadArtwork(uploadRequest(cookie, options));
  return { response, body: await response.json() as WallSnapshot };
}

async function readImage(cookie: string | undefined, url: string) {
  return getArtwork(new NextRequest(origin + url, { headers: cookie ? { cookie } : {} }), {
    params: Promise.resolve({ id: url.split("/").at(-1)! }),
  });
}

describe("artwork upload entry points", () => {
  it("creates compact artwork URLs and serves pixels only to the owning session", async () => {
    const owner = await visitor();
    const created = await upload(owner);
    expect(created.response.status).toBe(200);
    const work = created.body.session.works[0];
    expect(work.image).toMatch(/^\/api\/wall\/images\/[a-f0-9]{64}$/);
    expect(work.originalImage).toBe(work.image);
    expect(JSON.stringify(created.body)).not.toContain("base64");
    expect(JSON.stringify(created.body).length).toBeLessThan(16_000);
    const pixels = await readImage(owner, work.image);
    expect(pixels.status).toBe(200);
    expect(pixels.headers.get("content-type")).toBe("image/png");
    expect(pixels.headers.get("cache-control")).toBe("private, no-store");
    expect((await pixels.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect((await readImage(await visitor(), work.image)).status).toBe(404);
    expect((await readImage(undefined, work.image)).status).toBe(404);
  });

  it("keeps the original and resets review permissions when a draft image changes", async () => {
    const cookie = await visitor();
    const initial = (await upload(cookie)).body.session.works[0];
    await action(cookie, { action: "consent", workId: initial.id, aiConsent: true, saveConsent: true, conversationConsent: true });
    const confirmed = await action(cookie, { action: "confirm_summary", workId: initial.id, text: "My drawing record" });
    const revision = confirmed.body.session.works[0].revision;
    await action(cookie, { action: "share", workId: initial.id, includeArtwork: true, includeSummary: true, confirmed: true, expectedRevision: revision });
    const updated = await upload(cookie, { workId: initial.id, bytes: otherPicture });
    expect(updated.response.status).toBe(200);
    const work = updated.body.session.works[0];
    expect(work.originalImage).toBe(initial.image);
    expect(work.image).not.toBe(initial.image);
    expect(work).toMatchObject({ aiConsent: false, saveConsent: false, conversationConsent: false, observation: { status: "idle" }, summary: { confirmed: false } });
    expect(work.revision).toBe(revision + 1);
    expect(updated.body.session.shares.every(share => !!share.revokedAt)).toBe(true);
    expect((await readImage(cookie, initial.image)).status).toBe(200);
  });

  it("rejects replacement of a saved artwork and cross-session updates", async () => {
    const cookie = await visitor();
    const initial = (await upload(cookie)).body.session.works[0];
    expect((await upload(await visitor(), { workId: initial.id, bytes: otherPicture })).response.status).toBe(404);
    await action(cookie, { action: "consent", workId: initial.id, aiConsent: false, saveConsent: true });
    await action(cookie, { action: "save", workId: initial.id });
    const rejected = await upload(cookie, { workId: initial.id, bytes: otherPicture });
    expect(rejected.response.status).toBe(409);
    expect(rejected.body.session.works[0].image).toBe(initial.image);
    expect(rejected.body.session.works[0].originalImage).toBe(initial.image);
  });

  it("rejects oversized bodies and cross-origin uploads before creating a session", async () => {
    const oversized = await uploadArtwork(uploadRequest(undefined, { bytes: new Uint8Array(4_000_001) }));
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get("set-cookie")).toBeNull();
    const crossOrigin = await uploadArtwork(uploadRequest(undefined, { sourceOrigin: "https://unrelated.example" }));
    expect(crossOrigin.status).toBe(403);
    expect(crossOrigin.headers.get("set-cookie")).toBeNull();
  });

  it("returns a controlled error when an uploaded PNG cannot be decoded", async () => {
    const cookie = await visitor();
    const result = await upload(cookie, { bytes: new TextEncoder().encode("invalid PNG") });
    expect(result.response.status).toBe(400);
    expect(result.body.error).toBeTruthy();
    expect(result.body.session.works).toEqual([]);
  });

  it("returns the latest committed state after a CAS conflict without retrying the stale write", async () => {
    const cookie = await visitor();
    const initial = (await upload(cookie)).body.session;
    const fresh = (await loadWall(initial.id))!;
    const stale = (await loadWall(initial.id))!;
    fresh.name = "Latest committed state";
    await writeWall(fresh);
    stale.name = "Stale request";
    await expect(writeWall(stale)).rejects.toMatchObject({ status: 409 });
    const response = await wallFailure(new NextRequest(`${origin}/api/wall`, { headers: { cookie } }), new WallError("Changed elsewhere", 409), stale);
    const body = await response.json() as WallSnapshot;
    expect(response.status).toBe(409);
    expect(body.session.name).toBe("Latest committed state");
    expect((await loadWall(initial.id))?.name).toBe("Latest committed state");
  });
});
