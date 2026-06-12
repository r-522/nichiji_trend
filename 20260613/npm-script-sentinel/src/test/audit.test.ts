import test from "node:test";
import assert from "node:assert/strict";
import { classifyResolved, auditLockfile, isDirectDependency, packageNameFromLockKey } from "../lockfile.js";
import { dedupeFindings, renderAllowlist } from "../report.js";
import type { Finding, Lockfile } from "../types.js";

test("classifyResolved distinguishes registry, git, remote and local sources", () => {
  assert.equal(classifyResolved("https://registry.npmjs.org/esbuild/-/esbuild-0.25.0.tgz"), "registry");
  assert.equal(classifyResolved("git+ssh://git@github.com/user/repo.git#abc123"), "git");
  assert.equal(classifyResolved("github:user/repo"), "git");
  assert.equal(classifyResolved("https://example.com/tarballs/pkg-1.0.0.tgz"), "remote");
  assert.equal(classifyResolved("file:../local-pkg"), "local");
});

test("lock key helpers handle nested and scoped paths", () => {
  assert.equal(packageNameFromLockKey("node_modules/@scope/pkg"), "@scope/pkg");
  assert.equal(packageNameFromLockKey("node_modules/a/node_modules/b"), "b");
  assert.equal(isDirectDependency("node_modules/@scope/pkg"), true);
  assert.equal(isDirectDependency("node_modules/a/node_modules/b"), false);
});

test("auditLockfile flags install scripts and blocked sources", () => {
  const lockfile: Lockfile = {
    lockfileVersion: 3,
    packages: {
      "": { version: "1.0.0" },
      "node_modules/native-pkg": {
        version: "2.0.0",
        resolved: "https://registry.npmjs.org/native-pkg/-/native-pkg-2.0.0.tgz",
        hasInstallScript: true,
      },
      "node_modules/git-pkg": {
        version: "0.1.0",
        resolved: "git+https://github.com/user/git-pkg.git#deadbeef",
      },
      "node_modules/clean-pkg": {
        version: "3.0.0",
        resolved: "https://registry.npmjs.org/clean-pkg/-/clean-pkg-3.0.0.tgz",
      },
    },
  };
  const findings = auditLockfile(lockfile);
  assert.deepEqual(
    findings.map((f) => [f.kind, f.name]).sort(),
    [
      ["git-dependency", "git-pkg"],
      ["install-script", "native-pkg"],
    ],
  );
});

test("dedupeFindings prefers the node_modules entry carrying script names", () => {
  const fromLock: Finding = {
    kind: "install-script",
    name: "native-pkg",
    version: "2.0.0",
    location: "node_modules/native-pkg",
    direct: true,
  };
  const fromTree: Finding = { ...fromLock, scripts: ["postinstall"] };
  const merged = dedupeFindings([fromLock, fromTree]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0]?.scripts, ["postinstall"]);
});

test("renderAllowlist emits npm config covering every finding kind", () => {
  const findings: Finding[] = [
    { kind: "install-script", name: "b-pkg", version: "1.0.0", location: "node_modules/b-pkg", direct: true },
    { kind: "implicit-node-gyp", name: "a-pkg", version: "1.0.0", location: "node_modules/a-pkg", direct: false },
    {
      kind: "git-dependency",
      name: "git-pkg",
      version: "0.1.0",
      location: "node_modules/git-pkg",
      direct: true,
      resolved: "git+https://github.com/user/git-pkg.git",
    },
  ];
  const config = JSON.parse(renderAllowlist(findings)) as { npm: Record<string, unknown> };
  assert.deepEqual(config.npm["allow-scripts"], ["a-pkg", "b-pkg"]);
  assert.equal(config.npm["allow-git"], "*");
  assert.equal(config.npm["allow-remote"], undefined);
});
