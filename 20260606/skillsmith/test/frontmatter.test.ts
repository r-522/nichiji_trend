import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument, FrontmatterError } from "../src/frontmatter.ts";

test("parses required scalar fields and body", () => {
  const doc = parseDocument(
    ["---", "name: my-skill", 'description: "Use when X"', "---", "", "# Body", "text"].join("\n"),
  );
  assert.ok(doc.frontmatter);
  assert.equal(doc.frontmatter!.name, "my-skill");
  assert.equal(doc.frontmatter!.description, "Use when X");
  assert.match(doc.body, /# Body/);
});

test("parses nested metadata mapping", () => {
  const doc = parseDocument(
    ["---", "name: s", "description: d", "metadata:", "  author: ann", "  version: 1.0", "---", "b"].join(
      "\n",
    ),
  );
  assert.deepEqual(doc.frontmatter!.metadata, { author: "ann", version: "1.0" });
});

test("returns null frontmatter when no block present", () => {
  const doc = parseDocument("# just markdown\n");
  assert.equal(doc.frontmatter, null);
  assert.match(doc.body, /just markdown/);
});

test("throws on unclosed frontmatter", () => {
  assert.throws(() => parseDocument("---\nname: x\n"), FrontmatterError);
});

test("throws on duplicate keys", () => {
  assert.throws(() => parseDocument("---\nname: a\nname: b\n---\nx"), FrontmatterError);
});

test("strips inline comments outside quotes but not inside", () => {
  const doc = parseDocument(
    ["---", "name: s # a comment", 'description: "has # hash"', "---", "x"].join("\n"),
  );
  assert.equal(doc.frontmatter!.name, "s");
  assert.equal(doc.frontmatter!.description, "has # hash");
});

test("handles CRLF and BOM", () => {
  const doc = parseDocument("﻿---\r\nname: s\r\ndescription: d\r\n---\r\nbody");
  assert.equal(doc.frontmatter!.name, "s");
  assert.equal(doc.body.trim(), "body");
});
