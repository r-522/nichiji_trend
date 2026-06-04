// webmcp-shim.js
// A faithful, minimal polyfill for the WebMCP `navigator.modelContext` surface
// (registerTool / unregisterTool / provideContext / clearContext), per the
// Chrome 149 origin-trial / W3C WebML CG proposal.
//
// WHY THIS EXISTS:
//   The native API only ships behind the Chrome 149 origin trial, and even when
//   present the *page* cannot enumerate or invoke its own tools — only the
//   browser's agent can. To make this demo runnable today AND to let the bundled
//   in-page agent console exercise the tools, this shim installs a spec-shaped
//   `navigator.modelContext` whenever a native one is absent, plus a few
//   clearly-namespaced `__`-prefixed helpers that the native API does not have.
//
// If a native implementation already exists, we DO NOT overwrite it; we only
// layer the demo-only helpers on top so the console can still observe activity.

const SHIM_FLAG = "__webmcpShim";

function createShim() {
  /** @type {Map<string, object>} */
  const tools = new Map();
  const changeListeners = new Set();

  function notify() {
    const names = [...tools.keys()];
    for (const fn of changeListeners) fn(names);
  }

  function validate(toolDef) {
    if (!toolDef || typeof toolDef !== "object") {
      throw new TypeError("tool definition must be an object");
    }
    if (typeof toolDef.name !== "string" || !toolDef.name) {
      throw new TypeError("tool.name must be a non-empty string");
    }
    if (typeof toolDef.execute !== "function") {
      throw new TypeError("tool.execute must be a function");
    }
    return {
      name: toolDef.name,
      description: toolDef.description ?? "",
      inputSchema: toolDef.inputSchema ?? { type: "object", properties: {} },
      execute: toolDef.execute,
    };
  }

  const modelContext = {
    // ---- Spec surface -----------------------------------------------------
    registerTool(toolDef) {
      const tool = validate(toolDef);
      tools.set(tool.name, tool);
      notify();
      return { name: tool.name };
    },

    unregisterTool(name) {
      const existed = tools.delete(name);
      if (existed) notify();
      return existed;
    },

    provideContext(context = {}) {
      // Replaces the full tool set, matching the spec's "declare tools for the
      // current page state" semantics.
      tools.clear();
      for (const t of context.tools ?? []) {
        const tool = validate(t);
        tools.set(tool.name, tool);
      }
      notify();
    },

    clearContext() {
      tools.clear();
      notify();
    },

    // ---- Demo-only helpers (NOT part of the real API) ---------------------
    [SHIM_FLAG]: true,

    /** Enumerate registered tools (browser would hide these from the page). */
    __listTools() {
      return [...tools.values()].map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      }));
    },

    /** Invoke a tool the way a browser agent would, returning its content. */
    async __callTool(name, args = {}) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`no registered tool named "${name}"`);
      const result = await tool.execute(args ?? {});
      return normalizeResult(result);
    },

    /** Observe registration changes; returns an unsubscribe function. */
    __onToolsChanged(fn) {
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },
  };

  return modelContext;
}

/** Normalize a tool result to the MCP `{ content: [{ type, text }] }` shape. */
export function normalizeResult(result) {
  if (result && Array.isArray(result.content)) return result;
  // Some examples in the wild return a bare `{ type, text }`; wrap it.
  if (result && result.type === "text") return { content: [result] };
  return { content: [{ type: "text", text: JSON.stringify(result ?? null) }] };
}

/**
 * Ensure `target.navigator.modelContext` exists. Installs the shim when no
 * native implementation is present. Returns { modelContext, usingShim }.
 */
export function installWebMCP(target = globalThis) {
  if (!target.navigator) target.navigator = {};
  const nav = target.navigator;

  if (nav.modelContext && !nav.modelContext[SHIM_FLAG]) {
    // Native WebMCP is present. Leave it untouched.
    return { modelContext: nav.modelContext, usingShim: false };
  }
  if (!nav.modelContext) {
    nav.modelContext = createShim();
  }
  return { modelContext: nav.modelContext, usingShim: true };
}
