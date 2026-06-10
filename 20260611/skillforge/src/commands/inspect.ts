/** `skillforge inspect <path>` — show metadata and the progressive-disclosure token budget. */

import fs from 'node:fs';
import path from 'node:path';
import { loadSkill } from '../skill.js';
import { estimateTokens } from '../spec.js';

function* walkFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(full);
    else if (entry.isFile()) yield full;
  }
}

export function inspect(skillPath: string): void {
  const skill = loadSkill(skillPath);
  const fm = skill.frontmatter;

  const name = typeof fm.data['name'] === 'string' ? (fm.data['name'] as string) : '(unnamed)';
  const description = typeof fm.data['description'] === 'string' ? (fm.data['description'] as string) : '';

  console.log(`Skill: ${name}`);
  console.log(`Path:  ${skill.dir}`);
  console.log('');
  console.log('Frontmatter:');
  for (const [key, value] of Object.entries(fm.data)) {
    const rendered = Array.isArray(value)
      ? `[${value.join(', ')}]`
      : typeof value === 'object'
        ? JSON.stringify(value)
        : value;
    console.log(`  ${key}: ${rendered}`);
  }

  // Progressive disclosure: level 1 = metadata, level 2 = body, level 3 = supporting files.
  const level1 = estimateTokens(`${name} ${description}`);
  const level2 = estimateTokens(fm.body);
  let level3 = 0;
  const supportingFiles: { rel: string; tokens: number }[] = [];
  for (const file of walkFiles(skill.dir)) {
    if (path.resolve(file) === path.resolve(skill.file)) continue;
    const tokens = estimateTokens(fs.readFileSync(file, 'utf8'));
    level3 += tokens;
    supportingFiles.push({ rel: path.relative(skill.dir, file), tokens });
  }

  console.log('');
  console.log('Progressive disclosure budget (~tokens, chars/4):');
  console.log(`  level 1  metadata (always loaded)   ${String(level1).padStart(8)}`);
  console.log(`  level 2  SKILL.md body (on trigger) ${String(level2).padStart(8)}`);
  console.log(`  level 3  supporting files (on use)  ${String(level3).padStart(8)}`);
  for (const f of supportingFiles) {
    console.log(`           - ${f.rel} (~${f.tokens})`);
  }
  const total = level1 + level2 + level3;
  if (total > 0) {
    const preloaded = ((level1 / total) * 100).toFixed(1);
    console.log(`  => only ${preloaded}% of the skill's ${total} tokens are preloaded per session`);
  }
}
