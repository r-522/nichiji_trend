#!/usr/bin/env node
/**
 * slopguard CLI.
 *
 *   slopguard [path] [options]
 *
 * Scans a project directory (default: cwd), a package.json, or a single source
 * file for AI-hallucinated / slopsquatted dependencies.
 */
import { scan, type ScanOptions } from "./scanner.js";
import { renderReport } from "./report.js";
import type { Severity } from "./types.js";

interface Cli {
  target: string;
  options: ScanOptions;
  json: boolean;
  failOn: Severity | "none";
  help: boolean;
}

const SEVERITIES: Severity[] = ["info", "low", "medium", "high", "critical"];

function parseArgs(argv: string[]): Cli {
  const cli: Cli = {
    target: ".",
    options: { online: false, scanSources: true },
    json: false,
    failOn: "high",
    help: false,
  };
  let sawTarget = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "-h":
      case "--help":
        cli.help = true;
        break;
      case "--online":
        cli.options.online = true;
        break;
      case "--offline":
        cli.options.online = false;
        break;
      case "--no-sources":
        cli.options.scanSources = false;
        break;
      case "--json":
        cli.json = true;
        break;
      case "--fail-on": {
        const v = argv[++i] as Severity | "none" | undefined;
        if (v && (v === "none" || SEVERITIES.includes(v as Severity))) {
          cli.failOn = v;
        } else {
          throw new Error(`--fail-on expects one of: none, ${SEVERITIES.join(", ")}`);
        }
        break;
      }
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        cli.target = arg;
        sawTarget = true;
    }
  }
  void sawTarget;
  return cli;
}

const HELP = `slopguard — detect AI-hallucinated & slopsquatted npm dependencies

USAGE
  slopguard [path] [options]

ARGUMENTS
  path                 Project dir, package.json, or source file (default: ".")

OPTIONS
  --online             Verify each package against the live npm registry
                       (existence, publish age, weekly downloads, install hooks)
  --offline            Heuristics only, no network (default)
  --no-sources         Do not scan source files for import/require specifiers
  --json               Emit the full report as JSON
  --fail-on <sev>      Exit non-zero if any finding >= severity.
                       One of: none, info, low, medium, high, critical
                       (default: high)
  -h, --help           Show this help

EXIT CODES
  0  no finding at or above --fail-on threshold
  2  findings at or above threshold
  1  usage / runtime error

EXAMPLES
  slopguard                       # scan current project (offline)
  slopguard ./examples --online   # full registry-backed scan
  slopguard pkg/app --json | jq   # machine-readable output`;

async function main(): Promise<number> {
  let cli: Cli;
  try {
    cli = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error("Run with --help for usage.");
    return 1;
  }

  if (cli.help) {
    console.log(HELP);
    return 0;
  }

  let report;
  try {
    report = await scan(cli.target, cli.options);
  } catch (err) {
    console.error(`slopguard: ${(err as Error).message}`);
    return 1;
  }

  if (cli.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderReport(report));
  }

  if (cli.failOn === "none") return 0;
  const threshold = SEVERITIES.indexOf(cli.failOn);
  const tripped = report.findings.some((f) => SEVERITIES.indexOf(f.severity) >= threshold);
  return tripped ? 2 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
