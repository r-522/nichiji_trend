#!/usr/bin/env node
import { runGraph } from "./graph.js";
import { buildSupervisor } from "./supervisor.js";
import { researcher } from "./agents/researcher.js";
import { coder } from "./agents/coder.js";
import { writer } from "./agents/writer.js";

function readTaskFromArgv(): string {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    return "Explain the Supervisor multi-agent pattern and produce a code sample.";
  }
  return args.join(" ");
}

async function main(): Promise<void> {
  const task = readTaskFromArgv();
  const workers = [researcher, coder, writer];
  const supervisor = buildSupervisor(workers);

  const finalState = await runGraph({
    task,
    supervisor,
    workers,
    maxSteps: 8,
  });

  console.log();
  console.log("════════════════ FINAL ANSWER ════════════════");
  console.log(finalState.finalAnswer ?? "(no final answer produced)");
  console.log("══════════════════════════════════════════════");
  console.log();
  console.log(`workers visited: ${[...finalState.visited].join(", ") || "(none)"}`);
  console.log(`artifacts: ${finalState.artifacts.length}`);
  console.log(`messages : ${finalState.messages.length}`);
}

main().catch((err: unknown) => {
  console.error("fatal:", err);
  process.exit(1);
});
