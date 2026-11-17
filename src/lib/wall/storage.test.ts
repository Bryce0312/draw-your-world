import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const backend = vi.hoisted(() => ({
  entries: new Map<string, { data: unknown; metadata: Record<string, unknown>; etag: string }>(),
  revision: 0,
  failRead: false,
  failWrite: false,
  configurations: [] as { name: string; consistency: string }[],
}));

vi.mock("@netlify/blobs", () => ({
  getStore(configuration: { name: string; consistency: string }) {
    backend.configurations.push(configuration);
    const prefix = `${configuration.name}/`;

    async function set(key: string, data: unknown, options: { onlyIfNew?: boolean; onlyIfMatch?: string; metadata?: Record<string, unknown> } = {}) {
      if (backend.failWrite) throw new Error("Simulated storage write failure");
      const existing = backend.entries.get(prefix + key);
      if ((options.onlyIfNew && existing) || (options.onlyIfMatch && existing?.etag !== options.onlyIfMatch)) {
        return { modified: false };
      }
      const etag = `"revision-${++backend.revision}"`;
      backend.entries.set(prefix + key, { data: structuredClone(data), metadata: structuredClone(options.metadata ?? {}), etag });
      return { modified: true, etag };
    }

    return {
      set,
      setJSON: set,
      async getWithMetadata(key: string, options: { type?: string } = {}) {
        if (backend.failRead) throw new Error("Simulated storage read failure");
        const entry = backend.entries.get(prefix + key);
        if (!entry) return null;
        const copy = structuredClone(entry);
        if (options.type === "arrayBuffer" && !(copy.data instanceof ArrayBuffer)) {
          copy.data = Uint8Array.from(copy.data as Uint8Array).buffer;
        }
        return copy;
      },
      async get(key: string) {
        if (backend.failRead) throw new Error("Simulated storage read failure");
        return structuredClone(backend.entries.get(prefix + key)?.data ?? null);
      },
      async getMetadata(key: string) {
        const entry = backend.entries.get(prefix + key);
        return entry ? { metadata: structuredClone(entry.metadata), etag: entry.etag } : null;
      },
      list(options: { paginate?: boolean } = {}) {
        const blobs = [...backend.entries.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key: key.slice(prefix.length) }));
        if (options.paginate) {
          return { async *[Symbol.asyncIterator]() { yield { blobs }; } };
        }
        return Promise.resolve({ blobs });
      },
      async delete(key: string) {
        backend.entries.delete(prefix + key);
      },
    };
  },
}));

import { createWork, loadWall, newWall, pruneWallDrafts, readWallImage, storeWallImage, writeWall } from "./store";
import { DRAFT_LIFETIME_MS } from "./wall-storage";

beforeEach(() => {
  backend.entries.clear();
  backend.configurations.length = 0;
  backend.revision = 0;
  backend.failRead = false;
  backend.failWrite = false;
  vi.stubEnv("WALL_STORAGE", "netlify");
  vi.stubEnv("STUDIO_MODE", "demo");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Netlify drawing storage", () => {
  it("rejects a stale independent writer and keeps the committed version", async () => {
    const session = await newWall();
    const first = (await loadWall(session.id))!;
    const stale = (await loadWall(session.id))!;
    first.name = "First request";
    await writeWall(first);
    stale.name = "Stale request";
    await expect(writeWall(stale)).rejects.toMatchObject({ status: 409 });
    expect((await loadWall(session.id))?.name).toBe("First request");
    expect(backend.configurations.every(configuration => configuration.consistency === "strong")).toBe(true);
  });

  it("uses fresh reads instead of sharing mutable session objects", async () => {
    const session = await newWall();
    const first = (await loadWall(session.id))!;
    first.name = "Uncommitted change";
    expect((await loadWall(session.id))?.name).toBe("");
    await writeWall(first);
    expect((await loadWall(session.id))?.name).toBe("Uncommitted change");
  });

  it("isolates session records and authorizes artwork against the owning collection", async () => {
    const owner = await newWall();
    const other = await newWall();
    const image = await storeWallImage(owner.id, "data:image/png;base64,YQ==");
    const work = createWork(owner, image, "draw", "Owner's drawing");
    await writeWall(owner);
    const imageId = image.split("/").at(-1)!;
    expect((await loadWall(owner.id))?.works[0].id).toBe(work.id);
    expect((await loadWall(other.id))?.works).toEqual([]);
    expect(await readWallImage(other, imageId)).toBeUndefined();
    const pixels = await readWallImage((await loadWall(owner.id))!, imageId);
    expect(Buffer.from(pixels!.bytes).toString()).toBe("a");
    expect(pixels?.contentType).toBe("image/png");
  });

  it("expires temporary work while retaining only the selected saved record", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T00:00:00Z"));
    const session = await newWall();
    const saved = createWork(session, "saved-image", "draw");
    saved.status = "saved";
    saved.saveConsent = true;
    saved.summary = { text: "My confirmed record", confirmed: true, revision: saved.revision };
    saved.messages.push({ id: "saved-message", role: "user", content: "Unsaved conversation", createdAt: saved.createdAt });
    createWork(session, "draft-image", "draw");
    await writeWall(session);
    expect((await loadWall(session.id))?.works).toHaveLength(2);

    vi.advanceTimersByTime(DRAFT_LIFETIME_MS + 1);
    const restored = (await loadWall(session.id))!;
    expect(restored.works).toHaveLength(1);
    expect(restored.works[0].id).toBe(saved.id);
    expect(restored.works[0].summary.text).toBe("My confirmed record");
    expect(restored.works[0].messages).toEqual([]);
    expect(restored.activeWorkId).toBeNull();
    const persisted = JSON.stringify([...backend.entries.values()]);
    expect(persisted).not.toContain("draft-image");
    expect(persisted).not.toContain("Unsaved conversation");
  });

  it("reports storage failures without returning an unsaved new session", async () => {
    backend.failWrite = true;
    await expect(newWall()).rejects.toThrow();
    expect(backend.entries.size).toBe(0);
    backend.failWrite = false;
    const session = await newWall();
    backend.failRead = true;
    await expect(loadWall(session.id)).rejects.toThrow();
  });

  it("keeps the last committed data when an update fails remotely", async () => {
    const session = await newWall();
    session.name = "This update failed";
    backend.failWrite = true;
    await expect(writeWall(session)).rejects.toThrow();
    backend.failWrite = false;
    expect((await loadWall(session.id))?.name).toBe("");
    await writeWall(session);
    expect((await loadWall(session.id))?.name).toBe("This update failed");
  });

  it("cleans both mode namespaces and removes only old unreferenced artwork", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T00:00:00Z"));
    const collections: { id: string; image: string; draftImage: string; mode: string }[] = [];
    for (const mode of ["demo", "live"]) {
      vi.stubEnv("STUDIO_MODE", mode);
      const session = await newWall();
      const image = await storeWallImage(session.id, "data:image/png;base64,YQ==");
      const saved = createWork(session, image, "draw");
      saved.status = "saved";
      saved.saveConsent = true;
      const draftImage = await storeWallImage(session.id, "data:image/png;base64,Yg==");
      createWork(session, draftImage, "draw");
      await storeWallImage(session.id, "data:image/png;base64,Yw==");
      await writeWall(session);
      collections.push({ id: session.id, image, draftImage, mode });
    }
    vi.advanceTimersByTime(DRAFT_LIFETIME_MS + 1);
    const recentOrphan = await storeWallImage(collections[1].id, "data:image/png;base64,ZA==");
    const result = await pruneWallDrafts();
    expect(result).toMatchObject({ sessions: 2, images: 4, limited: false });
    for (const collection of collections) {
      vi.stubEnv("STUDIO_MODE", collection.mode);
      const restored = (await loadWall(collection.id))!;
      expect(restored.works).toHaveLength(1);
      expect(restored.works[0].image).toBe(collection.image);
      expect(await readWallImage(restored, collection.image.split("/").at(-1)!)).toBeDefined();
      expect([...backend.entries.keys()].some(key => key.endsWith(`/${collection.draftImage.split("/").at(-1)}`))).toBe(false);
    }
    expect([...backend.entries.keys()].some(key => key.endsWith(`/${recentOrphan.split("/").at(-1)}`))).toBe(true);
  });

  it("bounds a cleanup batch and resumes the remaining collections on its next run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T00:00:00Z"));
    for (let index = 0; index < 105; index++) await newWall();
    vi.advanceTimersByTime(DRAFT_LIFETIME_MS + 1);
    const first = await pruneWallDrafts();
    expect(first.sessions).toBe(100);
    expect(first.limited).toBe(true);
    const second = await pruneWallDrafts();
    expect(second.sessions).toBe(5);
    expect(second.limited).toBe(false);
  });
});
