import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultRegistry, filteredRegistry } from "../src/tools/registry.js";
import { SharedMemory } from "../src/shared-memory.js";
import { Tracer } from "../src/tracer.js";

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "subagent-test-"));
  await mkdir(join(dir, "sub"), { recursive: true });
  await writeFile(join(dir, "hello.txt"), "hello world\n", "utf8");
  return dir;
}

function ctx(agentId: string, ws: string) {
  return { agentId, workspace: ws, memory: new SharedMemory(), tracer: new Tracer({ silent: true }) };
}

test("read_file reads inside the workspace", async () => {
  const reg = defaultRegistry();
  const ws = await workspace();
  const res = await reg.get("read_file")!.invoke({ path: "hello.txt" }, ctx("a", ws));
  assert.equal(res.ok, true);
  assert.equal((res.output as { content: string }).content, "hello world\n");
});

test("read_file refuses to escape the workspace", async () => {
  const reg = defaultRegistry();
  const ws = await workspace();
  const res = await reg.get("read_file")!.invoke({ path: "../../etc/passwd" }, ctx("a", ws));
  assert.equal(res.ok, false);
  assert.match(res.error ?? "", /escapes the workspace/);
});

test("shell tool refuses non-allowlisted commands", async () => {
  const reg = defaultRegistry();
  const ws = await workspace();
  const res = await reg.get("shell")!.invoke({ cmd: "rm", args: ["-rf", "/"] }, ctx("a", ws));
  assert.equal(res.ok, false);
  assert.match(res.error ?? "", /not on allowlist/);
});

test("shell tool runs allowlisted echo", async () => {
  const reg = defaultRegistry();
  const ws = await workspace();
  const res = await reg.get("shell")!.invoke({ cmd: "echo", args: ["hi"] }, ctx("a", ws));
  assert.equal(res.ok, true);
  assert.equal((res.output as { stdout: string }).stdout.trim(), "hi");
});

test("filteredRegistry honors allowlist but always includes done", () => {
  const reg = filteredRegistry(defaultRegistry(), ["read_file"]);
  assert.ok(reg.has("read_file"));
  assert.ok(reg.has("done"));
  assert.ok(!reg.has("shell"));
});

test("memory_write through the tool respects ownership", async () => {
  const reg = defaultRegistry();
  const ws = await workspace();
  const writer = reg.get("memory_write")!;
  const memory = new SharedMemory();
  const tracer = new Tracer({ silent: true });

  const own = await writer.invoke(
    { namespace: "subtask:a", value: { ok: true } },
    { agentId: "a", workspace: ws, memory, tracer },
  );
  assert.equal(own.ok, true);

  const foreign = await writer.invoke(
    { namespace: "subtask:b", value: { ok: false } },
    { agentId: "a", workspace: ws, memory, tracer },
  );
  assert.equal(foreign.ok, false);
});
