/**
 * Core domain types for skill-forge.
 *
 * The model mirrors the 2026 "self-evolving agent skills" trend: an agent
 * executes tasks (producing *trajectories*), and successful trajectories are
 * distilled into reusable *skill packages* that live in external memory rather
 * than in model weights. Skills carry a confidence score that rises with
 * corroborating successes and decays with failures.
 */

/** A single step taken by an agent while solving a task. */
export interface TrajectoryStep {
  /** Imperative action the agent performed, e.g. "run_tests". */
  action: string;
  /** Free-form observation/result the action produced. */
  observation: string;
}

/** One complete attempt at a task, success or failure. */
export interface Trajectory {
  /** Natural-language description of the task that was attempted. */
  task: string;
  /** Ordered steps taken. */
  steps: TrajectoryStep[];
  /** Whether the attempt ultimately succeeded. */
  success: boolean;
  /** Optional tags used to bias retrieval (e.g. "git", "python"). */
  tags?: string[];
  /** Epoch millis the trajectory was recorded. Defaults to Date.now(). */
  recordedAt?: number;
}

/** A distilled, reusable procedure compiled from one or more trajectories. */
export interface SkillPackage {
  /** Stable identifier derived from the normalized task. */
  id: string;
  /** Human-readable name of the skill. */
  name: string;
  /** The canonical task this skill solves. */
  task: string;
  /** Ordered action template the skill recommends. */
  procedure: string[];
  /** Free-text tags used for retrieval. */
  tags: string[];
  /** How many successful trajectories reinforced this skill. */
  successes: number;
  /** How many failures have been attributed to this skill. */
  failures: number;
  /**
   * Confidence in [0, 1]. Derived from the success/failure ledger via a
   * smoothed ratio (see compiler.ts). Higher means more trustworthy.
   */
  confidence: number;
  /** Epoch millis of first compilation. */
  createdAt: number;
  /** Epoch millis of the most recent reinforcement. */
  updatedAt: number;
}

/** A scored retrieval hit. */
export interface RetrievalHit {
  skill: SkillPackage;
  /** Relevance score in [0, 1] combining text similarity and confidence. */
  score: number;
}
