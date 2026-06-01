import type {
  GraphState,
  SupervisorAgent,
  WorkerAgent,
} from "./types.js";

export interface RunOptions {
  task: string;
  supervisor: SupervisorAgent;
  workers: WorkerAgent[];
  /** Hard cap on supervisor decisions to avoid runaway loops. */
  maxSteps?: number;
  /** Optional trace sink (defaults to console.log). */
  onEvent?: (event: GraphEvent) => void;
}

export type GraphEvent =
  | { type: "start"; task: string }
  | { type: "route"; step: number; worker: string; reason: string }
  | { type: "worker-done"; step: number; worker: string; artifactKind: string }
  | { type: "finish"; step: number; reason: string };

function defaultLogger(event: GraphEvent): void {
  switch (event.type) {
    case "start":
      console.log(`▶  task: ${event.task}`);
      break;
    case "route":
      console.log(`  └─ step ${event.step}: → ${event.worker}  (${event.reason})`);
      break;
    case "worker-done":
      console.log(`     ✓ ${event.worker} produced ${event.artifactKind}`);
      break;
    case "finish":
      console.log(`■  finish: ${event.reason}`);
      break;
  }
}

/**
 * Drive the state graph until the supervisor returns FINISH or maxSteps is
 * reached. Mirrors LangGraph's `Graph.invoke` contract: caller supplies
 * initial state, we return the final state.
 */
export async function runGraph(opts: RunOptions): Promise<GraphState> {
  const maxSteps = opts.maxSteps ?? 10;
  const onEvent = opts.onEvent ?? defaultLogger;
  const workerByName = new Map(opts.workers.map((w) => [w.name, w]));

  const state: GraphState = {
    task: opts.task,
    messages: [
      { role: "user", from: "user", content: opts.task, step: 0 },
    ],
    artifacts: [],
    visited: new Set<string>(),
    step: 0,
  };

  onEvent({ type: "start", task: opts.task });

  for (let i = 0; i < maxSteps; i++) {
    state.step += 1;
    const decision = await opts.supervisor.decide(state);

    if (decision.kind === "finish") {
      state.finalAnswer = decision.answer;
      state.messages.push({
        role: "supervisor",
        from: "supervisor",
        content: `FINISH: ${decision.reason}`,
        step: state.step,
      });
      onEvent({ type: "finish", step: state.step, reason: decision.reason });
      return state;
    }

    const worker = workerByName.get(decision.next);
    if (!worker) {
      // Defensive — supervisor.decide already guards against this.
      state.finalAnswer = `unknown worker: ${decision.next}`;
      return state;
    }

    state.messages.push({
      role: "supervisor",
      from: "supervisor",
      content: `route → ${worker.name}: ${decision.reason}`,
      step: state.step,
    });
    onEvent({
      type: "route",
      step: state.step,
      worker: worker.name,
      reason: decision.reason,
    });

    const artifact = await worker.run(state);
    state.artifacts.push(artifact);
    state.visited.add(worker.name);
    state.messages.push({
      role: "worker",
      from: worker.name,
      content: artifact.content,
      step: state.step,
    });
    onEvent({
      type: "worker-done",
      step: state.step,
      worker: worker.name,
      artifactKind: artifact.kind,
    });
  }

  // Hit maxSteps without a FINISH — synthesise a best-effort answer.
  const report = state.artifacts.find((a) => a.kind === "report");
  state.finalAnswer = report?.content
    ?? `Stopped after ${maxSteps} steps without a final report.`;
  onEvent({
    type: "finish",
    step: state.step,
    reason: `maxSteps reached (${maxSteps})`,
  });
  return state;
}
