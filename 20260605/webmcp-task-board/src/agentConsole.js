// agentConsole.js
// A deliberately tiny, rule-based "agent" that turns a natural-language line
// into a WebMCP tool call and invokes it through navigator.modelContext.
//
// This is NOT an LLM — it is a transparent stand-in so you can SEE the WebMCP
// contract working end-to-end without the Chrome 149 origin trial or a real
// model. A genuine browser agent (e.g. Gemini in Chrome) would do this matching
// with a model, but the tool-call mechanics it exercises are identical.

const PRIORITY_WORDS = { low: "low", medium: "medium", high: "high", urgent: "high" };
const COLUMN_WORDS = {
  todo: "todo", "to-do": "todo", backlog: "todo",
  doing: "doing", "in progress": "doing", start: "doing", working: "doing",
  done: "done", complete: "done", completed: "done", finish: "done", finished: "done",
};

/** Parse a free-text instruction into { tool, args } or null. */
export function interpret(text) {
  const raw = String(text ?? "").trim();
  const t = raw.toLowerCase();
  if (!t) return null;

  const id = (t.match(/\bt\d+\b/) || [])[0];

  // stats
  if (/\b(stats?|summary|how many|count|overview)\b/.test(t)) {
    return { tool: "board_stats", args: {} };
  }

  // search
  let m = raw.match(/\b(?:search|find)\b\s+(?:for\s+)?(?:tasks?\s+)?(.+)/i);
  if (m) return { tool: "search_tasks", args: { query: stripQuotes(m[1]) } };

  // list
  if (/\b(list|show|what'?s on)\b/.test(t)) {
    const col = matchWord(t, COLUMN_WORDS);
    return { tool: "list_tasks", args: col ? { column: col } : {} };
  }

  // remove
  if (/\b(remove|delete|drop)\b/.test(t) && id) {
    return { tool: "remove_task", args: { id } };
  }

  // move / complete
  if (id && (/\b(move|mark|set|complete|finish|start)\b/.test(t))) {
    const col = matchWord(t, COLUMN_WORDS) || (/\b(complete|finish)\b/.test(t) ? "done" : null);
    if (col) return { tool: "move_task", args: { id, column: col } };
  }

  // add  (default verb)
  m = raw.match(/\b(?:add|create|new|remember|capture)\b\s+(?:a\s+)?(?:task\s+)?(?:to\s+)?(.+)/i);
  if (m) {
    let body = stripQuotes(m[1]);
    const priority = matchWord(t, PRIORITY_WORDS);
    const column = matchWord(t, COLUMN_WORDS);
    // remove trailing priority/column hint words from the captured text
    body = body
      .replace(/\b(with\s+)?(low|medium|high|urgent)\s+priority\b/i, "")
      .replace(/\bpriority\b/i, "")
      .replace(/\b(in|to)\s+(the\s+)?(todo|to-do|backlog|doing|in progress|done)\b/i, "")
      .trim();
    const args = { text: body };
    if (priority) args.priority = priority;
    if (column) args.column = column;
    return body ? { tool: "add_task", args } : null;
  }

  return null;
}

function matchWord(text, table) {
  for (const key of Object.keys(table).sort((a, b) => b.length - a.length)) {
    if (text.includes(key)) return table[key];
  }
  return null;
}

function stripQuotes(s) {
  return String(s).trim().replace(/^["']|["'.!]+$/g, "").trim();
}

/**
 * Run one instruction: interpret it, call the matching WebMCP tool through the
 * provided modelContext, and return a transcript entry describing what happened.
 */
export async function runInstruction(modelContext, text) {
  const plan = interpret(text);
  if (!plan) {
    return {
      input: text,
      ok: false,
      message:
        "I couldn't map that to a tool. Try: add / list / move t1 to done / " +
        "search <text> / remove t2 / stats.",
    };
  }
  if (typeof modelContext.__callTool !== "function") {
    return {
      input: text,
      ok: false,
      tool: plan.tool,
      args: plan.args,
      message:
        "Native WebMCP is active: the page can't invoke its own tools — a real " +
        "browser agent would. (Run without native WebMCP to use this console.)",
    };
  }
  try {
    const result = await modelContext.__callTool(plan.tool, plan.args);
    const out = result.content.map((c) => c.text).join("\n");
    return { input: text, ok: true, tool: plan.tool, args: plan.args, message: out };
  } catch (err) {
    return { input: text, ok: false, tool: plan.tool, args: plan.args, message: String(err) };
  }
}
