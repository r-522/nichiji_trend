# slopguard 🛡️

**Detect AI-hallucinated & slopsquatted npm dependencies before they ship.**

`slopguard` is an offline-first command-line scanner that walks a project's
dependencies — both declared (`package.json`) and imported (`import` /
`require` in source) — and flags package names that look like **slopsquatting**:
the supply-chain attack class where AI coding assistants *hallucinate*
non-existent package names and attackers pre-register those phantom names on the
registry to ship malware.

> Trend context & sources: see [`../readme.md`](../readme.md).

## Why this exists

In 2026, AI assistants hallucinate package names at non-trivial rates (commercial
models ~5%, open models ~22%), and **43%** of hallucinated names reappear across
identical re-prompts — making them *registerable targets*. Combined with
autonomous agents that `install` without a human checkpoint, a hallucinated
import can become an RCE vector. `slopguard` is a small, dependency-light guard
you can drop into CI to catch these before install.

## Detections

| Rule | Mode | Severity | What it catches |
| :--- | :--- | :--- | :--- |
| `phantom` | online | critical | Package does **not exist** on npm — a live hallucination an attacker could register. |
| `conflation` | offline | high | Name is two real packages mashed together (e.g. `react-codeshift` ← `react-codemod` + `jscodeshift`). |
| `typosquat` | offline | high/medium | 1–2 edits from a popular package (`expres`→`express`, `loadsh`→`lodash`). |
| `newly-registered` | online | high | Package first published < 30 days ago. |
| `registry-install-hook` | online | high | Latest version runs `pre/post/install` lifecycle scripts. |
| `low-adoption` | online | medium | < 50 weekly downloads. |
| `install-hook` | offline | medium | The project's own manifest declares install-time scripts. |
| `unknown-offline` | offline | info | Not in the known-good list — verify with `--online`. |

Signals are scored (0–100) and aggregated per package; a high cumulative score
can promote severity (many mediums → high/critical).

## Install / Run

Requires **Node ≥ 20**. No runtime dependencies — only dev tooling.

```bash
npm install          # installs tsx + typescript (dev only)

# scan the current project (offline heuristics)
npm run scan -- .

# full registry-backed scan of the bundled demo
npm run scan -- ./examples --online

# machine-readable output for CI
npm run scan -- . --json --fail-on high
```

Or build a standalone CLI:

```bash
npm run build        # emits dist/
node dist/index.js ./examples --online
```

## Usage

```
slopguard [path] [options]

  path                Project dir, package.json, or source file (default ".")
  --online            Verify packages against the live npm registry
  --offline           Heuristics only, no network (default)
  --no-sources        Skip scanning source files for imports
  --json              Emit the full report as JSON
  --fail-on <sev>     Exit 2 if any finding >= severity
                      (none|info|low|medium|high|critical, default: high)
  -h, --help          Show help
```

**Exit codes:** `0` clean (below threshold) · `2` findings at/above `--fail-on`
· `1` usage/runtime error — ready for a CI gate:

```yaml
# .github/workflows/ci.yml
- run: npx slopguard . --online --fail-on high
```

## Example

```
$ slopguard ./examples --online --fail-on none

[CRITICAL] ai-vector-toolkit-fast@^0.0.1  risk 100/100
  · phantom: Package does not exist on the npm registry — a hallucinated dependency...
  · install-hook: Declares install-time lifecycle script(s): postinstall...

[HIGH] react-codeshift@^1.0.0  risk 75/100
  · conflation: Name looks composed of fragments of multiple real packages (react, jscodeshift)...

[HIGH] expres@^4.0.0  risk 70/100
  · typosquat: Name is 1 edit(s) away from popular package "express"...
```

## How it works

```
collect.ts    → gather deps from package.json + import/require specifiers
heuristics.ts → pure detection rules (levenshtein, conflation, registry signals)
registry.ts   → optional npm registry client (graceful offline degradation)
scanner.ts    → orchestrate: collect → run rules → aggregate → report
report.ts     → pretty terminal output;  index.ts → CLI
```

The heuristics are **pure functions**, covered by `node:test`:

```bash
npm test     # 12 tests
```

## Limitations & honest caveats

- The known-good list is a high-signal subset, not the whole registry — so
  offline mode favors recall (it nudges you to `--online`) over precision.
- Heuristics can false-positive on legitimately new or niche packages; treat
  findings as a **review prompt**, not a verdict. `--online` sharply reduces
  noise by confirming real existence.
- Not a sandbox: `slopguard` never installs or executes any dependency. It only
  reads names and registry metadata.

## License

MIT
