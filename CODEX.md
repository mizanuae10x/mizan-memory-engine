# CODEX.md — Build Instructions

## Project: Mizan Memory Engine
A standalone long-term memory system for AI agents.

## What to Build
A TypeScript/Node.js package that provides persistent, searchable memory for AI agents.

## Architecture

```
src/
├── index.ts          — Main entry, exports MemoryEngine class
├── store.ts          — SQLite storage layer (better-sqlite3)
├── embeddings.ts     — OpenAI embeddings integration
├── search.ts         — Semantic search + keyword search
├── summarizer.ts     — Auto-summarization of old memories
├── wal.ts            — Write-Ahead Log protocol
├── decay.ts          — Memory decay/importance scoring
├── types.ts          — TypeScript interfaces
├── cli.ts            — CLI interface (memory add/search/list/export)
└── server.ts         — REST API server (Express)
```

## Core Features

### 1. Memory Storage (SQLite)
- Store memories with: id, content, category, tags, timestamp, importance, embedding
- Categories: decision, lesson, preference, episode, fact, person, project
- SQLite via better-sqlite3 (no async needed, fast)

### 2. Semantic Search
- Generate embeddings via OpenAI text-embedding-3-small
- Cosine similarity search
- Combine with keyword/tag search
- Return top-K results with relevance scores

### 3. WAL Protocol
- Write-ahead log for crash safety
- Append new memories to WAL first
- Periodic flush to main DB
- Recovery on startup

### 4. Auto-Summarization
- When memory count exceeds threshold, summarize old entries
- Group by category, merge similar memories
- Keep important memories intact (high importance score)

### 5. Memory Decay
- Memories lose importance over time unless accessed
- Access refreshes importance
- Configurable decay rate
- Pruning of very old, unimportant memories

### 6. REST API
- POST /memories — add a memory
- GET /memories/search?q=... — semantic search
- GET /memories — list (with filters: category, tags, date range)
- GET /memories/:id — get specific memory
- DELETE /memories/:id — delete
- POST /memories/summarize — trigger summarization
- GET /health — health check

### 7. CLI
- `mizan-memory add "content" --category decision --tags tag1,tag2`
- `mizan-memory search "query" --limit 10`
- `mizan-memory list --category lessons --since 7d`
- `mizan-memory export --format json`
- `mizan-memory serve --port 3200`

## Tech Stack
- TypeScript (strict mode)
- better-sqlite3 for storage
- OpenAI SDK for embeddings
- Express for REST API
- Commander for CLI
- Vitest for testing

## package.json Scripts
- `npm run build` — compile TypeScript
- `npm run dev` — watch mode
- `npm run test` — run tests
- `npm run serve` — start API server
- `npm run cli` — run CLI

## Environment Variables
- `OPENAI_API_KEY` — for embeddings
- `MEMORY_DB_PATH` — SQLite file path (default: ./memory.db)
- `MEMORY_PORT` — API port (default: 3200)

## Quality
- Full TypeScript types, no `any`
- JSDoc comments on public methods
- Error handling with descriptive messages
- Input validation on API endpoints

## Do NOT
- Do not use Next.js (this is a backend package)
- Do not add any frontend/UI
- Do not use async SQLite (use better-sqlite3 sync API)
- Do not hardcode API keys
