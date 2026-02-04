import { MemoryRecord, MemoryCategory, MemoryInput } from "./types";

export interface SummarizeOptions {
  maxGroupSize: number;
  preserveImportanceThreshold: number;
}

export interface SummaryPlan {
  summary: MemoryInput;
  sourceIds: string[];
}

const summarizeText = (memories: MemoryRecord[]): string => {
  const snippets = memories.map((memory) => {
    const trimmed = memory.content.trim();
    if (trimmed.length <= 140) return trimmed;
    return `${trimmed.slice(0, 137)}...`;
  });
  return snippets.join(" ");
};

export const buildSummaries = (
  memories: MemoryRecord[],
  options: SummarizeOptions
): SummaryPlan[] => {
  const grouped = new Map<MemoryCategory, MemoryRecord[]>();
  for (const memory of memories) {
    if (memory.importance >= options.preserveImportanceThreshold) continue;
    const list = grouped.get(memory.category) ?? [];
    list.push(memory);
    grouped.set(memory.category, list);
  }

  const plans: SummaryPlan[] = [];
  for (const [category, group] of grouped.entries()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.timestamp - b.timestamp);

    const slice = group.slice(0, options.maxGroupSize);
    const start = new Date(slice[0].timestamp).toISOString();
    const end = new Date(slice[slice.length - 1].timestamp).toISOString();
    const content = `Summary (${category}) ${start} - ${end}: ${summarizeText(
      slice
    )}`;

    plans.push({
      summary: {
        content,
        category,
        tags: ["summary"],
        timestamp: Date.now(),
        importance: options.preserveImportanceThreshold,
      },
      sourceIds: slice.map((memory) => memory.id),
    });
  }

  return plans;
};
