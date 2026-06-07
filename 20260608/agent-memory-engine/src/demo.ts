/**
 * End-to-end demo: a coding assistant that remembers across sessions.
 *
 * Run with:   npm run demo     (or: node src/demo.ts)
 *
 * We drive the engine with a simulated clock so the forgetting curve and the
 * consolidation pass produce visible, deterministic results in a few seconds.
 */

import { AgentMemory } from "./memoryStore.ts";
import type { RetrievalResult } from "./types.ts";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// A mutable virtual clock so we can fast-forward through "time".
let virtualNow = Date.parse("2026-06-08T09:00:00+09:00");
const clock = () => virtualNow;
const advance = (ms: number) => {
  virtualNow += ms;
};

const mem = new AgentMemory({ clock, halfLifeMs: 30 * MINUTE, workingCapacity: 4 });

function line(char = "─", n = 64): string {
  return char.repeat(n);
}

function printResults(query: string, results: RetrievalResult[]): void {
  console.log(`\n🔎  recall("${query}")`);
  if (results.length === 0) {
    console.log("    (no memories)");
    return;
  }
  for (const { record, score } of results) {
    console.log(
      `   [${record.kind.padEnd(8)}] ${score.total.toFixed(3)}  ${record.content}`,
    );
    console.log(
      `              rel=${score.relevance.toFixed(2)} rec=${score.recency.toFixed(
        2,
      )} imp=${score.importance.toFixed(2)} rnf=${score.reinforcement.toFixed(2)}`,
    );
  }
}

console.log(line("═"));
console.log("  Agent Memory Engine — coding-assistant simulation");
console.log(line("═"));

// ── Session 1: morning planning chat ──────────────────────────────────────
console.log("\n● SESSION 1  (09:00 JST) — project kickoff\n");
mem.remember("The user prefers TypeScript and dislikes writing Rust.", {
  importance: 0.9,
  metadata: { source: "session-1" },
});
mem.remember("We are building the Phoenix billing service.", { importance: 0.8 });
mem.remember("Phoenix must ship before the Friday deadline.", { importance: 0.85 });
mem.remember("The user grabbed a coffee.", { importance: 0.1 });
mem.remember("CI is run on GitHub Actions for the Phoenix repo.", { importance: 0.6 });
mem.remember("The user mentioned it is raining outside.", { importance: 0.05 });

console.log("  stored 6 observations. working buffer (most recent):");
for (const r of mem.workingMemory()) console.log(`    • ${r.content}`);
console.log("\n  stats:", mem.stats());

// Relevance retrieval.
printResults("which programming language should I use?", mem.recall("which programming language should I use?", { limit: 2 }));

// Associative retrieval via the context graph: asking about "Phoenix" should
// surface the deadline and CI even without lexical overlap with "deadline".
printResults("tell me about the Phoenix project", mem.recall("tell me about the Phoenix project", { limit: 3 }));

console.log(`\n  context-graph neighbours of "phoenix":`);
for (const n of mem.graph.neighbors("phoenix")) {
  console.log(`    → ${n.entity} (w=${n.weight})`);
}

// ── 4 hours pass, then a consolidation pass ("the agent sleeps") ───────────
advance(4 * HOUR);
console.log("\n" + line());
console.log("● 4 hours later — running consolidation (the agent 'sleeps')");
console.log(line());

// Recall the key fact a few times first so reinforcement promotes it too.
mem.recall("does the user like rust?");
mem.recall("user language preference");

const { promoted, forgotten } = mem.consolidate();
console.log("\n  promoted to semantic (durable):");
for (const r of promoted) console.log(`    ✓ ${r.content}`);
console.log("  forgotten (decayed below floor):");
for (const r of forgotten) console.log(`    ✗ ${r.content}`);
console.log("\n  stats:", mem.stats());

// ── Session 2: next day, the assistant still "knows" the durable facts ─────
advance(20 * HOUR);
console.log("\n" + line());
console.log("● SESSION 2  (next day) — long-term recall");
console.log(line());

printResults("remind me what the user thinks about Rust", mem.recall("remind me what the user thinks about Rust", { limit: 2 }));
printResults("what was that trivia about the weather?", mem.recall("what was that trivia about the weather?", { limit: 2 }));

console.log("\n" + line("═"));
console.log("  Takeaway: salient + reinforced facts survived to semantic memory;");
console.log("  low-importance trivia decayed away — memory, not the model, is the product.");
console.log(line("═"));
