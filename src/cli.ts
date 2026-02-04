import { Command } from "commander";
import { MemoryEngine, MemoryCategory, MemoryInput } from "./index";
import { startServer } from "./server";

const CATEGORIES: MemoryCategory[] = [
  "decision",
  "lesson",
  "preference",
  "episode",
  "fact",
  "person",
  "project",
];

const parseCategory = (value: string): MemoryCategory => {
  if (!CATEGORIES.includes(value as MemoryCategory)) {
    throw new Error(`Invalid category: ${value}`);
  }
  return value as MemoryCategory;
};

const parseTags = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const parseDurationMs = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2];

  const unitMs: Record<string, number> = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
  };

  return amount * unitMs[unit];
};

export const runCli = async (): Promise<void> => {
  const program = new Command();
  program
    .name("mizan-memory")
    .description("Mizan Memory Engine CLI")
    .version("0.1.0");

  program
    .command("add")
    .argument("<content>", "Memory content")
    .requiredOption("--category <category>", "Memory category")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--importance <importance>", "Importance score", "0.5")
    .action(async (content, options) => {
      const engine = new MemoryEngine();
      try {
        const input: MemoryInput = {
          content,
          category: parseCategory(options.category),
          tags: parseTags(options.tags),
          importance: Number(options.importance),
        };
        const memory = await engine.addMemory(input);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(memory, null, 2));
      } finally {
        engine.close();
      }
    });

  program
    .command("search")
    .argument("<query>", "Search query")
    .option("--limit <limit>", "Max results", "10")
    .option("--category <category>", "Filter by category")
    .option("--tags <tags>", "Filter by tags")
    .action(async (query, options) => {
      const engine = new MemoryEngine();
      try {
        const results = await engine.search(query, {
          limit: Number(options.limit),
          category: options.category
            ? parseCategory(options.category)
            : undefined,
          tags: parseTags(options.tags),
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(results, null, 2));
      } finally {
        engine.close();
      }
    });

  program
    .command("list")
    .option("--category <category>", "Filter by category")
    .option("--tags <tags>", "Filter by tags")
    .option("--since <duration>", "Relative duration like 7d, 12h")
    .option("--limit <limit>", "Max results")
    .action((options) => {
      const engine = new MemoryEngine();
      try {
        const duration = parseDurationMs(options.since);
        const since = duration ? Date.now() - duration : undefined;
        const memories = engine.list({
          category: options.category
            ? parseCategory(options.category)
            : undefined,
          tags: parseTags(options.tags),
          since,
          limit: options.limit ? Number(options.limit) : undefined,
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(memories, null, 2));
      } finally {
        engine.close();
      }
    });

  program
    .command("export")
    .option("--format <format>", "Export format (json)", "json")
    .action((options) => {
      const engine = new MemoryEngine();
      try {
        const format = String(options.format).toLowerCase();
        const memories = engine.list();
        if (format !== "json") {
          throw new Error("Only json export is supported.");
        }
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(memories, null, 2));
      } finally {
        engine.close();
      }
    });

  program
    .command("serve")
    .option("--port <port>", "API port")
    .action((options) => {
      if (options.port) {
        process.env.MEMORY_PORT = String(options.port);
      }
      startServer();
    });

  await program.parseAsync(process.argv);
};

if (require.main === module) {
  runCli();
}
