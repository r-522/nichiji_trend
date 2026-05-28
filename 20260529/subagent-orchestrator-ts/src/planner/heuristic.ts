import type { OrchestratorPlanner, SubagentBrain } from "./types.js";
import type { OrchestratorPlan, Subtask, PlanStep, AgentId } from "../types.js";

// Deterministic, dependency-free planner so the demo runs offline.
// The rules look at the goal text and pick a small set of subtasks that the
// subagents can satisfy using only the bundled local tools.
//
// Important property: the output is stable for a given input — tests rely on it.

interface Rule {
  readonly trigger: RegExp;
  readonly build: (goal: string) => Subtask[];
}

const RULES: Rule[] = [
  {
    trigger: /(inventory|list).*(workspace|files|directory|dir)/i,
    build: () => [
      sub("scan-root", "List files at the workspace root", "list workspace root", [
        "list_dir",
        "memory_write",
      ]),
      sub(
        "summarize",
        "Summarize the listing",
        "read subtask:scan-root and write a count to merged:summary",
        ["memory_read", "memory_write"],
        ["scan-root"],
      ),
    ],
  },
  {
    trigger: /environment|uname|os|host/i,
    build: () => [
      sub("os-info", "Capture OS info via uname", "run uname -a", [
        "shell",
        "memory_write",
      ]),
      sub("date-info", "Capture current date", "run date", ["shell", "memory_write"]),
      sub(
        "report",
        "Merge env info",
        "compose a one-line report from subtask:os-info and subtask:date-info",
        ["memory_read", "memory_write"],
        ["os-info", "date-info"],
      ),
    ],
  },
  {
    trigger: /count|wc|lines|words/i,
    build: () => [
      sub("count-readme", "Count lines in README.md", "wc -l README.md", [
        "shell",
        "memory_write",
      ]),
    ],
  },
];

const FALLBACK: (goal: string) => Subtask[] = (goal) => [
  sub("echo-goal", "Echo the goal", `echo the user goal: ${goal}`, [
    "shell",
    "memory_write",
  ]),
];

export class HeuristicOrchestratorPlanner implements OrchestratorPlanner {
  async decompose(goal: string): Promise<OrchestratorPlan> {
    const collected: Subtask[] = [];
    const seen = new Set<string>();
    for (const rule of RULES) {
      if (rule.trigger.test(goal)) {
        for (const st of rule.build(goal)) {
          if (!seen.has(st.id)) {
            seen.add(st.id);
            collected.push(st);
          }
        }
      }
    }
    const subtasks = collected.length > 0 ? collected : FALLBACK(goal);
    return { goal, subtasks };
  }
}

// A trivial subagent brain that drives a single tool call per turn based on
// the natural-language instruction and finishes with `done`. The point is to
// exercise the orchestrator/subagent loop deterministically, not to pretend
// this is an LLM.
export class HeuristicSubagentBrain implements SubagentBrain {
  async nextStep(input: {
    subtask: Subtask;
    history: ReadonlyArray<{ step: PlanStep; result: { ok: boolean; output: unknown } }>;
  }): Promise<PlanStep> {
    const { subtask, history } = input;
    const turn = history.length;
    const instr = subtask.instruction.toLowerCase();

    // Turn 0: take the primary action implied by the instruction.
    if (turn === 0) {
      if (instr.includes("uname")) {
        return mkStep("invoke uname -a", "shell", { cmd: "uname", args: ["-a"] });
      }
      if (instr.startsWith("run date")) {
        return mkStep("invoke date", "shell", { cmd: "date" });
      }
      if (instr.includes("list workspace root")) {
        return mkStep("list workspace root", "list_dir", { path: "." });
      }
      if (instr.includes("wc -l")) {
        const m = instr.match(/wc -l (\S+)/);
        const path = m ? m[1] : "README.md";
        return mkStep("count lines", "shell", { cmd: "wc", args: ["-l", path] });
      }
      if (instr.startsWith("echo the user goal")) {
        return mkStep("echo goal", "shell", {
          cmd: "echo",
          args: [subtask.instruction.replace(/^echo the user goal:\s*/i, "")],
        });
      }
      if (instr.includes("read subtask:") || instr.includes("compose")) {
        return mkStep(
          "read first dependency",
          "memory_read",
          { namespace: `subtask:${subtask.dependsOn[0] ?? subtask.id}` },
        );
      }
    }

    // Turn 1: persist the previous result into this subagent's private slot.
    if (turn === 1) {
      const previous = history[0]?.result.output;
      return mkStep(
        "store result in subtask memory",
        "memory_write",
        {
          namespace: `subtask:${subtask.id}`,
          value: previous,
        },
      );
    }

    // Turn 2+: report completion.
    return mkStep("complete subtask", "done", {
      summary: `subtask ${subtask.id} completed in ${turn} turns`,
      artifacts: { lastResult: history.at(-1)?.result.output ?? null },
    });
  }
}

function sub(
  id: AgentId,
  title: string,
  instruction: string,
  toolAllowlist: string[],
  dependsOn: AgentId[] = [],
): Subtask {
  return { id, title, instruction, dependsOn, toolAllowlist };
}

function mkStep(thought: string, tool: string, args: Record<string, unknown>): PlanStep {
  return { thought, tool: { name: tool, args } };
}
