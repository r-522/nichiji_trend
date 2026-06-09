/**
 * Dependency collection: gather every external package a project references,
 * both from package.json manifests and from import/require statements in
 * source files.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import type { DependencyOrigin, DependencyRef } from "./types.js";
import { isNodeBuiltin } from "./heuristics.js";

const MANIFEST_FIELDS: Array<[string, DependencyOrigin]> = [
  ["dependencies", "package.json:dependencies"],
  ["devDependencies", "package.json:devDependencies"],
  ["optionalDependencies", "package.json:optionalDependencies"],
  ["peerDependencies", "package.json:peerDependencies"],
];

const SOURCE_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", ".turbo"]);

/**
 * Reduce an import specifier to its installable package name.
 * "@scope/pkg/sub" -> "@scope/pkg"; "lodash/merge" -> "lodash";
 * relative paths and node: builtins -> null.
 */
export function specifierToPackage(spec: string): string | null {
  if (!spec || spec.startsWith(".") || spec.startsWith("/")) return null;
  if (spec.startsWith("node:")) return null;
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
  if (isNodeBuiltin(name)) return null;
  return name;
}

const IMPORT_RE =
  /(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

/** Extract bare module specifiers from a source file's text. */
export function extractImports(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(IMPORT_RE)) {
    const pkg = specifierToPackage(match[1]!);
    if (pkg) found.add(pkg);
  }
  return [...found];
}

interface Accumulator {
  map: Map<string, DependencyRef>;
}

function record(acc: Accumulator, name: string, origin: DependencyOrigin, range?: string): void {
  const existing = acc.map.get(name);
  if (existing) {
    if (!existing.origins.includes(origin)) existing.origins.push(origin);
    if (range && !existing.range) existing.range = range;
  } else {
    acc.map.set(name, { name, range, origins: [origin] });
  }
}

async function collectManifest(acc: Accumulator, manifestPath: string): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch {
    return false;
  }
  let json: Record<string, any>;
  try {
    json = JSON.parse(raw);
  } catch {
    return false;
  }
  for (const [field, origin] of MANIFEST_FIELDS) {
    const deps = json[field];
    if (deps && typeof deps === "object") {
      for (const [name, range] of Object.entries(deps)) {
        record(acc, name, origin, typeof range === "string" ? range : undefined);
      }
    }
  }
  return true;
}

async function walkSources(acc: Accumulator, dir: string, depth: number): Promise<void> {
  if (depth > 8) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") {
      if (SKIP_DIRS.has(entry.name)) continue;
    }
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkSources(acc, full, depth + 1);
    } else if (entry.isFile() && SOURCE_EXTS.has(extname(entry.name))) {
      try {
        const text = await readFile(full, "utf8");
        for (const pkg of extractImports(text)) {
          record(acc, pkg, "source-import");
        }
      } catch {
        /* ignore unreadable files */
      }
    }
  }
}

export interface CollectResult {
  deps: DependencyRef[];
  /** Install-lifecycle script keys declared in the root manifest, if any. */
  manifestInstallHooks: string[];
}

/**
 * Collect dependencies from a project directory (or a single package.json /
 * source file). `scanSources` toggles the source-import walk.
 */
export async function collect(target: string, scanSources: boolean): Promise<CollectResult> {
  const acc: Accumulator = { map: new Map() };

  const s = await stat(target).catch(() => null);
  if (!s) throw new Error(`Path not found: ${target}`);

  if (s.isFile()) {
    if (target.endsWith("package.json")) {
      await collectManifest(acc, target);
    } else if (SOURCE_EXTS.has(extname(target))) {
      const text = await readFile(target, "utf8");
      for (const pkg of extractImports(text)) record(acc, pkg, "source-import");
    }
    return { deps: [...acc.map.values()], manifestInstallHooks: await readHooks(target) };
  }

  const manifestPath = join(target, "package.json");
  await collectManifest(acc, manifestPath);
  const hooks = await readHooks(manifestPath);
  if (scanSources) await walkSources(acc, target, 0);

  return { deps: [...acc.map.values()], manifestInstallHooks: hooks };
}

/** Read install-lifecycle script keys declared in a manifest, if any. */
async function readHooks(manifestPath: string): Promise<string[]> {
  if (!manifestPath.endsWith("package.json")) return [];
  try {
    const json = JSON.parse(await readFile(manifestPath, "utf8"));
    const scripts = json.scripts;
    if (scripts && typeof scripts === "object") {
      return Object.keys(scripts).filter((k) =>
        ["preinstall", "install", "postinstall"].includes(k),
      );
    }
  } catch {
    /* ignore */
  }
  return [];
}
