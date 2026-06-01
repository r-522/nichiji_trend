import type { Artifact, GraphState, WorkerAgent } from "../types.js";

function bullet(s: string): string {
  return s
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
    .join("\n");
}

export const writer: WorkerAgent = {
  name: "writer",
  description: "Synthesises prior worker artifacts into a final report.",
  async run(state: Readonly<GraphState>): Promise<Artifact> {
    const research = state.artifacts.filter((a) => a.kind === "research");
    const code = state.artifacts.filter((a) => a.kind === "code");

    const sections: string[] = [];
    sections.push(`# Report — ${state.task}`);

    if (research.length > 0) {
      sections.push("## Background");
      sections.push(
        research.map((a) => bullet(a.content)).join("\n\n"),
      );
    }

    if (code.length > 0) {
      sections.push("## Reference implementation");
      for (const a of code) {
        sections.push("```ts\n" + a.content.trimEnd() + "\n```");
      }
    }

    sections.push("## Conclusion");
    sections.push(
      `Three specialist agents — researcher, coder and writer — were ` +
        `coordinated by a single supervisor to address "${state.task}". ` +
        `This is the Supervisor pattern that dominated Agentic AI ` +
        `frameworks in 2026.`,
    );

    return {
      producer: "writer",
      kind: "report",
      step: state.step,
      content: sections.join("\n\n"),
    };
  },
};
