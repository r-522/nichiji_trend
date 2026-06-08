# agentsmd-toolkit

> AGENTS.md — instructions for AI coding agents working in this repo.
> Human-facing docs live in README.md.

## Project overview

agentsmd-toolkit is a zero-dependency TypeScript CLI for the AGENTS.md open
standard. Source lives in `src/` and runs directly on Node 22.6+ via native
type-stripping (no build step required). There are no runtime dependencies —
only Node built-ins.

## Build & development commands

```bash
# run the CLI from source
node src/cli.ts --help

# optional: compile to dist/
npm run build
```

## Testing instructions

```bash
# run the full test suite (Node built-in runner)
npm test
```

Always run `npm test` and `npm run typecheck` before opening a pull request.

## Code style & conventions

- TypeScript with `strict` enabled; keep code strip-types compatible
  (no enums, namespaces, or parameter properties).
- No runtime dependencies — only Node built-in modules.
- Match the style of surrounding code; document exported functions with JSDoc.

## Constraints / boundaries

- Do not add runtime dependencies to `package.json`.
- Do not commit the `dist/` or `node_modules/` directories.
- Keep `src/cli.ts` importable without side effects (guard direct execution).
