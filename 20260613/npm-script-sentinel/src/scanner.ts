import { readFile, readdir, access } from "node:fs/promises";
import { join, relative } from "node:path";
import { BLOCKED_LIFECYCLE_SCRIPTS, type BlockedLifecycleScript, type Finding, type PackageManifest } from "./types.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(dir: string): Promise<PackageManifest | null> {
  try {
    return JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as PackageManifest;
  } catch {
    return null;
  }
}

/** Collect every installed package directory under node_modules, including nested and scoped ones. */
async function* walkPackages(nodeModules: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(nodeModules, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".bin" || entry.name === ".cache") continue;
    const full = join(nodeModules, entry.name);
    if (entry.name.startsWith("@")) {
      for (const scoped of await readdir(full, { withFileTypes: true })) {
        if (scoped.isDirectory()) yield join(full, scoped.name);
      }
    } else {
      yield full;
    }
  }
}

async function auditPackageDir(projectDir: string, pkgDir: string, findings: Finding[]): Promise<void> {
  const manifest = await readManifest(pkgDir);
  if (!manifest) return;
  const location = relative(projectDir, pkgDir);
  const direct = !location.slice("node_modules/".length).includes("node_modules");
  const base = {
    name: manifest.name ?? location,
    version: manifest.version ?? "unknown",
    location,
    direct,
  };

  const declared = BLOCKED_LIFECYCLE_SCRIPTS.filter(
    (s): s is BlockedLifecycleScript => typeof manifest.scripts?.[s] === "string",
  );
  if (declared.length > 0) {
    findings.push({ kind: "install-script", scripts: declared, ...base });
  } else if (await exists(join(pkgDir, "binding.gyp"))) {
    // No explicit install script, but npm runs an implicit `node-gyp rebuild`
    // for binding.gyp packages — npm v12 blocks that too.
    findings.push({ kind: "implicit-node-gyp", ...base });
  }

  // Recurse into nested node_modules (deduplicated copies with different versions).
  const nested = join(pkgDir, "node_modules");
  if (await exists(nested)) {
    for await (const dir of walkPackages(nested)) {
      await auditPackageDir(projectDir, dir, findings);
    }
  }
}

/**
 * Findings derivable from the installed tree: declared lifecycle scripts and
 * implicit node-gyp builds the lockfile's hasInstallScript flag can miss.
 */
export async function auditNodeModules(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  for await (const dir of walkPackages(join(projectDir, "node_modules"))) {
    await auditPackageDir(projectDir, dir, findings);
  }
  return findings;
}

export async function nodeModulesExists(projectDir: string): Promise<boolean> {
  return exists(join(projectDir, "node_modules"));
}
