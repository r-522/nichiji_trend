import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSkill } from "../src/validator.ts";

function makeSkill(name: string, body: string): string {
  const root = mkdtempSync(join(tmpdir(), "skillsmith-"));
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), body, "utf8");
  return dir;
}

const rules = (r: ReturnType<typeof validateSkill>) => r.diagnostics.map((d) => d.rule);

test("a well-formed skill passes", () => {
  const dir = makeSkill(
    "good-skill",
    [
      "---",
      "name: good-skill",
      "description: Use this when you need to demonstrate a valid skill bundle.",
      "---",
      "# good-skill",
      "Instructions here.",
    ].join("\n"),
  );
  const report = validateSkill(dir);
  assert.equal(report.ok, true);
  assert.equal(report.name, "good-skill");
});

test("detects missing required fields", () => {
  const dir = makeSkill("x", ["---", "license: MIT", "---", "body"].join("\n"));
  const report = validateSkill(dir);
  assert.equal(report.ok, false);
  assert.ok(rules(report).includes("name/required"));
  assert.ok(rules(report).includes("description/required"));
});

test("rejects invalid name pattern", () => {
  const dir = makeSkill("Bad_Name", ["---", "name: Bad_Name", "description: a valid description here", "---", "b"].join("\n"));
  const report = validateSkill(dir);
  assert.ok(rules(report).includes("name/pattern"));
});

test("detects folder/name mismatch", () => {
  const dir = makeSkill("folder-a", ["---", "name: other-name", "description: a valid description here", "---", "b"].join("\n"));
  const report = validateSkill(dir);
  assert.ok(rules(report).includes("name/folder-match"));
});

test("flags over-long name and description", () => {
  const longName = "a".repeat(65);
  const longDesc = "d".repeat(1025);
  const dir = makeSkill(longName, ["---", `name: ${longName}`, `description: ${longDesc}`, "---", "b"].join("\n"));
  const report = validateSkill(dir);
  assert.ok(rules(report).includes("name/length"));
  assert.ok(rules(report).includes("description/length"));
});

test("flags empty body", () => {
  const dir = makeSkill("empty-body", ["---", "name: empty-body", "description: a valid description here", "---", ""].join("\n"));
  const report = validateSkill(dir);
  assert.ok(rules(report).includes("body/empty"));
});

test("reports missing SKILL.md", () => {
  const root = mkdtempSync(join(tmpdir(), "skillsmith-"));
  const report = validateSkill(root);
  assert.equal(report.ok, false);
  assert.ok(rules(report).includes("io/no-skill-md"));
});

test("surfaces unknown fields as info, not error", () => {
  const dir = makeSkill("known", ["---", "name: known", "description: a valid description here works", "weird: 1", "---", "b"].join("\n"));
  const report = validateSkill(dir);
  assert.equal(report.ok, true);
  assert.ok(rules(report).includes("frontmatter/unknown-field"));
});
