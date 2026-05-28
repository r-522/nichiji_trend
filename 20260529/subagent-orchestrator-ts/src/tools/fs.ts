import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative, isAbsolute, join } from "node:path";
import { asString, ok, fail } from "./types.js";
import type { Tool } from "./types.js";

function safeJoin(workspace: string, target: string): string {
  const abs = isAbsolute(target) ? target : join(workspace, target);
  const resolved = resolve(abs);
  const rel = relative(workspace, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`path "${target}" escapes the workspace`);
  }
  return resolved;
}

export const readFileTool: Tool = {
  name: "read_file",
  description: "Read a UTF-8 text file under the workspace.",
  async invoke(args, ctx) {
    try {
      const path = safeJoin(ctx.workspace, asString(args, "path"));
      const text = await readFile(path, "utf8");
      return ok({ path, bytes: Buffer.byteLength(text, "utf8"), content: text });
    } catch (e) {
      return fail((e as Error).message);
    }
  },
};

export const listDirTool: Tool = {
  name: "list_dir",
  description: "List entries of a directory under the workspace.",
  async invoke(args, ctx) {
    try {
      const path = safeJoin(ctx.workspace, asString(args, "path"));
      const names = await readdir(path);
      const entries = await Promise.all(
        names.map(async (name) => {
          const s = await stat(join(path, name));
          return {
            name,
            kind: s.isDirectory() ? "dir" : s.isFile() ? "file" : "other",
            size: s.size,
          };
        }),
      );
      return ok({ path, entries });
    } catch (e) {
      return fail((e as Error).message);
    }
  },
};

// Exposed for tests: never use outside of the read tools above.
export const _internal = { safeJoin };
