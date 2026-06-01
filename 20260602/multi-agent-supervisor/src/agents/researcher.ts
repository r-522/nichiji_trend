import type { Artifact, GraphState, WorkerAgent } from "../types.js";

const FACTS: ReadonlyArray<string> = [
  "Agentic AI was the dominant theme on the GitHub trending page through May 2026 — OpenClaw alone passed 373k stars.",
  "LangGraph v1.2 (May 2026) introduced per-node timeouts, error recovery and DeltaChannel for incremental state.",
  "Microsoft Agent Framework, merging AutoGen and Semantic Kernel, reached GA in Q1 2026.",
  "The MCP TypeScript SDK passed 66M cumulative npm downloads by mid-2026 and is now the de-facto tool layer for agents.",
  "The Supervisor pattern — one router + several specialist workers — is the most widely deployed multi-agent architecture in production.",
];

export const researcher: WorkerAgent = {
  name: "researcher",
  description: "Looks up background facts about the user's task.",
  async run(state: Readonly<GraphState>): Promise<Artifact> {
    const task = state.task.toLowerCase();
    const relevant = FACTS.filter((f) => {
      const lower = f.toLowerCase();
      return task.split(/\s+/).some(
        (token) => token.length > 3 && lower.includes(token),
      );
    });
    const picked = relevant.length > 0 ? relevant : FACTS.slice(0, 3);
    const body = picked.map((f, i) => `  ${i + 1}. ${f}`).join("\n");
    return {
      producer: "researcher",
      kind: "research",
      step: state.step,
      content: `Background on "${state.task}":\n${body}`,
    };
  },
};
