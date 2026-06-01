import { routeWithMockLLM } from "./llm.js";
import type {
  GraphState,
  SupervisorAgent,
  SupervisorDecision,
  WorkerAgent,
} from "./types.js";

/**
 * Build a Supervisor that knows about a fixed set of workers. The supervisor
 * itself holds no state — all state lives in GraphState, exactly like
 * LangGraph nodes.
 */
export function buildSupervisor(workers: WorkerAgent[]): SupervisorAgent {
  const candidates = workers.map((w) => ({
    name: w.name,
    description: w.description,
  }));

  return {
    async decide(state: Readonly<GraphState>): Promise<SupervisorDecision> {
      const decision = await routeWithMockLLM({
        task: state.task,
        candidates,
        alreadyVisited: state.visited,
        artifactKinds: state.artifacts.map((a) => a.kind),
      });

      if (decision.next === "FINISH") {
        const report = state.artifacts.find((a) => a.kind === "report");
        const answer = report?.content
          ?? "No report produced; aborting with whatever artifacts exist.";
        return { kind: "finish", answer, reason: decision.reason };
      }

      if (!candidates.some((c) => c.name === decision.next)) {
        return {
          kind: "finish",
          answer: `Supervisor proposed unknown worker "${decision.next}"; aborting.`,
          reason: "unknown worker proposed",
        };
      }

      return {
        kind: "route",
        next: decision.next,
        reason: decision.reason,
      };
    },
  };
}
