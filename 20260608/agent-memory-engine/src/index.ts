/**
 * Public API surface for the Agent Memory Engine.
 *
 * Typical usage:
 *
 *   import { AgentMemory } from "agent-memory-engine";
 *
 *   const mem = new AgentMemory();
 *   mem.remember("The user prefers TypeScript over Rust", { importance: 0.9 });
 *   const hits = mem.recall("what language does the user like?");
 *   console.log(hits[0].record.content);
 */

export { AgentMemory, extractEntities } from "./memoryStore.ts";
export type { AgentMemoryConfig } from "./memoryStore.ts";
export { ContextGraph } from "./contextGraph.ts";
export type { RelatedEntity } from "./contextGraph.ts";
export { embed, cosineSimilarity, tokenize, EMBED_DIM } from "./embedding.ts";
export {
  scoreMemory,
  retention,
  reinforcement,
  DEFAULT_WEIGHTS,
  DEFAULT_HALF_LIFE_MS,
} from "./scoring.ts";
export type { ScoreWeights } from "./scoring.ts";
export type {
  Clock,
  MemoryKind,
  MemoryRecord,
  RememberOptions,
  RecallOptions,
  RetrievalResult,
  ScoreBreakdown,
} from "./types.ts";
