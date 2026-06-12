import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Finding, Lockfile, LockfilePackageEntry } from "./types.js";

const GIT_RESOLVED = /^(git\+|git:|ssh:|github:|gitlab:|bitbucket:)/;
const REGISTRY_HOSTS = new Set(["registry.npmjs.org", "registry.yarnpkg.com"]);

/** "node_modules/@scope/pkg/node_modules/leaf" -> "leaf" */
export function packageNameFromLockKey(key: string): string {
  const idx = key.lastIndexOf("node_modules/");
  return idx === -1 ? key : key.slice(idx + "node_modules/".length);
}

/** A direct dependency sits exactly one node_modules level deep. */
export function isDirectDependency(key: string): boolean {
  return key.startsWith("node_modules/") && !key.slice("node_modules/".length).includes("node_modules/");
}

export function classifyResolved(resolved: string): "git" | "remote" | "registry" | "local" {
  if (GIT_RESOLVED.test(resolved)) return "git";
  if (resolved.startsWith("file:")) return "local";
  if (/^https?:\/\//.test(resolved)) {
    try {
      const host = new URL(resolved).hostname;
      return REGISTRY_HOSTS.has(host) ? "registry" : "remote";
    } catch {
      return "remote";
    }
  }
  return "local";
}

export async function loadLockfile(projectDir: string): Promise<Lockfile | null> {
  for (const name of ["package-lock.json", "npm-shrinkwrap.json"]) {
    try {
      return JSON.parse(await readFile(join(projectDir, name), "utf8")) as Lockfile;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Findings derivable from the lockfile alone: hasInstallScript flags and
 * git/remote resolutions that npm v12 blocks via --allow-git/--allow-remote.
 */
export function auditLockfile(lockfile: Lockfile): Finding[] {
  const findings: Finding[] = [];
  for (const [key, entry] of Object.entries(lockfile.packages ?? {})) {
    if (key === "" || entry.link) continue; // root project or workspace symlink
    const base = {
      name: packageNameFromLockKey(key),
      version: entry.version ?? "unknown",
      location: key,
      direct: isDirectDependency(key),
    };
    if (entry.hasInstallScript) {
      findings.push({ kind: "install-script", ...base });
    }
    if (entry.resolved) {
      const kind = classifyResolved(entry.resolved);
      if (kind === "git") {
        findings.push({ kind: "git-dependency", resolved: entry.resolved, ...base });
      } else if (kind === "remote") {
        findings.push({ kind: "remote-dependency", resolved: entry.resolved, ...base });
      }
    }
  }
  return findings;
}

export type { LockfilePackageEntry };
