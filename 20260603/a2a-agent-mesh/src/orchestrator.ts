/**
 * Orchestrator — runs a federated workflow across the mesh.
 *
 * A workflow is an ordered list of steps. Each step names a capability tag
 * (the mesh routes it to the best agent) and builds its request from the
 * shared context produced by earlier steps. This is the "graph-based
 * sequential pattern" from Microsoft Agent Framework, but vendor-neutral:
 * every hop is a standard A2A `message/send` call.
 */

import type { AgentMesh } from "./mesh.js";

export interface WorkflowContext {
  /** Free-form values accumulated across steps (keyed by step name). */
  values: Record<string, unknown>;
  /** The original user input. */
  input: string;
}

export interface WorkflowStep {
  name: string;
  /** Capability tag the mesh routes on. */
  tag: string;
  /** Build the request text for this step from the running context. */
  buildRequest: (ctx: WorkflowContext) => string;
  /** Optional: fold this step's structured result back into the context. */
  collect?: (ctx: WorkflowContext, data: Record<string, unknown> | undefined, text: string) => void;
}

export interface StepTrace {
  step: string;
  tag: string;
  request: string;
  response: string;
}

export interface WorkflowResult {
  context: WorkflowContext;
  trace: StepTrace[];
}

export async function runWorkflow(
  mesh: AgentMesh,
  input: string,
  steps: WorkflowStep[],
): Promise<WorkflowResult> {
  const ctx: WorkflowContext = { values: {}, input };
  const trace: StepTrace[] = [];
  // A shared contextId stitches every A2A task into one logical conversation.
  const contextId = `wf-${Date.now()}`;

  for (const step of steps) {
    const request = step.buildRequest(ctx);
    const task = await mesh.invoke(step.tag, request, contextId);
    const text = mesh.text(task);
    const data = mesh.data(task);
    ctx.values[step.name] = data ?? text;
    step.collect?.(ctx, data, text);
    trace.push({ step: step.name, tag: step.tag, request, response: text });
  }

  return { context: ctx, trace };
}

/**
 * Concurrent fan-out: run several capability tags against the same input in
 * parallel and return each agent's text result, keyed by tag.
 */
export async function fanOut(
  mesh: AgentMesh,
  input: string,
  tags: string[],
): Promise<Record<string, string>> {
  const results = await Promise.all(
    tags.map(async (tag) => {
      const task = await mesh.invoke(tag, input);
      return [tag, mesh.text(task)] as const;
    }),
  );
  return Object.fromEntries(results);
}
