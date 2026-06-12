#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { auditLockfile, loadLockfile } from "./lockfile.js";
import { auditNodeModules, nodeModulesExists } from "./scanner.js";
import { dedupeFindings, renderAllowlist, renderJson, renderText } from "./report.js";
import type { AuditResult } from "./types.js";

const USAGE = `Usage: npm-script-sentinel [project-dir] [options]

Audits a project for the npm v12 breaking changes announced by GitHub
(install scripts off by default, --allow-git=none, --allow-remote=none).

Options:
  --json        Emit the full audit result as JSON
  --allowlist   Emit a package.json "npm" config snippet approving the findings
  --fail        Exit with code 1 when any finding exists (for CI gates)
  --help        Show this help
`;

export async function runAudit(projectDir: string): Promise<AuditResult> {
  const lockfile = await loadLockfile(projectDir);
  const hasNodeModules = await nodeModulesExists(projectDir);
  const findings = dedupeFindings([
    ...(lockfile ? auditLockfile(lockfile) : []),
    ...(hasNodeModules ? await auditNodeModules(projectDir) : []),
  ]);
  return {
    source: { projectDir, lockfileFound: lockfile !== null, nodeModulesFound: hasNodeModules },
    findings,
  };
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      json: { type: "boolean", default: false },
      allowlist: { type: "boolean", default: false },
      fail: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  const projectDir = resolve(positionals[0] ?? ".");
  const result = await runAudit(projectDir);

  if (!result.source.lockfileFound && !result.source.nodeModulesFound) {
    process.stderr.write(`error: no package-lock.json or node_modules found in ${projectDir}\n`);
    process.exitCode = 2;
    return;
  }

  if (values.json) {
    process.stdout.write(renderJson(result) + "\n");
  } else if (values.allowlist) {
    process.stdout.write(renderAllowlist(result.findings) + "\n");
  } else {
    process.stdout.write(renderText(result) + "\n");
  }
  if (values.fail && result.findings.length > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 2;
});
