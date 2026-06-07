/**
 * Test suite — runs with the built-in Node test runner and native TS support:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { embed, cosineSimilarity } from "../src/embedding.ts";
import { retention, reinforcement } from "../src/scoring.ts";
import { ContextGraph } from "../src/contextGraph.ts";
import { AgentMemory, extractEntities } from "../src/memoryStore.ts";

test("embedding: related text scores higher than unrelated", () => {
  const a = embed("the cat sat on the warm mat");
  const b = embed("a cat rested on a mat");
  const c = embed("quarterly financial revenue projections");
  assert.ok(cosineSimilarity(a, b) > cosineSimilarity(a, c));
});

test("embedding: identical text is maximally similar", () => {
  const v = embed("model context protocol");
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-6);
});

test("scoring: retention is monotonically decreasing with age", () => {
  const fresh = retention(0, 0.5, 1000);
  const mid = retention(500, 0.5, 1000);
  const old = retention(5000, 0.5, 1000);
  assert.equal(fresh, 1);
  assert.ok(mid < fresh && old < mid);
});

test("scoring: importance slows decay", () => {
  const trivial = retention(1000, 0.0, 1000);
  const salient = retention(1000, 1.0, 1000);
  assert.ok(salient > trivial);
});

test("scoring: reinforcement increases but saturates below 1", () => {
  assert.ok(reinforcement(5) > reinforcement(1));
  assert.ok(reinforcement(1000) < 1);
});

test("entity extraction: capitalised words and hashtags", () => {
  const e = extractEntities("Deploy Phoenix to GitHub Actions #urgent");
  assert.ok(e.includes("phoenix"));
  assert.ok(e.includes("github"));
  assert.ok(e.includes("urgent"));
});

test("context graph: co-occurring entities become neighbours", () => {
  const g = new ContextGraph();
  g.observe(["phoenix", "deadline"]);
  g.observe(["phoenix", "deadline"]);
  g.observe(["phoenix", "ci"]);
  const n = g.neighbors("phoenix");
  assert.equal(n[0].entity, "deadline");
  assert.equal(n[0].weight, 2);
});

test("recall: returns the most relevant memory first", () => {
  const mem = new AgentMemory();
  mem.remember("The user prefers TypeScript over Rust", { importance: 0.9 });
  mem.remember("The user had lunch", { importance: 0.1 });
  const hits = mem.recall("what language does the user like?", { limit: 1 });
  assert.match(hits[0].record.content, /TypeScript/);
});

test("recall: reinforces accessed memories", () => {
  const mem = new AgentMemory();
  const r = mem.remember("Phoenix ships Friday", { importance: 0.8 });
  assert.equal(r.accessCount, 0);
  mem.recall("when does Phoenix ship?", { limit: 1 });
  assert.equal(r.accessCount, 1);
});

test("recall: graph expansion surfaces associated memories", () => {
  const mem = new AgentMemory();
  mem.remember("Phoenix is the new billing service");
  mem.remember("The deadline is on Friday for Phoenix", { importance: 0.5 });
  // Query mentions Phoenix; graph links Phoenix<->deadline so the deadline
  // memory should rank in the top results.
  const hits = mem.recall("status of Phoenix", { limit: 2 });
  assert.ok(hits.some((h) => /deadline/i.test(h.record.content)));
});

test("consolidate: promotes important memories to semantic", () => {
  const mem = new AgentMemory();
  mem.remember("Critical: API key rotation policy", { importance: 0.95 });
  mem.remember("user said hi", { importance: 0.1 });
  const { promoted } = mem.consolidate();
  assert.equal(promoted.length, 1);
  assert.equal(promoted[0].kind, "semantic");
  assert.equal(mem.byKind("semantic").length, 1);
});

test("consolidate: forgets decayed low-importance memories", () => {
  let now = 0;
  const mem = new AgentMemory({ clock: () => now, halfLifeMs: 1000 });
  mem.remember("trivial passing remark", { importance: 0.0 });
  now += 60_000; // many half-lives later
  const { forgotten } = mem.consolidate({ forgetFloor: 0.05 });
  assert.equal(forgotten.length, 1);
  assert.equal(mem.size, 0);
});

test("consolidate: high-importance memory survives the forget pass", () => {
  let now = 0;
  const mem = new AgentMemory({ clock: () => now, halfLifeMs: 1000 });
  mem.remember("important durable fact", { importance: 0.95 });
  now += 60_000;
  const { promoted, forgotten } = mem.consolidate();
  assert.equal(forgotten.length, 0);
  assert.equal(promoted.length, 1);
});

test("working memory respects capacity", () => {
  const mem = new AgentMemory({ workingCapacity: 3 });
  for (let i = 0; i < 6; i++) mem.remember(`event number ${i}`);
  assert.equal(mem.workingMemory().length, 3);
  // Oldest should have been evicted from the buffer (but still stored).
  assert.match(mem.workingMemory()[2].content, /event number 5/);
  assert.equal(mem.size, 6);
});
