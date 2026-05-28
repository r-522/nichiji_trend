import { asString, ok } from "./types.js";
import type { Tool } from "./types.js";

export const doneTool: Tool = {
  name: "done",
  description:
    "Signal that the subtask is complete. Provide a 'summary' string and optional 'artifacts' object.",
  async invoke(args) {
    const summary = asString(args, "summary");
    const artifacts = (args["artifacts"] ?? {}) as Record<string, unknown>;
    return ok({ done: true, summary, artifacts });
  },
};
