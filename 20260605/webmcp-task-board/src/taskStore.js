// taskStore.js
// Pure, framework-free task-board state. Isomorphic: runs in the browser and
// under Node (for tests). Holds no DOM references — the UI subscribes to it.

export const COLUMNS = ["todo", "doing", "done"];
export const PRIORITIES = ["low", "medium", "high"];

/**
 * A small observable task store. All mutations go through methods so that both
 * the human UI and the WebMCP tools drive the exact same logic.
 */
export class TaskStore {
  constructor(initial = []) {
    this._tasks = [];
    this._seq = 0;
    this._listeners = new Set();
    for (const t of initial) this.addTask(t);
  }

  /** Subscribe to any change. Returns an unsubscribe function. */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    const snapshot = this.list();
    for (const fn of this._listeners) fn(snapshot);
  }

  _nextId() {
    this._seq += 1;
    return `t${this._seq}`;
  }

  /** Add a task. Returns the created task (a copy). */
  addTask({ text, priority = "medium", column = "todo" } = {}) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) throw new Error("task text must not be empty");
    if (!PRIORITIES.includes(priority)) {
      throw new Error(`priority must be one of ${PRIORITIES.join(", ")}`);
    }
    if (!COLUMNS.includes(column)) {
      throw new Error(`column must be one of ${COLUMNS.join(", ")}`);
    }
    const task = {
      id: this._nextId(),
      text: trimmed,
      priority,
      column,
      createdAt: Date.now(),
    };
    this._tasks.push(task);
    this._emit();
    return { ...task };
  }

  /** Move a task to another column. Returns the updated task. */
  moveTask(id, column) {
    if (!COLUMNS.includes(column)) {
      throw new Error(`column must be one of ${COLUMNS.join(", ")}`);
    }
    const task = this._tasks.find((t) => t.id === id);
    if (!task) throw new Error(`no task with id ${id}`);
    task.column = column;
    this._emit();
    return { ...task };
  }

  /** Remove a task by id. Returns true if something was removed. */
  removeTask(id) {
    const before = this._tasks.length;
    this._tasks = this._tasks.filter((t) => t.id !== id);
    const removed = this._tasks.length !== before;
    if (removed) this._emit();
    return removed;
  }

  /** Find tasks whose text contains the query (case-insensitive). */
  findTasks(query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) return this.list();
    return this.list().filter((t) => t.text.toLowerCase().includes(q));
  }

  /** Return a defensive copy of all tasks, optionally filtered by column. */
  list(column) {
    let tasks = this._tasks.map((t) => ({ ...t }));
    if (column) {
      if (!COLUMNS.includes(column)) {
        throw new Error(`column must be one of ${COLUMNS.join(", ")}`);
      }
      tasks = tasks.filter((t) => t.column === column);
    }
    return tasks;
  }

  /** Aggregate counts per column + total. */
  stats() {
    const byColumn = Object.fromEntries(COLUMNS.map((c) => [c, 0]));
    for (const t of this._tasks) byColumn[t.column] += 1;
    return { total: this._tasks.length, byColumn };
  }
}
