#!/usr/bin/env node
/**
 * agentsmd-toolkit CLI.
 *
 * Commands:
 *   validate [file]        Lint an AGENTS.md against best-practice rules.
 *   resolve  [dir]         Show the monorepo nearest-file precedence chain.
 *   init     [name]        Print a starter AGENTS.md to stdout (or --out file).
 *   migrate  <file>        Convert CLAUDE.md / GEMINI.md / etc. to AGENTS.md.
 *
 * Zero runtime dependencies — only Node built-ins.
 */

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "./parser.ts";
import { resolveChain } from "./resolver.ts";
import { migrate, scaffold } from "./scaffold.ts";
import { validate } from "./validator.ts";
import type { Finding } from "./types.ts";

const VERSION = "1.0.0";

interface Flags {
  positionals: string[];
  options: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): Flags {
  const positionals: string[] = [];
  const options = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        options.set(arg.slice(2, eq), arg.slice(eq + 1));
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          options.set(arg.slice(2), next);
          i++;
        } else {
          options.set(arg.slice(2), true);
        }
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

// --- ANSI helpers (auto-disabled when not a TTY or NO_COLOR is set) ---------
const useColor = process.stdout.isTTY && !process.env["NO_COLOR"];
const paint = (code: string, s: string): string => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s: string) => paint("31", s);
const yellow = (s: string) => paint("33", s);
const cyan = (s: string) => paint("36", s);
const green = (s: string) => paint("32", s);
const dim = (s: string) => paint("2", s);
const bold = (s: string) => paint("1", s);

function severityTag(f: Finding): string {
  if (f.severity === "error") return red("error");
  if (f.severity === "warning") return yellow("warn ");
  return cyan("info ");
}

const HELP = `agentsmd-toolkit v${VERSION} — tooling for the AGENTS.md open standard

Usage: agentsmd <command> [args] [options]

Commands:
  validate [file]     Lint an AGENTS.md file (default: ./AGENTS.md).
  resolve  [dir]      Show which AGENTS.md files apply to a directory and in
                      what merge order (root -> nearest = increasing precedence).
                      Options: --root <dir> to fix the resolution root.
  init     [name]     Print a starter AGENTS.md. Options: --full, --out <file>.
  migrate  <file>     Convert a legacy agent config (CLAUDE.md, GEMINI.md, ...)
                      to AGENTS.md. Options: --out <file>.

Global options:
  --json              Emit machine-readable JSON where supported.
  -h, --help          Show this help.
  -v, --version       Show version.

Exit codes: 0 ok, 1 validation errors found, 2 usage error.`;

function cmdValidate(flags: Flags): number {
  const file = resolve(flags.positionals[0] ?? "AGENTS.md");
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    process.stderr.write(red(`Cannot read ${file}\n`));
    return 2;
  }
  const result = validate(parse(raw, file));

  if (flags.options.get("json")) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return result.ok ? 0 : 1;
  }

  process.stdout.write(bold(`Validating ${relative(process.cwd(), file) || file}\n`));
  if (result.findings.length === 0) {
    process.stdout.write(green("  ✓ No issues found.\n"));
  }
  for (const f of result.findings) {
    const loc = f.line > 0 ? dim(`:${f.line}`) : "";
    process.stdout.write(`  ${severityTag(f)} ${dim(f.rule)}${loc}  ${f.message}\n`);
  }
  const summary = `${result.errors} error(s), ${result.warnings} warning(s), ${result.infos} info`;
  process.stdout.write("\n" + (result.ok ? green("✓ ") : red("✗ ")) + summary + "\n");
  return result.ok ? 0 : 1;
}

function cmdResolve(flags: Flags): number {
  const dir = resolve(flags.positionals[0] ?? ".");
  const rootOpt = flags.options.get("root");
  const root = typeof rootOpt === "string" ? rootOpt : undefined;
  const res = resolveChain(dir, root);

  if (flags.options.get("json")) {
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return 0;
  }

  process.stdout.write(bold(`AGENTS.md resolution for ${res.from}\n`));
  process.stdout.write(dim(`root: ${res.root}\n\n`));
  if (res.layers.length === 0) {
    process.stdout.write(yellow("  No AGENTS.md files found along the path.\n"));
    return 0;
  }
  process.stdout.write(dim("merge order (root first; later overrides earlier):\n"));
  for (const layer of res.layers) {
    const isNearest = layer.precedence === res.layers.length;
    const marker = isNearest ? green(" ← highest precedence") : "";
    process.stdout.write(
      `  ${cyan(`[${layer.precedence}]`)} ${relative(res.root, layer.path) || basename(layer.path)}${marker}\n`,
    );
  }
  return 0;
}

function cmdInit(flags: Flags): number {
  const name = flags.positionals[0] ?? basename(process.cwd());
  const text = scaffold({ projectName: name, full: Boolean(flags.options.get("full")) });
  return emit(text, flags);
}

function cmdMigrate(flags: Flags): number {
  const src = flags.positionals[0];
  if (!src) {
    process.stderr.write(red("migrate requires a source file, e.g. `agentsmd migrate CLAUDE.md`\n"));
    return 2;
  }
  const srcPath = resolve(src);
  let raw: string;
  try {
    raw = readFileSync(srcPath, "utf8");
  } catch {
    process.stderr.write(red(`Cannot read ${srcPath}\n`));
    return 2;
  }
  const text = migrate(raw, basename(srcPath));
  return emit(text, flags);
}

/** Write generated text to --out file or stdout. */
function emit(text: string, flags: Flags): number {
  const out = flags.options.get("out");
  if (typeof out === "string") {
    writeFileSync(resolve(out), text.endsWith("\n") ? text : text + "\n");
    process.stderr.write(green(`Wrote ${out}\n`));
  } else {
    process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  }
  return 0;
}

export function main(argv: string[]): number {
  const flags = parseArgs(argv);

  if (flags.options.get("help") || flags.options.get("h")) {
    process.stdout.write(HELP + "\n");
    return 0;
  }
  if (flags.options.get("version") || flags.options.get("v")) {
    process.stdout.write(VERSION + "\n");
    return 0;
  }

  const command = flags.positionals.shift();
  switch (command) {
    case "validate":
      return cmdValidate(flags);
    case "resolve":
      return cmdResolve(flags);
    case "init":
      return cmdInit(flags);
    case "migrate":
      return cmdMigrate(flags);
    case undefined:
      process.stdout.write(HELP + "\n");
      return 0;
    default:
      process.stderr.write(red(`Unknown command: ${command}\n\n`) + HELP + "\n");
      return 2;
  }
}

// Only run when invoked directly (not when imported by tests).
function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (isMainModule()) {
  process.exit(main(process.argv.slice(2)));
}
