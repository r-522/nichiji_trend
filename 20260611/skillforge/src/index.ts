#!/usr/bin/env node
/**
 * skillforge — scaffold, validate, list and inspect Agent Skills (SKILL.md open standard).
 */

import { init } from './commands/init.js';
import { validate } from './commands/validate.js';
import { list } from './commands/list.js';
import { inspect } from './commands/inspect.js';

const USAGE = `skillforge — toolkit for the Agent Skills (SKILL.md) open standard

Usage:
  skillforge init <name> [parent-dir]   Scaffold a new skill directory
  skillforge validate <path...>         Lint SKILL.md against the spec (exit 1 on errors)
  skillforge list <dir>                 Inventory all skills under a directory tree
  skillforge inspect <path>             Show metadata and token budget for one skill
  skillforge help                       Show this message
`;

function main(argv: string[]): number {
  const [command, ...args] = argv;

  try {
    switch (command) {
      case 'init':
        if (args.length < 1) throw new Error('usage: skillforge init <name> [parent-dir]');
        init(args[0], args[1] ?? '.');
        return 0;
      case 'validate':
        if (args.length < 1) throw new Error('usage: skillforge validate <path...>');
        return validate(args) > 0 ? 1 : 0;
      case 'list':
        if (args.length !== 1) throw new Error('usage: skillforge list <dir>');
        list(args[0]);
        return 0;
      case 'inspect':
        if (args.length !== 1) throw new Error('usage: skillforge inspect <path>');
        inspect(args[0]);
        return 0;
      case 'help':
      case '--help':
      case '-h':
      case undefined:
        console.log(USAGE);
        return command === undefined ? 1 : 0;
      default:
        console.error(`unknown command: ${command}\n`);
        console.log(USAGE);
        return 1;
    }
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
