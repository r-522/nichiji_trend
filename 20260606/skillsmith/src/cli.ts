#!/usr/bin/env -S npx tsx
/**
 * skillsmith — a toolkit for the Agent Skills (SKILL.md) open standard.
 *
 *   skillsmith validate <path...>     spec-conformance check (exit 1 on error)
 *   skillsmith lint <path...>         advisory best-practice check
 *   skillsmith check <path...>        validate + lint together
 *   skillsmith index <dir> [--out f]  build a registry catalog (JSON)
 *   skillsmith init <name> [opts]     scaffold a new skill bundle
 *
 * Global flags: --json (machine output), --no-color, -h/--help, -v/--version.
 */

import { writeFileSync } from "node:fs";
import { validateSkill } from "./validator.ts";
import { lintSkill } from "./linter.ts";
import { findSkillDirs, buildCatalog } from "./indexer.ts";
import { scaffoldSkill } from "./scaffold.ts";
import { countBySeverity, type Diagnostic, type SkillReport } from "./diagnostics.ts";

const VERSION = "0.1.0";

// ---- tiny arg parser ---------------------------------------------------------

interface Args {
  positionals: string[];
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags.set(a.slice(2, eq), a.slice(eq + 1));
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          flags.set(key, next);
          i++;
        } else {
          flags.set(key, true);
        }
      }
    } else if (a.startsWith("-") && a.length > 1) {
      flags.set(a.slice(1), true);
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

// ---- colour ------------------------------------------------------------------

let useColor = process.stdout.isTTY ?? false;
const paint = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  red: (s: string) => paint("31", s),
  yellow: (s: string) => paint("33", s),
  blue: (s: string) => paint("34", s),
  green: (s: string) => paint("32", s),
  dim: (s: string) => paint("2", s),
  bold: (s: string) => paint("1", s),
};

const sevTag = (sev: Diagnostic["severity"]) =>
  sev === "error" ? c.red("error") : sev === "warning" ? c.yellow("warn ") : c.blue("info ");

function printDiagnostic(d: Diagnostic): void {
  const loc = d.line ? `${d.file}:${d.line}` : d.file;
  console.log(`  ${sevTag(d.severity)} ${c.dim(d.rule.padEnd(24))} ${d.message}`);
  console.log(`        ${c.dim(loc)}`);
}

// ---- commands ----------------------------------------------------------------

function expandTargets(positionals: string[]): string[] {
  if (positionals.length === 0) return ["."];
  const out: string[] = [];
  for (const p of positionals) {
    const dirs = findSkillDirs(p);
    // If the path itself is a skill (SKILL.md present) findSkillDirs returns it;
    // if nothing found, treat the path as a direct target so errors surface.
    if (dirs.length > 0) out.push(...dirs);
    else out.push(p);
  }
  return [...new Set(out)];
}

function runReports(
  targets: string[],
  opts: { lint: boolean; validate: boolean },
): { reports: SkillReport[]; lintMap: Map<string, Diagnostic[]> } {
  const reports: SkillReport[] = [];
  const lintMap = new Map<string, Diagnostic[]>();
  for (const t of targets) {
    if (opts.validate) reports.push(validateSkill(t));
    if (opts.lint) lintMap.set(t, lintSkill(t));
  }
  return { reports, lintMap };
}

function cmdCheck(args: Args, mode: "validate" | "lint" | "check"): number {
  const json = args.flags.has("json");
  const targets = expandTargets(args.positionals);
  const doValidate = mode !== "lint";
  const doLint = mode !== "validate";

  const { reports, lintMap } = runReports(targets, { lint: doLint, validate: doValidate });

  // Merge per-target diagnostics for display.
  const all: { target: string; name?: string; diags: Diagnostic[]; ok: boolean }[] = [];
  for (const t of targets) {
    const r = reports.find((x) => x.path === t);
    const diags = [...(r?.diagnostics ?? []), ...(lintMap.get(t) ?? [])];
    diags.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
    all.push({ target: t, name: r?.name, diags, ok: r ? r.ok : !diags.some((d) => d.severity === "error") });
  }

  if (json) {
    console.log(JSON.stringify({ skills: all }, null, 2));
  } else {
    for (const entry of all) {
      const label = entry.name ? `${entry.name} ${c.dim(`(${entry.target})`)}` : entry.target;
      const status = entry.ok ? c.green("PASS") : c.red("FAIL");
      console.log(`${status} ${c.bold(label)}`);
      for (const d of entry.diags) printDiagnostic(d);
      if (entry.diags.length === 0) console.log(`  ${c.dim("no issues")}`);
      console.log();
    }
    const totals = countBySeverity(all.flatMap((e) => e.diags));
    console.log(
      c.bold(
        `${all.length} skill(s): ` +
          `${c.red(`${totals.error} error`)}, ` +
          `${c.yellow(`${totals.warning} warning`)}, ` +
          `${c.blue(`${totals.info} info`)}`,
      ),
    );
  }

  return all.some((e) => !e.ok) ? 1 : 0;
}

function cmdIndex(args: Args): number {
  const root = args.positionals[0] ?? ".";
  const catalog = buildCatalog(root);
  const out = args.flags.get("out");
  const text = JSON.stringify(catalog, null, 2);
  if (typeof out === "string") {
    writeFileSync(out, text + "\n", "utf8");
    console.log(c.green(`wrote ${catalog.count} skill(s) to ${out}`));
  } else {
    console.log(text);
  }
  return 0;
}

function cmdInit(args: Args): number {
  const name = args.positionals[0];
  if (!name) {
    console.error(c.red("error: `init` requires a skill name"));
    return 2;
  }
  try {
    const result = scaffoldSkill({
      parentDir: typeof args.flags.get("dir") === "string" ? (args.flags.get("dir") as string) : ".",
      name,
      description:
        typeof args.flags.get("description") === "string"
          ? (args.flags.get("description") as string)
          : undefined,
      license:
        typeof args.flags.get("license") === "string" ? (args.flags.get("license") as string) : undefined,
      withBundles: args.flags.has("bundles"),
    });
    console.log(c.green(`created skill "${name}"`));
    for (const f of result.created) console.log(`  ${c.dim("+")} ${f}`);
    return 0;
  } catch (err) {
    console.error(c.red(`error: ${(err as Error).message}`));
    return 1;
  }
}

const HELP = `skillsmith ${VERSION} — toolkit for the Agent Skills (SKILL.md) standard

USAGE
  skillsmith <command> [paths...] [options]

COMMANDS
  validate <path...>     Check SKILL.md files against the spec (errors fail CI)
  lint <path...>         Advisory best-practice checks (warnings/info)
  check <path...>        Run validate + lint together
  index <dir>            Build a registry catalog of all skills found under <dir>
  init <name>            Scaffold a new spec-compliant skill bundle

  Paths may be a SKILL.md file, a skill directory, or a tree containing skills
  (it is searched recursively). Defaults to the current directory.

OPTIONS
  --json                 Machine-readable output (validate/lint/check)
  --out <file>           Write catalog to a file (index)
  --dir <dir>            Parent directory for new skill (init, default ".")
  --description <text>   Description for the new skill (init)
  --license <id>         License id for the new skill (init)
  --bundles              Also create scripts/ references/ assets/ (init)
  --no-color             Disable ANSI colours
  -h, --help             Show this help
  -v, --version          Show version

EXAMPLES
  skillsmith validate ./skills/pdf-extractor
  skillsmith check ./skills --json
  skillsmith index ./skills --out catalog.json
  skillsmith init pdf-extractor --description "Use when extracting text from PDFs" --bundles
`;

function main(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.flags.has("no-color")) useColor = false;
  if (args.flags.has("help") || args.flags.has("h")) {
    console.log(HELP);
    return 0;
  }
  if (args.flags.has("version") || args.flags.has("v")) {
    console.log(VERSION);
    return 0;
  }

  const command = args.positionals.shift();
  switch (command) {
    case "validate":
      return cmdCheck(args, "validate");
    case "lint":
      return cmdCheck(args, "lint");
    case "check":
      return cmdCheck(args, "check");
    case "index":
      return cmdIndex(args);
    case "init":
      return cmdInit(args);
    case undefined:
      console.log(HELP);
      return 0;
    default:
      console.error(c.red(`unknown command: ${command}`));
      console.error(`run \`skillsmith --help\` for usage`);
      return 2;
  }
}

process.exit(main(process.argv.slice(2)));
