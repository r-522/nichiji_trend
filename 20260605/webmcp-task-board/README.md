# WebMCP Task Board 🗂️🤖

An **agent-ready Kanban board** built to demonstrate **WebMCP** — the
`navigator.modelContext` browser standard headlined at **Google I/O 2026** and
shipped into the **Chrome 149 origin trial** (announced 2026-05-19).

The point of WebMCP: instead of an AI agent *screenshotting your page and
guessing where to click*, your site **declares structured tools** (name +
description + JSON input schema + an `execute` handler) and the agent calls them
like an API. This app exposes its entire feature set that way — the buttons and
the agent drive **one shared `TaskStore`**.

```
add_task · move_task · remove_task · list_tasks · search_tasks · board_stats
```

## Run it

```bash
cd webmcp-task-board
npm start            # → http://localhost:8080/  (zero dependencies, Node ≥18)
# or:  python3 -m http.server 8080
```

Open the page and either click the cards or type into the **Agent console**:

- `add buy milk with high priority`
- `move t1 to done`  ·  `complete t2`
- `search milk`  ·  `list doing`  ·  `stats`  ·  `remove t3`

## How WebMCP is used here

The tools are declared in [`src/tools.js`](src/tools.js) and published via
`navigator.modelContext.provideContext({ tools })`. Each tool follows the
MCP-compatible shape:

```js
navigator.modelContext.registerTool({
  name: "add_task",
  description: "Add a new task (card) to the board.",
  inputSchema: {
    type: "object",
    properties: {
      text:     { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      column:   { type: "string", enum: ["todo", "doing", "done"] },
    },
    required: ["text"],
  },
  execute: ({ text, priority = "medium", column = "todo" }) => {
    const task = store.addTask({ text, priority, column });
    return { content: [{ type: "text", text: `Added ${task.id}…` }] };
  },
});
```

### Running today, before Chrome 149 is everywhere

The native API only exists behind the origin trial, and even then a page can't
invoke *its own* tools — only the browser's agent can. So this project ships a
faithful **polyfill** ([`src/webmcp-shim.js`](src/webmcp-shim.js)) that:

- installs a spec-shaped `navigator.modelContext`
  (`registerTool` / `unregisterTool` / `provideContext` / `clearContext`)
  **only when no native implementation is present**, and
- adds clearly `__`-prefixed, demo-only helpers (`__listTools`, `__callTool`)
  so the bundled **rule-based agent console** can exercise the exact tool
  contract a real agent would.

If your browser already exposes native WebMCP, the shim steps aside, the banner
says so, and tool calls flow to your browser's real agent instead.

## Architecture

| File | Responsibility |
| :--- | :--- |
| `src/taskStore.js` | Pure, observable board state (isomorphic; no DOM). |
| `src/webmcp-shim.js` | `navigator.modelContext` polyfill + result normalizer. |
| `src/tools.js` | The six WebMCP tool definitions, backed by the store. |
| `src/agentConsole.js` | Tiny rule-based NL → tool-call interpreter. |
| `src/app.js` | DOM rendering + form/console wiring. |
| `server.js` | Zero-dep static file server. |
| `tests/` | `node --test` suite (store + WebMCP + agent). |

## Test

```bash
npm test     # node --test — 18 checks, no dependencies
```

## Notes

WebMCP is a **proposal / origin-trial** technology (W3C Web Machine Learning
Community Group; Google + Microsoft). API details may change. References:
- https://developer.chrome.com/docs/ai/webmcp
- https://webmachinelearning.github.io/webmcp/docs/proposal.html

MIT licensed.
