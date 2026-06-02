# a2a-agent-mesh

A **federated multi-agent mesh** built on the **Agent2Agent (A2A) protocol** —
a small, dependency-free TypeScript reference implementation inspired by the
**Azure Agent Mesh** announced at **Microsoft Build 2026 (June 2–3, 2026)** and
the Linux Foundation A2A standard.

> Individual agents handle single-environment execution; the **mesh** federates
> execution across a heterogeneous fleet under a unified governance +
> observability layer — exactly the pattern Microsoft demoed for Azure Agent
> Mesh.

## What it does

- **A2A agents** (`A2AAgent`) each publish an **AgentCard** at
  `/.well-known/agent-card.json` and answer JSON-RPC 2.0 calls
  (`message/send`, `tasks/get`) at `/a2a`.
- **A2AClient** discovers an agent by its card and drives it over `fetch`.
- **AgentMesh** discovers agents, indexes their skills, probes latency, and
  **routes each task to the lowest-latency capable agent** — recording every
  decision in a governance **audit trail** (Entra ID + Purview style).
- **Orchestrator** runs **federated sequential workflows** and **concurrent
  fan-outs** across the mesh, stitched together by a shared A2A `contextId`.

Everything is built on Node's built-in `http`/`crypto`/`fetch` — no runtime
dependencies, so the whole mesh runs fully offline.

## Architecture

```
            ┌────────────────────────── AgentMesh ──────────────────────────┐
            │  registry (AgentCards) · latency probes · capability routing    │
            │  governance audit log (identity + data classification)          │
            └───────┬───────────────┬───────────────┬───────────────┬────────┘
                    │ A2A/JSON-RPC   │               │               │
              ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼──────┐ ┌──────▼───────┐
              │ ledger     │   │ risk-calc   │  │ edge-nlp    │ │ compliance   │
              │ (on-prem)  │   │ (Azure)     │  │ (edge NPU)  │ │ (Cloud PC)   │
              │ extract    │   │ calculate   │  │ sentiment   │ │ compliance   │
              └────────────┘   └─────────────┘  └─────────────┘ └──────────────┘
```

## Run it

```bash
cd a2a-agent-mesh
npm install        # optional: only for @types/node + tsx + typescript
npm run demo       # spins up the fleet and runs a federated compliance workflow
npm test           # node:test integration suite (7 tests across the full stack)
npm run build      # type-check + emit to dist/
```

Requires Node.js ≥ 20 (uses the global `fetch`). The demo and tests use
[`tsx`](https://github.com/privatenumber/tsx) to run TypeScript directly.

## Example: the federated compliance workflow

The demo reviews a transaction and routes the work across four agents:

```
[extract]    (on-prem)   "$12,500 wire + $35.50 fee"  => total = 12535.5
[risk]       (Azure)     "12535.5 * 1.05"             => 13162.28
[compliance] (Cloud PC)  "check 13162.28"             => FLAGGED (>= $10,000)
[sentiment]  (edge NPU)  parallel fan-out             => negative
```

…and prints a full governance audit trail of every register / route / execute
decision, including the service identity and data classification of each agent.

## Library usage

```ts
import { A2AAgent, AgentMesh, runWorkflow, calculatorSkill } from "./src/index.js";

const agent = new A2AAgent({ name: "calc", description: "math", skills: [calculatorSkill] });
const url = await agent.listen();

const mesh = new AgentMesh();
await mesh.register(url);

const task = await mesh.invoke("math", "Compute (10 + 5) * 3");
console.log(mesh.text(task)); // "result = 45"
```

## A2A protocol notes

This implements a pragmatic subset of the
[Agent2Agent specification](https://a2a-protocol.org):

- **AgentCard** discovery at the well-known path.
- **JSON-RPC 2.0** transport (`message/send`, `tasks/get`).
- **Task** state machine (`submitted → working → completed/failed`) carrying
  **Message** history and **Artifact** outputs.

Streaming (`message/stream` via SSE) and push notifications are intentionally
omitted to keep the reference compact.

## License

MIT
