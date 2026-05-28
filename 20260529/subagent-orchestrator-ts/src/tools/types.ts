import type { ToolCall, ToolResult, AgentId } from "../types.js";
import type { SharedMemory } from "../shared-memory.js";
import type { Tracer } from "../tracer.js";

export interface ToolContext {
  readonly agentId: AgentId;
  readonly workspace: string; // absolute path; tools must never escape this root
  readonly memory: SharedMemory;
  readonly tracer: Tracer;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  invoke(args: Readonly<Record<string, unknown>>, ctx: ToolContext): Promise<ToolResult>;
}

export type ToolRegistry = ReadonlyMap<string, Tool>;

export function ok(output: unknown): ToolResult {
  return { ok: true, output };
}

export function fail(error: string): ToolResult {
  return { ok: false, output: null, error };
}

export function asString(args: Readonly<Record<string, unknown>>, key: string): string {
  const v = args[key];
  if (typeof v !== "string") {
    throw new Error(`tool arg "${key}" must be a string`);
  }
  return v;
}

export function asOptionalString(
  args: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const v = args[key];
  if (v === undefined) return undefined;
  if (typeof v !== "string") {
    throw new Error(`tool arg "${key}" must be a string when provided`);
  }
  return v;
}

export { ToolCall, ToolResult };
