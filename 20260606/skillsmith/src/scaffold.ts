/** Scaffold a spec-compliant skill bundle. */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { NAME_PATTERN, NAME_MAX } from "./spec.ts";

export interface ScaffoldOptions {
  /** Directory under which `<name>/` is created. */
  parentDir: string;
  name: string;
  description?: string;
  license?: string;
  /** Also create empty scripts/ references/ assets/ directories. */
  withBundles?: boolean;
}

export interface ScaffoldResult {
  skillDir: string;
  created: string[];
}

function template(name: string, description: string, license?: string): string {
  const fm = [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    ...(license ? [`license: ${license}`] : []),
    "---",
  ].join("\n");

  return `${fm}

# ${name}

${description}

## Instructions

1. Describe the first step the agent should take.
2. Keep this file lean — link out to \`references/\` for long material so the
   agent only loads detail when it is needed (progressive disclosure).

## Examples

> Show a representative input and the expected behaviour here.
`;
}

export function scaffoldSkill(opts: ScaffoldOptions): ScaffoldResult {
  const { name } = opts;
  if (name.length > NAME_MAX) {
    throw new Error(`name is ${name.length} chars; max is ${NAME_MAX}`);
  }
  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      "name must be lowercase letters, numbers and single hyphens " +
        "(no leading/trailing/double hyphen)",
    );
  }

  const skillDir = join(opts.parentDir, name);
  if (existsSync(skillDir)) {
    throw new Error(`refusing to overwrite existing directory: ${skillDir}`);
  }

  const created: string[] = [];
  mkdirSync(skillDir, { recursive: true });
  created.push(skillDir);

  const description =
    opts.description ?? `Use this skill when ... (describe when ${name} applies).`;
  const skillFile = join(skillDir, "SKILL.md");
  writeFileSync(skillFile, template(name, description, opts.license), "utf8");
  created.push(skillFile);

  if (opts.withBundles) {
    for (const dir of ["scripts", "references", "assets"]) {
      const p = join(skillDir, dir);
      mkdirSync(p, { recursive: true });
      writeFileSync(join(p, ".gitkeep"), "", "utf8");
      created.push(p);
    }
  }

  return { skillDir, created };
}
