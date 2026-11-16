import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AssetKind, GenerationJob, StudioAsset, StudioCapabilities, StudioMode, StudioSession } from "./types";

export class StudioStoreError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

const databases = new Map<string, DatabaseSync>();
export const getStudioDataDirectory = () => path.resolve(/* turbopackIgnore: true */ process.env.STUDIO_DATA_DIR || path.join(process.cwd(), ".data"));
function database() {
  const directory = getStudioDataDirectory();
  let db = databases.get(directory);
  if (!db) {
    fs.mkdirSync(directory, { recursive: true });
    db = new DatabaseSync(path.join(directory, "studio.sqlite"));
    db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS job_leases (job_id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL, next_poll_at INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS events (session_id TEXT NOT NULL, event_id TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(session_id,event_id));`);
    databases.set(directory, db);
  }
  return db;
}

function validId(id: string) {
  if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    throw new StudioStoreError("找不到这次创作。", 404);
  }
}
function readSession(db: DatabaseSync, id: string): StudioSession {
  validId(id);
  const row = db.prepare("SELECT payload FROM sessions WHERE id = ?").get(id) as { payload: string } | undefined;
  if (!row) throw new StudioStoreError("这次创作不存在或已被删除。", 404);
  return JSON.parse(row.payload) as StudioSession;
}
function writeSession(db: DatabaseSync, session: StudioSession) {
  session.version += 1;
  db.prepare("UPDATE sessions SET payload = ? WHERE id = ?").run(JSON.stringify(session), session.id);
}
function transaction<T>(body: (db: DatabaseSync) => T): T {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try { const result = body(db); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}

export function createStudioSession(mode?: StudioMode): StudioSession {
  const chosen = mode ?? (process.env.STUDIO_MODE === "demo" ? "demo" : "live");
  if (chosen !== "demo" && chosen !== "live") throw new StudioStoreError("体验模式无效。");
  const session: StudioSession = {
    id: randomUUID(), version: 0, artworkVersion: 0, assets: [], messages: [], proposals: [], jobs: [],
    userStatements: [], rejectedInterpretations: [], status: "active", mode: chosen, createdAt: new Date().toISOString(),
  };
  database().prepare("INSERT INTO sessions (id, payload) VALUES (?, ?)").run(session.id, JSON.stringify(session));
  return session;
}
export function getSession(id: string): StudioSession { return readSession(database(), id); }
export function mutateSession(id: string, mutate: (session: StudioSession) => void): StudioSession {
  return transaction((db) => {
    const session = readSession(db, id);
    mutate(session);
    if (session.id !== id) throw new StudioStoreError("创作标识不可修改。");
    writeSession(db, session);
    return session;
  });
}
export function listSessionIds(): string[] {
  return (database().prepare("SELECT id FROM sessions").all() as { id: string }[]).map((row) => row.id);
}
function assetDirectory(sessionId: string) {
  validId(sessionId);
  const parent = path.resolve(getStudioDataDirectory(), "assets");
  const directory = path.resolve(parent, sessionId);
  if (!directory.startsWith(parent + path.sep)) throw new StudioStoreError("作品路径无效。");
  return directory;
}
export function deleteSession(id: string) {
  transaction((db) => {
    const session = readSession(db, id);
    for (const job of session.jobs) db.prepare("DELETE FROM job_leases WHERE job_id = ?").run(job.id);
    db.prepare("DELETE FROM events WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  });
  fs.rmSync(assetDirectory(id), { force: true, recursive: true });
}
export function saveAsset(sessionId: string, bytes: Buffer, options: { kind: AssetKind; artworkVersion: number; parentId?: string; mimeType: string }): StudioAsset {
  getSession(sessionId);
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 100 * 1024 * 1024) throw new StudioStoreError("作品文件大小无效。");
  const id = randomUUID();
  const asset: StudioAsset = { id, ...options, url: `/api/assets/${id}`, createdAt: new Date().toISOString() };
  const directory = assetDirectory(sessionId);
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, id);
  fs.writeFileSync(filename, bytes, { flag: "wx" });
  try { mutateSession(sessionId, (session) => { session.assets.push(asset); }); }
  catch (error) { fs.rmSync(filename, { force: true }); throw error; }
  return asset;
}
export function readAsset(sessionId: string, assetId: string): { bytes: Buffer; asset: StudioAsset } {
  validId(assetId);
  const asset = getSession(sessionId).assets.find((item) => item.id === assetId);
  if (!asset) throw new StudioStoreError("找不到这件作品。", 404);
  try { return { bytes: fs.readFileSync(path.join(assetDirectory(sessionId), assetId)), asset }; }
  catch { throw new StudioStoreError("作品文件暂时无法读取。", 404); }
}
/** Commit the file reference and terminal job state together, serialized with cancellation. */
export function commitJobResultAsset(sessionId: string, jobId: string, bytes: Buffer, mimeType: string): StudioAsset | undefined {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 100 * 1024 * 1024) throw new StudioStoreError("作品文件大小无效。");
  let filename: string | undefined;
  try {
    return transaction((db) => {
      const session = readSession(db, sessionId);
      const job = session.jobs.find((item) => item.id === jobId);
      if (!job || !["submitted", "running"].includes(job.status)) return undefined;
      if (session.status !== "active" || job.artworkVersion !== session.artworkVersion || job.sourceAssetId !== session.activeAssetId) {
        job.status = "cancelled"; job.error = "作品已经更新，这次结果没有加入当前画面。"; job.updatedAt = new Date().toISOString();
        writeSession(db, session); return undefined;
      }
      const id = randomUUID();
      const asset: StudioAsset = { id, kind: job.kind, artworkVersion: job.artworkVersion, parentId: job.sourceAssetId, mimeType, url: `/api/assets/${id}`, createdAt: new Date().toISOString() };
      const directory = assetDirectory(sessionId);
      fs.mkdirSync(directory, { recursive: true });
      filename = path.join(directory, id);
      fs.writeFileSync(filename, bytes, { flag: "wx" });
      session.assets.push(asset);
      job.status = "succeeded"; job.resultAssetId = asset.id; job.error = undefined; job.updatedAt = new Date().toISOString();
      const proposal = session.proposals.find((item) => item.id === job.proposalId);
      if (proposal) proposal.status = "completed";
      writeSession(db, session);
      return asset;
    });
  } catch (error) {
    if (filename) fs.rmSync(filename, { force: true });
    throw error;
  }
}
export function recordWorkerHeartbeat() {
  const mode = process.env.STUDIO_MODE === "demo" ? "demo" : "live";
  database().prepare("INSERT INTO metadata (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(`worker_heartbeat_${mode}`, String(Date.now()));
}
export function getCapabilities(): StudioCapabilities {
  const mode = process.env.STUDIO_MODE === "demo" ? "demo" : "live";
  const heartbeat = database().prepare("SELECT value FROM metadata WHERE key=?").get(`worker_heartbeat_${mode}`) as { value: string } | undefined;
  const worker = !!heartbeat && Date.now() - Number(heartbeat.value) < 20_000;
  return {
    mode, chat: mode === "demo" || !!process.env.DEEPSEEK_API_KEY,
    vision: mode === "demo" || !!process.env.DEEPSEEK_API_KEY,
    image: mode === "demo" || !!(process.env.DASHSCOPE_API_KEY && process.env.DASHSCOPE_IMAGE_ENDPOINT),
    video: mode === "live" && !!(process.env.DASHSCOPE_API_KEY && process.env.DASHSCOPE_VIDEO_ENDPOINT), worker,
  };
}

/** Claim and transition under one write lock, including across web/worker processes. */
export function claimNextJob(owner: string): { session: StudioSession; job: GenerationJob } | undefined {
  return transaction((db) => {
    const mode = process.env.STUDIO_MODE === "demo" ? "demo" : "live";
    const rows = db.prepare("SELECT payload FROM sessions ORDER BY rowid").all() as { payload: string }[];
    const now = Date.now();
    for (const row of rows) {
      const session = JSON.parse(row.payload) as StudioSession;
      if (session.mode !== mode) continue;
      for (const job of session.jobs) {
        if (!["queued", "submitted", "running"].includes(job.status)) continue;
        const lease = db.prepare("SELECT expires_at,next_poll_at FROM job_leases WHERE job_id=?").get(job.id) as { expires_at: number; next_poll_at: number } | undefined;
        if (lease && (lease.expires_at > now || lease.next_poll_at > now)) continue;
        if (session.status !== "active" || job.artworkVersion !== session.artworkVersion) {
          job.status = "cancelled"; job.error = "作品已更新或创作已结束，这次请求不再继续。";
          job.updatedAt = new Date().toISOString(); writeSession(db, session); continue;
        }
        if (job.status === "submitted" && !job.providerTaskId) {
          job.status = "unknown"; job.error = "服务提交状态未能确认。为避免重复生成，没有自动重发。";
          job.updatedAt = new Date().toISOString(); writeSession(db, session); continue;
        }
        if (job.status === "queued") { job.status = "submitted"; job.updatedAt = new Date().toISOString(); writeSession(db, session); }
        db.prepare("INSERT INTO job_leases(job_id,owner,expires_at,next_poll_at) VALUES(?,?,?,0) ON CONFLICT(job_id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at,next_poll_at=0")
          .run(job.id, owner, now + 180_000);
        return { session, job };
      }
    }
    return undefined;
  });
}
export function releaseJobClaim(jobId: string, owner: string, delay = 0) {
  database().prepare("UPDATE job_leases SET expires_at=0,next_poll_at=? WHERE job_id=? AND owner=?").run(Date.now() + delay, jobId, owner);
}
export function claimEvent(sessionId: string, eventId: string): "new" | "done" | "pending" {
  if (typeof eventId !== "string" || eventId.length < 8 || eventId.length > 100) throw new StudioStoreError("操作标识无效。");
  return transaction((db) => {
    readSession(db, sessionId);
    const row = db.prepare("SELECT status FROM events WHERE session_id=? AND event_id=?").get(sessionId, eventId) as { status: "done" | "pending" } | undefined;
    if (row) return row.status;
    db.prepare("INSERT INTO events(session_id,event_id,status,created_at) VALUES(?,?,'pending',?)").run(sessionId, eventId, Date.now());
    return "new";
  });
}
export function finishEvent(sessionId: string, eventId: string) {
  database().prepare("UPDATE events SET status='done' WHERE session_id=? AND event_id=?").run(sessionId, eventId);
}
export function abandonEvent(sessionId: string, eventId: string) {
  database().prepare("DELETE FROM events WHERE session_id=? AND event_id=? AND status='pending'").run(sessionId, eventId);
}
export function closeStudioStores() { for (const db of databases.values()) db.close(); databases.clear(); }
