export type MemoryCategory =
  | "decision"
  | "lesson"
  | "preference"
  | "episode"
  | "fact"
  | "person"
  | "project";

export type MemoryTag = string;

export interface MemoryInput {
  content: string;
  category: MemoryCategory;
  tags?: MemoryTag[];
  timestamp?: number;
  importance?: number;
}

export interface MemoryRecord {
  id: string;
  content: string;
  category: MemoryCategory;
  tags: MemoryTag[];
  timestamp: number;
  importance: number;
  embedding: number[];
  lastAccessed: number;
}

export interface SearchOptions {
  limit?: number;
  category?: MemoryCategory;
  tags?: MemoryTag[];
  keyword?: string;
}

export interface SearchResult {
  memory: MemoryRecord;
  score: number;
}

export interface ListOptions {
  category?: MemoryCategory;
  tags?: MemoryTag[];
  since?: number;
  until?: number;
  limit?: number;
  offset?: number;
}

export interface MemoryEngineOptions {
  dbPath?: string;
  walPath?: string;
  openaiApiKey?: string;
  embeddingModel?: string;
  decayRate?: number;
  summaryThreshold?: number;
  preserveImportanceThreshold?: number;
}

export interface HealthStatus {
  ok: boolean;
  memoryCount: number;
  dbPath: string;
  walPath: string;
}
