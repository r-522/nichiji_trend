import type { AgentId } from "./types.js";

// Shared memory layer modeled after the Antigravity 2.0 "structured context store":
//   - Any agent can READ from any namespace.
//   - Subagents can WRITE only to their own private namespace (subtask:<id>).
//   - The orchestrator owns the "shared:" and "merged:" namespaces and is the
//     only writer that can update them. This avoids the cross-agent write
//     conflicts called out in the public architecture write-ups.
//
// Implementation note: the runtime is single-threaded JS, so we don't need
// real mutexes — the permission check is the only thing that prevents one
// subagent from clobbering another's slot.

export type Namespace = `subtask:${AgentId}` | `shared:${string}` | `merged:${string}`;

export interface WriteOptions {
  readonly writer: AgentId; // "orchestrator" or a subagent id
}

export class SharedMemory {
  private readonly store = new Map<string, unknown>();

  read(namespace: Namespace): unknown {
    return this.store.get(namespace);
  }

  entries(): ReadonlyArray<readonly [string, unknown]> {
    return Array.from(this.store.entries());
  }

  write(namespace: Namespace, value: unknown, opts: WriteOptions): void {
    if (!this.canWrite(namespace, opts.writer)) {
      throw new Error(
        `agent "${opts.writer}" is not allowed to write to "${namespace}"`,
      );
    }
    this.store.set(namespace, value);
  }

  private canWrite(namespace: Namespace, writer: AgentId): boolean {
    if (writer === "orchestrator") {
      return true; // orchestrator is the sole owner of shared:/merged: namespaces
    }
    if (namespace.startsWith("subtask:")) {
      return namespace === `subtask:${writer}`;
    }
    return false;
  }
}
