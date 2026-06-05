/**
 * Discover skills under a root directory and build a registry catalog —
 * the kind of index an agent runtime or a marketplace uses to route to skills.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { parseDocument } from "./frontmatter.ts";
import { validateSkill } from "./validator.ts";
import { BUNDLE_DIRS } from "./spec.ts";

export interface CatalogEntry {
  name: string;
  description: string;
  path: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string[];
  metadata?: Record<string, string>;
  bundles: string[];
  valid: boolean;
}

export interface Catalog {
  generatedAt: string;
  root: string;
  count: number;
  skills: CatalogEntry[];
}

/** Recursively find directories that directly contain a SKILL.md file. */
export function findSkillDirs(root: string, maxDepth = 5): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    if (entries.includes("SKILL.md") && statSync(join(dir, "SKILL.md")).isFile()) {
      found.push(dir);
      // A skill's own bundle dirs are not scanned for nested skills.
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const p = join(dir, entry);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p, depth + 1);
    }
  };
  walk(root, 0);
  return found.sort();
}

function readEntry(skillDir: string, root: string): CatalogEntry | null {
  const skillFile = join(skillDir, "SKILL.md");
  let parsed;
  try {
    parsed = parseDocument(readFileSync(skillFile, "utf8"));
  } catch {
    return null;
  }
  const fm = parsed.frontmatter;
  if (fm === null) return null;

  const str = (k: string): string | undefined =>
    typeof fm[k] === "string" ? (fm[k] as string) : undefined;

  const allowed = str("allowed-tools");
  const bundles = BUNDLE_DIRS.filter(
    (d) => existsSync(join(skillDir, d)) && statSync(join(skillDir, d)).isDirectory(),
  );

  const report = validateSkill(skillDir);

  return {
    name: str("name") ?? "(unnamed)",
    description: str("description") ?? "",
    path: relative(root, skillDir) || ".",
    license: str("license"),
    compatibility: str("compatibility"),
    allowedTools: allowed ? allowed.split(/\s+/).filter(Boolean) : undefined,
    metadata:
      fm.metadata && typeof fm.metadata === "object"
        ? (fm.metadata as Record<string, string>)
        : undefined,
    bundles,
    valid: report.ok,
  };
}

export function buildCatalog(root: string): Catalog {
  const dirs = findSkillDirs(root);
  const skills = dirs
    .map((d) => readEntry(d, root))
    .filter((e): e is CatalogEntry => e !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    generatedAt: new Date().toISOString(),
    root,
    count: skills.length,
    skills,
  };
}
