/** `skillforge list <dir>` — inventory every skill under a directory tree. */

import path from 'node:path';
import { discoverSkills, loadSkill } from '../skill.js';
import { validateSkill, estimateTokens } from '../spec.js';

interface Row {
  name: string;
  dir: string;
  status: string;
  metaTokens: string;
  bodyTokens: string;
  description: string;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function list(root: string): void {
  const dirs = discoverSkills(root);
  if (dirs.length === 0) {
    console.log(`no skills found under ${path.resolve(root)}`);
    return;
  }

  const rows: Row[] = dirs.map((dir) => {
    try {
      const skill = loadSkill(dir);
      const diags = validateSkill(skill.dir, skill.frontmatter);
      const errors = diags.filter((d) => d.severity === 'error').length;
      const warnings = diags.filter((d) => d.severity === 'warning').length;
      const fm = skill.frontmatter;
      const name = typeof fm.data['name'] === 'string' ? (fm.data['name'] as string) : '(unnamed)';
      const description = typeof fm.data['description'] === 'string' ? (fm.data['description'] as string) : '';
      const metaText = `${name} ${description}`;
      return {
        name,
        dir: path.relative(process.cwd(), dir) || '.',
        status: errors > 0 ? `FAIL(${errors})` : warnings > 0 ? `WARN(${warnings})` : 'OK',
        metaTokens: String(estimateTokens(metaText)),
        bodyTokens: String(estimateTokens(fm.body)),
        description: truncate(description.replace(/\s+/g, ' ').trim(), 60),
      };
    } catch (err) {
      return {
        name: '(unreadable)',
        dir: path.relative(process.cwd(), dir) || '.',
        status: 'FAIL',
        metaTokens: '-',
        bodyTokens: '-',
        description: (err as Error).message,
      };
    }
  });

  const headers: Row = {
    name: 'NAME',
    dir: 'PATH',
    status: 'STATUS',
    metaTokens: 'META~TOK',
    bodyTokens: 'BODY~TOK',
    description: 'DESCRIPTION',
  };
  const all = [headers, ...rows];
  const keys = Object.keys(headers) as (keyof Row)[];
  const widths = Object.fromEntries(keys.map((k) => [k, Math.max(...all.map((r) => r[k].length))])) as Record<
    keyof Row,
    number
  >;

  for (const row of all) {
    console.log(keys.map((k) => row[k].padEnd(widths[k])).join('  '));
  }
  console.log(`\n${rows.length} skill(s) found under ${path.resolve(root)}`);
}
