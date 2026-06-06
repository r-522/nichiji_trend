/**
 * Persistent, file-backed skill store.
 *
 * Agent memory in 2026 is treated as production infrastructure that survives
 * across sessions. We persist the compiled skill packages to a single JSON
 * file so a skill learned in one run is available in the next. The store is
 * intentionally simple and synchronous-friendly via async fs APIs.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SkillPackage } from "./types.js";

interface StoreShape {
  version: 1;
  skills: SkillPackage[];
}

export class SkillStore {
  private skills = new Map<string, SkillPackage>();

  /** @param path JSON file used for persistence. */
  constructor(private readonly path: string) {}

  /** Load skills from disk. Missing file => empty store. */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as StoreShape;
      this.skills.clear();
      for (const skill of parsed.skills ?? []) {
        this.skills.set(skill.id, skill);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
  }

  /** Persist the current in-memory skills to disk (pretty-printed). */
  async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const data: StoreShape = { version: 1, skills: this.list() };
    await writeFile(this.path, JSON.stringify(data, null, 2) + "\n", "utf8");
  }

  get(id: string): SkillPackage | undefined {
    return this.skills.get(id);
  }

  upsert(skill: SkillPackage): void {
    this.skills.set(skill.id, skill);
  }

  /** All skills, sorted by confidence descending then most-recently updated. */
  list(): SkillPackage[] {
    return [...this.skills.values()].sort(
      (a, b) => b.confidence - a.confidence || b.updatedAt - a.updatedAt,
    );
  }

  get size(): number {
    return this.skills.size;
  }
}
