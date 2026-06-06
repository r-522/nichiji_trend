/**
 * SkillForge — the orchestrator that ties together compilation, persistence
 * and retrieval into a single self-evolving skill loop.
 *
 * Typical lifecycle:
 *   1. An agent attempts a task and records the resulting trajectory.
 *   2. forge.observe(trajectory) compiles or reinforces the matching skill.
 *   3. Before the next attempt, forge.recall(task) returns the most relevant,
 *      highest-confidence skills to prime the agent.
 */

import { compileSkill, reinforceSkill, skillId } from "./compiler.js";
import { cosineSimilarity } from "./similarity.js";
import { SkillStore } from "./store.js";
import type { RetrievalHit, SkillPackage, Trajectory } from "./types.js";

export interface RecallOptions {
  /** Max number of hits to return. Default 3. */
  limit?: number;
  /** Minimum combined relevance score to include. Default 0.1. */
  minScore?: number;
}

export class SkillForge {
  private constructor(private readonly store: SkillStore) {}

  /** Create a forge backed by a JSON file and load any existing skills. */
  static async open(path: string): Promise<SkillForge> {
    const store = new SkillStore(path);
    await store.load();
    return new SkillForge(store);
  }

  /**
   * Ingest a trajectory: compile a new skill the first time a task is seen,
   * otherwise reinforce the existing one. Returns the resulting skill.
   */
  observe(traj: Trajectory): SkillPackage {
    const id = skillId(traj.task);
    const existing = this.store.get(id);
    const skill = existing
      ? reinforceSkill(existing, traj)
      : compileSkill(traj);
    this.store.upsert(skill);
    return skill;
  }

  /**
   * Retrieve the skills most relevant to a task. Relevance blends lexical
   * similarity (70%) with the skill's own confidence (30%) so a strongly
   * proven skill outranks a marginally-more-similar but unreliable one.
   */
  recall(task: string, opts: RecallOptions = {}): RetrievalHit[] {
    const limit = opts.limit ?? 3;
    const minScore = opts.minScore ?? 0.1;

    const hits: RetrievalHit[] = [];
    for (const skill of this.store.list()) {
      const haystack = `${skill.task} ${skill.tags.join(" ")}`;
      const similarity = cosineSimilarity(task, haystack);
      if (similarity === 0) continue;
      const score = 0.7 * similarity + 0.3 * skill.confidence;
      if (score >= minScore) hits.push({ skill, score });
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Persist the current state to disk. */
  async flush(): Promise<void> {
    await this.store.save();
  }

  /** All known skills, best first. */
  skills(): SkillPackage[] {
    return this.store.list();
  }

  get size(): number {
    return this.store.size;
  }
}

export type { SkillPackage, Trajectory, RetrievalHit } from "./types.js";
