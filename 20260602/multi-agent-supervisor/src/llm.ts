/**
 * Deterministic mock LLM. Real frameworks (LangGraph, Mastra, Microsoft
 * Agent Framework) call an actual model here; we keep the contract identical
 * — string in, structured JSON out — so swapping in a real client is a
 * one-file change.
 */

export interface RouteCandidate {
  name: string;
  description: string;
}

export interface RouteRequest {
  task: string;
  candidates: RouteCandidate[];
  alreadyVisited: ReadonlySet<string>;
  artifactKinds: ReadonlyArray<string>;
}

export interface RouteResponse {
  next: string | "FINISH";
  reason: string;
}

const KEYWORDS: Record<string, string[]> = {
  researcher: [
    "research", "investigate", "find", "look up", "background", "trend",
    "調査", "リサーチ", "調べ", "動向",
  ],
  coder: [
    "code", "implement", "function", "snippet", "sample", "script", "demo",
    "実装", "コード", "サンプル",
  ],
  writer: [
    "summarize", "summary", "report", "write", "explain", "draft",
    "まとめ", "要約", "レポート", "解説",
  ],
};

function score(text: string, name: string): number {
  const lower = text.toLowerCase();
  const kws = KEYWORDS[name] ?? [];
  let n = 0;
  for (const kw of kws) if (lower.includes(kw)) n += 1;
  return n;
}

/**
 * Workers may declare dependencies on artifact kinds. The supervisor will
 * not route to a worker whose dependencies are not yet in the state.
 * The writer synthesises prior artifacts, so it must wait for research.
 */
const DEPENDENCIES: Record<string, ReadonlyArray<string>> = {
  researcher: [],
  coder: [],
  writer: ["research"],
};

const CANONICAL_ORDER = ["researcher", "coder", "writer"] as const;

function depsSatisfied(name: string, artifactKinds: ReadonlyArray<string>): boolean {
  const deps = DEPENDENCIES[name] ?? [];
  return deps.every((d) => artifactKinds.includes(d));
}

/**
 * Pick the next worker. A real LLM-backed supervisor would emit JSON like
 * {"next": "...", "reason": "..."}; we reproduce the same shape.
 *
 * Policy:
 *   1. FINISH once the writer has produced a report.
 *   2. Otherwise, consider only unvisited workers whose dependencies are
 *      already satisfied by the artifacts in state.
 *   3. Among eligible candidates, prefer the one with the highest keyword
 *      score against the task; break ties by canonical order
 *      (researcher → coder → writer).
 *   4. If no eligible candidate exists, FINISH (deadlock guard).
 */
export async function routeWithMockLLM(
  req: RouteRequest,
): Promise<RouteResponse> {
  const { task, candidates, alreadyVisited, artifactKinds } = req;

  if (artifactKinds.includes("report")) {
    return {
      next: "FINISH",
      reason: "writer has produced a report; nothing left to dispatch",
    };
  }

  const eligible = candidates.filter(
    (c) => !alreadyVisited.has(c.name) && depsSatisfied(c.name, artifactKinds),
  );

  if (eligible.length === 0) {
    return {
      next: "FINISH",
      reason: "no eligible unvisited workers remain",
    };
  }

  const ranked = [...eligible]
    .map((c) => ({
      c,
      kw: score(task, c.name),
      ord: CANONICAL_ORDER.indexOf(c.name as (typeof CANONICAL_ORDER)[number]),
    }))
    .sort((a, b) => {
      if (b.kw !== a.kw) return b.kw - a.kw;
      return a.ord - b.ord;
    });

  const top = ranked[0]!;
  const reason = top.kw > 0
    ? `task mentions ${top.c.name} keywords (score=${top.kw})`
    : `canonical pipeline order (research → code → write); picked ${top.c.name}`;
  return { next: top.c.name, reason };
}
