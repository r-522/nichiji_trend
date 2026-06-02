/**
 * A2AAgent — an A2A-compliant agent server.
 *
 * Serves its AgentCard at /.well-known/agent-card.json and accepts A2A
 * JSON-RPC calls at /a2a. Implements the core methods `message/send` and
 * `tasks/get`. Built only on Node's `http` module — no framework.
 */

import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  AGENT_CARD_PATH,
  A2A_RPC_PATH,
  A2A_PROTOCOL_VERSION,
  type AgentCard,
  type Message,
  type Task,
} from "./types.js";
import {
  RpcErrors,
  isRpcError,
  rpcError,
  rpcSuccess,
  type JsonRpcRequest,
} from "./jsonrpc.js";
import type { SkillImpl } from "./skills.js";

export interface AgentOptions {
  name: string;
  description: string;
  skills: SkillImpl[];
  provider?: AgentCard["provider"];
  /** Optional artificial latency (ms) to make mesh routing observable. */
  latencyMs?: number;
}

export class A2AAgent {
  private server: http.Server;
  private readonly tasks = new Map<string, Task>();
  private baseUrl = "";
  private readonly opts: AgentOptions;

  constructor(opts: AgentOptions) {
    this.opts = opts;
    this.server = http.createServer((req, res) => {
      void this.onRequest(req, res);
    });
  }

  /** Start listening on an ephemeral port. Resolves with the base URL. */
  async listen(port = 0): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(port, resolve));
    const addr = this.server.address();
    if (addr && typeof addr === "object") {
      this.baseUrl = `http://127.0.0.1:${addr.port}`;
    }
    return this.baseUrl;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server.close((err) => (err ? reject(err) : resolve())),
    );
  }

  get url(): string {
    return this.baseUrl;
  }

  card(): AgentCard {
    return {
      protocolVersion: A2A_PROTOCOL_VERSION,
      name: this.opts.name,
      description: this.opts.description,
      url: `${this.baseUrl}${A2A_RPC_PATH}`,
      version: "1.0.0",
      capabilities: { streaming: false },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      skills: this.opts.skills.map((s) => s.card),
      provider: this.opts.provider,
    };
  }

  private async onRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (this.opts.latencyMs) {
      await new Promise((r) => setTimeout(r, this.opts.latencyMs));
    }

    if (req.method === "GET" && req.url === AGENT_CARD_PATH) {
      return this.json(res, 200, this.card());
    }

    if (req.method === "POST" && req.url === A2A_RPC_PATH) {
      const body = await this.readBody(req);
      let parsed: JsonRpcRequest;
      try {
        parsed = JSON.parse(body) as JsonRpcRequest;
      } catch {
        return this.json(
          res,
          200,
          rpcError(null, RpcErrors.PARSE_ERROR, "invalid JSON"),
        );
      }
      const response = this.dispatch(parsed);
      return this.json(res, isRpcError(response) ? 200 : 200, response);
    }

    return this.json(res, 404, { error: "not found" });
  }

  private dispatch(req: JsonRpcRequest) {
    const { id, method, params } = req;
    if (typeof id === "undefined") {
      return rpcError(null, RpcErrors.INVALID_REQUEST, "missing id");
    }
    try {
      switch (method) {
        case "message/send":
          return rpcSuccess(id, this.handleMessageSend(params));
        case "tasks/get":
          return rpcSuccess(id, this.handleTasksGet(params));
        default:
          return rpcError(
            id,
            RpcErrors.METHOD_NOT_FOUND,
            `unknown method: ${method}`,
          );
      }
    } catch (err) {
      return rpcError(
        id,
        RpcErrors.INTERNAL_ERROR,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /** Core A2A method: accept a Message, run a skill, return a completed Task. */
  private handleMessageSend(params: unknown): Task {
    const p = params as { message?: Message } | undefined;
    const message = p?.message;
    if (!message || !Array.isArray(message.parts)) {
      throw new Error("invalid params: missing message.parts");
    }
    const text = message.parts
      .map((part) => (part.kind === "text" ? part.text : ""))
      .join(" ")
      .trim();

    const skill = this.selectSkill(text);
    if (!skill) {
      throw new Error("no skill on this agent can handle the request");
    }

    const result = skill.handle(text);
    const taskId = randomUUID();
    const contextId = message.contextId ?? randomUUID();
    const now = new Date().toISOString();

    const replyMessage: Message = {
      kind: "message",
      role: "agent",
      messageId: randomUUID(),
      taskId,
      contextId,
      parts: [{ kind: "text", text: result.text }],
    };

    const task: Task = {
      kind: "task",
      id: taskId,
      contextId,
      status: { state: "completed", timestamp: now, message: replyMessage },
      history: [{ ...message, taskId, contextId }, replyMessage],
      artifacts: [
        {
          artifactId: randomUUID(),
          name: `${skill.card.id}-result`,
          parts: [
            { kind: "text", text: result.text },
            ...(result.data ? [{ kind: "data" as const, data: result.data }] : []),
          ],
        },
      ],
    };

    this.tasks.set(taskId, task);
    return task;
  }

  private handleTasksGet(params: unknown): Task {
    const id = (params as { id?: string } | undefined)?.id;
    if (!id) throw new Error("invalid params: missing id");
    const task = this.tasks.get(id);
    if (!task) throw new Error(`task not found: ${id}`);
    return task;
  }

  /**
   * Pick the first skill whose id/tags appear in the request, otherwise fall
   * back to the only skill if this is a single-skill agent.
   */
  private selectSkill(text: string): SkillImpl | undefined {
    const lower = text.toLowerCase();
    const hinted = this.opts.skills.find(
      (s) =>
        lower.includes(s.card.id) ||
        s.card.tags.some((t) => lower.includes(t)),
    );
    if (hinted) return hinted;
    return this.opts.skills.length === 1 ? this.opts.skills[0] : undefined;
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  }

  private json(res: http.ServerResponse, status: number, payload: unknown) {
    const body = JSON.stringify(payload);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body);
  }
}
