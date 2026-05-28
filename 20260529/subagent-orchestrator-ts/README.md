# subagent-orchestrator-ts

A minimal, dependency-free TypeScript reproduction of the
**orchestrator + parallel sub-agents** architecture popularised by
**Google Antigravity 2.0** (Google I/O 2026, 2026-05-19) and reinforced by
**Gemini 3.5 Flash**'s agentic-coding push the same week.

> This is the daily JST-trend app for 2026-05-29.
> Trend write-up: `../readme.md`.

## What it shows

The public Antigravity 2.0 architecture writes:

> The orchestrator agent receives your high-level goal and decides how to
> break it into subtasks, then defines and spawns subagents, each focused
> on a single task, with its own isolated context window, and runs them
> in parallel. … Anti-Gravity 2.0 addresses this with a shared memory
> layer — essentially a structured context store that any agent can read
> from and write to, with the orchestrator controlling write permissions
> to avoid conflicts.

This project implements that pattern locally and offline:

```
  ┌────────────────────────────┐
  │       Orchestrator         │   only writer of shared:/merged:
  │  goal → plan → spawn       │
  └──────────────┬─────────────┘
                 │ Promise.all(wave)
   ┌─────────────┼─────────────┐
   ▼             ▼             ▼
 Subagent     Subagent      Subagent     each has its own context history
   │             │             │         and writes only to subtask:<id>
   └─────────────┴─────┬───────┘
                       ▼
               SharedMemory (with write-permission table)
```

Properties:

- **Parallel execution**: independent subtasks run in the same wave via `Promise.all`.
- **Topological scheduling**: subtasks with `dependsOn` are scheduled into later waves.
- **Isolated contexts**: each subagent maintains its own `history` and tool registry.
- **Write-permission table**: a subagent can only `memory_write` to `subtask:<own-id>`.
  Only the orchestrator can write `shared:*` / `merged:*`.
- **Managed execution**: a strict allowlist on shell + workspace-rooted FS paths.
- **Streamed JSONL trace**: every plan/spawn/tool_call/tool_result/merge event is
  emitted as JSON-lines on stdout (toggle with `--silent`) and optionally written
  to `--trace path.jsonl`.

## Quickstart

Requires **Node.js 22+** (uses native ESM + `node --test`).

```bash
npm install
npm run build

# Heuristic planner: deterministic, no API key required.
node dist/src/index.js run "inventory the workspace files"

node dist/src/index.js run "report on environment uname and host" \
  --trace /tmp/trace.jsonl

# OpenAI-compatible planner (any chat-completions endpoint works).
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.openai.com/v1   # or Gemini's openai-compat URL, Ollama, vLLM, …
export OPENAI_MODEL=gpt-4o-mini
node dist/src/index.js run "<goal>" --planner llm
```

## Tests

```bash
npm test
```

Uses the built-in `node --test` runner — no Jest/Vitest dependency.

## Layout

```
src/
  index.ts            CLI entry
  orchestrator.ts     Decompose → spawn waves → merge
  subagent.ts         Plan-Act-Observe loop per subtask
  shared-memory.ts    Structured context store with write-permission table
  tracer.ts           JSONL event emitter
  planner/
    types.ts          OrchestratorPlanner + SubagentBrain interfaces
    heuristic.ts      Offline deterministic planner / brain
    llm.ts            OpenAI-compatible planner / brain (opt-in)
  tools/
    types.ts          Tool / ToolContext / helpers
    registry.ts       Default registry + per-subagent filter
    fs.ts             read_file / list_dir, sandboxed to workspace
    shell.ts          Allowlisted execFile (echo,ls,pwd,cat,wc,uname,date)
    memory.ts         memory_read / memory_write (delegates to SharedMemory)
    done.ts           Terminal step that returns summary + artifacts
test/
  shared-memory.test.ts
  orchestrator.test.ts
  tools.test.ts
examples/
  trace-inventory.txt   Pre-recorded JSONL trace for "inventory workspace files"
```

## Security / sandboxing notes

- `read_file` and `list_dir` resolve their argument against the `--workspace`
  root and refuse anything that escapes it (no `..` traversal, no absolute paths
  outside the root).
- `shell` uses `execFile` (no shell interpolation), a hard 5 s timeout,
  a 256 KiB output cap, and an allowlist of read-only commands.
- The "managed execution" boundary is enforced in code; the orchestrator
  cannot widen a subagent's allowlist at runtime — only the plan declares
  what each subagent may invoke.

## Why this app, today

- The dominant trend in the past 24 hours is **agentic execution**, and the
  Antigravity 2.0 orchestrator/subagent pattern is now the de-facto reference
  architecture (covered the last week across TechCrunch, MarkTechPost,
  DataCamp, 9to5Google, Medium, MindStudio).
- The complementary MCP **Tasks** extension in the 2026-07-28 RC (locked
  2026-05-21) standardises long-running async sub-jobs — same direction,
  different surface.
- Per `../../CLAUDE.md`, today's language must not be **Go** (used 2026-05-28)
  or **Python** (used 2026-05-27). TypeScript was chosen accordingly.
