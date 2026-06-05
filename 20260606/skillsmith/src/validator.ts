/** Spec-conformance validation for SKILL.md files and skill bundles. */

import { readFileSync, statSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseDocument, FrontmatterError, type Frontmatter } from "./frontmatter.ts";
import {
  NAME_MAX,
  NAME_PATTERN,
  DESCRIPTION_MAX,
  COMPATIBILITY_MAX,
  KNOWN_FIELDS,
  REQUIRED_FIELDS,
} from "./spec.ts";
import { makeReport, type Diagnostic, type SkillReport } from "./diagnostics.ts";

/**
 * Resolve a user-supplied path to the SKILL.md file plus the directory whose
 * name the `name` field must match. Accepts either a SKILL.md file or the
 * directory that contains one.
 */
export function resolveSkillPath(target: string): { skillFile: string; skillDir: string } {
  const st = statSync(target);
  if (st.isDirectory()) {
    return { skillFile: join(target, "SKILL.md"), skillDir: target };
  }
  return { skillFile: target, skillDir: dirname(target) };
}

function expectScalar(
  fm: Frontmatter,
  key: string,
  file: string,
  line: number,
  diags: Diagnostic[],
): string | null {
  const value = fm[key];
  if (typeof value !== "string") {
    diags.push({
      severity: "error",
      rule: `${key}/type`,
      message: `\`${key}\` must be a scalar string`,
      file,
      line,
    });
    return null;
  }
  return value;
}

export function validateSkill(target: string): SkillReport {
  const diags: Diagnostic[] = [];
  let skillFile: string;
  let skillDir: string;

  try {
    ({ skillFile, skillDir } = resolveSkillPath(target));
  } catch {
    diags.push({
      severity: "error",
      rule: "io/not-found",
      message: `path does not exist: ${target}`,
      file: target,
    });
    return makeReport(target, diags);
  }

  if (!existsSync(skillFile)) {
    diags.push({
      severity: "error",
      rule: "io/no-skill-md",
      message: `SKILL.md not found at ${skillFile}`,
      file: skillFile,
    });
    return makeReport(target, diags);
  }

  let parsed;
  try {
    parsed = parseDocument(readFileSync(skillFile, "utf8"));
  } catch (err) {
    if (err instanceof FrontmatterError) {
      diags.push({
        severity: "error",
        rule: "frontmatter/parse",
        message: err.message,
        file: skillFile,
        line: err.line,
      });
    } else {
      diags.push({
        severity: "error",
        rule: "io/read",
        message: `could not read file: ${(err as Error).message}`,
        file: skillFile,
      });
    }
    return makeReport(target, diags);
  }

  const fm = parsed.frontmatter;
  if (fm === null) {
    diags.push({
      severity: "error",
      rule: "frontmatter/missing",
      message: "missing YAML front matter; SKILL.md must start with a `---` block",
      file: skillFile,
      line: 1,
    });
    return makeReport(target, diags);
  }

  const fmLine = parsed.frontmatterStartLine;

  // Required fields present.
  for (const field of REQUIRED_FIELDS) {
    if (!(field in fm)) {
      diags.push({
        severity: "error",
        rule: `${field}/required`,
        message: `missing required field \`${field}\``,
        file: skillFile,
        line: fmLine,
      });
    }
  }

  // name
  let name: string | undefined;
  if ("name" in fm) {
    const value = expectScalar(fm, "name", skillFile, fmLine, diags);
    if (value !== null) {
      name = value;
      if (value.length === 0) {
        diags.push({
          severity: "error",
          rule: "name/empty",
          message: "`name` must not be empty",
          file: skillFile,
          line: fmLine,
        });
      } else {
        if (value.length > NAME_MAX) {
          diags.push({
            severity: "error",
            rule: "name/length",
            message: `\`name\` is ${value.length} chars; max is ${NAME_MAX}`,
            file: skillFile,
            line: fmLine,
          });
        }
        if (!NAME_PATTERN.test(value)) {
          diags.push({
            severity: "error",
            rule: "name/pattern",
            message:
              "`name` must be lowercase letters, numbers and single hyphens " +
              "(no leading/trailing/double hyphen)",
            file: skillFile,
            line: fmLine,
          });
        }
        const folder = basename(skillDir);
        if (NAME_PATTERN.test(value) && folder !== value) {
          diags.push({
            severity: "error",
            rule: "name/folder-match",
            message: `\`name\` ("${value}") must match the skill folder name ("${folder}")`,
            file: skillFile,
            line: fmLine,
          });
        }
      }
    }
  }

  // description
  if ("description" in fm) {
    const value = expectScalar(fm, "description", skillFile, fmLine, diags);
    if (value !== null) {
      if (value.trim().length === 0) {
        diags.push({
          severity: "error",
          rule: "description/empty",
          message: "`description` must not be empty",
          file: skillFile,
          line: fmLine,
        });
      } else if (value.length > DESCRIPTION_MAX) {
        diags.push({
          severity: "error",
          rule: "description/length",
          message: `\`description\` is ${value.length} chars; max is ${DESCRIPTION_MAX}`,
          file: skillFile,
          line: fmLine,
        });
      }
    }
  }

  // compatibility (optional)
  if ("compatibility" in fm) {
    const value = expectScalar(fm, "compatibility", skillFile, fmLine, diags);
    if (value !== null && value.length > COMPATIBILITY_MAX) {
      diags.push({
        severity: "error",
        rule: "compatibility/length",
        message: `\`compatibility\` is ${value.length} chars; max is ${COMPATIBILITY_MAX}`,
        file: skillFile,
        line: fmLine,
      });
    }
  }

  // metadata (optional) must be a mapping if present.
  if ("metadata" in fm && typeof fm.metadata === "string" && fm.metadata.length > 0) {
    diags.push({
      severity: "error",
      rule: "metadata/type",
      message: "`metadata` must be a mapping of key/value pairs",
      file: skillFile,
      line: fmLine,
    });
  }

  // Unknown fields are allowed by the spec but worth surfacing.
  for (const key of Object.keys(fm)) {
    if (!KNOWN_FIELDS.includes(key as (typeof KNOWN_FIELDS)[number])) {
      diags.push({
        severity: "info",
        rule: "frontmatter/unknown-field",
        message: `unknown front matter field \`${key}\` (allowed, but not part of the core spec)`,
        file: skillFile,
        line: fmLine,
      });
    }
  }

  // Body must be non-empty: the instructions are the point of a skill.
  if (parsed.body.trim().length === 0) {
    diags.push({
      severity: "error",
      rule: "body/empty",
      message: "SKILL.md has no instructional body after the front matter",
      file: skillFile,
      line: parsed.bodyStartLine,
    });
  }

  return makeReport(target, diags, name);
}
