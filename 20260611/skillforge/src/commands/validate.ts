/** `skillforge validate <path...>` — lint skills against the SKILL.md spec. */

import { loadSkill } from '../skill.js';
import { validateSkill, Diagnostic, Severity } from '../spec.js';

const ICONS: Record<Severity, string> = { error: '✖', warning: '⚠', info: 'ℹ' };
const COLORS: Record<Severity, string> = { error: '\x1b[31m', warning: '\x1b[33m', info: '\x1b[36m' };
const RESET = '\x1b[0m';

function printDiagnostic(d: Diagnostic): void {
  const color = process.stdout.isTTY ? COLORS[d.severity] : '';
  const reset = process.stdout.isTTY ? RESET : '';
  console.log(`  ${color}${ICONS[d.severity]} [${d.severity}] ${d.rule}${reset}: ${d.message}`);
}

/** Returns the number of skills that failed (had at least one error). */
export function validate(paths: string[]): number {
  let failed = 0;
  for (const skillPath of paths) {
    let diags: Diagnostic[];
    try {
      const skill = loadSkill(skillPath);
      diags = validateSkill(skill.dir, skill.frontmatter);
    } catch (err) {
      console.log(`${skillPath}`);
      printDiagnostic({ severity: 'error', rule: 'load', message: (err as Error).message });
      failed++;
      continue;
    }

    const errors = diags.filter((d) => d.severity === 'error').length;
    const warnings = diags.filter((d) => d.severity === 'warning').length;
    const status = errors > 0 ? 'FAIL' : 'PASS';
    console.log(`${skillPath}  [${status}] ${errors} error(s), ${warnings} warning(s)`);
    for (const d of diags) printDiagnostic(d);
    if (errors > 0) failed++;
  }
  return failed;
}
