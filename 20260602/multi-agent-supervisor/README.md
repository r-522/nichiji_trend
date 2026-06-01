# multi-agent-supervisor

Reference implementation of the **Supervisor multi-agent pattern** — the
architecture that dominated Agentic AI frameworks in 2026 (LangGraph,
CrewAI, Microsoft Agent Framework, Mastra, OpenClaw, Hermes Agent) —
written in **TypeScript** with **zero runtime dependencies**.

## What it shows

```
        ┌─────────────────┐
        │      USER       │
        └────────┬────────┘
                 │ task
        ┌────────▼────────┐
        │   SUPERVISOR    │◀──── decides next worker / FINISH
        └────────┬────────┘
       ┌─────────┼─────────┐
       ▼         ▼         ▼
 ┌──────────┐ ┌──────┐ ┌────────┐
 │researcher│ │coder │ │ writer │   (workers, each produces 1 artifact)
 └────┬─────┘ └──┬───┘ └───┬────┘
      └──────────┴─────────┘
                 │
            shared GraphState
            (messages + artifacts)
```

- **GraphState** is the typed shared state — message log, artifacts,
  visited workers, step counter.
- **Supervisor** inspects the state and emits a structured routing
  decision (`{ next, reason }` or `FINISH`).
- **Workers** (`researcher`, `coder`, `writer`) each implement a single
  `run(state) → Artifact` method.
- **runGraph** drives the loop until `FINISH` or `maxSteps`.

The supervisor is wired through a `routeWithMockLLM` function whose
signature matches a real LLM-backed router — string in, structured JSON
out — so swapping in OpenAI / Anthropic / a local model is a one-file
change in `src/llm.ts`. As shipped, the mock LLM is deterministic and
the whole app runs offline.

## Project layout

```
multi-agent-supervisor/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts          # CLI entry point
    ├── graph.ts          # state-graph runner (LangGraph-style)
    ├── supervisor.ts     # Supervisor factory
    ├── llm.ts            # mock LLM router (swap for a real model)
    ├── types.ts          # shared GraphState / Agent / Decision types
    ├── test.ts           # zero-dep self-test
    └── agents/
        ├── researcher.ts # background-facts worker
        ├── coder.ts      # code-sample worker
        └── writer.ts     # final-report synthesiser
```

## Run it

```bash
cd 20260602/multi-agent-supervisor
npm install            # installs only typescript / ts-node devDeps
npm run build
npm start -- "Investigate the supervisor pattern and write a report"
```

Or without building:

```bash
npm run dev -- "Tell me about agentic AI"
```

Run the self-test:

```bash
npm test
```

## Sample output

```
▶  task: Investigate the supervisor pattern and write a report
  └─ step 1: → researcher  (task mentions researcher keywords (score=1))
     ✓ researcher produced research
  └─ step 2: → writer  (task mentions writer keywords (score=1))
     ✓ writer produced report
  └─ step 3: → coder  (default supervisor ordering (research → code → write); picked coder)
     ✓ coder produced code
■  finish: every worker has produced an artifact

════════════════ FINAL ANSWER ════════════════
# Report — Investigate the supervisor pattern and write a report
...
```

## Swapping in a real LLM

Replace `routeWithMockLLM` in `src/llm.ts` with a function that calls your
model. Keep the input/output shapes identical:

```ts
export async function routeWithMockLLM(req: RouteRequest): Promise<RouteResponse> {
  const prompt = buildPrompt(req);
  const json = await yourModel.complete({ prompt, responseFormat: "json" });
  return JSON.parse(json) as RouteResponse;
}
```

Everything else — supervisor, graph, workers, state — stays the same.

## Why this is the 2026 trend

- OpenClaw passed 373k GitHub stars in May 2026, the most-starred software
  project on GitHub.
- LangGraph v1.2 (May 2026) shipped per-node timeouts, error recovery and
  DeltaChannel — turning the supervisor graph into a production-grade
  primitive.
- Microsoft Agent Framework (AutoGen + Semantic Kernel) hit GA in Q1 2026.
- The MCP TypeScript SDK crossed 66M cumulative npm downloads — the
  Supervisor / Worker / Tool stack is now standard.

See `../readme.md` for full trend sourcing.
