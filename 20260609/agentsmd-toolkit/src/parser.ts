/**
 * A tiny, dependency-free Markdown parser specialised for AGENTS.md documents.
 *
 * It intentionally understands only what the toolkit needs: ATX headings,
 * fenced code blocks, and `@path` file references. Code-block contents are
 * excluded from heading/reference scanning so that examples inside fences do
 * not produce false positives.
 */

import type { AgentsDoc, CodeBlock, FileReference, Section } from "./types.ts";

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;
// `@some/path` — a reference token. Stops at whitespace or common punctuation.
const REFERENCE_RE = /(?<![\w/@])@([A-Za-z0-9._\-/]+)/g;

/** Convert a heading title into a lowercase slug used for fuzzy matching. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Parse AGENTS.md source text into a structured {@link AgentsDoc}.
 *
 * @param raw  The full document text.
 * @param path Optional source path, stored on the result for reporting.
 */
export function parse(raw: string, path?: string): AgentsDoc {
  const lines = raw.split(/\r?\n/);
  const sections: Section[] = [];
  const codeBlocks: CodeBlock[] = [];
  const references: FileReference[] = [];

  let current: Section | null = null;
  let fence: { marker: string; indent: number; block: CodeBlock } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i] ?? "";

    // --- Fenced code blocks -------------------------------------------------
    const fenceMatch = line.match(FENCE_RE);
    if (fence) {
      // Inside a fence: only a matching closing fence ends it.
      if (
        fenceMatch &&
        fenceMatch[2] !== undefined &&
        fenceMatch[2][0] === fence.marker[0] &&
        fenceMatch[2].length >= fence.marker.length &&
        (fenceMatch[3] ?? "").trim() === ""
      ) {
        codeBlocks.push(fence.block);
        if (current) current.body.push(line);
        fence = null;
      } else {
        fence.block.content.push(line);
        if (current) current.body.push(line);
      }
      continue;
    }
    if (fenceMatch && fenceMatch[2]) {
      fence = {
        marker: fenceMatch[2],
        indent: (fenceMatch[1] ?? "").length,
        block: { lang: (fenceMatch[3] ?? "").trim(), line: lineNo, content: [] },
      };
      if (current) current.body.push(line);
      continue;
    }

    // --- Headings -----------------------------------------------------------
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch && headingMatch[1] && headingMatch[2] !== undefined) {
      const title = headingMatch[2].trim();
      current = {
        level: headingMatch[1].length,
        title,
        slug: slugify(title),
        line: lineNo,
        body: [],
      };
      sections.push(current);
    } else if (current) {
      current.body.push(line);
    }

    // --- File references ----------------------------------------------------
    collectReferences(line, lineNo, references);
  }

  return {
    path,
    raw,
    lineCount: lines.length,
    sections,
    codeBlocks,
    references,
  };
}

function collectReferences(line: string, lineNo: number, out: FileReference[]): void {
  // Strip inline code spans (`...`): references shown as examples there are
  // documentation, not real links, and must not count as dangling.
  const scanned = line.replace(/`[^`]*`/g, (s) => " ".repeat(s.length));
  REFERENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REFERENCE_RE.exec(scanned)) !== null) {
    const target = m[1];
    if (!target) continue;
    // Heuristic: ignore things that look like emails or npm scopes handled
    // elsewhere — a real path reference contains a slash or a known md file.
    if (target.includes("/") || /\.(md|markdown|mdx)$/i.test(target)) {
      out.push({ target, line: lineNo });
    }
  }
}
