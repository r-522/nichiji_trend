/**
 * Tiny zero-dependency self-test. Run with:
 *   npx ts-node --esm src/test.ts
 * or after `npm run build`:
 *   node dist/test.js
 */
import { runGraph } from "./graph.js";
import { buildSupervisor } from "./supervisor.js";
import { researcher } from "./agents/researcher.js";
import { coder } from "./agents/coder.js";
import { writer } from "./agents/writer.js";

interface TestCase {
  name: string;
  task: string;
  expectVisited: string[];
  expectReport: boolean;
}

const CASES: TestCase[] = [
  {
    name: "full pipeline",
    task: "Research the Supervisor pattern and write a report with a code sample.",
    expectVisited: ["researcher", "coder", "writer"],
    expectReport: true,
  },
  {
    name: "default ordering on generic task",
    task: "Tell me about agents.",
    expectVisited: ["researcher", "coder", "writer"],
    expectReport: true,
  },
];

async function runOne(tc: TestCase): Promise<boolean> {
  const workers = [researcher, coder, writer];
  const supervisor = buildSupervisor(workers);
  const state = await runGraph({
    task: tc.task,
    supervisor,
    workers,
    maxSteps: 8,
    onEvent: () => {},
  });

  for (const w of tc.expectVisited) {
    if (!state.visited.has(w)) {
      console.error(`  ✗ ${tc.name}: expected ${w} to run, but it did not`);
      return false;
    }
  }
  if (tc.expectReport) {
    const hasReport = state.artifacts.some((a) => a.kind === "report");
    if (!hasReport) {
      console.error(`  ✗ ${tc.name}: expected a report artifact`);
      return false;
    }
    if (!state.finalAnswer || !state.finalAnswer.includes("# Report")) {
      console.error(`  ✗ ${tc.name}: final answer is not the report`);
      return false;
    }
  }
  console.log(`  ✓ ${tc.name}`);
  return true;
}

async function main(): Promise<void> {
  let ok = true;
  for (const tc of CASES) ok = (await runOne(tc)) && ok;
  if (!ok) {
    console.error("FAIL");
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((err: unknown) => {
  console.error("fatal:", err);
  process.exit(1);
});
