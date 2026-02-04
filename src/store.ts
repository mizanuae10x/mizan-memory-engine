import Database from "better-sqlite3";
import { MemoryRecord, ListOptions, MemoryCategory, MemoryTag } from "./types";

export class SQLiteStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  get path(): string {
    return this.dbPath;
  }

  private init(): void {
    this.db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          category TEXT NOT NULL,
          tags TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          importance REAL NOT NULL,
          embedding TEXT NOT NULL,
          lastAccessed INTEGER NOT NULL
        );
      `
      )
      .run();

    this.db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      `
      )
      .run();

    this.db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
      `
      )
      .run();
  }

  addMemory(memory: MemoryRecord): void {
    this.db
      .prepare(
        `
        INSERT INTO memories (
          id, content, category, tags, timestamp, importance, embedding, lastAccessed
        ) VALUES (
          @id, @content, @category, @tags, @timestamp, @importance, @embedding, @lastAccessed
        );
      `
      )
      .run(this.serialize(memory));
  }

  upsertMemory(memory: MemoryRecord): void {
    this.db
      .prepare(
        `
        INSERT INTO memories (
          id, content, category, tags, timestamp, importance, embedding, lastAccessed
        ) VALUES (
          @id, @content, @category, @tags, @timestamp, @importance, @embedding, @lastAccessed
        )
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          category = excluded.category,
          tags = excluded.tags,
          timestamp = excluded.timestamp,
          importance = excluded.importance,
          embedding = excluded.embedding,
          lastAccessed = excluded.lastAccessed;
      `
      )
      .run(this.serialize(memory));
  }

  getMemory(id: string): MemoryRecord | null {
    const row = this.db
      .prepare("SELECT * FROM memories WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.deserialize(row);
  }

  deleteMemory(id: string): boolean {
    const info = this.db
      .prepare("DELETE FROM memories WHERE id = ?")
      .run(id);
    return info.changes > 0;
  }

  listMemories(options: ListOptions = {}): MemoryRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.category) {
      clauses.push("category = @category");
      params.category = options.category;
    }

    if (options.since) {
      clauses.push("timestamp >= @since");
      params.since = options.since;
    }

    if (options.until) {
      clauses.push("timestamp <= @until");
      params.until = options.until;
    }

    let sql = "SELECT * FROM memories";
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }

    sql += " ORDER BY timestamp DESC";

    if (typeof options.limit === "number") {
      sql += " LIMIT @limit";
      params.limit = options.limit;
    }

    if (typeof options.offset === "number") {
      sql += " OFFSET @offset";
      params.offset = options.offset;
    }

    const rows = this.db.prepare(sql).all(params) as Record<string, unknown>[];
    const memories = rows.map((row) => this.deserialize(row));

    if (options.tags && options.tags.length > 0) {
      return memories.filter((memory) =>
        options.tags?.every((tag) => memory.tags.includes(tag))
      );
    }

    return memories;
  }

  getAllMemories(): MemoryRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM memories")
      .all() as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  updateAccess(id: string, timestamp: number): void {
    this.db
      .prepare("UPDATE memories SET lastAccessed = ? WHERE id = ?")
      .run(timestamp, id);
  }

  updateImportance(id: string, importance: number): void {
    this.db
      .prepare("UPDATE memories SET importance = ? WHERE id = ?")
      .run(importance, id);
  }

  pruneBelowImportance(threshold: number, olderThan: number): number {
    const info = this.db
      .prepare(
        "DELETE FROM memories WHERE importance < ? AND timestamp < ?"
      )
      .run(threshold, olderThan);
    return info.changes;
  }

  count(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM memories")
      .get() as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }

  private serialize(memory: MemoryRecord): Record<string, unknown> {
    return {
      ...memory,
      tags: JSON.stringify(memory.tags),
      embedding: JSON.stringify(memory.embedding),
    };
  }

  private deserialize(row: Record<string, unknown>): MemoryRecord {
    return {
      id: String(row.id),
      content: String(row.content),
      category: row.category as MemoryCategory,
      tags: JSON.parse(String(row.tags)) as MemoryTag[],
      timestamp: Number(row.timestamp),
      importance: Number(row.importance),
      embedding: JSON.parse(String(row.embedding)) as number[],
      lastAccessed: Number(row.lastAccessed),
    };
  }
}
