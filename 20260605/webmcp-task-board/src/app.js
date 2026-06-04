// app.js — browser entry point. Wires the TaskStore to the DOM, installs
// WebMCP, registers the board's tools, and drives the in-page agent console.

import { TaskStore, COLUMNS } from "./taskStore.js";
import { installWebMCP } from "./webmcp-shim.js";
import { registerTaskBoardTools } from "./tools.js";
import { runInstruction } from "./agentConsole.js";

const store = new TaskStore([
  { text: "Read the WebMCP origin-trial docs", priority: "high", column: "doing" },
  { text: "Ship agent-ready task board", priority: "medium", column: "todo" },
  { text: "Star the WebMCP-org repo", priority: "low", column: "done" },
]);

// --- Install WebMCP and expose the board to agents ------------------------
const { modelContext, usingShim } = installWebMCP(window);
registerTaskBoardTools(modelContext, store);

// --- Render the board -----------------------------------------------------
const COLUMN_LABEL = { todo: "To Do", doing: "Doing", done: "Done" };

function render(tasks) {
  for (const col of COLUMNS) {
    const list = document.querySelector(`#col-${col} .cards`);
    const count = document.querySelector(`#col-${col} .count`);
    const colTasks = tasks.filter((t) => t.column === col);
    count.textContent = colTasks.length;
    list.innerHTML = "";
    for (const task of colTasks) {
      list.appendChild(renderCard(task));
    }
  }
}

function renderCard(task) {
  const el = document.createElement("div");
  el.className = `card prio-${task.priority}`;
  el.innerHTML = `
    <div class="card-head">
      <span class="id">${task.id}</span>
      <span class="prio">${task.priority}</span>
    </div>
    <div class="text"></div>
    <div class="actions">
      ${COLUMNS.filter((c) => c !== task.column)
        .map((c) => `<button data-move="${c}">→ ${COLUMN_LABEL[c]}</button>`)
        .join("")}
      <button class="del" data-del="1">✕</button>
    </div>`;
  el.querySelector(".text").textContent = task.text; // textContent = XSS-safe
  el.querySelectorAll("[data-move]").forEach((b) =>
    b.addEventListener("click", () => store.moveTask(task.id, b.dataset.move))
  );
  el.querySelector("[data-del]").addEventListener("click", () =>
    store.removeTask(task.id)
  );
  return el;
}

store.subscribe(render);
render(store.list());

// --- Human "add task" form ------------------------------------------------
const form = document.querySelector("#add-form");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = form.text.value.trim();
  if (!text) return;
  store.addTask({ text, priority: form.priority.value });
  form.reset();
  form.text.focus();
});

// --- Agent console --------------------------------------------------------
const banner = document.querySelector("#mode-banner");
banner.textContent = usingShim
  ? "WebMCP shim active — the in-page agent below can call the registered tools."
  : "Native WebMCP detected — your browser's agent handles tool calls; the console is read-only.";
banner.classList.add(usingShim ? "shim" : "native");

const toolList = document.querySelector("#tool-list");
const tools = typeof modelContext.__listTools === "function" ? modelContext.__listTools() : [];
toolList.innerHTML = tools
  .map((t) => `<li><code>${t.name}</code> — ${escapeHtml(t.description)}</li>`)
  .join("");

const transcript = document.querySelector("#transcript");
const agentForm = document.querySelector("#agent-form");
agentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = agentForm.cmd.value.trim();
  if (!input) return;
  agentForm.cmd.value = "";
  const entry = await runInstruction(modelContext, input);
  appendTranscript(entry);
});

function appendTranscript(entry) {
  const li = document.createElement("li");
  li.className = entry.ok ? "ok" : "err";
  const call = entry.tool
    ? `<span class="call">${entry.tool}(${escapeHtml(JSON.stringify(entry.args))})</span>`
    : "";
  li.innerHTML = `<div class="you">🧑 ${escapeHtml(entry.input)}</div>
    <div class="bot">🤖 ${call}<pre>${escapeHtml(entry.message)}</pre></div>`;
  transcript.prepend(li);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
