# CODEX.md — Build Instructions for Codex CLI

## Project: محرك ذاكرة ميزان (Mizan Memory Engine)
## Category: ai-agent

## Description
A standalone long-term memory system for AI agents. Supports WAL protocol, semantic search, vector embeddings, automatic summarization, and memory decay. Works with any LLM agent.

## Features to Build
1. بحث دلالي في الذاكرة
2. تلخيص تلقائي
3. WAL protocol
4. REST API + CLI
5. تكامل مع OpenClaw

## Tech Stack
TypeScript, SQLite, OpenAI Embeddings, Node.js

## Design Guidelines
- RTL layout (Arabic first)
- Color scheme: Gold #D4AF37, Dark #1B1D21, Beige #f2eccf
- MOJ branding
- Mobile responsive
- Accessibility compliant

## Architecture
- Use Next.js App Router
- API routes in /app/api/
- Components in /components/
- Arabic + English i18n support
- Tailwind CSS for styling

## Priority Order
1. Core functionality first
2. UI/UX polish
3. API integration
4. Testing
