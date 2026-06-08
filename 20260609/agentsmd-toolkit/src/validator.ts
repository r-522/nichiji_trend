/**
 * Validation rules for AGENTS.md documents.
 *
 * The AGENTS.md spec is deliberately loose ("just Markdown"), so these rules
 * encode community best practices rather than a hard schema. Errors flag things
 * that genuinely break agent usage (e.g. no headings at all); warnings nudge
 * toward a more useful file; infos are gentle suggestions.
 */

import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { parse } from "./parser.ts";
import type { AgentsDoc, Finding, Section, ValidationResult } from "./types.ts";

/** A recommended section, matched against heading slugs by keyword. */
interface RecommendedSection {
  rule: string;
  label: string;
  /** Any of these substrings appearing in a heading slug counts as present. */
  keywords: string[];
  severity: "warning" | "info";
}

const RECOMMENDED: RecommendedSection[] = [
  {
    rule: "overview",
    label: "Project overview / context",
    keywords: ["overview", "about", "project", "context", "introduction"],
    severity: "info",
  },
  {
    rule: "build",
    label: "Build & development commands",
    keywords: ["build", "setup", "install", "dev", "development", "run", "getting started"],
    severity: "warning",
  },
  {
    rule: "test",
    label: "Testing instructions",
    keywords: ["test", "testing", "ci", "check", "lint"],
    severity: "warning",
  },
  {
    rule: "style",
    label: "Code style & conventions",
    keywords: ["style", "convention", "format", "guideline", "standard"],
    severity: "info",
  },
  {
    rule: "boundaries",
    label: "Constraints / boundaries",
    keywords: ["constraint", "boundar", "do not", "don't", "avoid", "rule", "security"],
    severity: "info",
  },
];

/** Soft size budget: agents pay for every token of context. */
const LINE_BUDGET = 300;

/**
 * Validate a parsed document, optionally resolving `@path` references against
 * a base directory (defaults to the document's own directory).
 */
export function validate(doc: AgentsDoc, baseDir?: string): ValidationResult {
  const findings: Finding[] = [];

  // Rule: at least one heading.
  if (doc.sections.length === 0) {
    findings.push({
      severity: "error",
      rule: "no-headings",
      message: "Document has no Markdown headings; agents rely on sections to navigate it.",
      line: 0,
    });
  }

  // Rule: exactly one top-level (#) title is recommended.
  const h1s = doc.sections.filter((s) => s.level === 1);
  if (doc.sections.length > 0 && h1s.length === 0) {
    findings.push({
      severity: "warning",
      rule: "missing-title",
      message: "No top-level `#` title found; start the file with a single H1 title.",
      line: doc.sections[0]?.line ?? 1,
    });
  } else if (h1s.length > 1) {
    findings.push({
      severity: "warning",
      rule: "multiple-titles",
      message: `Found ${h1s.length} top-level \`#\` titles; use a single H1 and nest with \`##\`.`,
      line: h1s[1]?.line ?? 0,
    });
  }

  // Rule: recommended sections present.
  for (const rec of RECOMMENDED) {
    if (!hasSection(doc.sections, rec.keywords)) {
      findings.push({
        severity: rec.severity,
        rule: `missing-section.${rec.rule}`,
        message: `Consider adding a "${rec.label}" section.`,
        line: 0,
      });
    }
  }

  // Rule: empty sections (heading with no content).
  for (const s of doc.sections) {
    if (s.body.join("").trim() === "") {
      findings.push({
        severity: "info",
        rule: "empty-section",
        message: `Section "${s.title}" is empty.`,
        line: s.line,
      });
    }
  }

  // Rule: size budget.
  if (doc.lineCount > LINE_BUDGET) {
    findings.push({
      severity: "warning",
      rule: "too-large",
      message:
        `Document is ${doc.lineCount} lines (> ${LINE_BUDGET}); large files waste agent ` +
        "context. Split detail into nested AGENTS.md files and link with `@path`.",
      line: 0,
    });
  }

  // Rule: dangling `@path` references.
  const refBase = baseDir ?? (doc.path ? dirname(doc.path) : undefined);
  if (refBase) {
    for (const ref of doc.references) {
      const abs = isAbsolute(ref.target) ? ref.target : resolve(refBase, ref.target);
      if (!safeExists(abs)) {
        findings.push({
          severity: "warning",
          rule: "dangling-reference",
          message: `Referenced file "@${ref.target}" does not exist relative to ${refBase}.`,
          line: ref.line,
        });
      }
    }
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  return {
    path: doc.path,
    findings,
    errors,
    warnings,
    infos,
    ok: errors === 0,
  };
}

/** Parse + validate raw text in one call. */
export function validateText(raw: string, path?: string, baseDir?: string): ValidationResult {
  return validate(parse(raw, path), baseDir);
}

function hasSection(sections: Section[], keywords: string[]): boolean {
  return sections.some((s) => keywords.some((k) => s.slug.includes(k)));
}

function safeExists(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}
