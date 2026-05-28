import { asString, ok, fail } from "./types.js";
import type { Tool } from "./types.js";
import type { Namespace } from "../shared-memory.js";

function asNamespace(s: string): Namespace {
  if (s.startsWith("subtask:") || s.startsWith("shared:") || s.startsWith("merged:")) {
    return s as Namespace;
  }
  throw new Error(
    `namespace must start with "subtask:", "shared:", or "merged:" (got "${s}")`,
  );
}

export const memoryReadTool: Tool = {
  name: "memory_read",
  description: "Read a value from the shared memory layer.",
  async invoke(args, ctx) {
    try {
      const ns = asNamespace(asString(args, "namespace"));
      const value = ctx.memory.read(ns);
      return ok({ namespace: ns, value });
    } catch (e) {
      return fail((e as Error).message);
    }
  },
};

export const memoryWriteTool: Tool = {
  name: "memory_write",
  description:
    "Write a value to the shared memory layer. Subagents can only write to their own subtask:<id> slot.",
  async invoke(args, ctx) {
    try {
      const ns = asNamespace(asString(args, "namespace"));
      const value = args["value"];
      ctx.memory.write(ns, value, { writer: ctx.agentId });
      ctx.tracer.emit({
        agent: ctx.agentId,
        kind: "memory_write",
        data: { namespace: ns },
      });
      return ok({ namespace: ns });
    } catch (e) {
      return fail((e as Error).message);
    }
  },
};
