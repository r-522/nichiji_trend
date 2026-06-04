import { test } from "node:test";
import assert from "node:assert/strict";
import { installWebMCP, normalizeResult } from "../src/webmcp-shim.js";
import { TaskStore } from "../src/taskStore.js";
import { registerTaskBoardTools, buildTools } from "../src/tools.js";
import { interpret, runInstruction } from "../src/agentConsole.js";

function freshContext() {
  // Each test gets an isolated fake global with no native modelContext.
  const target = { navigator: {} };
  const { modelContext, usingShim } = installWebMCP(target);
  return { modelContext, usingShim, target };
}

test("installWebMCP installs the shim when no native API exists", () => {
  const { modelContext, usingShim } = freshContext();
  assert.equal(usingShim, true);
  assert.equal(typeof modelContext.registerTool, "function");
  assert.equal(typeof modelContext.provideContext, "function");
});

test("installWebMCP does not overwrite a native implementation", () => {
  const native = { registerTool() {}, provideContext() {}, native: true };
  const target = { navigator: { modelContext: native } };
  const { modelContext, usingShim } = installWebMCP(target);
  assert.equal(usingShim, false);
  assert.equal(modelContext, native);
});

test("provideContext replaces the whole tool set atomically", () => {
  const { modelContext } = freshContext();
  modelContext.registerTool({ name: "old", execute: () => ({ content: [] }) });
  modelContext.provideContext({
    tools: [{ name: "new", execute: () => ({ content: [] }) }],
  });
  const names = modelContext.__listTools().map((t) => t.name);
  assert.deepEqual(names, ["new"]);
});

test("registerTaskBoardTools publishes all six board tools", () => {
  const { modelContext } = freshContext();
  const store = new TaskStore();
  registerTaskBoardTools(modelContext, store);
  const names = modelContext.__listTools().map((t) => t.name).sort();
  assert.deepEqual(names, [
    "add_task", "board_stats", "list_tasks", "move_task", "remove_task", "search_tasks",
  ]);
});

test("add_task tool mutates the shared store and returns MCP content", async () => {
  const { modelContext } = freshContext();
  const store = new TaskStore();
  registerTaskBoardTools(modelContext, store);
  const res = await modelContext.__callTool("add_task", { text: "via agent", priority: "high" });
  assert.match(res.content[0].text, /Added task t1/);
  assert.equal(store.list()[0].text, "via agent");
  assert.equal(store.list()[0].priority, "high");
});

test("list_tasks tool returns JSON the agent can parse", async () => {
  const { modelContext } = freshContext();
  const store = new TaskStore();
  registerTaskBoardTools(modelContext, store);
  store.addTask({ text: "one", column: "doing" });
  const res = await modelContext.__callTool("list_tasks", { column: "doing" });
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].text, "one");
});

test("normalizeResult wraps a bare {type,text} into a content array", () => {
  const r = normalizeResult({ type: "text", text: "hi" });
  assert.deepEqual(r, { content: [{ type: "text", text: "hi" }] });
});

// --- Agent NL interpretation -------------------------------------------------

test("interpret maps natural language to the right tool + args", () => {
  assert.deepEqual(interpret("add buy milk with high priority"), {
    tool: "add_task",
    args: { text: "buy milk", priority: "high" },
  });
  assert.deepEqual(interpret("move t3 to done"), {
    tool: "move_task",
    args: { id: "t3", column: "done" },
  });
  assert.deepEqual(interpret("complete t2"), {
    tool: "move_task",
    args: { id: "t2", column: "done" },
  });
  assert.deepEqual(interpret("remove t5"), { tool: "remove_task", args: { id: "t5" } });
  assert.deepEqual(interpret("search milk"), { tool: "search_tasks", args: { query: "milk" } });
  assert.deepEqual(interpret("list doing"), { tool: "list_tasks", args: { column: "doing" } });
  assert.deepEqual(interpret("stats"), { tool: "board_stats", args: {} });
  assert.equal(interpret("gibberish %%"), null);
});

test("runInstruction executes end-to-end through WebMCP", async () => {
  const { modelContext } = freshContext();
  const store = new TaskStore();
  registerTaskBoardTools(modelContext, store);
  const entry = await runInstruction(modelContext, "add ship it with high priority");
  assert.equal(entry.ok, true);
  assert.equal(entry.tool, "add_task");
  assert.equal(store.list()[0].text, "ship it");
  assert.equal(store.list()[0].priority, "high");
});

test("buildTools every tool has name, description and inputSchema", () => {
  for (const t of buildTools(new TaskStore())) {
    assert.ok(t.name && typeof t.name === "string");
    assert.ok(t.description && t.description.length > 5);
    assert.equal(t.inputSchema.type, "object");
    assert.equal(typeof t.execute, "function");
  }
});
