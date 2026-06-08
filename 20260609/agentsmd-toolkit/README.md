# agentsmd-toolkit

A **zero-dependency TypeScript CLI** for the [AGENTS.md](https://agents.md/) open
standard — the Linux Foundation–stewarded, cross-tool format for giving AI
coding agents project-specific instructions.

> Built 2026-06-09 (JST) as the daily trend app. Trend: **AGENTS.md**, which in
> Dec 2025 moved under the Linux Foundation's *Agentic AI Foundation* (alongside
> MCP and Goose) and is now used by 60,000+ GitHub repos and read natively by
> Codex CLI, GitHub Copilot, Cursor, Windsurf, Amp and Devin.

## Why

As autonomous coding agents became the dominant 2026 dev trend, the *context
file* that steers them turned into critical infrastructure — and AGENTS.md
emerged as the neutral, tool-agnostic standard unifying the previous sprawl of
`CLAUDE.md` / `GEMINI.md` / `.cursorrules` / `copilot-instructions.md`. This
toolkit helps you author, validate, and reason about those files.

## Requirements

- **Node.js ≥ 22.6** (uses native TypeScript type-stripping — no build step
  needed to run). No runtime dependencies; only Node built-ins.

## Install / run

```bash
# run straight from source (no build needed on Node 22.6+)
node src/cli.ts --help

# or via npm script
npm run agentsmd -- --help

# optional: compile to dist/ with the TypeScript compiler
npm install   # dev-only: @types/node + typescript
npm run build
```

## Commands

### `validate [file]`
Lint an AGENTS.md against best-practice rules (default `./AGENTS.md`).

```bash
node src/cli.ts validate AGENTS.md
node src/cli.ts validate AGENTS.md --json
```

Checks include: has headings, a single H1 title, presence of recommended
sections (build / test / style / boundaries / overview), empty sections, a
context-size budget (300 lines), and **dangling `@path` references**. Exit code
is `1` when error-severity findings exist, else `0`.

### `resolve [dir]`
Preview the **monorepo nearest-file precedence chain**: agents walk from the
repo root down to the working directory and combine every AGENTS.md found, with
files closer to the working directory taking precedence. This command shows that
merge order explicitly.

```bash
node src/cli.ts resolve packages/api
node src/cli.ts resolve packages/api --root . --json
```

### `init [name]`
Print a starter AGENTS.md with the recommended structure.

```bash
node src/cli.ts init my-project --full --out AGENTS.md
```

### `migrate <file>`
Convert a legacy agent config (e.g. `CLAUDE.md`, `GEMINI.md`) into AGENTS.md,
preserving the body and adding a provenance note.

```bash
node src/cli.ts migrate CLAUDE.md --out AGENTS.md
```

## Project layout

```
agentsmd-toolkit/
├── src/
│   ├── types.ts       # shared type definitions
│   ├── parser.ts      # tiny Markdown parser (headings / fences / @refs)
│   ├── validator.ts   # best-practice lint rules
│   ├── resolver.ts    # monorepo nearest-file precedence walk
│   ├── scaffold.ts    # init + migrate generators
│   └── cli.ts         # CLI entrypoint
├── test/
│   └── toolkit.test.ts
├── AGENTS.md          # dogfooded: this repo's own agent instructions
├── package.json
├── tsconfig.json
└── README.md
```

## Tests

```bash
npm test   # node --test --experimental-strip-types  → 12 tests
```

## License

MIT
