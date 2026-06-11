import { RunResult } from "./types.js";

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "-";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export function renderSweepTable(results: RunResult[]): string {
  const headers = ["effort", "status", "latency", "TTFT", "in tok", "out tok", "cost"];
  const rows = results.map((r) => [
    r.effort,
    r.error ? "error" : r.refused ? `refusal(${r.refusalCategory ?? "?"})` : r.stopReason ?? "?",
    fmtMs(r.latencyMs),
    fmtMs(r.timeToFirstTokenMs),
    String(r.inputTokens),
    String(r.outputTokens),
    `$${r.costUsd.toFixed(4)}`,
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i].length)),
  );
  const line = (cells: string[]) =>
    "| " + cells.map((c, i) => pad(c, widths[i])).join(" | ") + " |";
  const sep = "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|";

  return [line(headers), sep, ...rows.map(line)].join("\n");
}

export function renderAnswers(results: RunResult[]): string {
  const parts: string[] = [];
  for (const r of results) {
    parts.push(`\n===== effort: ${r.effort} =====`);
    if (r.error) {
      parts.push(`[error] ${r.error}`);
    } else if (r.refused) {
      parts.push(
        `[refused by safety classifiers] category=${r.refusalCategory ?? "n/a"}` +
          (r.refusalExplanation ? ` — ${r.refusalExplanation}` : ""),
      );
    } else {
      if (r.thinkingSummary) parts.push(`[thinking summary]\n${r.thinkingSummary}\n---`);
      parts.push(r.text);
    }
  }
  return parts.join("\n");
}
