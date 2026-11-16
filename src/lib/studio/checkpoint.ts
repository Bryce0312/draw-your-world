import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver, WRITES_IDX_MAP, compareWritesSortKeys, writesSortKey,
  type Checkpoint, type CheckpointMetadata, type CheckpointListOptions,
  type CheckpointTuple, type PendingWrite,
} from "@langchain/langgraph-checkpoint";
import { getStudioDataDirectory } from "./store";

type SavedCheckpoint = {
  thread_id: string; namespace: string; checkpoint_id: string; parent_id: string | null;
  checkpoint_type: string; checkpoint: Uint8Array; metadata_type: string; metadata: Uint8Array;
};
type SavedWrite = { task_id: string; task_path: string; idx: number; channel: string; value_type: string; value: Uint8Array };

/** Local durable LangGraph checkpoints without a native npm SQLite extension. */
export class StudioCheckpointSaver extends BaseCheckpointSaver {
  private readonly database: DatabaseSync;

  constructor(filename = join(getStudioDataDirectory(), "checkpoints.sqlite")) {
    super();
    mkdirSync(dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    this.database.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS graph_checkpoints (
        thread_id TEXT NOT NULL, namespace TEXT NOT NULL, checkpoint_id TEXT NOT NULL,
        parent_id TEXT, checkpoint_type TEXT NOT NULL, checkpoint BLOB NOT NULL,
        metadata_type TEXT NOT NULL, metadata BLOB NOT NULL,
        PRIMARY KEY (thread_id, namespace, checkpoint_id)
      );
      CREATE TABLE IF NOT EXISTS graph_writes (
        thread_id TEXT NOT NULL, namespace TEXT NOT NULL, checkpoint_id TEXT NOT NULL,
        task_id TEXT NOT NULL, task_path TEXT NOT NULL, idx INTEGER NOT NULL,
        channel TEXT NOT NULL, value_type TEXT NOT NULL, value BLOB NOT NULL,
        PRIMARY KEY (thread_id, namespace, checkpoint_id, task_id, idx)
      );
    `);
  }

  private async tuple(row: SavedCheckpoint): Promise<CheckpointTuple> {
    const writes = this.database.prepare(`SELECT task_id, task_path, idx, channel, value_type, value
      FROM graph_writes WHERE thread_id=? AND namespace=? AND checkpoint_id=?`)
      .all(row.thread_id, row.namespace, row.checkpoint_id) as unknown as SavedWrite[];
    writes.sort((a, b) => compareWritesSortKeys(writesSortKey(a.task_path, a.task_id, a.idx), writesSortKey(b.task_path, b.task_id, b.idx)));
    return {
      config: { configurable: { thread_id: row.thread_id, checkpoint_ns: row.namespace, checkpoint_id: row.checkpoint_id } },
      checkpoint: await this.serde.loadsTyped(row.checkpoint_type, row.checkpoint) as Checkpoint,
      metadata: await this.serde.loadsTyped(row.metadata_type, row.metadata) as CheckpointMetadata,
      pendingWrites: await Promise.all(writes.map(async (write) => [write.task_id, write.channel, await this.serde.loadsTyped(write.value_type, write.value)] as [string, string, unknown])),
      ...(row.parent_id ? { parentConfig: { configurable: { thread_id: row.thread_id, checkpoint_ns: row.namespace, checkpoint_id: row.parent_id } } } : {}),
    };
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const thread = config.configurable?.thread_id;
    if (!thread) return undefined;
    const namespace = config.configurable?.checkpoint_ns ?? "";
    const checkpoint = config.configurable?.checkpoint_id;
    const row = checkpoint
      ? this.database.prepare("SELECT * FROM graph_checkpoints WHERE thread_id=? AND namespace=? AND checkpoint_id=?").get(thread, namespace, checkpoint)
      : this.database.prepare("SELECT * FROM graph_checkpoints WHERE thread_id=? AND namespace=? ORDER BY checkpoint_id DESC LIMIT 1").get(thread, namespace);
    return row ? this.tuple(row as unknown as SavedCheckpoint) : undefined;
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const conditions: string[] = [];
    const parameters: SQLInputValue[] = [];
    for (const [column, value] of [["thread_id", config.configurable?.thread_id], ["namespace", config.configurable?.checkpoint_ns], ["checkpoint_id", config.configurable?.checkpoint_id]] as const) {
      if (value !== undefined) { conditions.push(`${column}=?`); parameters.push(value); }
    }
    if (options?.before?.configurable?.checkpoint_id) { conditions.push("checkpoint_id<?"); parameters.push(options.before.configurable.checkpoint_id); }
    const rows = this.database.prepare(`SELECT * FROM graph_checkpoints ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY checkpoint_id DESC`).all(...parameters) as unknown as SavedCheckpoint[];
    let count = 0;
    for (const row of rows) {
      if (options?.limit !== undefined && count >= options.limit) break;
      const tuple = await this.tuple(row);
      if (options?.filter && !Object.entries(options.filter).every(([key, value]) => (tuple.metadata as unknown as Record<string, unknown>)?.[key] === value)) continue;
      count += 1;
      yield tuple;
    }
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<RunnableConfig> {
    const thread = config.configurable?.thread_id;
    if (!thread) throw new Error("Checkpoint requires a thread_id.");
    const namespace = config.configurable?.checkpoint_ns ?? "";
    const [[checkpointType, checkpointBytes], [metadataType, metadataBytes]] = await Promise.all([this.serde.dumpsTyped(checkpoint), this.serde.dumpsTyped(metadata)]);
    this.database.prepare(`INSERT OR REPLACE INTO graph_checkpoints
      (thread_id, namespace, checkpoint_id, parent_id, checkpoint_type, checkpoint, metadata_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(thread, namespace, checkpoint.id, config.configurable?.checkpoint_id ?? null, checkpointType, checkpointBytes, metadataType, metadataBytes);
    return { configurable: { thread_id: thread, checkpoint_ns: namespace, checkpoint_id: checkpoint.id } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string, taskPath = ""): Promise<void> {
    const thread = config.configurable?.thread_id;
    const checkpoint = config.configurable?.checkpoint_id;
    if (!thread || !checkpoint) throw new Error("Checkpoint writes require a thread and checkpoint.");
    const namespace = config.configurable?.checkpoint_ns ?? "";
    const serialized = await Promise.all(writes.map(async ([channel, value], index) => ({ channel, index: WRITES_IDX_MAP[channel] ?? index, serialized: await this.serde.dumpsTyped(value) })));
    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const write of serialized) {
        const operation = write.index < 0 ? "REPLACE" : "IGNORE";
        this.database.prepare(`INSERT OR ${operation} INTO graph_writes
          (thread_id, namespace, checkpoint_id, task_id, task_path, idx, channel, value_type, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(thread, namespace, checkpoint, taskId, taskPath, write.index, write.channel, write.serialized[0], write.serialized[1]);
      }
      this.database.exec("COMMIT");
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }

  async deleteThread(threadId: string): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.prepare("DELETE FROM graph_writes WHERE thread_id=?").run(threadId);
      this.database.prepare("DELETE FROM graph_checkpoints WHERE thread_id=?").run(threadId);
      this.database.exec("COMMIT");
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }

  close(): void { this.database.close(); }
}
