/**
 * Minimal, dependency-free YAML front matter parser for SKILL.md files.
 *
 * It deliberately supports only the subset of YAML that the Agent Skills
 * specification uses in practice:
 *   - top-level `key: value` scalar pairs (quoted or bare)
 *   - one level of nested mappings (used by `metadata:`)
 *   - `# comments` and blank lines
 *
 * This keeps `skillsmith` install-free while still parsing every real-world
 * SKILL.md front matter we have encountered. Anything more exotic is reported
 * as a parse error rather than silently mishandled.
 */

export type FrontmatterValue = string | Record<string, string>;
export type Frontmatter = Record<string, FrontmatterValue>;

export interface ParsedDocument {
  /** Parsed front matter mapping, or `null` when no `---` block is present. */
  frontmatter: Frontmatter | null;
  /** 1-based line number where the front matter mapping starts (after `---`). */
  frontmatterStartLine: number;
  /** The markdown body that follows the closing `---`. */
  body: string;
  /** 1-based line number where the body starts. */
  bodyStartLine: number;
}

export class FrontmatterError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(message);
    this.name = "FrontmatterError";
  }
}

const DELIMITER = "---";

/** Strip a trailing inline `# comment` that is not inside quotes. */
function stripInlineComment(value: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble) {
      // A `#` only starts a comment when preceded by whitespace (or at start).
      if (i === 0 || /\s/.test(value[i - 1]!)) return value.slice(0, i);
    }
  }
  return value;
}

/** Unquote and unescape a scalar value. */
function parseScalar(raw: string): string {
  const value = stripInlineComment(raw).trim();
  if (value.length === 0) return "";
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function indentOf(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1]!.length : 0;
}

/**
 * Parse a SKILL.md (or any markdown) document into front matter + body.
 * Returns `frontmatter: null` if the file does not open with a `---` block.
 */
export function parseDocument(source: string): ParsedDocument {
  // Normalise newlines and a possible UTF-8 BOM.
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");

  if (lines[0]?.trim() !== DELIMITER) {
    return {
      frontmatter: null,
      frontmatterStartLine: 0,
      body: text,
      bodyStartLine: 1,
    };
  }

  // Find the closing delimiter.
  let closing = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === DELIMITER) {
      closing = i;
      break;
    }
  }
  if (closing === -1) {
    throw new FrontmatterError(
      "front matter opened with `---` but no closing `---` was found",
      1,
    );
  }

  const fm: Frontmatter = {};
  let currentMapKey: string | null = null;

  for (let i = 1; i < closing; i++) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const indent = indentOf(rawLine);

    if (indent > 0) {
      // Nested entry (e.g. inside `metadata:`).
      if (currentMapKey === null) {
        throw new FrontmatterError(
          `unexpected indentation; nested values must belong to a mapping key`,
          i + 1,
        );
      }
      const colon = trimmed.indexOf(":");
      if (colon === -1) {
        throw new FrontmatterError(
          `expected "key: value" inside "${currentMapKey}"`,
          i + 1,
        );
      }
      const key = trimmed.slice(0, colon).trim();
      const value = parseScalar(trimmed.slice(colon + 1));
      (fm[currentMapKey] as Record<string, string>)[key] = value;
      continue;
    }

    // Top-level entry.
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      throw new FrontmatterError(`expected "key: value" mapping`, i + 1);
    }
    const key = trimmed.slice(0, colon).trim();
    const rest = trimmed.slice(colon + 1);

    if (key.length === 0) {
      throw new FrontmatterError("empty key in front matter", i + 1);
    }
    if (key in fm) {
      throw new FrontmatterError(`duplicate key "${key}"`, i + 1);
    }

    if (rest.trim() === "") {
      // Opens a nested mapping (e.g. `metadata:`).
      fm[key] = {};
      currentMapKey = key;
    } else {
      fm[key] = parseScalar(rest);
      currentMapKey = null;
    }
  }

  return {
    frontmatter: fm,
    frontmatterStartLine: 2,
    body: lines.slice(closing + 1).join("\n"),
    bodyStartLine: closing + 2,
  };
}
