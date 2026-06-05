import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findSkillDirs, buildCatalog } from "../src/indexer.ts";
import { lintSkill } from "../src/linter.ts";

const here = dirname(fileURLToPath(import.meta.url));
const examples = join(here, "..", "examples", "skills");

test("findSkillDirs discovers all example skills", () => {
  const dirs = findSkillDirs(examples);
  const names = dirs.map((d) => d.split("/").pop());
  assert.ok(names.includes("pdf-extractor"));
  assert.ok(names.includes("commit-helper"));
  assert.ok(names.includes("Bad_Skill"));
});

test("buildCatalog summarises skills with validity flags", () => {
  const catalog = buildCatalog(examples);
  assert.equal(catalog.count, 3);
  const pdf = catalog.skills.find((s) => s.name === "pdf-extractor");
  assert.ok(pdf);
  assert.equal(pdf!.valid, true);
  assert.deepEqual(pdf!.allowedTools, ["Bash", "Read"]);
  assert.deepEqual(pdf!.bundles, ["references"]);
  const bad = catalog.skills.find((s) => s.name === "Bad_Skill");
  assert.equal(bad!.valid, false);
});

test("linter flags short description and missing license", () => {
  const rules = lintSkill(join(examples, "Bad_Skill")).map((d) => d.rule);
  assert.ok(rules.includes("description/too-short"));
  assert.ok(rules.includes("license/missing"));
});
