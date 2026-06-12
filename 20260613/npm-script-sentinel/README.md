# npm-script-sentinel

**npm v12 readiness auditor** — scans a project's dependency tree for everything
that the npm v12 breaking changes (announced by GitHub on 2026-06-09) will block
by default:

| What npm v12 blocks | How this tool detects it |
| :--- | :--- |
| `preinstall` / `install` / `postinstall` scripts in dependencies | `hasInstallScript` in the lockfile + `scripts` in each installed `package.json` |
| Implicit `node-gyp rebuild` for native addons | `binding.gyp` present without an explicit install script |
| Git dependencies (`--allow-git=none` default) | `resolved` URLs with `git+` / `github:` / `ssh:` schemes |
| Remote tarball dependencies (`--allow-remote=none` default) | `resolved` HTTPS URLs pointing outside the npm registry |

The audit is fully **offline** (no registry calls) and the tool itself has
**zero runtime dependencies** — only Node.js >= 22 built-ins.

## Build & run

```bash
npm install        # dev-only deps (typescript, @types/node)
npm run build      # tsc -> dist/
npm test           # node:test unit tests
npm run demo       # audit the bundled examples/demo-project
```

## Usage

```bash
npm-script-sentinel [project-dir] [options]

  --json        Emit the full audit result as JSON
  --allowlist   Emit a package.json "npm" config snippet approving the findings
  --fail        Exit 1 when any finding exists (CI gate)
```

### Example (bundled demo project)

```
$ node dist/cli.js examples/demo-project

npm-script-sentinel — npm v12 readiness report
project: .../examples/demo-project
inputs: lockfile=yes, node_modules=yes

▌ Lifecycle install scripts (blocked by default in npm 12) — 1 package(s)
    • sharp-native@2.4.0 [direct] — scripts: postinstall

▌ Implicit node-gyp builds via binding.gyp (also blocked) — 1 package(s)
    • legacy-addon@1.1.0 [direct]

▌ Git dependencies (blocked by --allow-git=none default) — 1 package(s)
    • patched-fork@0.3.0 [direct] — resolved: git+ssh://git@github.com/...

▌ Remote URL dependencies (blocked by --allow-remote=none default) — 1 package(s)
    • vendored-tarball@1.0.0 [direct] — resolved: https://artifacts.example.com/...

Total: 4 finding(s).
```

`--allowlist` turns the findings into a config snippet you can review and merge
into `package.json` before upgrading to npm 12:

```json
{
  "npm": {
    "allow-scripts": ["legacy-addon", "sharp-native"],
    "allow-git": "*",
    "allow-remote": "*"
  }
}
```

> Treat the snippet as a starting point: prefer approving individual packages
> you trust over blanket `"*"` opt-ins, which re-open the attack surface the
> npm v12 defaults are closing.

## Architecture

```
src/
├── cli.ts       — argument parsing (node:util parseArgs) and orchestration
├── lockfile.ts  — package-lock.json v2/v3 parsing, resolved-URL classification
├── scanner.ts   — node_modules walk (scoped + nested), script/binding.gyp detection
├── report.ts    — dedupe/merge, text/JSON/allowlist rendering
├── types.ts     — shared domain types
└── test/        — node:test unit tests
```

Lockfile and `node_modules` findings are merged: the lockfile knows about
packages that aren't installed yet (`hasInstallScript`), while the installed
tree knows *which* scripts a package declares and catches implicit node-gyp
builds the lockfile flag misses. Either input alone is enough to run an audit.
