/**
 * Core data model for slopguard.
 *
 * A scan walks a project's declared and imported dependencies, runs every
 * package name through a set of heuristics, and produces a list of findings.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

/** Where a dependency reference was discovered. */
export type DependencyOrigin =
  | "package.json:dependencies"
  | "package.json:devDependencies"
  | "package.json:optionalDependencies"
  | "package.json:peerDependencies"
  | "source-import";

export interface DependencyRef {
  /** The bare package name, e.g. "react" or "@scope/name". */
  name: string;
  /** Declared version range, when known (source imports have none). */
  range?: string;
  /** All locations this package was referenced from. */
  origins: DependencyOrigin[];
}

/** A single rule's verdict about one package. */
export interface Signal {
  /** Stable rule identifier, e.g. "conflation". */
  rule: string;
  severity: Severity;
  /** Human-readable explanation of why the rule fired. */
  message: string;
  /** Numeric contribution to the package's risk score (0-100). */
  score: number;
}

/** Aggregated result for one package. */
export interface Finding {
  package: string;
  range?: string;
  origins: DependencyOrigin[];
  /** Combined 0-100 risk score (capped). */
  riskScore: number;
  severity: Severity;
  signals: Signal[];
}

export interface ScanReport {
  scannedAt: string;
  projectPath: string;
  online: boolean;
  totalDependencies: number;
  findings: Finding[];
  /** Count of findings by severity. */
  summary: Record<Severity, number>;
}

/** Optional registry facts about a package, gathered in --online mode. */
export interface RegistryFacts {
  exists: boolean;
  /** ISO date of the package's very first publish, if known. */
  createdAt?: string;
  /** Approximate downloads in the last week. */
  weeklyDownloads?: number;
  /** True if the latest version declares an install-time lifecycle script. */
  hasInstallScript?: boolean;
}
