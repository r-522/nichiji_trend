import { test } from "node:test";
import assert from "node:assert/strict";
import { topoWaves, runOrchestrator } from "../src/orchestrator.js";
import { Tracer } from "../src/tracer.js";
import {
  HeuristicOrchestratorPlanner,
  HeuristicSubagentBrain,
} from "../src/planner/heuristic.js";
import type { Subtask } from "../src/types.js";

test("topoWaves groups independent subtasks into the same wave", () => {
  const subs: Subtask[] = [
    { id: "a", title: "", instruction: "", dependsOn: [], toolAllowlist: [] },
    { id: "b", title: "", instruction: "", dependsOn: [], toolAllowlist: [] },
    { id: "c", title: "", instruction: "", dependsOn: ["a", "b"], toolAllowlist: [] },
  ];
  const waves = topoWaves(subs);
  assert.equal(waves.length, 2);
  assert.deepEqual(
    waves[0].map((s) => s.id).sort(),
    ["a", "b"],
  );
  assert.deepEqual(
    waves[1].map((s) => s.id),
    ["c"],
  );
});

test("topoWaves rejects cycles", () => {
  const subs: Subtask[] = [
    { id: "a", title: "", instruction: "", dependsOn: ["b"], toolAllowlist: [] },
    { id: "b", title: "", instruction: "", dependsOn: ["a"], toolAllowlist: [] },
  ];
  assert.throws(() => topoWaves(subs), /cyclic/);
});

test("orchestrator drives the heuristic planner end-to-end", async () => {
  const tracer = new Tracer({ silent: true });
  const result = await runOrchestrator("inventory workspace files", {
    planner: new HeuristicOrchestratorPlanner(),
    brain: new HeuristicSubagentBrain(),
    tracer,
    workspace: process.cwd(),
    maxIterationsPerSubagent: 5,
  });
  assert.equal(result.status, "completed");
  assert.ok(result.subagentResults.length >= 1);
  assert.ok(result.subagentResults.every((r) => r.status === "completed"));
  assert.ok(Object.keys(result.merged).length === result.subagentResults.length);
});

test("orchestrator runs environment plan with multiple subagents", async () => {
  const tracer = new Tracer({ silent: true });
  const result = await runOrchestrator(
    "report on environment uname and host",
    {
      planner: new HeuristicOrchestratorPlanner(),
      brain: new HeuristicSubagentBrain(),
      tracer,
      workspace: process.cwd(),
      maxIterationsPerSubagent: 5,
    },
  );
  const ids = result.subagentResults.map((r) => r.subtaskId).sort();
  assert.deepEqual(ids, ["date-info", "os-info", "report"]);
  assert.equal(result.status, "completed");

  // The trace must show that os-info and date-info were spawned in the same wave.
  const spawnEvents = tracer
    .snapshot()
    .filter((e) => e.kind === "spawn")
    .map((e) => (e.data as { wave: string[] }).wave.slice().sort());
  assert.deepEqual(spawnEvents[0], ["date-info", "os-info"]);
  assert.deepEqual(spawnEvents[1], ["report"]);
});
