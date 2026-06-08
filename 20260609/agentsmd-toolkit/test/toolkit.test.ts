/**
 * Tests for agentsmd-toolkit. Run with: npm test
 * (node --test --experimental-strip-types)
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { parse, slugify } from "../src/parser.ts";
import { validate, validateText } from "../src/validator.ts";
import { resolveChain } from "../src/resolver.ts";
import { migrate, scaffold } from "../src/scaffold.ts";

// --- parser -----------------------------------------------------------------

test("parser extracts headings, code blocks and references", () => {
  const src = [
    "# Title",
    "intro line",
    "## Build",
    "```bash",
    "## not a heading inside fence",
    "npm run build",
    "```",
    "See @packages/api/AGENTS.md for details.",
  ].join("\n");
  const doc = parse(src);

  assert.equal(doc.sections.length, 2);
  assert.equal(doc.sections[0]?.title, "Title");
  assert.equal(doc.sections[1]?.title, "Build");
  // The `##` inside the fence must NOT be treated as a heading.
  assert.equal(doc.codeBlocks.length, 1);
  assert.equal(doc.codeBlocks[0]?.lang, "bash");
  assert.equal(doc.references.length, 1);
  assert.equal(doc.references[0]?.target, "packages/api/AGENTS.md");
});

test("slugify normalises headings", () => {
  assert.equal(slugify("## Build & Dev Commands"), "build dev commands");
  assert.equal(slugify("`Testing`"), "testing");
});

// --- validator --------------------------------------------------------------

test("validator flags an empty document with an error", () => {
  const res = validateText("");
  assert.equal(res.ok, false);
  assert.ok(res.findings.some((f) => f.rule === "no-headings"));
});

test("validator accepts a well-formed document", () => {
  const good = scaffold({ projectName: "Demo", full: true });
  const res = validateText(good);
  assert.equal(res.ok, true, JSON.stringify(res.findings));
  assert.equal(res.errors, 0);
});

test("validator warns on missing build/test sections", () => {
  const res = validateText("# Only a title\n\nsome prose\n");
  assert.ok(res.findings.some((f) => f.rule === "missing-section.build"));
  assert.ok(res.findings.some((f) => f.rule === "missing-section.test"));
});

test("validator detects multiple H1 titles", () => {
  const res = validateText("# One\n\ntext\n\n# Two\n\nmore\n");
  assert.ok(res.findings.some((f) => f.rule === "multiple-titles"));
});

test("validator reports dangling @references", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentsmd-ref-"));
  const file = join(dir, "AGENTS.md");
  writeFileSync(file, "# T\n\nSee @docs/missing.md here.\n");
  const res = validate(parse("# T\n\nSee @docs/missing.md here.\n", file));
  assert.ok(res.findings.some((f) => f.rule === "dangling-reference"));
});

test("validator accepts existing @references", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentsmd-ref2-"));
  mkdirSync(join(dir, "docs"));
  writeFileSync(join(dir, "docs", "exists.md"), "x");
  const file = join(dir, "AGENTS.md");
  const text = "# T\n\nSee @docs/exists.md here.\n";
  writeFileSync(file, text);
  const res = validate(parse(text, file));
  assert.ok(!res.findings.some((f) => f.rule === "dangling-reference"));
});

// --- resolver ---------------------------------------------------------------

test("resolveChain builds a root-first precedence chain", () => {
  const root = mkdtempSync(join(tmpdir(), "agentsmd-mono-"));
  const api = join(root, "packages", "api");
  mkdirSync(api, { recursive: true });
  writeFileSync(join(root, "AGENTS.md"), "# root");
  writeFileSync(join(api, "AGENTS.md"), "# api");

  const res = resolveChain(api, root);
  assert.equal(res.layers.length, 2);
  // Root has lowest precedence (1), nearest (api) has highest (2).
  assert.equal(res.layers[0]?.precedence, 1);
  assert.ok(res.layers[0]?.path.endsWith(join(root, "AGENTS.md")) || res.layers[0]?.path === join(root, "AGENTS.md"));
  assert.equal(res.layers[1]?.precedence, 2);
  assert.equal(res.layers[1]?.path, join(api, "AGENTS.md"));
});

test("resolveChain returns no layers when none exist", () => {
  const root = mkdtempSync(join(tmpdir(), "agentsmd-empty-"));
  const sub = join(root, "sub");
  mkdirSync(sub);
  const res = resolveChain(sub, root);
  assert.equal(res.layers.length, 0);
});

// --- scaffold & migrate -----------------------------------------------------

test("scaffold output validates clean and includes recommended sections", () => {
  const text = scaffold({ projectName: "MyApp" });
  assert.match(text, /^# MyApp/);
  assert.match(text, /## Build & development commands/);
  assert.match(text, /## Testing instructions/);
  assert.equal(validateText(text).ok, true);
});

test("migrate preserves body and normalises the title", () => {
  const legacy = "# Old Project\n\n## Rules\n\n- be nice\n\n## Build\n\nmake\n";
  const out = migrate(legacy, "CLAUDE.md");
  // The original H1 is reused as the (single) normalised title.
  const h1Count = out.split("\n").filter((l) => /^#\s/.test(l)).length;
  assert.equal(h1Count, 1);
  assert.match(out, /^# Old Project/);
  assert.match(out, /Migrated from CLAUDE\.md/);
  assert.match(out, /be nice/);
});
