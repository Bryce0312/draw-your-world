import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWork, loadWall, newWall, writeWall } from "./store";
import type { WallSession } from "./types";

beforeEach(() => {
  vi.stubEnv("STUDIO_DATA_DIR", fs.mkdtempSync(path.join(os.tmpdir(), "drawing-wall-storage-")));
  vi.stubEnv("STUDIO_MODE", "demo");
  vi.stubEnv("NETLIFY", "false");
  vi.stubEnv("WALL_STORAGE", "local");
  vi.stubEnv("DYW_NETLIFY_BUILD", "0");
  vi.stubEnv("NETLIFY_BLOBS_CONTEXT", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("local drawing storage compatibility", () => {
  it("migrates the existing SQLite table and loads the original drawing data", async () => {
    const original: WallSession = { id: randomUUID(), name: "A saved visitor", works: [], shares: [], activeWorkId: null, createdAt: new Date().toISOString() };
    const work = createWork(original, "data:image/png;base64,YQ==", "draw");
    work.status = "saved";
    work.saveConsent = true;
    const db = new DatabaseSync(path.join(process.env.STUDIO_DATA_DIR!, "wall-demo.sqlite"));
    db.exec("CREATE TABLE wall_sessions(id TEXT PRIMARY KEY, payload TEXT NOT NULL)");
    db.prepare("INSERT INTO wall_sessions(id, payload) VALUES (?, ?)").run(original.id, JSON.stringify(original));
    db.close();

    const restored = (await loadWall(original.id))!;
    expect(restored.works[0].originalImage).toBe(work.originalImage);
    restored.name = "Updated visitor";
    await writeWall(restored);
    expect((await loadWall(original.id))?.name).toBe("Updated visitor");
  });

  it("keeps a draft in the running local session and rejects stale writes", async () => {
    const session = await newWall();
    const work = createWork(session, "data:image/png;base64,YQ==", "draw");
    await writeWall(session);
    const first = (await loadWall(session.id))!;
    const second = (await loadWall(session.id))!;
    expect(first.works[0].id).toBe(work.id);
    first.name = "Committed";
    await writeWall(first);
    second.name = "Stale";
    await expect(writeWall(second)).rejects.toMatchObject({ status: 409 });
    expect((await loadWall(session.id))?.name).toBe("Committed");
  });
});
