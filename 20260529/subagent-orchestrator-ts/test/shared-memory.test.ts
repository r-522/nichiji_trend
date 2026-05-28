import { test } from "node:test";
import assert from "node:assert/strict";
import { SharedMemory } from "../src/shared-memory.js";

test("subagent can write only to its own subtask slot", () => {
  const m = new SharedMemory();
  m.write("subtask:a", { v: 1 }, { writer: "a" });
  assert.deepEqual(m.read("subtask:a"), { v: 1 });
  assert.throws(() => m.write("subtask:b", { v: 2 }, { writer: "a" }));
});

test("orchestrator owns shared:/merged: namespaces", () => {
  const m = new SharedMemory();
  m.write("shared:env", "ok", { writer: "orchestrator" });
  m.write("merged:report", { done: true }, { writer: "orchestrator" });
  assert.equal(m.read("shared:env"), "ok");
  assert.throws(() => m.write("shared:env", "nope", { writer: "a" }));
  assert.throws(() => m.write("merged:report", "nope", { writer: "a" }));
});

test("read of unknown namespace returns undefined", () => {
  const m = new SharedMemory();
  assert.equal(m.read("subtask:nope"), undefined);
});
