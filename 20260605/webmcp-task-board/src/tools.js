// tools.js
// Declares the task board's capabilities to AI agents via WebMCP. Every tool's
// `execute` delegates to the SAME TaskStore the human UI uses, so the agent and
// the user manipulate one shared source of truth.

import { COLUMNS, PRIORITIES } from "./taskStore.js";

/** Build the WebMCP tool definitions for a given store. */
export function buildTools(store) {
  const ok = (text) => ({ content: [{ type: "text", text }] });

  return [
    {
      name: "add_task",
      description:
        "Add a new task (card) to the board. Use when the user wants to create, " +
        "add, capture, or remember something to do.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The task description." },
          priority: {
            type: "string",
            enum: PRIORITIES,
            description: "Priority. Default 'medium' if unspecified.",
          },
          column: {
            type: "string",
            enum: COLUMNS,
            description: "Starting column. Default 'todo'.",
          },
        },
        required: ["text"],
      },
      execute: ({ text, priority = "medium", column = "todo" }) => {
        const task = store.addTask({ text, priority, column });
        return ok(
          `Added task ${task.id}: "${task.text}" (${task.priority}) to "${task.column}". ` +
            `Board now has ${store.stats().total} task(s).`
        );
      },
    },
    {
      name: "move_task",
      description:
        "Move an existing task to a different column (todo / doing / done). " +
        "Use to start work on, progress, or complete a task.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The task id, e.g. 't3'." },
          column: { type: "string", enum: COLUMNS, description: "Target column." },
        },
        required: ["id", "column"],
      },
      execute: ({ id, column }) => {
        const task = store.moveTask(id, column);
        return ok(`Moved task ${task.id} ("${task.text}") to "${task.column}".`);
      },
    },
    {
      name: "remove_task",
      description: "Delete a task from the board by its id.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The task id to remove." },
        },
        required: ["id"],
      },
      execute: ({ id }) => {
        const removed = store.removeTask(id);
        return ok(removed ? `Removed task ${id}.` : `No task with id ${id} to remove.`);
      },
    },
    {
      name: "list_tasks",
      description:
        "List tasks on the board, optionally filtered to one column. Returns " +
        "JSON so the agent can reason over ids, text, priority and column.",
      inputSchema: {
        type: "object",
        properties: {
          column: {
            type: "string",
            enum: COLUMNS,
            description: "Optional column filter.",
          },
        },
      },
      execute: ({ column } = {}) => {
        const tasks = store.list(column);
        return ok(JSON.stringify(tasks, null, 2));
      },
    },
    {
      name: "search_tasks",
      description: "Find tasks whose text contains a query string (case-insensitive).",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Substring to search for." },
        },
        required: ["query"],
      },
      execute: ({ query }) => {
        const matches = store.findTasks(query);
        return ok(
          matches.length
            ? JSON.stringify(matches, null, 2)
            : `No tasks match "${query}".`
        );
      },
    },
    {
      name: "board_stats",
      description: "Get a summary of how many tasks are in each column.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const s = store.stats();
        const parts = COLUMNS.map((c) => `${c}: ${s.byColumn[c]}`).join(", ");
        return ok(`Total ${s.total} task(s) — ${parts}.`);
      },
    },
  ];
}

/**
 * Register all task-board tools against a WebMCP `modelContext`. Uses
 * `provideContext` (atomic full-set declaration) when available, else falls
 * back to per-tool `registerTool`. Returns the tool definitions.
 */
export function registerTaskBoardTools(modelContext, store) {
  const tools = buildTools(store);
  if (typeof modelContext.provideContext === "function") {
    modelContext.provideContext({ tools });
  } else {
    for (const t of tools) modelContext.registerTool(t);
  }
  return tools;
}
