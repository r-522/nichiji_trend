/**
 * A2AClient — talks to a remote A2A agent over JSON-RPC, using global `fetch`.
 *
 * Handles AgentCard discovery and the `message/send` / `tasks/get` methods.
 */

import { randomUUID } from "node:crypto";
import {
  AGENT_CARD_PATH,
  type AgentCard,
  type Message,
  type Task,
} from "./types.js";
import {
  isRpcError,
  rpcRequest,
  type JsonRpcResponse,
} from "./jsonrpc.js";

export class A2AClient {
  constructor(public readonly card: AgentCard) {}

  /** Discover an agent by fetching its well-known AgentCard. */
  static async discover(baseUrl: string): Promise<A2AClient> {
    const res = await fetch(`${baseUrl}${AGENT_CARD_PATH}`);
    if (!res.ok) {
      throw new Error(`failed to fetch agent card from ${baseUrl}: ${res.status}`);
    }
    const card = (await res.json()) as AgentCard;
    return new A2AClient(card);
  }

  /** Send a text message and await the resulting (completed) Task. */
  async sendMessage(text: string, contextId?: string): Promise<Task> {
    const message: Message = {
      kind: "message",
      role: "user",
      messageId: randomUUID(),
      contextId,
      parts: [{ kind: "text", text }],
    };
    const result = await this.rpc("message/send", { message });
    return result as Task;
  }

  async getTask(id: string): Promise<Task> {
    const result = await this.rpc("tasks/get", { id });
    return result as Task;
  }

  private async rpc(method: string, params: unknown): Promise<unknown> {
    const res = await fetch(this.card.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rpcRequest(method, params)),
    });
    const json = (await res.json()) as JsonRpcResponse;
    if (isRpcError(json)) {
      throw new Error(`A2A error ${json.error.code}: ${json.error.message}`);
    }
    return json.result;
  }
}

/** Convenience: extract the joined text from a completed Task's first artifact. */
export function taskText(task: Task): string {
  const artifact = task.artifacts[0];
  if (!artifact) return "";
  return artifact.parts
    .map((p) => (p.kind === "text" ? p.text : ""))
    .filter(Boolean)
    .join(" ");
}

/** Convenience: extract structured data from a completed Task's first artifact. */
export function taskData(task: Task): Record<string, unknown> | undefined {
  const artifact = task.artifacts[0];
  const dataPart = artifact?.parts.find((p) => p.kind === "data");
  return dataPart && dataPart.kind === "data" ? dataPart.data : undefined;
}
