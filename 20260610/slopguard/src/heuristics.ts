/**
 * Offline heuristics for spotting hallucinated / slopsquatted package names.
 *
 * Each heuristic is a pure function from a package name (plus optional registry
 * facts) to zero or one {@link Signal}. Keeping them pure makes them trivial to
 * unit-test and to compose in the scanner.
 */
import type { RegistryFacts, Severity, Signal } from "./types.js";
import { KNOWN_PACKAGES, KNOWN_PACKAGE_SET } from "./knownPackages.js";

/** Node.js built-in modules — never registry packages, so never flagged. */
const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "cluster", "console", "crypto",
  "dgram", "dns", "events", "fs", "http", "http2", "https", "net", "os",
  "path", "perf_hooks", "process", "querystring", "readline", "stream",
  "string_decoder", "timers", "tls", "tty", "url", "util", "v8", "vm",
  "worker_threads", "zlib", "async_hooks", "diagnostics_channel",
]);

export function isNodeBuiltin(name: string): boolean {
  const bare = name.startsWith("node:") ? name.slice(5) : name;
  return NODE_BUILTINS.has(bare);
}

export function isKnown(name: string): boolean {
  return KNOWN_PACKAGE_SET.has(name.toLowerCase());
}

/** Classic Levenshtein edit distance, capped early for speed. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

/** Strip an npm scope ("@scope/name" -> "name"). */
function unscope(name: string): string {
  const slash = name.indexOf("/");
  return name.startsWith("@") && slash !== -1 ? name.slice(slash + 1) : name;
}

/** Break a package name into lowercase word tokens on common separators. */
export function tokenize(name: string): string[] {
  return unscope(name)
    .toLowerCase()
    .split(/[-_.]+/)
    .filter((t) => t.length > 0);
}

/**
 * Conflation: hallucinated names are frequently two real package names mashed
 * together. We flag a name when its tokens are covered by tokens drawn from at
 * least two *different* known packages, and the name itself is unknown.
 *
 * Example: "react-codeshift" -> "react"/"codemod" tokens overlap "react-codemod"
 * and "codeshift" overlaps "jscodeshift" -> conflation.
 */
const KNOWN_TOKEN_INDEX: Map<string, Set<string>> = (() => {
  const idx = new Map<string, Set<string>>();
  for (const pkg of KNOWN_PACKAGES) {
    for (const tok of tokenize(pkg)) {
      if (tok.length < 3) continue; // ignore noise tokens like "js", "io"
      let set = idx.get(tok);
      if (!set) idx.set(tok, (set = new Set()));
      set.add(pkg.toLowerCase());
    }
  }
  return idx;
})();

/** Pre-computed (package, unscoped-name) pairs for substring matching. */
const KNOWN_UNSCOPED: ReadonlyArray<readonly [string, string]> = KNOWN_PACKAGES.map(
  (p) => [p.toLowerCase(), unscope(p).toLowerCase()] as const,
);

/**
 * Decide whether a single token clearly originates from a known package.
 * Returns the owning package name, or null. A token counts when it either
 * exactly matches a known token, or has a >=5-char overlap (substring in
 * either direction) with a known package name — this is what lets "codeshift"
 * resolve to "jscodeshift".
 */
function tokenSource(tok: string): string | null {
  const owners = KNOWN_TOKEN_INDEX.get(tok);
  if (owners) return owners.values().next().value ?? null;
  if (tok.length < 5) return null;
  for (const [pkg, bare] of KNOWN_UNSCOPED) {
    if (bare.length < 5) continue;
    if ((bare.includes(tok) || tok.includes(bare)) && Math.min(bare.length, tok.length) >= 5) {
      return pkg;
    }
  }
  return null;
}

export function detectConflation(name: string): Signal | null {
  if (isKnown(name)) return null;
  const tokens = tokenize(name).filter((t) => t.length >= 3);
  if (tokens.length < 2) return null;

  const sources = new Set<string>();
  let covered = 0;
  for (const tok of tokens) {
    const src = tokenSource(tok);
    if (src) {
      covered++;
      sources.add(src);
    }
  }
  // Every token must trace to a known package, drawn from >=2 distinct sources.
  if (covered === tokens.length && sources.size >= 2) {
    const sample = [...sources].slice(0, 3).join(", ");
    return {
      rule: "conflation",
      severity: "high",
      score: 55,
      message: `Name looks composed of fragments of multiple real packages (${sample}); a classic AI name-conflation hallucination pattern.`,
    };
  }
  return null;
}

/**
 * Typosquat / slopsquat: very close (1-2 edits) to a popular package but not an
 * exact match. The closer the edit distance, the higher the score.
 */
export function detectTyposquat(name: string): Signal | null {
  if (isKnown(name)) return null;
  const bare = unscope(name).toLowerCase();
  if (bare.length < 4) return null;

  let best: { target: string; dist: number } | null = null;
  for (const known of KNOWN_PACKAGES) {
    const target = unscope(known).toLowerCase();
    if (target === bare) return null; // unscoped exact match -> treat as known
    if (Math.abs(target.length - bare.length) > 2) continue;
    const dist = levenshtein(bare, target, 2);
    if (dist <= 2 && (!best || dist < best.dist)) {
      best = { target: known, dist };
      if (dist === 1) break;
    }
  }
  if (!best) return null;
  const severity: Severity = best.dist === 1 ? "high" : "medium";
  return {
    rule: "typosquat",
    severity,
    score: best.dist === 1 ? 50 : 35,
    message: `Name is ${best.dist} edit(s) away from popular package "${best.target}" — possible typo/slop-squat.`,
  };
}

/**
 * Phantom package: in offline mode we cannot prove non-existence, but a name
 * that is neither known nor close to anything known and is *not* scoped earns a
 * low-confidence "unknown" note. In online mode this is replaced by a hard
 * existence check (see {@link detectRegistry}).
 */
export function detectUnknownOffline(name: string): Signal | null {
  if (isKnown(name)) return null;
  return {
    rule: "unknown-offline",
    severity: "info",
    score: 8,
    message:
      "Package is not in slopguard's known-good list. Run with --online to verify it actually exists on the registry.",
  };
}

/** Suspicious lifecycle hooks that run automatically on `npm install`. */
const INSTALL_HOOKS = ["preinstall", "install", "postinstall"];

export function detectInstallScriptName(scriptKeys: string[]): Signal | null {
  const hooks = scriptKeys.filter((k) => INSTALL_HOOKS.includes(k));
  if (hooks.length === 0) return null;
  return {
    rule: "install-hook",
    severity: "medium",
    score: 20,
    message: `Declares install-time lifecycle script(s): ${hooks.join(", ")}. Install hooks are the primary execution vector in recent npm supply-chain worms.`,
  };
}

/** Registry-backed signals, only available in --online mode. */
export function detectRegistry(
  facts: RegistryFacts,
  now: Date = new Date(),
): Signal[] {
  const signals: Signal[] = [];
  if (!facts.exists) {
    signals.push({
      rule: "phantom",
      severity: "critical",
      score: 90,
      message:
        "Package does not exist on the npm registry — a hallucinated dependency. If an attacker registers this name, your install pulls their code.",
    });
    return signals; // nothing else matters if it doesn't exist
  }
  if (facts.createdAt) {
    const ageDays = (now.getTime() - new Date(facts.createdAt).getTime()) / 86_400_000;
    if (ageDays >= 0 && ageDays < 30) {
      signals.push({
        rule: "newly-registered",
        severity: "high",
        score: 45,
        message: `Package was first published only ${Math.round(ageDays)} day(s) ago. Freshly-registered names matching hallucinations are a hallmark of slopsquatting.`,
      });
    }
  }
  if (typeof facts.weeklyDownloads === "number" && facts.weeklyDownloads < 50) {
    signals.push({
      rule: "low-adoption",
      severity: "medium",
      score: 25,
      message: `Very low adoption (~${facts.weeklyDownloads} weekly downloads). Legitimate dependencies suggested by AI are usually far more popular.`,
    });
  }
  if (facts.hasInstallScript) {
    signals.push({
      rule: "registry-install-hook",
      severity: "high",
      score: 40,
      message:
        "Latest published version runs an install-time lifecycle script — the execution vector used by the Miasma/axios-style npm worms.",
    });
  }
  return signals;
}

const SEVERITY_ORDER: Severity[] = ["info", "low", "medium", "high", "critical"];

/** Roll a set of signals into an overall risk score and severity. */
export function aggregate(signals: Signal[]): { riskScore: number; severity: Severity } {
  if (signals.length === 0) return { riskScore: 0, severity: "info" };
  const riskScore = Math.min(100, signals.reduce((s, sig) => s + sig.score, 0));
  let worst: Severity = "info";
  for (const sig of signals) {
    if (SEVERITY_ORDER.indexOf(sig.severity) > SEVERITY_ORDER.indexOf(worst)) {
      worst = sig.severity;
    }
  }
  // Let an extreme aggregate score promote severity (many medium signals add up).
  let severity = worst;
  if (riskScore >= 80 && SEVERITY_ORDER.indexOf(severity) < SEVERITY_ORDER.indexOf("critical")) {
    severity = "critical";
  } else if (riskScore >= 50 && SEVERITY_ORDER.indexOf(severity) < SEVERITY_ORDER.indexOf("high")) {
    severity = "high";
  }
  return { riskScore, severity };
}
