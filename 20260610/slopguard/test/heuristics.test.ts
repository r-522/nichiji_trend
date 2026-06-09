import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  detectConflation,
  detectInstallScriptName,
  detectRegistry,
  detectTyposquat,
  detectUnknownOffline,
  isKnown,
  isNodeBuiltin,
  levenshtein,
  tokenize,
} from "../src/heuristics.ts";
import { extractImports, specifierToPackage } from "../src/collect.ts";

test("levenshtein basics", () => {
  assert.equal(levenshtein("kitten", "kitten"), 0);
  assert.equal(levenshtein("kitten", "sitten"), 1);
  assert.equal(levenshtein("loadsh", "lodash"), 2);
  assert.equal(levenshtein("expres", "express"), 1);
});

test("known + builtin recognition", () => {
  assert.ok(isKnown("react"));
  assert.ok(isKnown("React")); // case-insensitive
  assert.ok(!isKnown("react-codeshift"));
  assert.ok(isNodeBuiltin("fs"));
  assert.ok(isNodeBuiltin("node:crypto"));
  assert.ok(!isNodeBuiltin("express"));
});

test("tokenize splits and lowercases", () => {
  assert.deepEqual(tokenize("@scope/react-codeshift"), ["react", "codeshift"]);
  assert.deepEqual(tokenize("Foo_Bar.baz"), ["foo", "bar", "baz"]);
});

test("typosquat detects near-misses but not exact known names", () => {
  assert.equal(detectTyposquat("react"), null);
  const expres = detectTyposquat("expres");
  assert.ok(expres);
  assert.equal(expres!.rule, "typosquat");
  assert.equal(expres!.severity, "high"); // distance 1
  const loadsh = detectTyposquat("loadsh");
  assert.ok(loadsh);
  assert.equal(loadsh!.severity, "medium"); // distance 2
});

test("conflation flags mashed-up known names", () => {
  const sig = detectConflation("react-codeshift");
  assert.ok(sig, "expected react-codeshift to be flagged as conflation");
  assert.equal(sig!.rule, "conflation");
  // pure unknown words should not trigger conflation
  assert.equal(detectConflation("ai-vector-toolkit-fast"), null);
  // genuine known package never conflated
  assert.equal(detectConflation("react-dom"), null);
});

test("offline unknown is low-confidence info", () => {
  assert.equal(detectUnknownOffline("react"), null);
  const sig = detectUnknownOffline("totally-made-up-pkg");
  assert.ok(sig);
  assert.equal(sig!.severity, "info");
});

test("install-hook detection on manifest scripts", () => {
  assert.equal(detectInstallScriptName(["build", "test"]), null);
  const sig = detectInstallScriptName(["postinstall", "build"]);
  assert.ok(sig);
  assert.equal(sig!.rule, "install-hook");
});

test("registry: phantom package is critical", () => {
  const sigs = detectRegistry({ exists: false });
  assert.equal(sigs.length, 1);
  assert.equal(sigs[0]!.rule, "phantom");
  assert.equal(sigs[0]!.severity, "critical");
});

test("registry: newly registered + low adoption + install hook", () => {
  const now = new Date("2026-06-10T00:00:00Z");
  const sigs = detectRegistry(
    {
      exists: true,
      createdAt: "2026-06-01T00:00:00Z",
      weeklyDownloads: 12,
      hasInstallScript: true,
    },
    now,
  );
  const rules = sigs.map((s) => s.rule).sort();
  assert.deepEqual(rules, ["low-adoption", "newly-registered", "registry-install-hook"]);
});

test("registry: established package yields no signals", () => {
  const now = new Date("2026-06-10T00:00:00Z");
  const sigs = detectRegistry(
    { exists: true, createdAt: "2014-01-01T00:00:00Z", weeklyDownloads: 5_000_000, hasInstallScript: false },
    now,
  );
  assert.equal(sigs.length, 0);
});

test("aggregate caps score and escalates severity", () => {
  assert.deepEqual(aggregate([]), { riskScore: 0, severity: "info" });
  const agg = aggregate([
    { rule: "a", severity: "medium", score: 40, message: "" },
    { rule: "b", severity: "medium", score: 50, message: "" },
  ]);
  assert.equal(agg.riskScore, 90);
  assert.equal(agg.severity, "critical"); // promoted by high aggregate score
});

test("import extraction + specifier normalization", () => {
  assert.equal(specifierToPackage("./local"), null);
  assert.equal(specifierToPackage("node:fs"), null);
  assert.equal(specifierToPackage("fs"), null);
  assert.equal(specifierToPackage("lodash/merge"), "lodash");
  assert.equal(specifierToPackage("@scope/pkg/sub"), "@scope/pkg");

  const src = `
    import express from "express";
    import { z } from 'zod';
    const x = require("lodash/get");
    export { default } from "react-codeshift";
    const m = await import("node:crypto");
    import local from "./local.js";
  `;
  const imports = extractImports(src).sort();
  assert.deepEqual(imports, ["express", "lodash", "react-codeshift", "zod"]);
});
