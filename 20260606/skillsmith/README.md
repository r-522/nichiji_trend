# skillsmith

A tiny, **zero-runtime-dependency** TypeScript toolkit for the
[Agent Skills](https://agentskills.io) open standard (`SKILL.md`).

It validates skills against the spec, lints them for authoring best practices,
builds a registry catalog of all skills in a tree, and scaffolds new ones.

> The Agent Skills standard (published by Anthropic, Apache-2.0 / CC-BY-4.0) is a
> simple idea that went viral across the AI-agent ecosystem in 2026: a skill is
> just a folder with a `SKILL.md` file whose YAML front matter tells an agent
> *what the skill does and when to use it*, with the body holding the
> instructions. `skillsmith` is the linter/CI companion for that format.

## Why

As `SKILL.md` spread to Claude Code, VS Code/Copilot, Codex, Cursor, Goose and
others, teams started shipping dozens of skills — and hitting the same problems
CI normally catches: a `name` that doesn't match its folder, a missing
`description`, front matter that silently fails to parse, or a 900-line SKILL.md
that defeats progressive disclosure. `skillsmith` turns those into fast,
explained diagnostics with exit codes you can gate a pipeline on.

## Requirements

- Node.js >= 20
- [`tsx`](https://github.com/privatenumber/tsx) to run the TypeScript directly
  (already declared as a dev dependency)

No build step is required to run it; `tsx` executes the sources as-is.

## Install / run

```bash
cd skillsmith
npm install          # installs tsx, typescript, @types/node (dev only)

# run via the npm script…
npm run skillsmith -- validate examples/skills/pdf-extractor

# …or directly with tsx
npx tsx src/cli.ts check examples/skills
```

## Commands

| Command                | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `validate <path...>`   | Spec-conformance check. Exits non-zero on any **error**.            |
| `lint <path...>`       | Advisory best-practice checks (warnings / info only).               |
| `check <path...>`      | `validate` + `lint` in one pass.                                    |
| `index <dir>`          | Recursively discover skills and emit a registry catalog (JSON).     |
| `init <name>`          | Scaffold a new spec-compliant skill bundle.                         |

Paths may be a single `SKILL.md`, a skill directory, or a tree containing many
skills (searched recursively). Defaults to the current directory.

### Examples

```bash
# Validate one skill
npx tsx src/cli.ts validate ./examples/skills/pdf-extractor

# Lint + validate a whole tree, machine-readable
npx tsx src/cli.ts check ./examples/skills --json

# Build a catalog an agent runtime / marketplace could consume
npx tsx src/cli.ts index ./examples/skills --out catalog.json

# Scaffold a new skill with bundle dirs
npx tsx src/cli.ts init pdf-extractor \
  --description "Use when extracting text from PDFs" --bundles
```

## What gets checked

**Spec (errors — `validate`)**

- front matter present and parseable (`---` … `---`)
- required `name` and `description`
- `name`: lowercase `a-z0-9` + single hyphens, ≤ 64 chars, **matches the folder**
- `description`: non-empty, ≤ 1024 chars
- `compatibility` ≤ 500 chars; `metadata` is a mapping
- non-empty instructional body
- unknown front matter fields reported as `info` (allowed by the spec)

**Best practices (warnings/info — `lint`)**

- description long enough to be useful, and says *when* to use the skill
- SKILL.md body kept lean (progressive disclosure → push detail to `references/`)
- bundle hygiene (`scripts/`, `references/`, `assets/`)
- a `license` is present for shareable skills

## Library use

Every command is also a typed function you can import:

```ts
import { validateSkill, lintSkill, buildCatalog } from "skillsmith";

const report = validateSkill("./skills/pdf-extractor");
if (!report.ok) process.exit(1);
```

## Development

```bash
npm test         # node:test suite (frontmatter, validator, indexer/linter)
npm run typecheck
npm run build    # emit dist/ (optional; tsx runs sources directly)
```

## Project layout

```
skillsmith/
├── src/
│   ├── frontmatter.ts   # dependency-free YAML front matter parser
│   ├── spec.ts          # constraints from the Agent Skills spec
│   ├── diagnostics.ts   # shared diagnostic types
│   ├── validator.ts     # spec conformance
│   ├── linter.ts        # best-practice rules
│   ├── indexer.ts       # discovery + catalog
│   ├── scaffold.ts      # `init`
│   ├── cli.ts           # command-line entry point
│   └── index.ts         # library exports
├── test/                # node:test suites
└── examples/skills/     # valid + intentionally-broken sample skills
```

## License

MIT
