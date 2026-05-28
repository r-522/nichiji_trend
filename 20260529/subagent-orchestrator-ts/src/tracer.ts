import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { TraceEvent } from "./types.js";

export class Tracer {
  private readonly events: TraceEvent[] = [];
  private readonly silent: boolean;

  constructor(opts: { silent?: boolean } = {}) {
    this.silent = opts.silent ?? false;
  }

  emit(event: Omit<TraceEvent, "ts">): void {
    const full: TraceEvent = { ts: Date.now(), ...event };
    this.events.push(full);
    if (!this.silent) {
      // Stream as JSON Lines so a downstream UI can render incrementally.
      process.stdout.write(JSON.stringify(full) + "\n");
    }
  }

  snapshot(): readonly TraceEvent[] {
    return this.events.slice();
  }

  async dump(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const body = this.events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    await writeFile(path, body, "utf8");
  }
}
