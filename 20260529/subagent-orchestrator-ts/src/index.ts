#!/usr/bin/env node
import { resolve } from "node:path";
import { runOrchestrator } from "./orchestrator.js";
import { Tracer } from "./tracer.js";
import {
  HeuristicOrchestratorPlanner,
  HeuristicSubagentBrain,
} from "./planner/heuristic.js";
import {
  LLMOrchestratorPlanner,
  LLMSubagentBrain,
  type OpenAICompatConfig,
} from "./planner/llm.js";

interface CliOpts {
  readonly command: "run" | "help";
  readonly goal: string;
  readonly planner: "heuristic" | "llm";
  readonly workspace: string;
  readonly tracePath?: string;
  readonly maxIter: number;
  readonly silent: boolean;
}

function parseArgs(argv: readonly string[]): CliOpts {
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    return {
      command: "help",
      goal: "",
      planner: "heuristic",
      workspace: process.cwd(),
      maxIter: 6,
      silent: false,
    };
  }
  if (argv[0] !== "run") {
    throw new Error(`unknown command "${argv[0]}". try "run" or "help"`);
  }

  let goal = "";
  let planner: CliOpts["planner"] = "heuristic";
  let workspace = process.cwd();
  let tracePath: string | undefined;
  let maxIter = 6;
  let silent = false;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--planner":
        planner = pickPlanner(argv[++i]);
        break;
      case "--workspace":
        workspace = resolve(argv[++i] ?? "");
        break;
      case "--trace":
        tracePath = resolve(argv[++i] ?? "");
        break;
      case "--max-iter":
        maxIter = parseInt(argv[++i] ?? "6", 10);
        break;
      case "--silent":
        silent = true;
        break;
      default:
        if (a.startsWith("--")) throw new Error(`unknown flag "${a}"`);
        goal = goal ? `${goal} ${a}` : a;
    }
  }
  if (!goal) throw new Error('missing goal. usage: run "<goal>"');
  const opts: CliOpts = { command: "run", goal, planner, workspace, maxIter, silent };
  return tracePath !== undefined ? { ...opts, tracePath } : opts;
}

function pickPlanner(v: string | undefined): CliOpts["planner"] {
  if (v === "heuristic" || v === "llm") return v;
  throw new Error(`--planner must be "heuristic" or "llm" (got "${v}")`);
}

function helpText(): string {
  return `subagent-orchestrator — local Antigravity-2.0-style orchestrator demo

USAGE
  subagent-orchestrator run "<goal>" [flags]

FLAGS
  --planner <heuristic|llm>   Decomposer + subagent brain. Default: heuristic
  --workspace <path>          Sandbox directory for file/shell tools. Default: cwd
  --trace <path>              Write JSONL trace to this path
  --max-iter <n>              Max iterations per subagent (default 6)
  --silent                    Suppress live trace on stdout

ENV (only when --planner llm)
  OPENAI_BASE_URL   default https://api.openai.com/v1
  OPENAI_API_KEY    required
  OPENAI_MODEL      default gpt-4o-mini (any OpenAI-compatible chat model)

EXAMPLES
  subagent-orchestrator run "inventory the workspace files"
  subagent-orchestrator run "summarise environment and uname"
  subagent-orchestrator run "count lines in README.md" --trace trace.jsonl
`;
}

function llmConfigFromEnv(): OpenAICompatConfig {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when --planner llm is selected");
  }
  return {
    baseUrl: process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1",
    apiKey,
    model: process.env["OPENAI_MODEL"] ?? "gpt-4o-mini",
  };
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));

  if (cli.command === "help") {
    process.stdout.write(helpText());
    return;
  }

  const tracer = new Tracer({ silent: cli.silent });
  const planner =
    cli.planner === "llm"
      ? new LLMOrchestratorPlanner(llmConfigFromEnv())
      : new HeuristicOrchestratorPlanner();
  const brain =
    cli.planner === "llm"
      ? new LLMSubagentBrain(llmConfigFromEnv())
      : new HeuristicSubagentBrain();

  const result = await runOrchestrator(cli.goal, {
    planner,
    brain,
    tracer,
    workspace: cli.workspace,
    maxIterationsPerSubagent: cli.maxIter,
  });

  if (cli.tracePath) {
    await tracer.dump(cli.tracePath);
  }

  // Final summary on stderr so stdout stays the pure JSONL trace.
  process.stderr.write(
    "\n=== orchestrator result ===\n" + JSON.stringify(result, null, 2) + "\n",
  );

  process.exit(result.status === "completed" ? 0 : 1);
}

main().catch((e: unknown) => {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exit(2);
});
