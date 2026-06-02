/**
 * Integration tests for the A2A agent mesh. Uses Node's built-in test runner.
 * Run:  npx tsx --test test/mesh.test.ts
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { A2AAgent } from "../src/agent.js";
import { A2AClient } from "../src/client.js";
import { AgentMesh } from "../src/mesh.js";
import { runWorkflow, type WorkflowStep } from "../src/orchestrator.js";
import { AGENT_CARD_PATH } from "../src/types.js";
import {
  amountExtractorSkill,
  calculatorSkill,
  complianceSkill,
} from "../src/skills.js";

let extractor: A2AAgent;
let math: A2AAgent;
let compliance: A2AAgent;
let mesh: AgentMesh;

before(async () => {
  extractor = new A2AAgent({
    name: "ledger-agent",
    description: "extractor",
    skills: [amountExtractorSkill],
    latencyMs: 30,
  });
  math = new A2AAgent({
    name: "risk-calc-agent",
    description: "math",
    skills: [calculatorSkill],
    latencyMs: 5,
  });
  compliance = new A2AAgent({
    name: "compliance-agent",
    description: "compliance",
    skills: [complianceSkill],
    latencyMs: 5,
  });

  const urls = await Promise.all([
    extractor.listen(),
    math.listen(),
    compliance.listen(),
  ]);
  mesh = new AgentMesh();
  for (const u of urls) await mesh.register(u);
});

after(async () => {
  await Promise.all([extractor.close(), math.close(), compliance.close()]);
});

test("agents publish a discoverable AgentCard", async () => {
  const res = await fetch(`${extractor.url}${AGENT_CARD_PATH}`);
  assert.equal(res.ok, true);
  const card = (await res.json()) as { name: string; skills: unknown[] };
  assert.equal(card.name, "ledger-agent");
  assert.equal(card.skills.length, 1);
});

test("client message/send returns a completed task with an artifact", async () => {
  const client = await A2AClient.discover(math.url);
  const task = await client.sendMessage("Compute (100 + 50) * 2");
  assert.equal(task.kind, "task");
  assert.equal(task.status.state, "completed");
  assert.equal(task.artifacts.length, 1);
  const data = task.artifacts[0]!.parts.find((p) => p.kind === "data");
  assert.ok(data && data.kind === "data");
  assert.equal((data.data as { value: number }).value, 300);
});

test("tasks/get retrieves a previously created task", async () => {
  const client = await A2AClient.discover(math.url);
  const created = await client.sendMessage("Compute 7 * 6");
  const fetched = await client.getTask(created.id);
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.status.state, "completed");
});

test("mesh registered all agents and indexes capabilities", () => {
  assert.equal(mesh.size(), 3);
  assert.equal(mesh.capable("math").length, 1);
  assert.equal(mesh.capable("compliance").length, 1);
  assert.equal(mesh.capable("nonexistent").length, 0);
});

test("route throws for an unknown capability", () => {
  assert.throws(() => mesh.route("teleportation"), /no agent in the mesh/);
});

test("federated workflow flags a high-value transaction", async () => {
  const steps: WorkflowStep[] = [
    {
      name: "extract",
      tag: "extract",
      buildRequest: (ctx) => ctx.input,
      collect: (ctx, data) => {
        ctx.values["total"] = (data?.["total"] as number) ?? 0;
      },
    },
    {
      name: "risk",
      tag: "math",
      buildRequest: (ctx) => `Compute ${ctx.values["total"]} * 1.05`,
      collect: (ctx, data) => {
        ctx.values["riskTotal"] = (data?.["value"] as number) ?? 0;
      },
    },
    {
      name: "compliance",
      tag: "compliance",
      buildRequest: (ctx) =>
        `compliance-check ${ctx.values["riskTotal"]} threshold`,
    },
  ];

  const { context, trace } = await runWorkflow(
    mesh,
    "Wire of $12,500 plus $35.50 fee",
    steps,
  );

  // 12500 + 35.50 = 12535.50 ; *1.05 = 13162.275 -> rounded 13162.28 ; >= 10000
  assert.equal(context.values["total"], 12535.5);
  assert.equal(context.values["riskTotal"], 13162.28);
  assert.match(trace[2]!.response, /FLAGGED/);
});

test("audit log records register, route and execute actions", () => {
  const actions = new Set(mesh.getAuditLog().map((e) => e.action));
  assert.ok(actions.has("register"));
  assert.ok(actions.has("route"));
  assert.ok(actions.has("execute"));
});
