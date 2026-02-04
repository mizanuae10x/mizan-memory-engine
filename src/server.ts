import express from "express";
import { MemoryEngine, MemoryInput, MemoryCategory } from "./index";

const CATEGORIES: MemoryCategory[] = [
  "decision",
  "lesson",
  "preference",
  "episode",
  "fact",
  "person",
  "project",
];

const parseCategory = (
  value: string | undefined
): MemoryCategory | undefined => {
  if (!value) return undefined;
  if (CATEGORIES.includes(value as MemoryCategory)) {
    return value as MemoryCategory;
  }
  return undefined;
};

const parseTags = (value: string | undefined): string[] | undefined => {
  if (!value) return undefined;
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const parseDate = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return timestamp;
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return numeric;
  return undefined;
};

export const createServer = (engine: MemoryEngine): express.Express => {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json(engine.health());
  });

  app.post("/memories", async (req, res) => {
    try {
      const body = req.body as MemoryInput;
      const memory = await engine.addMemory(body);
      res.status(201).json(memory);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/memories/search", async (req, res) => {
    try {
      const query = String(req.query.q ?? "");
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const category = parseCategory(req.query.category as string | undefined);
      const tags = parseTags(req.query.tags as string | undefined);

      const results = await engine.search(query, {
        limit,
        category,
        tags,
      });

      res.json(results);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/memories", (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const category = parseCategory(req.query.category as string | undefined);
      const tags = parseTags(req.query.tags as string | undefined);
      const since = parseDate(req.query.since as string | undefined);
      const until = parseDate(req.query.until as string | undefined);

      const memories = engine.list({
        limit,
        offset,
        category,
        tags,
        since,
        until,
      });

      res.json(memories);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/memories/:id", (req, res) => {
    const memory = engine.get(req.params.id);
    if (!memory) {
      res.status(404).json({ error: "Memory not found." });
      return;
    }

    res.json(memory);
  });

  app.delete("/memories/:id", (req, res) => {
    try {
      const removed = engine.delete(req.params.id);
      if (!removed) {
        res.status(404).json({ error: "Memory not found." });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/memories/summarize", async (_req, res) => {
    try {
      const result = await engine.summarize();
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  return app;
};

export const startServer = (): void => {
  const port = Number(process.env.MEMORY_PORT ?? 3200);
  const engine = new MemoryEngine();
  const app = createServer(engine);

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Mizan Memory Engine API listening on ${port}`);
  });
};

if (require.main === module) {
  startServer();
}
