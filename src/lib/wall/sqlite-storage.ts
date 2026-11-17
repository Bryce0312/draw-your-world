import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { WallSession } from "./types";
import { WallError, wallMode } from "./wall-storage";

interface LocalWall {
  session: WallSession;
  version: string;
}

const runtime = globalThis as typeof globalThis & {
  wallStorageMemory?: Map<string, LocalWall>;
  wallStorageDatabases?: Map<string, DatabaseSync>;
};
const memory = runtime.wallStorageMemory ??= new Map<string, LocalWall>();
const databases = runtime.wallStorageDatabases ??= new Map<string, DatabaseSync>();

function location() {
  return path.resolve(process.env.STUDIO_DATA_DIR || path.join(process.cwd(), ".data"), `wall-${wallMode()}.sqlite`);
}

function database() {
  const file = location();
  let db = databases.get(file);
  if (!db) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS wall_sessions(id TEXT PRIMARY KEY, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0)");
    const columns = db.prepare("PRAGMA table_info(wall_sessions)").all() as { name: string }[];
    if (!columns.some(column => column.name === "version")) {
      db.exec("ALTER TABLE wall_sessions ADD COLUMN version INTEGER NOT NULL DEFAULT 0");
    }
    databases.set(file, db);
  }
  return db;
}

export function readLocalWall(id: string): LocalWall | undefined {
  const row = database().prepare("SELECT payload, version FROM wall_sessions WHERE id = ?").get(id) as { payload: string; version: number } | undefined;
  if (!row) return;
  const version = String(row.version);
  const cacheKey = `${location()}:${id}`;
  const cached = memory.get(cacheKey);
  if (cached?.version === version) return structuredClone(cached);
  const result = { session: JSON.parse(row.payload) as WallSession, version };
  memory.set(cacheKey, result);
  return structuredClone(result);
}

export function writeLocalWall(session: WallSession, retained: WallSession, version: string | null): string {
  const db = database();
  const nextVersion = version === null ? 1 : Number(version) + 1;
  const result = version === null
    ? db.prepare("INSERT OR IGNORE INTO wall_sessions(id, payload, version) VALUES (?, ?, ?)").run(session.id, JSON.stringify(retained), nextVersion)
    : db.prepare("UPDATE wall_sessions SET payload = ?, version = ? WHERE id = ? AND version = ?").run(JSON.stringify(retained), nextVersion, session.id, Number(version));
  if (result.changes !== 1) {
    throw new WallError("This drawing collection changed in another request. Reload the current version and try again.", 409);
  }
  const next = String(nextVersion);
  memory.set(`${location()}:${session.id}`, { session: structuredClone(session), version: next });
  return next;
}
