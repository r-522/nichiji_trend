/**
 * AgentMemory — the core engine.
 *
 * Implements the three-layer memory hierarchy that has become the reference
 * architecture for agent memory in 2026:
 *
 *   working   — a small, fixed-size buffer of the most recent observations
 *               (the agent's "attention span"); overflow spills into episodic.
 *   episodic  — timestamped events that decay along a forgetting curve.
 *   semantic  — durable, consolidated facts distilled from episodic memory;
 *               these effectively never decay.
 *
 * The engine ties together local embeddings (relevance), a forgetting curve
 * (recency), salience (importance) and reinforcement, and a context graph
 * (association) to produce explainable retrievals.
 */

import { embed, cosineSimilarity } from "./embedding.ts";
import { ContextGraph } from "./contextGraph.ts";
import {
  scoreMemory,
  DEFAULT_WEIGHTS,
  DEFAULT_HALF_LIFE_MS,
  retention,
  type ScoreWeights,
} from "./scoring.ts";
import type {
  Clock,
  MemoryKind,
  MemoryRecord,
  RecallOptions,
  RememberOptions,
  RetrievalResult,
} from "./types.ts";

export interface AgentMemoryConfig {
  /** Max items kept in the working buffer before spilling to episodic. */
  workingCapacity?: number;
  /** Forgetting half-life for episodic memory, in ms. */
  halfLifeMs?: number;
  /** Scoring weights for retrieval. */
  weights?: ScoreWeights;
  /** Injectable clock for deterministic tests. */
  clock?: Clock;
}

/** A naive but serviceable entity extractor: capitalised words + #hashtags. */
export function extractEntities(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/#(\w+)/gu)) out.add(m[1].toLowerCase());
  for (const m of text.matchAll(/\b([A-Z][a-zA-Z0-9]{2,})\b/gu)) {
    out.add(m[1].toLowerCase());
  }
  return [...out];
}

export class AgentMemory {
  private readonly records = new Map<string, MemoryRecord>();
  private readonly working: string[] = []; // ordered list of ids, oldest first
  readonly graph = new ContextGraph();

  private readonly workingCapacity: number;
  private readonly halfLifeMs: number;
  private readonly weights: ScoreWeights;
  private readonly clock: Clock;
  private seq = 0;

  constructor(config: AgentMemoryConfig = {}) {
    this.workingCapacity = config.workingCapacity ?? 5;
    this.halfLifeMs = config.halfLifeMs ?? DEFAULT_HALF_LIFE_MS;
    this.weights = config.weights ?? DEFAULT_WEIGHTS;
    this.clock = config.clock ?? Date.now;
  }

  /** Store a new memory. Defaults to the episodic layer + working buffer. */
  remember(content: string, opts: RememberOptions = {}): MemoryRecord {
    const now = this.clock();
    const entities = [
      ...new Set([...(opts.entities ?? []), ...extractEntities(content)]),
    ].map((e) => e.toLowerCase());

    const record: MemoryRecord = {
      id: `mem_${(this.seq++).toString(36)}_${now.toString(36)}`,
      kind: opts.kind ?? "episodic",
      content,
      embedding: embed(content),
      entities,
      importance: clampImportance(opts.importance ?? 0.5),
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      metadata: opts.metadata ?? {},
    };

    this.records.set(record.id, record);
    this.graph.observe(entities);

    // Mirror the freshest items into the bounded working buffer.
    if (record.kind === "episodic" || record.kind === "working") {
      this.working.push(record.id);
      while (this.working.length > this.workingCapacity) this.working.shift();
    }
    return record;
  }

  /** Retrieve the most relevant memories for a query, with score breakdowns. */
  recall(query: string, opts: RecallOptions = {}): RetrievalResult[] {
    const now = this.clock();
    const limit = opts.limit ?? 5;
    const reinforce = opts.reinforce ?? true;
    const queryVec = embed(query);

    // Optionally expand the query's entities via the context graph so that
    // associatively-related memories can surface (spreading activation).
    let entityBoost = new Map<string, number>();
    if (opts.expandGraph ?? true) {
      const seeds = extractEntities(query);
      const activated = this.graph.activate(seeds);
      const max = activated.reduce((m, a) => Math.max(m, a.weight), 0) || 1;
      for (const a of activated) entityBoost.set(a.entity, a.weight / max);
    }

    const scored: RetrievalResult[] = [];
    for (const record of this.records.values()) {
      if (opts.kind && record.kind !== opts.kind) continue;

      let relevance = cosineSimilarity(queryVec, record.embedding);
      // Associative lift: memories sharing activated entities get a boost.
      let assoc = 0;
      for (const e of record.entities) assoc = Math.max(assoc, entityBoost.get(e) ?? 0);
      relevance = Math.min(1, relevance + 0.25 * assoc);

      const score = scoreMemory(record, relevance, now, this.halfLifeMs, this.weights);
      scored.push({ record, score });
    }

    scored.sort((a, b) => b.score.total - a.score.total);
    const top = scored.slice(0, limit);

    if (reinforce) {
      for (const { record } of top) {
        record.accessCount++;
        record.lastAccessedAt = now;
      }
    }
    return top;
  }

  /**
   * Consolidation pass (the agent "sleeping"):
   *   1. Promote episodic memories that are important *or* frequently recalled
   *      into the durable semantic layer.
   *   2. Forget episodic memories whose decayed strength falls below a floor.
   *
   * Returns a summary of what changed.
   */
  consolidate(options: {
    promoteImportance?: number;
    promoteAccessCount?: number;
    forgetFloor?: number;
  } = {}): { promoted: MemoryRecord[]; forgotten: MemoryRecord[] } {
    const now = this.clock();
    const promoteImportance = options.promoteImportance ?? 0.7;
    const promoteAccessCount = options.promoteAccessCount ?? 3;
    const forgetFloor = options.forgetFloor ?? 0.05;

    const promoted: MemoryRecord[] = [];
    const forgotten: MemoryRecord[] = [];

    for (const record of [...this.records.values()]) {
      if (record.kind !== "episodic") continue;

      const promote =
        record.importance >= promoteImportance ||
        record.accessCount >= promoteAccessCount;

      if (promote) {
        record.kind = "semantic";
        // Promotion strengthens salience so it endures.
        record.importance = Math.max(record.importance, 0.85);
        promoted.push(record);
        continue;
      }

      const strength = retention(now - record.createdAt, record.importance, this.halfLifeMs);
      if (strength < forgetFloor) {
        this.records.delete(record.id);
        const idx = this.working.indexOf(record.id);
        if (idx >= 0) this.working.splice(idx, 1);
        forgotten.push(record);
      }
    }
    return { promoted, forgotten };
  }

  /** The current working-memory buffer, oldest first. */
  workingMemory(): MemoryRecord[] {
    return this.working
      .map((id) => this.records.get(id))
      .filter((r): r is MemoryRecord => r !== undefined);
  }

  /** All records of a given layer. */
  byKind(kind: MemoryKind): MemoryRecord[] {
    return [...this.records.values()].filter((r) => r.kind === kind);
  }

  /** Snapshot counts of each layer plus graph size. */
  stats(): { working: number; episodic: number; semantic: number; entities: number } {
    return {
      working: this.working.length,
      episodic: this.byKind("episodic").length,
      semantic: this.byKind("semantic").length,
      entities: this.graph.size,
    };
  }

  /** Total number of stored memories. */
  get size(): number {
    return this.records.size;
  }
}

function clampImportance(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
