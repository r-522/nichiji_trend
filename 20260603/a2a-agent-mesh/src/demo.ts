/**
 * Demo: a federated A2A Agent Mesh.
 *
 * Spins up four single-purpose A2A agents, each tagged as if it lived in a
 * different environment (on-prem, Azure, edge, cloud PC) — exactly the
 * heterogeneous topology Microsoft demoed for Azure Agent Mesh at Build 2026.
 * The mesh discovers them, then the orchestrator runs a financial-compliance
 * workflow that hops across agents, ending with a governance audit trail.
 *
 * Run:  npx tsx src/demo.ts
 */

import { A2AAgent } from "./agent.js";
import { AgentMesh } from "./mesh.js";
import { runWorkflow, fanOut, type WorkflowStep } from "./orchestrator.js";
import {
  amountExtractorSkill,
  calculatorSkill,
  complianceSkill,
  sentimentSkill,
} from "./skills.js";

async function main() {
  console.log("=== A2A Agent Mesh demo (Microsoft Build 2026 trend) ===\n");

  // 1. Stand up a heterogeneous fleet of A2A agents.
  const extractorAgent = new A2AAgent({
    name: "ledger-agent",
    description: "On-prem ledger reader (via Azure Arc).",
    skills: [amountExtractorSkill],
    provider: { organization: "Contoso", identity: "svc-ledger@contoso", dataClassification: "confidential" },
    latencyMs: 40,
  });
  const mathAgent = new A2AAgent({
    name: "risk-calc-agent",
    description: "Azure-hosted risk arithmetic engine.",
    skills: [calculatorSkill],
    provider: { organization: "Contoso", identity: "svc-risk@contoso", dataClassification: "internal" },
    latencyMs: 10,
  });
  const sentimentAgent = new A2AAgent({
    name: "edge-nlp-agent",
    description: "Edge NPU sentiment classifier.",
    skills: [sentimentSkill],
    provider: { organization: "Contoso", identity: "svc-nlp@contoso", dataClassification: "internal" },
    latencyMs: 25,
  });
  const complianceAgent = new A2AAgent({
    name: "compliance-agent",
    description: "Windows 365 Cloud PC compliance checker.",
    skills: [complianceSkill],
    provider: { organization: "Contoso", identity: "svc-compliance@contoso", dataClassification: "confidential" },
    latencyMs: 15,
  });

  const agents = [extractorAgent, mathAgent, sentimentAgent, complianceAgent];
  const urls = await Promise.all(agents.map((a) => a.listen()));

  // 2. Federate them into a single mesh via AgentCard discovery.
  const mesh = new AgentMesh();
  for (const url of urls) await mesh.register(url);
  console.log(`Mesh online with ${mesh.size()} agents.\n`);

  // 3. The transaction under review.
  const transaction =
    "Incoming wire of $12,500 from a flagged counterparty plus a $35.50 fee. Notes: suspicious risk.";
  console.log(`Transaction:\n  "${transaction}"\n`);

  // 4. A federated, sequential compliance workflow across the mesh.
  const steps: WorkflowStep[] = [
    {
      name: "extract",
      tag: "extract", // -> ledger-agent (on-prem)
      buildRequest: () => transaction,
      collect: (ctx, data) => {
        ctx.values["total"] = (data?.["total"] as number) ?? 0;
      },
    },
    {
      name: "risk",
      tag: "math", // -> risk-calc-agent (Azure)
      buildRequest: (ctx) => {
        const total = Number(ctx.values["total"] ?? 0);
        // Apply a 5% risk surcharge to the extracted total.
        return `Compute ${total} * 1.05`;
      },
      collect: (ctx, data) => {
        ctx.values["riskTotal"] = (data?.["value"] as number) ?? 0;
      },
    },
    {
      name: "compliance",
      tag: "compliance", // -> compliance-agent (Cloud PC)
      buildRequest: (ctx) =>
        `compliance-check total ${ctx.values["riskTotal"]} against threshold`,
    },
  ];

  const { trace } = await runWorkflow(mesh, transaction, steps);

  console.log("--- Federated workflow trace ---");
  for (const t of trace) {
    console.log(`  [${t.step}] (${t.tag})  "${t.request}"`);
    console.log(`           => ${t.response}`);
  }

  // 5. Concurrent fan-out: classify sentiment in parallel with the above style.
  const parallel = await fanOut(mesh, transaction, ["sentiment"]);
  console.log("\n--- Concurrent fan-out ---");
  for (const [tag, text] of Object.entries(parallel)) {
    console.log(`  ${tag}: ${text}`);
  }

  // 6. Governance audit trail (Entra ID + Purview style).
  console.log("\n--- Governance audit trail ---");
  for (const e of mesh.getAuditLog()) {
    const gov = e.identity ? ` [id=${e.identity}, class=${e.dataClassification}]` : "";
    console.log(`  ${e.timestamp}  ${e.action.padEnd(9)} ${e.agent ?? "-"}${gov}`);
    console.log(`        ${e.detail}`);
  }

  await Promise.all(agents.map((a) => a.close()));
  console.log("\nMesh shut down. Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
