/**
 * Skill compilation: turning raw trajectories into reusable skill packages.
 *
 * This is the heart of the "self-evolving skills" idea — instead of fine-tuning
 * model weights, the agent compiles successful task trajectories into an
 * external, text-space procedure that can be reinforced or eroded over time.
 */

import { createHash } from "node:crypto";
import type { SkillPackage, Trajectory } from "./types.js";
import { tokenize } from "./similarity.js";

/** Normalize a task string so equivalent tasks map to the same skill id. */
export function normalizeTask(task: string): string {
  return tokenize(task).sort().join(" ");
}

/** Deterministic id derived from the normalized task. */
export function skillId(task: string): string {
  return createHash("sha1").update(normalizeTask(task)).digest("hex").slice(0, 12);
}

/**
 * Laplace-smoothed confidence in [0, 1].
 *
 * (successes + 1) / (successes + failures + 2) — a Bayesian estimate that
 * starts at 0.5 with no evidence, rises toward 1 with corroborating successes,
 * and falls toward 0 as failures accumulate.
 */
export function computeConfidence(successes: number, failures: number): number {
  return (successes + 1) / (successes + failures + 2);
}

/** Turn a trajectory's steps into a compact, deduplicated action procedure. */
export function distillProcedure(traj: Trajectory): string[] {
  const seen = new Set<string>();
  const procedure: string[] = [];
  for (const step of traj.steps) {
    const action = step.action.trim();
    if (action && !seen.has(action)) {
      seen.add(action);
      procedure.push(action);
    }
  }
  return procedure;
}

/** Derive a short human-readable skill name from a task. */
function deriveName(task: string): string {
  const words = task.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Compile a fresh trajectory into a new skill package. Only meaningful for
 * successful trajectories; callers should reinforce existing skills otherwise.
 */
export function compileSkill(traj: Trajectory): SkillPackage {
  const now = traj.recordedAt ?? Date.now();
  const successes = traj.success ? 1 : 0;
  const failures = traj.success ? 0 : 1;
  return {
    id: skillId(traj.task),
    name: deriveName(traj.task),
    task: traj.task.trim(),
    procedure: distillProcedure(traj),
    tags: dedupeTags(traj.tags ?? []),
    successes,
    failures,
    confidence: computeConfidence(successes, failures),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Reinforce (or erode) an existing skill with a new trajectory for the same
 * task. A successful trajectory whose procedure is longer/cleaner can replace
 * the stored procedure; failures only move the confidence ledger.
 */
export function reinforceSkill(
  skill: SkillPackage,
  traj: Trajectory,
): SkillPackage {
  const now = traj.recordedAt ?? Date.now();
  const successes = skill.successes + (traj.success ? 1 : 0);
  const failures = skill.failures + (traj.success ? 0 : 1);

  let procedure = skill.procedure;
  if (traj.success) {
    const candidate = distillProcedure(traj);
    // Prefer the more detailed successful procedure when we have stronger
    // evidence, mirroring how self-evolving agents overwrite stale skills.
    if (candidate.length > procedure.length) procedure = candidate;
  }

  return {
    ...skill,
    procedure,
    tags: dedupeTags([...skill.tags, ...(traj.tags ?? [])]),
    successes,
    failures,
    confidence: computeConfidence(successes, failures),
    updatedAt: now,
  };
}

function dedupeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}
