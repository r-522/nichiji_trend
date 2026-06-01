import type { Artifact, GraphState, WorkerAgent } from "../types.js";

export const coder: WorkerAgent = {
  name: "coder",
  description: "Produces a runnable TypeScript code snippet related to the task.",
  async run(state: Readonly<GraphState>): Promise<Artifact> {
    const safeName = state.task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "task";

    const snippet = `// Minimal supervisor-pattern skeleton for: ${state.task}
import { runGraph } from "./graph.js";
import { buildSupervisor } from "./supervisor.js";
import { researcher } from "./agents/researcher.js";
import { coder } from "./agents/coder.js";
import { writer } from "./agents/writer.js";

const workers = [researcher, coder, writer];
const supervisor = buildSupervisor(workers);

export async function ${safeName}() {
  const state = await runGraph({
    task: ${JSON.stringify(state.task)},
    supervisor,
    workers,
    maxSteps: 8,
  });
  return state.finalAnswer;
}
`;

    return {
      producer: "coder",
      kind: "code",
      step: state.step,
      content: snippet,
    };
  },
};
