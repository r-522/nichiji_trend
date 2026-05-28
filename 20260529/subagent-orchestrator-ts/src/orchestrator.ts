import type { OrchestratorResult, OrchestratorPlan, Subtask, SubagentResult } from "./types.js";
import type { Tracer } from "./tracer.js";
import type { OrchestratorPlanner, SubagentBrain } from "./planner/types.js";
import { SharedMemory } from "./shared-memory.js";
import { runSubagent } from "./subagent.js";

export interface OrchestratorOptions {
  readonly planner: OrchestratorPlanner;
  readonly brain: SubagentBrain;
  readonly tracer: Tracer;
  readonly workspace: string;
  readonly maxIterationsPerSubagent?: number;
}

export async function runOrchestrator(
  goal: string,
  opts: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const { planner, brain, tracer, workspace } = opts;
  const memory = new SharedMemory();

  // 1. Decompose
  const plan = await planner.decompose(goal);
  tracer.emit({
    agent: "orchestrator",
    kind: "plan",
    data: { goal, subtaskIds: plan.subtasks.map((s) => s.id) },
  });
  validatePlan(plan);

  // 2. Execute subagents respecting dependencies; independent waves run in parallel.
  const completed = new Map<string, SubagentResult>();
  const waves = topoWaves(plan.subtasks);

  for (const wave of waves) {
    tracer.emit({
      agent: "orchestrator",
      kind: "spawn",
      data: { wave: wave.map((s) => s.id) },
    });

    const results = await Promise.all(
      wave.map((subtask) =>
        runSubagent({
          subtask,
          brain,
          tracer,
          memory,
          workspace,
          ...(opts.maxIterationsPerSubagent !== undefined
            ? { maxIterations: opts.maxIterationsPerSubagent }
            : {}),
        }),
      ),
    );

    for (const r of results) completed.set(r.subtaskId, r);
  }

  // 3. Merge — orchestrator is the sole writer of the merged: namespace.
  const merged: Record<string, unknown> = {};
  for (const subtask of plan.subtasks) {
    const r = completed.get(subtask.id);
    if (!r) continue;
    merged[subtask.id] = {
      status: r.status,
      summary: r.summary,
      artifacts: r.artifacts,
    };
    memory.write(`merged:${subtask.id}`, merged[subtask.id], { writer: "orchestrator" });
  }
  tracer.emit({
    agent: "orchestrator",
    kind: "merge",
    data: { keys: Object.keys(merged) },
  });

  const allDone = [...completed.values()].every((r) => r.status === "completed");
  const anyDone = [...completed.values()].some((r) => r.status === "completed");
  const status: OrchestratorResult["status"] = allDone
    ? "completed"
    : anyDone
      ? "partial"
      : "failed";

  tracer.emit({
    agent: "orchestrator",
    kind: "complete",
    data: { status, subtaskCount: completed.size },
  });

  return {
    goal,
    status,
    subagentResults: [...completed.values()],
    merged,
  };
}

function validatePlan(plan: OrchestratorPlan): void {
  const ids = new Set<string>();
  for (const s of plan.subtasks) {
    if (ids.has(s.id)) throw new Error(`duplicate subtask id "${s.id}"`);
    ids.add(s.id);
  }
  for (const s of plan.subtasks) {
    for (const dep of s.dependsOn) {
      if (!ids.has(dep)) {
        throw new Error(`subtask "${s.id}" depends on unknown "${dep}"`);
      }
    }
  }
}

// Group subtasks into waves so each wave can be Promise.all'd safely.
// A subtask joins the first wave where all its deps are in earlier waves.
export function topoWaves(subtasks: readonly Subtask[]): Subtask[][] {
  const remaining = new Map(subtasks.map((s) => [s.id, s]));
  const placed = new Set<string>();
  const waves: Subtask[][] = [];

  while (remaining.size > 0) {
    const wave: Subtask[] = [];
    for (const s of remaining.values()) {
      if (s.dependsOn.every((d) => placed.has(d))) wave.push(s);
    }
    if (wave.length === 0) {
      throw new Error("cyclic dependency in plan");
    }
    for (const s of wave) {
      placed.add(s.id);
      remaining.delete(s.id);
    }
    waves.push(wave);
  }
  return waves;
}
