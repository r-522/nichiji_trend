/**
 * A2A (Agent2Agent) protocol types.
 *
 * A faithful-but-pragmatic subset of the Linux Foundation Agent2Agent
 * specification (https://a2a-protocol.org). The wire format is JSON-RPC 2.0;
 * agents advertise themselves with an AgentCard served at
 * `/.well-known/agent-card.json`, and work is modelled as Tasks that carry
 * Messages and Artifacts through a small state machine.
 */

/** A single piece of content inside a Message or Artifact. */
export type Part =
  | { kind: "text"; text: string }
  | { kind: "data"; data: Record<string, unknown> };

/** A message exchanged between a user/client and an agent. */
export interface Message {
  kind: "message";
  role: "user" | "agent";
  parts: Part[];
  messageId: string;
  taskId?: string;
  contextId?: string;
}

/** Lifecycle states a Task can move through. */
export type TaskState =
  | "submitted"
  | "working"
  | "completed"
  | "failed"
  | "canceled";

export interface TaskStatus {
  state: TaskState;
  /** Optional human-readable status message from the agent. */
  message?: Message;
  timestamp: string;
}

/** A named output produced while completing a Task. */
export interface Artifact {
  artifactId: string;
  name?: string;
  parts: Part[];
}

/** The unit of work in A2A. */
export interface Task {
  kind: "task";
  id: string;
  contextId: string;
  status: TaskStatus;
  history: Message[];
  artifacts: Artifact[];
}

/** One advertised capability of an agent. */
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  /** Free-form tags used by the mesh to route by capability. */
  tags: string[];
  examples?: string[];
}

/** The agent's public "business card", served at /.well-known/agent-card.json */
export interface AgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  /** Base URL where the agent's JSON-RPC endpoint lives. */
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
  /**
   * Governance metadata. Inspired by Microsoft Build 2026's Azure Agent Mesh,
   * which pairs federated execution with Entra ID (identity) + Purview
   * (data classification) audit trails.
   */
  provider?: {
    organization: string;
    identity: string;
    dataClassification: "public" | "internal" | "confidential";
  };
}

/** The well-known path where an AgentCard is published. */
export const AGENT_CARD_PATH = "/.well-known/agent-card.json";

/** The JSON-RPC path where A2A method calls are POSTed. */
export const A2A_RPC_PATH = "/a2a";

export const A2A_PROTOCOL_VERSION = "0.2.5";
