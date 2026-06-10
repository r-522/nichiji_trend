/** Loading and discovery of Agent Skills on disk. */

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, FrontmatterResult } from './frontmatter.js';

export interface LoadedSkill {
  /** Absolute path to the skill directory. */
  dir: string;
  /** Absolute path to the SKILL.md file. */
  file: string;
  raw: string;
  frontmatter: FrontmatterResult;
}

export function loadSkill(skillDir: string): LoadedSkill {
  const dir = path.resolve(skillDir);
  const file = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(file)) {
    throw new Error(`no SKILL.md found in ${dir}`);
  }
  const raw = fs.readFileSync(file, 'utf8');
  return { dir, file, raw, frontmatter: parseFrontmatter(raw) };
}

/** Recursively find every directory containing a SKILL.md beneath `root`. */
export function discoverSkills(root: string, maxDepth = 6): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'SKILL.md')) {
      found.push(dir);
      return; // skills do not nest
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(path.join(dir, entry.name), depth + 1);
      }
    }
  };
  walk(path.resolve(root), 0);
  return found.sort();
}
