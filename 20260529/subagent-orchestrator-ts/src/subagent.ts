import type {
  Subtask,
  SubagentResult,
  PlanStep,
  ToolResult,
} from "./types.js";
import type { Tracer } from "./tracer.js";
import type { SharedMemory } from "./shared-memory.js";
import type { SubagentBrain } from "./planner/types.js";
import { defaultRegistry, filteredRegistry } from "./tools/registry.js";

export interface SubagentOptions {
  readonly subtask: Subtask;
  readonly brain: SubagentBrain;
  readonly tracer: Tracer;
  readonly memory: SharedMemory;
  readonly workspace: string;
  readonly maxIterations?: number;
}

export async function runSubagent(opts: SubagentOptions): Promise<SubagentResult> {
  const { subtask, brain, tracer, memory, workspace } = opts;
  const maxIterations = opts.maxIterations ?? 6;
  const registry = filteredRegistry(defaultRegistry(), subtask.toolAllowlist);
  const history: Array<{ step: PlanStep; result: ToolResult }> = [];

  for (let i = 0; i < maxIterations; i++) {
    let step: PlanStep;
    try {
      step = await brain.nextStep({ subtask, history });
    } catch (e) {
      tracer.emit({
        agent: subtask.id,
        kind: "error",
        data: { stage: "plan", message: (e as Error).message },
      });
      return {
        subtaskId: subtask.id,
        status: "failed",
        summary: `planner error: ${(e as Error).message}`,
        iterations: i,
        artifacts: {},
      };
    }

    tracer.emit({
      agent: subtask.id,
      kind: "plan",
      data: { iteration: i, thought: step.thought, tool: step.tool.name },
    });

    const tool = registry.get(step.tool.name);
    if (!tool) {
      tracer.emit({
        agent: subtask.id,
        kind: "error",
        data: { message: `tool "${step.tool.name}" not in allowlist` },
      });
      return {
        subtaskId: subtask.id,
        status: "failed",
        summary: `tool not allowed: ${step.tool.name}`,
        iterations: i,
        artifacts: {},
      };
    }

    tracer.emit({
      agent: subtask.id,
      kind: "tool_call",
      data: { tool: step.tool.name, args: step.tool.args },
    });

    const result = await tool.invoke(step.tool.args, {
      agentId: subtask.id,
      workspace,
      memory,
      tracer,
    });

    tracer.emit({
      agent: subtask.id,
      kind: "tool_result",
      data: { tool: step.tool.name, ok: result.ok, error: result.error ?? null },
    });

    history.push({ step, result });

    if (step.tool.name === "done" && result.ok) {
      const payload = result.output as { summary?: string; artifacts?: Record<string, unknown> };
      tracer.emit({
        agent: subtask.id,
        kind: "complete",
        data: { summary: payload.summary ?? "" },
      });
      return {
        subtaskId: subtask.id,
        status: "completed",
        summary: payload.summary ?? `subtask ${subtask.id} completed`,
        iterations: i + 1,
        artifacts: payload.artifacts ?? {},
      };
    }
  }

  tracer.emit({
    agent: subtask.id,
    kind: "error",
    data: { message: "max iterations reached" },
  });
  return {
    subtaskId: subtask.id,
    status: "stopped",
    summary: "max iterations reached without 'done'",
    iterations: maxIterations,
    artifacts: {},
  };
}
