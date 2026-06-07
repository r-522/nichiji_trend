/**
 * Scoring primitives that turn a raw similarity match into a ranked retrieval.
 *
 * The retrieval score blends four signals that mirror how human memory works:
 *
 *   relevance      — semantic overlap with the query (cosine similarity)
 *   recency        — exponential forgetting curve (Ebbinghaus); fresh wins
 *   importance      — caller-supplied salience; salient memories resist decay
 *   reinforcement  — memories recalled often become easier to recall again
 */

import type { MemoryRecord, ScoreBreakdown } from "./types.ts";

/** Relative weights of each signal. Tuned for the demo; export so callers tweak. */
export interface ScoreWeights {
  relevance: number;
  recency: number;
  importance: number;
  reinforcement: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  relevance: 0.55,
  recency: 0.2,
  importance: 0.15,
  reinforcement: 0.1,
};

/** One hour, in milliseconds — the default forgetting half-life. */
export const DEFAULT_HALF_LIFE_MS = 60 * 60 * 1000;

/**
 * Ebbinghaus-style retention: a memory keeps `0.5 ^ (age / halfLife)` of its
 * strength. Importance stretches the effective half-life so that salient
 * memories are forgotten far more slowly than trivia.
 */
export function retention(
  ageMs: number,
  importance: number,
  halfLifeMs: number,
): number {
  if (ageMs <= 0) return 1;
  // Importance up to ~5x the half-life at importance = 1.
  const effectiveHalfLife = halfLifeMs * (1 + 4 * clamp01(importance));
  return Math.pow(0.5, ageMs / effectiveHalfLife);
}

/** Diminishing-returns reinforcement from repeated recall. */
export function reinforcement(accessCount: number): number {
  return 1 - 1 / (1 + accessCount);
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Combine the four signals into a single ranked score plus a breakdown that
 * explains *why* a memory surfaced — useful for debugging agent behaviour.
 */
export function scoreMemory(
  record: MemoryRecord,
  relevance: number,
  now: number,
  halfLifeMs: number,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const recency = retention(now - record.createdAt, record.importance, halfLifeMs);
  const importance = clamp01(record.importance);
  const reinforce = reinforcement(record.accessCount);

  const total =
    weights.relevance * clamp01(relevance) +
    weights.recency * recency +
    weights.importance * importance +
    weights.reinforcement * reinforce;

  return {
    relevance: clamp01(relevance),
    recency,
    importance,
    reinforcement: reinforce,
    total,
  };
}
