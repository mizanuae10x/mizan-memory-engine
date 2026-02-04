import crypto from "crypto";
import path from "path";
import { SQLiteStore } from "./store";
import { EmbeddingsClient } from "./embeddings";
import { semanticSearch } from "./search";
import { WriteAheadLog } from "./wal";
import { applyDecay } from "./decay";
import { buildSummaries } from "./summarizer";
import {
  MemoryEngineOptions,
  MemoryInput,
  MemoryRecord,
  SearchOptions,
  SearchResult,
  ListOptions,
  HealthStatus,
} from "./types";

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "memory.db");
const DEFAULT_WAL_PATH = path.resolve(process.cwd(), "memory.wal");
const CATEGORIES = new Set([
  "decision",
  "lesson",
  "preference",
  "episode",
  "fact",
  "person",
  "project",
]);

export class MemoryEngine {
  private store: SQLiteStore;
  private wal: WriteAheadLog;
  private embeddings: EmbeddingsClient;
  private decayRate: number;
  private summaryThreshold: number;
  private preserveImportanceThreshold: number;
  private walFlushThreshold: number;
  private walPending: number;

  constructor(options: MemoryEngineOptions = {}) {
    const dbPath = options.dbPath ?? process.env.MEMORY_DB_PATH ?? DEFAULT_DB_PATH;
    const walPath = options.walPath ?? DEFAULT_WAL_PATH;
    const apiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? "";
    const model = options.embeddingModel ?? "text-embedding-3-small";

    this.store = new SQLiteStore(dbPath);
    this.wal = new WriteAheadLog(walPath);
    this.embeddings = new EmbeddingsClient(apiKey, model);

    this.decayRate = options.decayRate ?? 0.05;
    this.summaryThreshold = options.summaryThreshold ?? 200;
    this.preserveImportanceThreshold =
      options.preserveImportanceThreshold ?? 0.7;
    this.walFlushThreshold = 20;
    this.walPending = 0;

    this.recoverWal();
  }

  async addMemory(input: MemoryInput): Promise<MemoryRecord> {
    this.assertValidInput(input);

    const timestamp = input.timestamp ?? Date.now();
    const lastAccessed = timestamp;
    const importance = input.importance ?? 0.5;
    const tags = input.tags ?? [];
    const embedding = await this.embeddings.embedText(input.content);

    const memory: MemoryRecord = {
      id: crypto.randomUUID(),
      content: input.content.trim(),
      category: input.category,
      tags,
      timestamp,
      importance,
      embedding,
      lastAccessed,
    };

    this.wal.appendAdd(memory);
    this.store.addMemory(memory);
    this.maybeFlushWal();

    return memory;
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!query || !query.trim()) {
      throw new Error("Search query cannot be empty.");
    }

    const results = await semanticSearch(this.store, this.embeddings, query, {
      ...options,
      keyword: options.keyword ?? query,
    });

    const now = Date.now();
    for (const result of results) {
      const boosted = Math.min(1, result.memory.importance + 0.03);
      this.store.updateAccess(result.memory.id, now);
      this.store.updateImportance(result.memory.id, boosted);
    }

    return results;
  }

  list(options: ListOptions = {}): MemoryRecord[] {
    return this.store.listMemories(options);
  }

  get(id: string): MemoryRecord | null {
    const memory = this.store.getMemory(id);
    if (!memory) return null;

    const now = Date.now();
    const boosted = Math.min(1, memory.importance + 0.02);
    this.store.updateAccess(memory.id, now);
    this.store.updateImportance(memory.id, boosted);

    return { ...memory, lastAccessed: now, importance: boosted };
  }

  delete(id: string): boolean {
    if (!id) throw new Error("Memory id is required for deletion.");
    this.wal.appendDelete(id);
    const removed = this.store.deleteMemory(id);
    this.maybeFlushWal();
    return removed;
  }

  async summarize(): Promise<{ summaries: number; deleted: number }> {
    const count = this.store.count();
    if (count < this.summaryThreshold) {
      return { summaries: 0, deleted: 0 };
    }

    const memories = this.store.getAllMemories();
    const plans = buildSummaries(memories, {
      maxGroupSize: 12,
      preserveImportanceThreshold: this.preserveImportanceThreshold,
    });

    let summaries = 0;
    let deleted = 0;

    for (const plan of plans) {
      await this.addMemory(plan.summary);
      summaries += 1;

      for (const id of plan.sourceIds) {
        if (this.delete(id)) {
          deleted += 1;
        }
      }
    }

    return { summaries, deleted };
  }

  decay(): { updated: number; pruned: number } {
    const memories = this.store.getAllMemories();
    const now = Date.now();
    let updated = 0;

    for (const memory of memories) {
      const decayed = applyDecay(memory, now, {
        decayRate: this.decayRate,
        minimumImportance: 0.05,
      });
      if (decayed.importance !== memory.importance) {
        this.store.updateImportance(memory.id, decayed.importance);
        updated += 1;
      }
    }

    const pruneBefore = now - 1000 * 60 * 60 * 24 * 365;
    const pruned = this.store.pruneBelowImportance(0.1, pruneBefore);

    return { updated, pruned };
  }

  flushWal(): void {
    this.wal.clear();
    this.walPending = 0;
  }

  health(): HealthStatus {
    return {
      ok: true,
      memoryCount: this.store.count(),
      dbPath: this.store.path,
      walPath: this.wal.path,
    };
  }

  close(): void {
    this.store.close();
  }

  private maybeFlushWal(): void {
    this.walPending += 1;
    if (this.walPending >= this.walFlushThreshold) {
      this.flushWal();
    }
  }

  private recoverWal(): void {
    const entries = this.wal.readAll();
    if (entries.length === 0) return;

    for (const entry of entries) {
      if (entry.op === "add" && entry.memory) {
        this.store.upsertMemory(entry.memory);
      }
      if (entry.op === "delete" && entry.id) {
        this.store.deleteMemory(entry.id);
      }
    }

    this.flushWal();
  }

  private assertValidInput(input: MemoryInput): void {
    if (!input.content || !input.content.trim()) {
      throw new Error("Memory content is required.");
    }
    if (!input.category) {
      throw new Error("Memory category is required.");
    }
    if (!CATEGORIES.has(input.category)) {
      throw new Error(`Invalid memory category: ${input.category}`);
    }
  }
}

export * from "./types";
