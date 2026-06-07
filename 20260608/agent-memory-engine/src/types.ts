/**
 * Core type definitions for the Agent Memory Engine.
 *
 * The engine models a biologically-inspired, layered memory hierarchy that is
 * at the centre of the 2026 "context engineering" trend: the idea that an
 * agent's *memory* — not the underlying model — is the product.
 */

/** The three layers of the memory hierarchy. */
export type MemoryKind = "working" | "episodic" | "semantic";

/** A single unit of memory held by an agent. */
export interface MemoryRecord {
  /** Stable, unique identifier. */
  id: string;
  /** Which layer of the hierarchy this record currently lives in. */
  kind: MemoryKind;
  /** Raw natural-language content the agent observed or derived. */
  content: string;
  /** Dense vector used for relevance retrieval (locally computed, no network). */
  embedding: Float32Array;
  /** Named entities mentioned by this memory; links it into the context graph. */
  entities: string[];
  /**
   * Subjective importance in [0, 1]. High-importance memories decay slower and
   * are preferentially promoted to the semantic layer during consolidation.
   */
  importance: number;
  /** Epoch milliseconds at which the memory was first written. */
  createdAt: number;
  /** Epoch milliseconds at which the memory was last recalled. */
  lastAccessedAt: number;
  /** How many times the memory has been recalled — drives reinforcement. */
  accessCount: number;
  /** Free-form caller metadata (source, conversation id, tags, ...). */
  metadata: Record<string, unknown>;
}

/** Options accepted when storing a new memory. */
export interface RememberOptions {
  importance?: number;
  entities?: string[];
  metadata?: Record<string, unknown>;
  /** Override the layer a memory is written to (defaults to "episodic"). */
  kind?: MemoryKind;
}

/** Options accepted when recalling memories. */
export interface RecallOptions {
  /** Maximum number of memories to return. Defaults to 5. */
  limit?: number;
  /** Restrict recall to a single layer. */
  kind?: MemoryKind;
  /** Use the context graph to expand the query with related entities. */
  expandGraph?: boolean;
  /** Recalling a memory reinforces it (updates access stats). Defaults to true. */
  reinforce?: boolean;
}

/** The weighted breakdown behind a single retrieval score. */
export interface ScoreBreakdown {
  relevance: number;
  recency: number;
  importance: number;
  reinforcement: number;
  total: number;
}

/** A memory returned from recall, paired with why it was chosen. */
export interface RetrievalResult {
  record: MemoryRecord;
  score: ScoreBreakdown;
}

/** Injectable clock so behaviour over time can be tested deterministically. */
export type Clock = () => number;
