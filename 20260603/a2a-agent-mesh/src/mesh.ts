/**
 * AgentMesh — a federated registry + router over a fleet of A2A agents.
 *
 * Inspired by Microsoft Build 2026's "Azure Agent Mesh": individual agents
 * handle single-environment execution, while the mesh federates execution
 * across heterogeneous agents under a unified governance + observability layer.
 *
 *  - register():  discover an agent via its AgentCard and index its skills
 *  - route():     pick the lowest-latency agent capable of a skill tag
 *  - audit log:   every routing/execution decision is recorded, mirroring the
 *                 Entra ID (identity) + Purview (data classification) trail
 *                 from the Build demo.
 */

import { A2AClient, taskText, taskData } from "./client.js";
import type { Task } from "./types.js";

export interface AuditEntry {
  timestamp: string;
  action: string;
  agent?: string;
  identity?: string;
  dataClassification?: string;
  detail: string;
}

export interface RouteResult {
  agent: A2AClient;
  latencyMs: number;
}

export class AgentMesh {
  private readonly clients: A2AClient[] = [];
  private readonly latency = new Map<string, number>();
  private readonly auditLog: AuditEntry[] = [];

  /** Discover and register an agent by base URL, then probe its latency. */
  async register(baseUrl: string): Promise<A2AClient> {
    const client = await A2AClient.discover(baseUrl);
    this.clients.push(client);
    const ms = await this.probeLatency(client);
    this.latency.set(client.card.name, ms);
    this.audit({
      action: "register",
      agent: client.card.name,
      identity: client.card.provider?.identity,
      dataClassification: client.card.provider?.dataClassification,
      detail: `skills=[${client.card.skills
        .map((s) => s.id)
        .join(", ")}] latency=${ms}ms`,
    });
    return client;
  }

  /** All agents in the mesh whose skills carry the given capability tag. */
  capable(tag: string): A2AClient[] {
    return this.clients.filter((c) =>
      c.card.skills.some((s) => s.id === tag || s.tags.includes(tag)),
    );
  }

  /** Pick the lowest-latency agent that can satisfy a capability tag. */
  route(tag: string): RouteResult {
    const candidates = this.capable(tag);
    if (candidates.length === 0) {
      throw new Error(`no agent in the mesh can handle capability: ${tag}`);
    }
    candidates.sort(
      (a, b) =>
        (this.latency.get(a.card.name) ?? Infinity) -
        (this.latency.get(b.card.name) ?? Infinity),
    );
    const agent = candidates[0]!;
    const latencyMs = this.latency.get(agent.card.name) ?? 0;
    this.audit({
      action: "route",
      agent: agent.card.name,
      detail: `tag="${tag}" chosen from ${candidates.length} candidate(s) by latency (${latencyMs}ms)`,
    });
    return { agent, latencyMs };
  }

  /**
   * Federated invocation: route by capability tag, send the request, and
   * record the execution in the audit log. Returns the completed Task.
   */
  async invoke(tag: string, text: string, contextId?: string): Promise<Task> {
    const { agent } = this.route(tag);
    const task = await agent.sendMessage(text, contextId);
    this.audit({
      action: "execute",
      agent: agent.card.name,
      identity: agent.card.provider?.identity,
      dataClassification: agent.card.provider?.dataClassification,
      detail: `task=${task.id} state=${task.status.state} -> "${taskText(task)}"`,
    });
    return task;
  }

  /** Extract structured data from a completed Task (delegates to client util). */
  data(task: Task): Record<string, unknown> | undefined {
    return taskData(task);
  }

  text(task: Task): string {
    return taskText(task);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  size(): number {
    return this.clients.length;
  }

  private async probeLatency(client: A2AClient): Promise<number> {
    const start = performance.now();
    try {
      await fetch(`${client.card.url.replace(/\/a2a$/, "")}/.well-known/agent-card.json`);
    } catch {
      return Infinity;
    }
    return Math.round(performance.now() - start);
  }

  private audit(e: Omit<AuditEntry, "timestamp">): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), ...e });
  }
}
