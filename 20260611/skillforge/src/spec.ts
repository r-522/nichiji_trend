/**
 * Validation rules derived from the Agent Skills open standard (SKILL.md spec)
 * as implemented by Claude Code, Codex CLI, Gemini CLI and others.
 */

import path from 'node:path';
import fs from 'node:fs';
import { FrontmatterResult } from './frontmatter.js';

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  rule: string;
  message: string;
}

export const NAME_MAX_LENGTH = 64;
export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const DESCRIPTION_MAX_LENGTH = 1024;
/** Bodies past this size defeat progressive disclosure; agents are told to keep under ~500 lines. */
export const BODY_RECOMMENDED_MAX_LINES = 500;

export const KNOWN_FIELDS = new Set([
  'name',
  'description',
  'license',
  'allowed-tools',
  'metadata',
  'version',
  'compatibility',
]);

/** Rough token estimate (~4 chars per token) used for progressive-disclosure reporting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function validateSkill(skillDir: string, fm: FrontmatterResult): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const dirName = path.basename(path.resolve(skillDir));

  for (const w of fm.warnings) {
    diags.push({ severity: 'warning', rule: 'yaml-parse', message: w });
  }

  if (!fm.hasFrontmatter) {
    diags.push({
      severity: 'error',
      rule: 'frontmatter-required',
      message: 'SKILL.md must start with a YAML frontmatter block delimited by `---`',
    });
    return diags;
  }

  // --- name ---
  const name = fm.data['name'];
  if (typeof name !== 'string' || name.trim() === '') {
    diags.push({ severity: 'error', rule: 'name-required', message: 'frontmatter field `name` is required' });
  } else {
    if (name.length > NAME_MAX_LENGTH) {
      diags.push({
        severity: 'error',
        rule: 'name-length',
        message: `\`name\` is ${name.length} chars; maximum is ${NAME_MAX_LENGTH}`,
      });
    }
    if (!NAME_PATTERN.test(name)) {
      diags.push({
        severity: 'error',
        rule: 'name-format',
        message: '`name` must be lowercase letters/digits separated by single hyphens (e.g. `pdf-processing`)',
      });
    }
    if (name !== dirName) {
      diags.push({
        severity: 'warning',
        rule: 'name-matches-directory',
        message: `\`name\` is "${name}" but the skill directory is "${dirName}" — agents discover skills by directory name`,
      });
    }
  }

  // --- description ---
  const description = fm.data['description'];
  if (typeof description !== 'string' || description.trim() === '') {
    diags.push({
      severity: 'error',
      rule: 'description-required',
      message: 'frontmatter field `description` is required (it is the only text agents preload)',
    });
  } else {
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      diags.push({
        severity: 'error',
        rule: 'description-length',
        message: `\`description\` is ${description.length} chars; maximum is ${DESCRIPTION_MAX_LENGTH}`,
      });
    } else if (description.length > DESCRIPTION_MAX_LENGTH / 2) {
      diags.push({
        severity: 'warning',
        rule: 'description-bloat',
        message:
          `\`description\` is ${description.length} chars — long descriptions are preloaded for every session ` +
          'and erode the token savings of progressive disclosure',
      });
    }
    if (!/\b(use when|when|for)\b/i.test(description)) {
      diags.push({
        severity: 'info',
        rule: 'description-trigger',
        message: 'consider stating *when* the skill should trigger (e.g. "Use when ...") so agents can route to it',
      });
    }
  }

  // --- allowed-tools ---
  const allowedTools = fm.data['allowed-tools'];
  if (allowedTools !== undefined && !Array.isArray(allowedTools)) {
    diags.push({
      severity: 'error',
      rule: 'allowed-tools-type',
      message: '`allowed-tools` must be a YAML list of tool names',
    });
  }

  // --- unknown fields ---
  for (const key of Object.keys(fm.data)) {
    if (!KNOWN_FIELDS.has(key)) {
      diags.push({
        severity: 'warning',
        rule: 'unknown-field',
        message: `unknown frontmatter field \`${key}\` — most agent runtimes ignore it`,
      });
    }
  }

  // --- body ---
  const bodyLines = fm.body.split('\n');
  if (fm.body.trim() === '') {
    diags.push({
      severity: 'error',
      rule: 'body-required',
      message: 'SKILL.md has no instruction body below the frontmatter',
    });
  } else if (bodyLines.length > BODY_RECOMMENDED_MAX_LINES) {
    diags.push({
      severity: 'warning',
      rule: 'body-size',
      message:
        `body is ${bodyLines.length} lines (recommended < ${BODY_RECOMMENDED_MAX_LINES}); ` +
        'split details into referenced files under references/ or scripts/',
    });
  }

  // --- relative links in body must resolve ---
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of fm.body.matchAll(linkPattern)) {
    const target = match[1].split('#')[0].trim();
    if (target === '' || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) continue;
    const resolved = path.join(skillDir, target);
    if (!fs.existsSync(resolved)) {
      diags.push({
        severity: 'error',
        rule: 'broken-reference',
        message: `body references "${target}" but the file does not exist in the skill directory`,
      });
    }
  }

  return diags;
}
