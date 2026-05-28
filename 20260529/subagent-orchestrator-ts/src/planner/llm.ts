import type { OrchestratorPlanner, SubagentBrain } from "./types.js";
import type { OrchestratorPlan, PlanStep, Subtask } from "../types.js";

// Optional OpenAI-compatible planner. Works against any endpoint that speaks
// the OpenAI Chat Completions schema: OpenAI itself, the Gemini OpenAI-compat
// layer, vLLM, Ollama, etc. It is opt-in via `--planner llm` because the
// repo demo needs to run offline.

export interface OpenAICompatConfig {
  readonly baseUrl: string; // e.g. https://api.openai.com/v1
  readonly apiKey: string;
  readonly model: string;
}

const ORCHESTRATOR_SYSTEM = `You are an orchestrator that decomposes a goal into a list of
small, independent subtasks for parallel sub-agents. Reply with strict JSON of the form:
{"subtasks": [{"id": "kebab-case", "title": "...", "instruction": "...",
  "dependsOn": ["other-id"], "toolAllowlist": ["read_file","list_dir","shell","memory_read","memory_write","done"]}]}
Do not add prose. IDs must be unique. dependsOn may be empty.`;

const SUBAGENT_SYSTEM = `You are a sub-agent executing one subtask. Reply with strict JSON:
{"thought": "...", "tool": {"name": "...", "args": {...}}}
Available tools: read_file{path}, list_dir{path}, shell{cmd,args[]} (allowlisted: echo,ls,pwd,cat,wc,uname,date),
memory_read{namespace}, memory_write{namespace,value}, done{summary,artifacts}.
You may only memory_write to "subtask:<your-id>". Call "done" when finished.`;

async function chat(cfg: OpenAICompatConfig, system: string, user: string): Promise<string> {
  const r = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) {
    throw new Error(`LLM endpoint ${r.status}: ${await r.text()}`);
  }
  const json = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM returned no content");
  return content.trim();
}

function extractJson<T>(s: string): T {
  // Tolerate ```json fences that some endpoints return.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : s;
  return JSON.parse(body) as T;
}

export class LLMOrchestratorPlanner implements OrchestratorPlanner {
  constructor(private readonly cfg: OpenAICompatConfig) {}

  async decompose(goal: string): Promise<OrchestratorPlan> {
    const raw = await chat(this.cfg, ORCHESTRATOR_SYSTEM, `Goal: ${goal}`);
    const parsed = extractJson<{ subtasks: Subtask[] }>(raw);
    return { goal, subtasks: parsed.subtasks };
  }
}

export class LLMSubagentBrain implements SubagentBrain {
  constructor(private readonly cfg: OpenAICompatConfig) {}

  async nextStep(input: {
    subtask: Subtask;
    history: ReadonlyArray<{ step: PlanStep; result: { ok: boolean; output: unknown } }>;
  }): Promise<PlanStep> {
    const user =
      `Subtask id: ${input.subtask.id}\nInstruction: ${input.subtask.instruction}\n` +
      `Tools allowed: ${input.subtask.toolAllowlist.join(", ")}\n` +
      `History so far: ${JSON.stringify(input.history)}`;
    const raw = await chat(this.cfg, SUBAGENT_SYSTEM, user);
    return extractJson<PlanStep>(raw);
  }
}
