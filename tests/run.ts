import assert from "assert";
import fs from "fs";
import path from "path";
import { SQLiteStore } from "../src/store";
import { WriteAheadLog } from "../src/wal";
import { cosineSimilarity } from "../src/embeddings";
import { MemoryRecord } from "../src/types";

const TEST_DB = path.join(__dirname, "test.db");
const TEST_WAL = path.join(__dirname, "test.wal");

function cleanup() {
  [TEST_DB, TEST_WAL].forEach((f) => {
    try { fs.unlinkSync(f); } catch {}
  });
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

// ===== STORE TESTS =====
console.log("\n📦 Store Tests:");
cleanup();

test("Create store and add memory", () => {
  const store = new SQLiteStore(TEST_DB);
  const record: MemoryRecord = {
    id: "test-1",
    content: "Abdullah prefers Arabic communication",
    category: "preference",
    tags: ["language", "communication"],
    timestamp: Date.now(),
    importance: 0.8,
    embedding: Array(1536).fill(0.01),
    lastAccessed: Date.now(),
  };
  store.addMemory(record);
  const retrieved = store.getMemory("test-1");
  assert.ok(retrieved, "Record should exist");
  assert.strictEqual(retrieved!.content, "Abdullah prefers Arabic communication");
  assert.strictEqual(retrieved!.category, "preference");
  store.close();
});

test("List memories by category", () => {
  const store = new SQLiteStore(TEST_DB);
  const records = store.listMemories({ category: "preference" });
  assert.ok(records.length >= 1, "Should find at least 1 preference");
  store.close();
});

test("Count memories", () => {
  const store = new SQLiteStore(TEST_DB);
  const count = store.count();
  assert.strictEqual(count, 1, "Should have 1 memory");
  store.close();
});

test("Update importance", () => {
  const store = new SQLiteStore(TEST_DB);
  store.updateImportance("test-1", 0.95);
  const record = store.getMemory("test-1");
  assert.ok(record, "Record should exist");
  assert.strictEqual(record!.importance, 0.95);
  store.close();
});

test("Delete memory", () => {
  const store = new SQLiteStore(TEST_DB);
  store.deleteMemory("test-1");
  const retrieved = store.getMemory("test-1");
  assert.strictEqual(retrieved, null, "Should be deleted");
  assert.strictEqual(store.count(), 0, "Count should be 0");
  store.close();
});

// ===== WAL TESTS =====
console.log("\n📝 WAL Tests:");
cleanup();

test("Write to WAL and read back", () => {
  const wal = new WriteAheadLog(TEST_WAL);
  const record: MemoryRecord = {
    id: "wal-1", content: "test entry", category: "fact",
    tags: [], timestamp: Date.now(), importance: 0.5,
    embedding: [0.1, 0.2], lastAccessed: Date.now(),
  };
  wal.appendAdd(record);
  wal.appendDelete("old-id");
  const entries = wal.readAll();
  assert.strictEqual(entries.length, 2, "Should have 2 WAL entries");
  assert.strictEqual(entries[0].op, "add");
  assert.strictEqual(entries[0].memory!.id, "wal-1");
  assert.strictEqual(entries[1].op, "delete");
  assert.strictEqual(entries[1].id, "old-id");
});

test("Clear WAL", () => {
  const wal = new WriteAheadLog(TEST_WAL);
  wal.clear();
  const entries = wal.readAll();
  assert.strictEqual(entries.length, 0, "WAL should be empty after clear");
});

// ===== EMBEDDINGS TESTS =====
console.log("\n🔍 Cosine Similarity Tests:");

test("Identical vectors = similarity 1", () => {
  const a = [1, 0, 0];
  const b = [1, 0, 0];
  const sim = cosineSimilarity(a, b);
  assert.ok(Math.abs(sim - 1) < 0.001, `Expected ~1, got ${sim}`);
});

test("Orthogonal vectors = similarity 0", () => {
  const a = [1, 0, 0];
  const b = [0, 1, 0];
  const sim = cosineSimilarity(a, b);
  assert.ok(Math.abs(sim) < 0.001, `Expected ~0, got ${sim}`);
});

test("Similar vectors = high similarity", () => {
  const a = [1, 0, 0, 0];
  const b = [0.9, 0.1, 0, 0];
  const sim = cosineSimilarity(a, b);
  assert.ok(sim > 0.9, `Expected >0.9, got ${sim}`);
});

// ===== INTEGRATION TEST =====
console.log("\n🔗 Integration Tests:");

test("Full flow: WAL → Store", () => {
  cleanup();
  const wal = new WriteAheadLog(TEST_WAL);
  const store = new SQLiteStore(TEST_DB);

  // Write to WAL first
  const mem: MemoryRecord = {
    id: "int-1", content: "Integration test memory", category: "lesson",
    tags: ["test"], timestamp: Date.now(), importance: 0.7,
    embedding: Array(10).fill(0.1), lastAccessed: Date.now(),
  };
  wal.appendAdd(mem);

  // Replay WAL to store
  const entries = wal.readAll();
  for (const entry of entries) {
    if (entry.op === "add" && entry.memory) {
      store.addMemory(entry.memory);
    }
  }

  // Verify in store
  const retrieved = store.getMemory("int-1");
  assert.ok(retrieved, "Memory should be in store after WAL replay");
  assert.strictEqual(retrieved!.content, "Integration test memory");

  // Clear WAL after replay
  wal.clear();
  assert.strictEqual(wal.readAll().length, 0, "WAL should be empty after replay");

  store.close();
});

// ===== SUMMARY =====
cleanup();
console.log(`\n${"=".repeat(40)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(40)}\n`);
process.exit(failed > 0 ? 1 : 0);
