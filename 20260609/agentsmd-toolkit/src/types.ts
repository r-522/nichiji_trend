/**
 * Shared type definitions for agentsmd-toolkit.
 *
 * The AGENTS.md format is "just Markdown", but the toolkit models it as a small
 * structured document so that validation and resolution can reason about it.
 */

/** A single Markdown heading and the raw body text that follows it. */
export interface Section {
  /** Heading depth: 1 for `#`, 2 for `##`, etc. */
  level: number;
  /** Heading text with surrounding whitespace/markers stripped. */
  title: string;
  /** Lowercased title, used for fuzzy matching against recommended sections. */
  slug: string;
  /** 1-based line number of the heading within the source document. */
  line: number;
  /** Raw body lines that belong to this section (until the next heading). */
  body: string[];
}

/** A fenced code block discovered while parsing. */
export interface CodeBlock {
  /** Info string after the opening fence, e.g. "bash" (may be empty). */
  lang: string;
  /** 1-based line number of the opening fence. */
  line: number;
  /** Lines inside the fence (excluding the fences themselves). */
  content: string[];
}

/** An `@path` reference to another file (progressive-disclosure pattern). */
export interface FileReference {
  /** The referenced path exactly as written, without the leading `@`. */
  target: string;
  /** 1-based line number where the reference appears. */
  line: number;
}

/** A fully parsed AGENTS.md document. */
export interface AgentsDoc {
  /** Absolute or relative path the document was read from (if any). */
  path?: string;
  /** Raw source text. */
  raw: string;
  /** Total number of lines. */
  lineCount: number;
  /** All headings in document order. */
  sections: Section[];
  /** All fenced code blocks in document order. */
  codeBlocks: CodeBlock[];
  /** All `@path` references in document order. */
  references: FileReference[];
}

export type Severity = "error" | "warning" | "info";

/** A single finding produced by the validator. */
export interface Finding {
  severity: Severity;
  /** Stable rule identifier, e.g. "missing-section.testing". */
  rule: string;
  message: string;
  /** 1-based line number the finding relates to (0 if document-wide). */
  line: number;
}

export interface ValidationResult {
  path?: string;
  findings: Finding[];
  /** Convenience counts by severity. */
  errors: number;
  warnings: number;
  infos: number;
  /** True when there are no error-severity findings. */
  ok: boolean;
}

/** One layer in a monorepo nearest-file resolution chain. */
export interface ResolvedLayer {
  /** Path to the AGENTS.md file for this layer. */
  path: string;
  /** Directory depth from the resolution root (root = 0). */
  depth: number;
  /**
   * Merge precedence: higher wins. The file closest to the working directory
   * has the highest precedence, matching how agents combine instructions.
   */
  precedence: number;
}

export interface ResolutionResult {
  /** The directory resolution started from (the "working directory"). */
  from: string;
  /** The outermost directory the walk stopped at (the resolution root). */
  root: string;
  /**
   * Layers ordered from root (lowest precedence) to nearest the working
   * directory (highest precedence) — i.e. application/merge order.
   */
  layers: ResolvedLayer[];
}
