import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SkillForge } from "../src/forge.js";
import {
  computeConfidence,
  normalizeTask,
  skillId,
  distillProcedure,
} from "../src/compiler.js";
import { cosineSimilarity, tokenize } from "../src/similarity.js";
import type { Trajectory } from "../src/types.js";

function traj(over: Partial<Trajectory> = {}): Trajectory {
  return {
    task: "Fix failing unit tests in a Python project",
    tags: ["python"],
    success: true,
    steps: [
      { action: "run_tests", observation: "fail" },
      { action: "patch_code", observation: "fixed" },
      { action: "run_tests", observation: "pass" },
    ],
    ...over,
  };
}

test("tokenize lowercases, splits and drops stop words", () => {
  assert.deepEqual(tokenize("Fix the FAILING tests!"), ["fix", "failing", "tests"]);
});

test("cosineSimilarity is 1 for identical text and 0 for disjoint text", () => {
  assert.ok(Math.abs(cosineSimilarity("run the tests", "run the tests") - 1) < 1e-9);
  assert.equal(cosineSimilarity("python tests", "kubernetes cluster"), 0);
});

test("normalizeTask is order-insensitive so equivalent tasks collide", () => {
  assert.equal(
    normalizeTask("Fix failing python tests"),
    normalizeTask("python tests failing fix"),
  );
  assert.equal(
    skillId("Fix failing python tests"),
    skillId("python tests failing fix"),
  );
});

test("computeConfidence starts at 0.5 and moves with evidence", () => {
  assert.equal(computeConfidence(0, 0), 0.5);
  assert.ok(computeConfidence(5, 0) > 0.8);
  assert.ok(computeConfidence(0, 5) < 0.2);
});

test("distillProcedure dedupes repeated actions while preserving order", () => {
  assert.deepEqual(distillProcedure(traj()), ["run_tests", "patch_code"]);
});

test("observe compiles a new skill then reinforces it", () => {
  return withForge(async (forge) => {
    const first = forge.observe(traj());
    assert.equal(first.successes, 1);
    assert.equal(first.failures, 0);

    const second = forge.observe(traj({ success: false, steps: [] }));
    assert.equal(second.id, first.id, "same task => same skill");
    assert.equal(second.successes, 1);
    assert.equal(second.failures, 1);
    assert.equal(forge.size, 1, "no duplicate skill created");
  });
});

test("reinforcement adopts a longer successful procedure", () => {
  return withForge(async (forge) => {
    forge.observe(traj({ steps: [{ action: "run_tests", observation: "x" }] }));
    const richer = forge.observe(
      traj({
        steps: [
          { action: "run_tests", observation: "x" },
          { action: "read_traceback", observation: "y" },
          { action: "patch_code", observation: "z" },
        ],
      }),
    );
    assert.deepEqual(richer.procedure, ["run_tests", "read_traceback", "patch_code"]);
  });
});

test("recall ranks relevant, confident skills above noise", () => {
  return withForge(async (forge) => {
    forge.observe(traj()); // python tests skill
    forge.observe(
      traj({
        task: "Resolve a git merge conflict",
        tags: ["git"],
        steps: [{ action: "git_merge", observation: "ok" }],
      }),
    );

    const hits = forge.recall("my python tests keep failing");
    assert.ok(hits.length >= 1);
    assert.match(hits[0].skill.task, /python/i);
    assert.ok(hits[0].score > 0);
  });
});

test("recall returns nothing for unrelated queries", () => {
  return withForge(async (forge) => {
    forge.observe(traj());
    assert.equal(forge.recall("deploy kubernetes helm chart").length, 0);
  });
});

test("state persists across forge instances", () => {
  return withForge(async (forge, path) => {
    forge.observe(traj());
    await forge.flush();

    const reopened = await SkillForge.open(path);
    assert.equal(reopened.size, 1);
    assert.equal(reopened.skills()[0].successes, 1);
  });
});

/** Helper: run a test against a forge backed by a throwaway temp file. */
async function withForge(
  fn: (forge: SkillForge, path: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "skill-forge-"));
  const path = join(dir, "skills.json");
  try {
    const forge = await SkillForge.open(path);
    await fn(forge, path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
