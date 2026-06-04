import { test } from "node:test";
import assert from "node:assert/strict";
import { TaskStore } from "../src/taskStore.js";

test("addTask creates a task with defaults and increments count", () => {
  const store = new TaskStore();
  const t = store.addTask({ text: "hello" });
  assert.equal(t.text, "hello");
  assert.equal(t.priority, "medium");
  assert.equal(t.column, "todo");
  assert.equal(store.stats().total, 1);
});

test("addTask trims text and rejects empty input", () => {
  const store = new TaskStore();
  const t = store.addTask({ text: "  spaced  " });
  assert.equal(t.text, "spaced");
  assert.throws(() => store.addTask({ text: "   " }), /must not be empty/);
});

test("addTask validates priority and column", () => {
  const store = new TaskStore();
  assert.throws(() => store.addTask({ text: "x", priority: "huge" }), /priority/);
  assert.throws(() => store.addTask({ text: "x", column: "nope" }), /column/);
});

test("moveTask changes column and errors on unknown id", () => {
  const store = new TaskStore();
  const t = store.addTask({ text: "move me" });
  const moved = store.moveTask(t.id, "done");
  assert.equal(moved.column, "done");
  assert.equal(store.stats().byColumn.done, 1);
  assert.throws(() => store.moveTask("nope", "done"), /no task/);
});

test("removeTask returns whether something was removed", () => {
  const store = new TaskStore();
  const t = store.addTask({ text: "bye" });
  assert.equal(store.removeTask(t.id), true);
  assert.equal(store.removeTask(t.id), false);
  assert.equal(store.stats().total, 0);
});

test("list filters by column; findTasks searches case-insensitively", () => {
  const store = new TaskStore();
  store.addTask({ text: "Buy Milk", column: "todo" });
  store.addTask({ text: "Write code", column: "doing" });
  assert.equal(store.list("todo").length, 1);
  assert.equal(store.findTasks("milk").length, 1);
  assert.equal(store.findTasks("MILK")[0].text, "Buy Milk");
  assert.equal(store.findTasks("xyz").length, 0);
});

test("subscribe fires on mutation and unsubscribe stops it", () => {
  const store = new TaskStore();
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.addTask({ text: "a" });
  assert.equal(calls, 1);
  off();
  store.addTask({ text: "b" });
  assert.equal(calls, 1);
});

test("list returns defensive copies (mutating output does not affect store)", () => {
  const store = new TaskStore();
  store.addTask({ text: "immutable" });
  const snapshot = store.list();
  snapshot[0].text = "hacked";
  assert.equal(store.list()[0].text, "immutable");
});
