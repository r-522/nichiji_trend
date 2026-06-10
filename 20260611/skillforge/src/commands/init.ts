/** `skillforge init <name>` — scaffold a new skill directory. */

import fs from 'node:fs';
import path from 'node:path';
import { NAME_PATTERN, NAME_MAX_LENGTH } from '../spec.js';

const TEMPLATE = (name: string) => `---
name: ${name}
description: >-
  TODO: one or two sentences describing what this skill does and when an agent
  should use it. Start the trigger clause with "Use when ...".
license: MIT
---

# ${name}

## Overview

Explain the capability this skill provides.

## Instructions

1. Describe the workflow step by step.
2. Keep this file under 500 lines; move long reference material to
   [references/details.md](references/details.md).

## Examples

Show one concrete input/output example so the agent can imitate it.
`;

const REFERENCE_TEMPLATE = `# Details

Long-form reference material goes here. Agents only read this file when the
SKILL.md body points them to it (progressive disclosure level 3).
`;

export function init(name: string, parentDir = '.'): void {
  if (!NAME_PATTERN.test(name) || name.length > NAME_MAX_LENGTH) {
    throw new Error(
      `invalid skill name "${name}": use lowercase letters/digits separated by hyphens, max ${NAME_MAX_LENGTH} chars`,
    );
  }
  const dir = path.resolve(parentDir, name);
  if (fs.existsSync(dir)) {
    throw new Error(`directory already exists: ${dir}`);
  }
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), TEMPLATE(name));
  fs.writeFileSync(path.join(dir, 'references', 'details.md'), REFERENCE_TEMPLATE);

  console.log(`Created skill scaffold at ${dir}`);
  console.log(`  ${name}/`);
  console.log('  ├── SKILL.md');
  console.log('  ├── references/');
  console.log('  │   └── details.md');
  console.log('  └── scripts/');
  console.log('\nNext: edit SKILL.md, then run `skillforge validate ' + name + '`');
}
