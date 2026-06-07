# agent-memory-engine

A dependency-free, **layered memory engine for AI agents**, written in TypeScript.

It implements the reference architecture behind the 2026 "context engineering"
trend — *memory, not the model, is the product* — combining a biologically
inspired three-layer memory hierarchy with a forgetting curve, reinforcement,
and an associative **context graph**.

```
┌──────────────────────────────────────────────────────────────┐
│  working   small recency buffer (the agent's attention span)   │
│  episodic  timestamped events, decay along a forgetting curve   │
│  semantic  durable facts consolidated from episodic memory      │
│  + context graph: entities linked by co-occurrence (assoc.)     │
└──────────────────────────────────────────────────────────────┘
```

## Why

Production agents fail not because the model is weak but because they *forget*.
This engine gives an agent:

- **Relevance** — local, deterministic embeddings + cosine similarity (no API).
- **Recency** — an Ebbinghaus forgetting curve; fresh memories rank higher.
- **Importance** — caller-supplied salience slows decay for what matters.
- **Reinforcement** — memories recalled often become easier to recall again.
- **Association** — a context graph surfaces related memories via one hop of
  spreading activation (recall the *deadline* when asked about the *project*).
- **Consolidation** — a "sleep" pass promotes durable facts to semantic memory
  and forgets decayed trivia.

Every retrieval returns an explainable score breakdown.

## Requirements

- **Node.js ≥ 22.6** — runs the TypeScript sources directly via native type
  stripping. **No build step, no runtime dependencies.**
- `typescript` + `@types/node` are dev-only (for `npm run typecheck`).

## Quick start

```bash
npm run demo        # runs a cross-session coding-assistant simulation
npm test            # Node's built-in test runner (14 tests)
npm run typecheck   # tsc --noEmit
```

## Library usage

```ts
import { AgentMemory } from "agent-memory-engine";

const mem = new AgentMemory({ halfLifeMs: 30 * 60_000 });

mem.remember("The user prefers TypeScript over Rust.", { importance: 0.9 });
mem.remember("Phoenix must ship before the Friday deadline.", { importance: 0.85 });
mem.remember("The user grabbed a coffee.", { importance: 0.05 });

// Relevance + recency + importance + reinforcement, explained:
const hits = mem.recall("what language does the user like?", { limit: 1 });
console.log(hits[0].record.content);   // -> "The user prefers TypeScript over Rust."
console.log(hits[0].score);            // { relevance, recency, importance, reinforcement, total }

// Associative recall via the context graph:
mem.recall("status of Phoenix");       // surfaces the Friday deadline too

// "Sleep": promote durable facts, forget decayed trivia.
const { promoted, forgotten } = mem.consolidate();
```

## API

| Method | Purpose |
| :-- | :-- |
| `remember(content, opts?)` | Store a memory (defaults to episodic + working buffer). `opts`: `importance`, `entities`, `metadata`, `kind`. |
| `recall(query, opts?)` | Ranked retrieval with score breakdowns. `opts`: `limit`, `kind`, `expandGraph`, `reinforce`. |
| `consolidate(opts?)` | Promote important/frequent memories to semantic; forget decayed ones. |
| `workingMemory()` | Current working buffer, oldest first. |
| `byKind(kind)` | All records in a layer. |
| `stats()` | Counts per layer + graph size. |
| `mem.graph` | The underlying `ContextGraph` (`neighbors`, `activate`). |

## How scoring works

```
total = 0.55·relevance + 0.20·recency + 0.15·importance + 0.10·reinforcement

recency      = 0.5 ^ (age / effectiveHalfLife),  effectiveHalfLife = halfLife·(1 + 4·importance)
reinforcement = 1 - 1/(1 + accessCount)
```

Weights and half-life are configurable via the `AgentMemory` constructor.

## Layout

```
src/
  types.ts          shared types
  embedding.ts      feature-hashing embeddings + cosine similarity
  scoring.ts        forgetting curve, reinforcement, score combination
  contextGraph.ts   entity co-occurrence graph + spreading activation
  memoryStore.ts    AgentMemory — the core engine
  demo.ts           runnable cross-session simulation
  index.ts          public API
test/
  memory.test.ts    14 tests (node --test)
```

## License

MIT
