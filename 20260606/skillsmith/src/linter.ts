/**
 * Best-practice linting for SKILL.md bundles. These are advisory `warning`/`info`
 * diagnostics that go beyond hard spec conformance — they encode the authoring
 * guidance from the Agent Skills docs (progressive disclosure, useful
 * descriptions, sensible bundle layout).
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "./frontmatter.ts";
import { LINT, BUNDLE_DIRS } from "./spec.ts";
import { resolveSkillPath } from "./validator.ts";
import type { Diagnostic } from "./diagnostics.ts";

/**
 * Run lint rules on a skill. Assumes the file parses (validator covers hard
 * failures); returns only advisory diagnostics. Silently returns `[]` if the
 * file cannot be read or parsed.
 */
export function lintSkill(target: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  let skillFile: string;
  let skillDir: string;
  try {
    ({ skillFile, skillDir } = resolveSkillPath(target));
  } catch {
    return diags;
  }
  if (!existsSync(skillFile)) return diags;

  let parsed;
  try {
    parsed = parseDocument(readFileSync(skillFile, "utf8"));
  } catch {
    return diags;
  }
  const fm = parsed.frontmatter;
  if (fm === null) return diags;

  const fmLine = parsed.frontmatterStartLine;

  // description quality
  const description = typeof fm.description === "string" ? fm.description : "";
  if (description.length > 0 && description.length < LINT.descriptionMinLength) {
    diags.push({
      severity: "warning",
      rule: "description/too-short",
      message:
        `\`description\` is only ${description.length} chars; a richer description ` +
        "helps the agent decide when to load this skill",
      file: skillFile,
      line: fmLine,
    });
  }
  const lower = description.toLowerCase();
  if (description.length > 0 && !LINT.whenToUseHints.some((h) => lower.includes(h))) {
    diags.push({
      severity: "info",
      rule: "description/when-to-use",
      message:
        "`description` should describe *when* to use the skill (e.g. \"Use when …\"), " +
        "not only what it does",
      file: skillFile,
      line: fmLine,
    });
  }

  // progressive disclosure: body length
  const bodyLines = parsed.body.split("\n").length;
  if (bodyLines > LINT.bodyMaxLines) {
    diags.push({
      severity: "warning",
      rule: "body/too-long",
      message:
        `SKILL.md body is ${bodyLines} lines (> ${LINT.bodyMaxLines}); move detail into ` +
        "`references/` and link to it (progressive disclosure)",
      file: skillFile,
    });
  }

  // bundle hygiene: warn on unexpected top-level entries in the skill dir
  if (statSync(skillDir).isDirectory()) {
    const known = new Set<string>(["SKILL.md", ...BUNDLE_DIRS]);
    // referenced bundle dirs that don't exist aren't errors; we only flag
    // stray files lightly via info.
    for (const dir of BUNDLE_DIRS) {
      const p = join(skillDir, dir);
      if (existsSync(p) && !statSync(p).isDirectory()) {
        diags.push({
          severity: "warning",
          rule: "bundle/expected-dir",
          message: `\`${dir}\` exists but is not a directory`,
          file: p,
        });
      }
    }
    void known;
  }

  // license recommended for shareable skills
  if (!("license" in fm)) {
    diags.push({
      severity: "info",
      rule: "license/missing",
      message: "no `license` field; add one (e.g. \"MIT\") if you plan to share this skill",
      file: skillFile,
      line: fmLine,
    });
  }

  return diags;
}
