/**
 * Monorepo "nearest-file" resolution for AGENTS.md.
 *
 * Agents walk from the project root down to the current working directory,
 * combining every AGENTS.md found along the path. Files closer to the working
 * directory take precedence (more specific instructions override general ones).
 *
 * This module reproduces that walk so users can preview exactly which files
 * apply to a given directory and in what merge order.
 */

import { existsSync, statSync } from "node:fs";
import { dirname, join, parse as parsePath, resolve } from "node:path";
import type { ResolutionResult, ResolvedLayer } from "./types.ts";

export const AGENTS_FILENAME = "AGENTS.md";

/**
 * Resolve the AGENTS.md precedence chain that applies to `fromDir`.
 *
 * The walk stops at `rootDir` (inclusive) if provided; otherwise it climbs
 * until the filesystem root or a `.git` directory is found (treated as the
 * repository boundary).
 *
 * @returns layers ordered from root (lowest precedence) to nearest (highest).
 */
export function resolveChain(fromDir: string, rootDir?: string): ResolutionResult {
  const from = resolve(fromDir);
  const root = rootDir ? resolve(rootDir) : detectRoot(from);

  // Collect directories from `from` up to (and including) `root`.
  const dirs: string[] = [];
  let cursor = from;
  while (true) {
    dirs.push(cursor);
    if (cursor === root) break;
    const parent = dirname(cursor);
    if (parent === cursor) break; // reached filesystem root without hitting `root`
    cursor = parent;
  }

  // `dirs` is nearest-first; reverse to root-first for merge order.
  const rootFirst = dirs.slice().reverse();
  const layers: ResolvedLayer[] = [];
  rootFirst.forEach((dir, depth) => {
    const candidate = join(dir, AGENTS_FILENAME);
    if (isFile(candidate)) {
      layers.push({ path: candidate, depth, precedence: 0 });
    }
  });

  // Precedence increases with proximity to `from` (later in root-first order).
  layers.forEach((layer, idx) => {
    layer.precedence = idx + 1;
  });

  return { from, root, layers };
}

/**
 * Walk upward from `start` looking for a repository boundary.
 * Returns the directory containing a `.git` entry, or the filesystem root.
 */
export function detectRoot(start: string): string {
  let cursor = resolve(start);
  while (true) {
    if (existsSync(join(cursor, ".git"))) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) return cursor; // filesystem root
    cursor = parent;
  }
}

function isFile(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

/** True if `p` is a filesystem root (used by tests and the walk guard). */
export function isFsRoot(p: string): boolean {
  return parsePath(resolve(p)).root === resolve(p);
}
