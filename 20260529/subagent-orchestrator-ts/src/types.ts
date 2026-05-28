// Shared type definitions for the orchestrator + subagent system.
// The vocabulary mirrors the public Antigravity 2.0 architecture
// (orchestrator → subagents with isolated context → shared memory layer).

export type AgentId = string;

export interface Subtask {
  readonly id: AgentId;
  readonly title: string;
  readonly instruction: string;
  readonly dependsOn: readonly AgentId[];
  readonly toolAllowlist: readonly string[];
}

export interface OrchestratorPlan {
  readonly goal: string;
  readonly subtasks: readonly Subtask[];
}

export interface ToolCall {
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export interface ToolResult {
  readonly ok: boolean;
  readonly output: unknown;
  readonly error?: string;
}

export interface PlanStep {
  readonly thought: string;
  readonly tool: ToolCall;
}

export interface SubagentResult {
  readonly subtaskId: AgentId;
  readonly status: "completed" | "failed" | "stopped";
  readonly summary: string;
  readonly iterations: number;
  readonly artifacts: Readonly<Record<string, unknown>>;
}

export interface OrchestratorResult {
  readonly goal: string;
  readonly status: "completed" | "partial" | "failed";
  readonly subagentResults: readonly SubagentResult[];
  readonly merged: Readonly<Record<string, unknown>>;
}

export interface TraceEvent {
  readonly ts: number;
  readonly agent: AgentId;
  readonly kind:
    | "plan"
    | "spawn"
    | "tool_call"
    | "tool_result"
    | "observe"
    | "reflect"
    | "memory_write"
    | "merge"
    | "complete"
    | "error";
  readonly data: Readonly<Record<string, unknown>>;
}
