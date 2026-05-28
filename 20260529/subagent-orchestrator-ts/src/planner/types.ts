import type { OrchestratorPlan, PlanStep, Subtask, ToolResult } from "../types.js";

export interface OrchestratorPlanner {
  decompose(goal: string): Promise<OrchestratorPlan>;
}

export interface SubagentBrain {
  // Decide the next step for a subagent given its instruction history.
  nextStep(input: {
    subtask: Subtask;
    history: ReadonlyArray<{ step: PlanStep; result: ToolResult }>;
  }): Promise<PlanStep>;
}
