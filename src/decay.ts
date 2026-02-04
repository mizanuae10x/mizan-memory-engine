import { MemoryRecord } from "./types";

export interface DecayOptions {
  decayRate: number;
  minimumImportance: number;
}

export const applyDecay = (
  memory: MemoryRecord,
  now: number,
  options: DecayOptions
): MemoryRecord => {
  const ageMs = Math.max(0, now - memory.lastAccessed);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const decayed = memory.importance * Math.exp(-options.decayRate * ageDays);
  const importance = Math.max(options.minimumImportance, decayed);
  return { ...memory, importance };
};
