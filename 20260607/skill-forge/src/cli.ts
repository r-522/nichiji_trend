#!/usr/bin/env node
/**
 * skill-forge CLI.
 *
 * Commands:
 *   demo                 Run a scripted self-evolving skill loop (no args).
 *   recall "<task>"      Print skills most relevant to a task.
 *   list                 List all stored skills with their confidence.
 *
 * The store path defaults to ./.skill-forge/skills.json and can be overridden
 * with the SKILL_FORGE_DB environment variable.
 */

import { SkillForge } from "./forge.js";
import type { Trajectory } from "./types.js";

const DB_PATH = process.env.SKILL_FORGE_DB ?? "./.skill-forge/skills.json";

/** A small corpus of attempts an agent might log over several sessions. */
const SAMPLE_TRAJECTORIES: Trajectory[] = [
  {
    task: "Fix failing unit tests in a Python project",
    tags: ["python", "testing"],
    success: true,
    steps: [
      { action: "run_tests", observation: "3 failures in test_auth.py" },
      { action: "read_traceback", observation: "AssertionError on token expiry" },
      { action: "patch_code", observation: "adjust expiry to UTC" },
      { action: "run_tests", observation: "all green" },
    ],
  },
  {
    task: "Fix failing unit tests in python project",
    tags: ["python"],
    success: true,
    steps: [
      { action: "run_tests", observation: "1 failure" },
      { action: "read_traceback", observation: "ImportError" },
      { action: "install_dependency", observation: "added missing package" },
      { action: "patch_code", observation: "fixed import path" },
      { action: "run_tests", observation: "all green" },
    ],
  },
  {
    task: "Resolve a git merge conflict on a feature branch",
    tags: ["git"],
    success: true,
    steps: [
      { action: "git_status", observation: "2 conflicting files" },
      { action: "open_conflict_markers", observation: "found <<<<<<< blocks" },
      { action: "resolve_hunks", observation: "kept incoming changes" },
      { action: "git_add", observation: "staged resolved files" },
      { action: "git_commit", observation: "merge resolved" },
    ],
  },
  {
    task: "Fix failing unit tests in a python codebase",
    tags: ["python", "ci"],
    success: false,
    steps: [
      { action: "run_tests", observation: "flaky failure, could not reproduce" },
    ],
  },
];

async function runDemo(): Promise<void> {
  const forge = await SkillForge.open(DB_PATH);

  console.log("=== skill-forge: self-evolving skill loop ===\n");
  console.log(`Ingesting ${SAMPLE_TRAJECTORIES.length} trajectories...\n`);

  for (const traj of SAMPLE_TRAJECTORIES) {
    const skill = forge.observe(traj);
    const verdict = traj.success ? "✔ success" : "✗ failure";
    console.log(
      `  ${verdict}  "${traj.task}"\n` +
        `           -> skill ${skill.id} | confidence ${skill.confidence.toFixed(2)} ` +
        `(${skill.successes}✓/${skill.failures}✗) | ${skill.procedure.length} steps`,
    );
  }

  await forge.flush();
  console.log(`\nStored ${forge.size} distinct skill(s) at ${DB_PATH}\n`);

  const query = "tests are failing in my python app";
  console.log(`Recall for: "${query}"`);
  const hits = forge.recall(query);
  if (hits.length === 0) {
    console.log("  (no relevant skills)");
  }
  for (const { skill, score } of hits) {
    console.log(
      `  [${score.toFixed(2)}] ${skill.name} (conf ${skill.confidence.toFixed(2)})`,
    );
    console.log(`        procedure: ${skill.procedure.join(" -> ")}`);
  }
}

async function runRecall(task: string): Promise<void> {
  const forge = await SkillForge.open(DB_PATH);
  const hits = forge.recall(task);
  if (hits.length === 0) {
    console.log("No relevant skills found.");
    return;
  }
  for (const { skill, score } of hits) {
    console.log(
      `[${score.toFixed(2)}] ${skill.name} | confidence ${skill.confidence.toFixed(2)}`,
    );
    console.log(`    ${skill.procedure.join(" -> ")}`);
  }
}

async function runList(): Promise<void> {
  const forge = await SkillForge.open(DB_PATH);
  if (forge.size === 0) {
    console.log("No skills stored yet. Run `skill-forge demo` first.");
    return;
  }
  for (const skill of forge.skills()) {
    console.log(
      `${skill.id}  conf ${skill.confidence.toFixed(2)}  (${skill.successes}✓/${skill.failures}✗)  ${skill.name}`,
    );
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case undefined:
    case "demo":
      await runDemo();
      break;
    case "recall":
      if (rest.length === 0) {
        console.error('Usage: skill-forge recall "<task description>"');
        process.exitCode = 1;
        return;
      }
      await runRecall(rest.join(" "));
      break;
    case "list":
      await runList();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      console.error("Commands: demo | recall \"<task>\" | list");
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
