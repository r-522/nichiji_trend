/**
 * Scan orchestration: collect dependencies, run them through every heuristic,
 * and produce a {@link ScanReport}.
 */
import { collect } from "./collect.js";
import {
  aggregate,
  detectConflation,
  detectInstallScriptName,
  detectRegistry,
  detectTyposquat,
  detectUnknownOffline,
  isKnown,
  isNodeBuiltin,
} from "./heuristics.js";
import { getRegistryFacts } from "./registry.js";
import type { Finding, ScanReport, Severity, Signal } from "./types.js";

export interface ScanOptions {
  /** Query the live npm registry for existence / age / downloads. */
  online?: boolean;
  /** Walk source files for import/require specifiers (default true). */
  scanSources?: boolean;
  /** Concurrency for registry lookups in online mode. */
  concurrency?: number;
  /** Clock injection point for tests. */
  now?: Date;
}

function emptySummary(): Record<Severity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

/** Run a list of async tasks with bounded concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function scan(target: string, options: ScanOptions = {}): Promise<ScanReport> {
  const { online = false, scanSources = true, concurrency = 8, now = new Date() } = options;

  const { deps, manifestInstallHooks } = await collect(target, scanSources);
  const installHookSignal = detectInstallScriptName(manifestInstallHooks);

  const findings: Finding[] = await mapLimit(deps, online ? concurrency : 1, async (dep) => {
    const signals: Signal[] = [];

    // Built-ins and known-good packages short-circuit to a clean finding.
    if (isNodeBuiltin(dep.name) || isKnown(dep.name)) {
      return blankFinding(dep);
    }

    if (online) {
      const facts = await getRegistryFacts(dep.name);
      signals.push(...detectRegistry(facts, now));
    } else {
      const unknown = detectUnknownOffline(dep.name);
      if (unknown) signals.push(unknown);
    }

    const conflation = detectConflation(dep.name);
    if (conflation) signals.push(conflation);
    const typo = detectTyposquat(dep.name);
    if (typo) signals.push(typo);

    // Surface the project's own install hooks against unknown deps once.
    if (installHookSignal) signals.push(installHookSignal);

    const { riskScore, severity } = aggregate(signals);
    return {
      package: dep.name,
      range: dep.range,
      origins: dep.origins,
      riskScore,
      severity,
      signals,
    };
  });

  // Only keep packages that actually raised at least one signal.
  const flagged = findings.filter((f) => f.signals.length > 0);
  flagged.sort((a, b) => b.riskScore - a.riskScore);

  const summary = emptySummary();
  for (const f of flagged) summary[f.severity]++;

  return {
    scannedAt: now.toISOString(),
    projectPath: target,
    online,
    totalDependencies: deps.length,
    findings: flagged,
    summary,
  };
}

function blankFinding(dep: { name: string; range?: string; origins: any }): Finding {
  return {
    package: dep.name,
    range: dep.range,
    origins: dep.origins,
    riskScore: 0,
    severity: "info",
    signals: [],
  };
}
