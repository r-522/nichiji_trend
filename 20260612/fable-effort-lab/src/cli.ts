#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import { compareTokenizers, runOnce } from "./runner.js";
import { renderAnswers, renderSweepTable } from "./report.js";
import { Effort, EFFORT_LEVELS, isEffort, MODEL_ID } from "./types.js";

const USAGE = `fable-effort-lab — Claude Fable 5 effort-level laboratory

Usage:
  fable-effort-lab ask "<prompt>" [--effort <level>] [--max-tokens <n>] [--show-thinking]
  fable-effort-lab sweep "<prompt>" [--efforts low,high,...] [--max-tokens <n>] [--answers]
  fable-effort-lab tokens "<text>"

Commands:
  ask     Stream a single answer from ${MODEL_ID} at one effort level (default: high)
  sweep   Run the same prompt at multiple effort levels (default: low,medium,high)
          and print a latency / token / cost comparison table
  tokens  Count tokens under the new Fable 5 tokenizer and the prior-generation
          tokenizer, and show the delta

Effort levels: ${EFFORT_LEVELS.join(", ")}

Environment:
  ANTHROPIC_API_KEY must be set.
`;

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(name, next);
        i++;
      } else {
        flags.set(name, true);
      }
    } else {
      positional.push(arg);
    }
  }
  return { command, positional, flags };
}

function fail(message: string): never {
  console.error(`error: ${message}\n`);
  console.error(USAGE);
  process.exit(1);
}

function parseEffortList(raw: string): Effort[] {
  const efforts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const e of efforts) {
    if (!isEffort(e)) fail(`unknown effort level "${e}" (valid: ${EFFORT_LEVELS.join(", ")})`);
  }
  return efforts as Effort[];
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || flags.has("help")) {
    console.log(USAGE);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    fail("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic();
  const prompt = positional[0];
  if (!prompt) fail(`command "${command}" requires a prompt/text argument`);

  const maxTokens = Number(flags.get("max-tokens") ?? 16000);
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) fail("--max-tokens must be a positive integer");

  switch (command) {
    case "ask": {
      const effortRaw = String(flags.get("effort") ?? "high");
      if (!isEffort(effortRaw)) fail(`unknown effort level "${effortRaw}"`);
      const result = await runOnce(client, {
        prompt,
        effort: effortRaw,
        maxTokens,
        showThinking: flags.get("show-thinking") === true,
        echo: true,
      });
      process.stdout.write("\n\n");
      if (result.error) fail(result.error);
      if (result.refused) {
        console.log(
          `Request was declined by Fable 5's safety classifiers ` +
            `(category: ${result.refusalCategory ?? "n/a"}). ` +
            `Consider retrying on claude-opus-4-8 via the fallbacks beta.`,
        );
      }
      console.log(renderSweepTable([result]));
      break;
    }

    case "sweep": {
      const efforts = parseEffortList(String(flags.get("efforts") ?? "low,medium,high"));
      console.log(`model: ${MODEL_ID} | prompt: ${JSON.stringify(prompt)}\n`);
      const results = [];
      for (const effort of efforts) {
        process.stderr.write(`running effort=${effort} ...\n`);
        results.push(
          await runOnce(client, {
            prompt,
            effort,
            maxTokens,
            showThinking: false,
            echo: false,
          }),
        );
      }
      console.log(renderSweepTable(results));
      if (flags.get("answers") === true) console.log(renderAnswers(results));
      break;
    }

    case "tokens": {
      const cmp = await compareTokenizers(client, prompt);
      console.log(`Fable 5 tokenizer:           ${cmp.newTokens} tokens`);
      console.log(
        `Prior-generation tokenizer:  ${cmp.priorTokens ?? "(not returned by API)"} tokens`,
      );
      if (cmp.deltaPct !== null) {
        console.log(`Delta:                       ${cmp.deltaPct >= 0 ? "+" : ""}${cmp.deltaPct.toFixed(1)}%`);
      }
      break;
    }

    default:
      fail(`unknown command "${command}"`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
