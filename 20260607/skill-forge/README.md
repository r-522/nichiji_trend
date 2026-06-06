# skill-forge

> A self-evolving agent **skill memory engine** in TypeScript.

`skill-forge` implements the 2026 *self-evolving agent skills* pattern: instead
of fine-tuning model weights, an agent **records what it did** (trajectories),
**compiles successful trajectories into reusable skill packages** held in
external memory, and **recalls** the most relevant, highest-confidence skill
before its next attempt. Skills gain confidence with corroborating successes and
lose it with failures — learning that survives across sessions via a persisted
JSON store.

This mirrors ideas from Microsoft Research's *SkillOpt*, Nous Research's
*Hermes Agent* skill-compilation loop, and Cloudflare's *Agent Memory* — see
`../readme.md` for the full trend write-up and sources.

## Why it matters

- **No fine-tuning.** Skills live as text-space procedures in external memory,
  avoiding the regression and inference overhead of retraining weights.
- **Persistent.** Agent memory is treated as production infrastructure: a skill
  learned in one run is available in the next.
- **Confidence-scored.** A Laplace-smoothed `(successes+1)/(successes+failures+2)`
  ledger keeps unreliable skills from being blindly reused.
- **Zero dependencies.** Lexical retrieval (TF + cosine similarity) ships with
  no network calls and no model — fully deterministic and testable.

## Requirements

- Node.js >= 22 (uses the built-in test runner and `node:` core modules)

## Setup

```bash
npm install
npm run build
```

## Usage

Run the scripted self-evolving loop (ingests sample trajectories, then recalls):

```bash
npm run demo
```

Query the learned skills for a task:

```bash
node dist/src/cli.js recall "my python tests keep failing"
```

List all stored skills with their confidence ledger:

```bash
node dist/src/cli.js list
```

The store path defaults to `./.skill-forge/skills.json` and can be overridden
with the `SKILL_FORGE_DB` environment variable.

## Library API

```ts
import { SkillForge } from "skill-forge";

const forge = await SkillForge.open("./.skill-forge/skills.json");

// 1. Observe an attempt — compiles a new skill or reinforces an existing one.
forge.observe({
  task: "Fix failing unit tests in a Python project",
  tags: ["python", "testing"],
  success: true,
  steps: [
    { action: "run_tests", observation: "3 failures" },
    { action: "patch_code", observation: "fixed expiry logic" },
    { action: "run_tests", observation: "all green" },
  ],
});

// 2. Recall relevant, confident skills before the next attempt.
const hits = forge.recall("tests are failing in my python app");
//   -> [{ skill, score }, ...] sorted by relevance

// 3. Persist learning across sessions.
await forge.flush();
```

## How it works

| Module           | Responsibility                                                        |
| ---------------- | --------------------------------------------------------------------- |
| `types.ts`       | Domain model: `Trajectory`, `SkillPackage`, `RetrievalHit`.           |
| `similarity.ts`  | Dependency-free tokenizer + TF/cosine similarity for retrieval.       |
| `compiler.ts`    | Compiles/reinforces skills; confidence scoring; procedure distilling. |
| `store.ts`       | File-backed persistent skill store (JSON).                            |
| `forge.ts`       | `SkillForge` orchestrator: `observe` / `recall` / `flush`.            |
| `cli.ts`         | `demo` / `recall` / `list` commands.                                  |

**Retrieval score** blends lexical similarity (70%) with the skill's own
confidence (30%), so a strongly-proven skill outranks a marginally-more-similar
but unreliable one.

## Tests

```bash
npm test
```

10 tests cover tokenization, similarity, task normalization (so equivalent tasks
collide into one skill), confidence math, procedure distilling, the
compile→reinforce lifecycle, retrieval ranking, and cross-session persistence.

## License

MIT
