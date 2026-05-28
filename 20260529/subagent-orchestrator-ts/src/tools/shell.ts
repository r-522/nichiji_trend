import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { asString, ok, fail } from "./types.js";
import type { Tool } from "./types.js";

const execFileP = promisify(execFile);

// Strict allowlist. Anything else is refused, mirroring the "managed execution"
// posture Antigravity 2.0 advertises for its sub-agents.
const ALLOWED = new Set<string>(["echo", "ls", "pwd", "cat", "wc", "uname", "date"]);

export const shellTool: Tool = {
  name: "shell",
  description:
    "Run an allowlisted shell command. Allowed: " + [...ALLOWED].join(", "),
  async invoke(args, ctx) {
    try {
      const cmd = asString(args, "cmd");
      if (!ALLOWED.has(cmd)) {
        return fail(`command "${cmd}" not on allowlist`);
      }
      const rawArgs = args["args"];
      let cmdArgs: string[] = [];
      if (Array.isArray(rawArgs)) {
        cmdArgs = rawArgs.map((a) => {
          if (typeof a !== "string") throw new Error("shell args must be strings");
          return a;
        });
      } else if (rawArgs !== undefined) {
        return fail("shell args must be an array of strings");
      }
      const { stdout, stderr } = await execFileP(cmd, cmdArgs, {
        cwd: ctx.workspace,
        timeout: 5_000,
        maxBuffer: 256 * 1024,
      });
      return ok({ stdout, stderr });
    } catch (e) {
      return fail((e as Error).message);
    }
  },
};
