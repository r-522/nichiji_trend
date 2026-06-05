/** Shared diagnostic types used by the validator and linter. */

export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: Severity;
  /** Stable machine-readable rule id, e.g. "name/pattern". */
  rule: string;
  message: string;
  /** Path of the file the diagnostic refers to. */
  file: string;
  /** 1-based line number, when known. */
  line?: number;
}

export interface SkillReport {
  /** Absolute or relative path to the skill directory (or SKILL.md). */
  path: string;
  /** Parsed skill name, when it could be read. */
  name?: string;
  diagnostics: Diagnostic[];
  get ok(): boolean;
}

export function makeReport(path: string, diagnostics: Diagnostic[], name?: string): SkillReport {
  return {
    path,
    name,
    diagnostics,
    get ok() {
      return !this.diagnostics.some((d) => d.severity === "error");
    },
  };
}

export function countBySeverity(diagnostics: Diagnostic[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) counts[d.severity]++;
  return counts;
}
