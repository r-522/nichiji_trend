import type { Tool, ToolRegistry } from "./types.js";
import { readFileTool, listDirTool } from "./fs.js";
import { shellTool } from "./shell.js";
import { memoryReadTool, memoryWriteTool } from "./memory.js";
import { doneTool } from "./done.js";

export function defaultRegistry(): ToolRegistry {
  const tools: Tool[] = [
    readFileTool,
    listDirTool,
    shellTool,
    memoryReadTool,
    memoryWriteTool,
    doneTool,
  ];
  return new Map(tools.map((t) => [t.name, t]));
}

export function filteredRegistry(
  base: ToolRegistry,
  allowlist: readonly string[],
): ToolRegistry {
  const result = new Map<string, Tool>();
  for (const name of allowlist) {
    const tool = base.get(name);
    if (!tool) throw new Error(`unknown tool "${name}" in allowlist`);
    result.set(name, tool);
  }
  // `done` is always available so a subagent can always terminate cleanly.
  if (!result.has("done")) {
    const done = base.get("done");
    if (done) result.set("done", done);
  }
  return result;
}
