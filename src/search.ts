import { SQLiteStore } from "./store";
import { EmbeddingsClient, cosineSimilarity } from "./embeddings";
import { SearchOptions, SearchResult, MemoryRecord } from "./types";

const keywordScore = (memory: MemoryRecord, keyword: string): number => {
  const text = `${memory.content} ${memory.tags.join(" ")}`.toLowerCase();
  const tokens = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  let matches = 0;
  for (const token of tokens) {
    if (text.includes(token)) matches += 1;
  }

  return matches / tokens.length;
};

export const semanticSearch = async (
  store: SQLiteStore,
  embeddings: EmbeddingsClient,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> => {
  const allMemories = store.getAllMemories();
  if (allMemories.length === 0) return [];

  const queryEmbedding = await embeddings.embedText(query);
  const keyword = options.keyword ?? query;

  let candidates = allMemories;
  if (options.category) {
    candidates = candidates.filter(
      (memory) => memory.category === options.category
    );
  }
  if (options.tags && options.tags.length > 0) {
    candidates = candidates.filter((memory) =>
      options.tags?.every((tag) => memory.tags.includes(tag))
    );
  }

  const scored = candidates.map((memory) => {
    const semantic = cosineSimilarity(queryEmbedding, memory.embedding);
    const keywordBoost = keywordScore(memory, keyword);
    const score = semantic * 0.8 + keywordBoost * 0.2;
    return { memory, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const limit = options.limit ?? 10;
  return scored.slice(0, limit);
};
