import OpenAI from "openai";

export class EmbeddingsClient {
  private client?: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
    this.model = model;
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.client) {
      throw new Error("OPENAI_API_KEY is required for embeddings.");
    }
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });

    const vector = response.data[0]?.embedding;
    if (!vector || vector.length === 0) {
      throw new Error("Failed to generate embedding.");
    }

    return vector;
  }
}

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};
