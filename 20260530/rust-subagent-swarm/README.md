# rust-subagent-swarm

A **local-first, parallel sub-agent orchestrator** written in **pure Rust**, with
**zero external crate dependencies** (stdlib threads + `mpsc` only).

This is the daily trend-app for **2026-05-30 (JST)**. It implements, in miniature,
the architectural pattern that powers parallel-subagent systems trending in late
May 2026 — Google's Antigravity harness (announced at I/O 2026), Anthropic's
Claude Code parallel subagent execution, and Rust-native agent frameworks like
Rig, AutoAgents, and OpenFANG (the Q1-2026 wave of "Rust as AI-infrastructure
substrate").

## What it does

1. A **`Planner`** (LLM stand-in) turns a free-form goal into a `Plan` of
   independent `SubTask`s, each composed of one or more tool calls.
2. An **`Orchestrator`** spawns N worker threads, dispatches sub-tasks over an
   `mpsc` channel, and collects `TaskResult`s back.
3. Each **sub-agent** runs its tool calls sequentially and writes its final
   answer into shared **`Memory`**, so other downstream consumers can read it.
4. A **`render()`** call produces a human-readable timeline showing per-task
   wall-time, worker assignment, and the achieved speed-up vs. a serial run.

The default `MockPlanner` is fully deterministic and offline — no API keys, no
network. To plug in a real LLM (Gemini 3.5 Flash, Claude, etc.), implement the
3-method `Planner` trait in `src/llm.rs` and pass it to `Orchestrator::run`.

## Quick start

```bash
cargo build --release
./target/release/swarm demo            # built-in demo task across 4 workers
./target/release/swarm run "compute (1+2+3)*7 and reverse 'orchestration'"
./target/release/swarm tools           # list registered tools
./target/release/swarm bench           # 1-worker vs 8-workers wall-time
```

Sample `bench` output:

```
Sub-tasks: 8  (each: sleep 100ms)
1-worker  wall-time :   801 ms
8-workers wall-time :   101 ms
Speed-up            : 7.93x
```

## Architecture

```
              ┌─────────────┐
   goal ──▶   │  Planner    │  (trait — MockPlanner default; swap for Gemini etc.)
              └──────┬──────┘
                     │  Plan { tasks: Vec<SubTask> }
                     ▼
              ┌─────────────┐         ┌──── Worker 0 ────┐
              │ Orchestrator│ ──mpsc▶ │ SubAgent::execute│ ──▶ tool calls
              │  (N workers)│         └──────────────────┘        │
              └──────┬──────┘         ┌──── Worker 1 ────┐        │
                     │        ──mpsc▶ │ SubAgent::execute│ ──▶ tool calls
                     │                └──────────────────┘        │
                     │                          …                  │
                     ◀──── TaskResult ──────────────────────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ RunReport   │  render() → timeline + memory snapshot
              └─────────────┘
                     │
              ┌──────┴──────┐
              │ Memory      │  Arc<Mutex<HashMap<…>>>  (cross-agent shared state)
              └─────────────┘
```

## Module map

| File | Responsibility |
| :--- | :--- |
| `src/plan.rs` | `Plan` / `SubTask` / `ToolCall` / `TaskResult` data model |
| `src/tools.rs` | Tool registry + 7 default tools + tiny key=value arg parser + integer expression evaluator + civil-date converter |
| `src/llm.rs` | `Planner` trait + deterministic `MockPlanner` (keyword-based decomposition) |
| `src/memory.rs` | Thread-safe cross-agent key/value store |
| `src/agent.rs` | Sub-agent worker: runs one `SubTask`'s tool calls in order, records timing, publishes final answer to shared memory |
| `src/orchestrator.rs` | Spawns N worker threads, dispatches tasks via `mpsc`, collects + sorts results, renders the report |
| `src/main.rs` | CLI: `demo` / `run` / `tools` / `bench` / `help` |
| `tests/integration.rs` | End-to-end: goal → plan → parallel run → assert memory + speed-up |

## Default tools

| Name | Description |
| :--- | :--- |
| `calc` | Recursive-descent evaluator for `+ - * /` and parentheses over integers |
| `text_stats` | char / word / line counts |
| `reverse` | Reverse a string (character-aware) |
| `uppercase` | ASCII/Unicode uppercase |
| `jst_time` | Current wall-clock in JST (UTC+9), computed via Hinnant's civil-date algorithm — no `chrono` |
| `sleep_ms` | Block for N ms (used to demonstrate parallel speed-up) |
| `echo` | Return the input verbatim |

Tool arguments are a tiny `key=value` syntax (quoted values supported as
`text='hello world'`). This avoids dragging in `serde_json` while still being
unambiguous; switching to JSON is a one-function change.

## Why pure stdlib?

Most Rust agent frameworks pull in `tokio`, `serde`, `reqwest`, and friends.
That's fine for production, but it hides the underlying pattern. This crate
keeps the orchestration core to ~200 lines of pure `std` so the parallel
sub-agent dispatch loop is auditable and educational. Add `tokio` later if you
want async I/O or `serde_json` if you want full JSON-RPC.

## Tests

```bash
cargo test        # 14 unit tests + 3 integration tests
cargo clippy --all-targets -- -D warnings
```

Integration test `many_workers_beat_one_worker_on_io_bound_plan` asserts at
least a **3x speed-up** with 8 workers vs 1 on 8 independent sleep-tasks; in
practice the binary achieves ~8x (see `bench`).
