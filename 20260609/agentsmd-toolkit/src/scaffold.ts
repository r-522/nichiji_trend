/**
 * Generators: scaffold a fresh AGENTS.md and migrate legacy agent config files.
 */

import { parse } from "./parser.ts";
import type { AgentsDoc } from "./types.ts";

export interface ScaffoldOptions {
  /** Project name used in the H1 title. */
  projectName: string;
  /** If true, include extra optional sections. */
  full?: boolean;
}

/** Produce a recommended-structure AGENTS.md starter document. */
export function scaffold(opts: ScaffoldOptions): string {
  const name = opts.projectName.trim() || "Project";
  const lines: string[] = [];

  lines.push(`# ${name}`);
  lines.push("");
  lines.push("> AGENTS.md — instructions for AI coding agents working in this repo.");
  lines.push("> Human-facing docs live in README.md.");
  lines.push("");

  lines.push("## Project overview");
  lines.push("");
  lines.push(`Briefly describe what ${name} is, its tech stack, and how it is structured.`);
  lines.push("");

  lines.push("## Build & development commands");
  lines.push("");
  lines.push("```bash");
  lines.push("# install dependencies");
  lines.push("# <your install command>");
  lines.push("");
  lines.push("# start the dev server");
  lines.push("# <your dev command>");
  lines.push("```");
  lines.push("");

  lines.push("## Testing instructions");
  lines.push("");
  lines.push("```bash");
  lines.push("# run the full test suite");
  lines.push("# <your test command>");
  lines.push("```");
  lines.push("");
  lines.push("Always run the tests before opening a pull request.");
  lines.push("");

  lines.push("## Code style & conventions");
  lines.push("");
  lines.push("- Match the style of surrounding code.");
  lines.push("- Document the formatter / linter the project uses here.");
  lines.push("");

  lines.push("## Constraints / boundaries");
  lines.push("");
  lines.push("- Do not commit secrets or generated artifacts.");
  lines.push("- List directories or files agents must not touch.");
  lines.push("");

  if (opts.full) {
    lines.push("## Pull request / commit conventions");
    lines.push("");
    lines.push("- Describe the branch naming, commit message, and PR format here.");
    lines.push("");
    lines.push("## Nested guidance");
    lines.push("");
    lines.push("- For subproject-specific rules, add `packages/<name>/AGENTS.md`.");
    lines.push("- Reference them from here, e.g. `@packages/api/AGENTS.md`.");
    lines.push("");
  }

  return lines.join("\n");
}

const TITLE_RE = /^#\s+(.+?)\s*$/;

/**
 * Migrate a legacy CLAUDE.md / GEMINI.md / .cursorrules file into AGENTS.md.
 *
 * The body is preserved verbatim; a provenance note is prepended and the H1
 * title is normalised. The goal is a faithful, reviewable starting point — not
 * a lossy rewrite.
 */
export function migrate(sourceText: string, sourceLabel: string): string {
  const doc: AgentsDoc = parse(sourceText);
  const lines = sourceText.split(/\r?\n/);

  // Find an existing H1 to reuse as the title; otherwise synthesise one.
  const firstH1 = doc.sections.find((s) => s.level === 1);
  const title = firstH1 ? firstH1.title : "Project";

  const out: string[] = [];
  out.push(`# ${title}`);
  out.push("");
  out.push(`> Migrated from ${sourceLabel} by agentsmd-toolkit. Review and trim for agent use.`);
  out.push("");

  // Append the original content minus a leading H1 (to avoid duplicate titles).
  let skippedFirstH1 = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!skippedFirstH1 && firstH1 && TITLE_RE.test(line)) {
      skippedFirstH1 = true;
      continue; // drop the original H1; we already emitted a normalised one
    }
    out.push(line);
  }

  // Collapse any leading blank lines introduced by the drop.
  while (out.length > 4 && (out[4] ?? "").trim() === "" && (out[5] ?? "").trim() === "") {
    out.splice(4, 1);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
