export type Role = "user" | "supervisor" | "worker" | "system";

export interface Message {
  role: Role;
  /** Logical name of the speaker — for workers this is the agent name. */
  from: string;
  content: string;
  /** Monotonic step at which the message was produced. */
  step: number;
}

export interface Artifact {
  /** Worker that produced it. */
  producer: string;
  kind: "research" | "code" | "report" | "summary";
  content: string;
  step: number;
}

/** Mutable state shared across the graph. Inspired by LangGraph's typed state. */
export interface GraphState {
  task: string;
  messages: Message[];
  artifacts: Artifact[];
  /** Names of workers that have reported back at least once. */
  visited: Set<string>;
  step: number;
  /** Final answer written by the supervisor at FINISH. */
  finalAnswer?: string;
}

/** A worker is a specialist node — researcher, coder, writer, etc. */
export interface WorkerAgent {
  readonly name: string;
  readonly description: string;
  /** Returns the artifact this worker produced for the current task. */
  run(state: Readonly<GraphState>): Promise<Artifact>;
}

/** Supervisor decision. */
export type SupervisorDecision =
  | { kind: "route"; next: string; reason: string }
  | { kind: "finish"; answer: string; reason: string };

export interface SupervisorAgent {
  decide(state: Readonly<GraphState>): Promise<SupervisorDecision>;
}
