/**
 * Human-readable rendering of a {@link ScanReport} for the terminal.
 */
import type { ScanReport, Severity } from "./types.js";

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(code: string, s: string): string {
  return USE_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s;
}

const SEVERITY_STYLE: Record<Severity, (s: string) => string> = {
  critical: (s) => paint("1;37;41", s),
  high: (s) => paint("1;31", s),
  medium: (s) => paint("1;33", s),
  low: (s) => paint("36", s),
  info: (s) => paint("2", s),
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  info: "INFO",
};

export function renderReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(paint("1", "slopguard — slopsquatting / hallucinated-package scan"));
  lines.push(
    paint(
      "2",
      `target: ${report.projectPath}  •  deps: ${report.totalDependencies}  •  mode: ${report.online ? "online" : "offline"}`,
    ),
  );
  lines.push("");

  if (report.findings.length === 0) {
    lines.push(paint("32", "✓ No suspicious dependencies detected."));
    if (!report.online) {
      lines.push(paint("2", "  (offline mode — re-run with --online to verify packages exist on the registry.)"));
    }
    return lines.join("\n");
  }

  for (const f of report.findings) {
    const badge = SEVERITY_STYLE[f.severity](`[${SEVERITY_BADGE[f.severity]}]`);
    const ver = f.range ? paint("2", `@${f.range}`) : "";
    lines.push(`${badge} ${paint("1", f.package)}${ver}  ${paint("2", `risk ${f.riskScore}/100`)}`);
    lines.push(paint("2", `  origin: ${f.origins.join(", ")}`));
    for (const sig of f.signals) {
      lines.push(`  ${paint("2", "·")} ${paint("1", sig.rule)}: ${sig.message}`);
    }
    lines.push("");
  }

  const s = report.summary;
  lines.push(
    paint("1", "Summary: ") +
      [
        s.critical ? SEVERITY_STYLE.critical(`${s.critical} critical`) : "",
        s.high ? SEVERITY_STYLE.high(`${s.high} high`) : "",
        s.medium ? SEVERITY_STYLE.medium(`${s.medium} medium`) : "",
        s.low ? SEVERITY_STYLE.low(`${s.low} low`) : "",
        s.info ? SEVERITY_STYLE.info(`${s.info} info`) : "",
      ]
        .filter(Boolean)
        .join("  "),
  );
  return lines.join("\n");
}
