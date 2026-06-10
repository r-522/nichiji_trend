---
name: code-reviewer
description: >-
  Reviews a git diff for correctness bugs, missing tests and style drift.
  Use when the user asks for a code review or before opening a pull request.
license: MIT
allowed-tools: [Read, Grep, Bash]
metadata:
  version: 1.0.0
---

# code-reviewer

## Overview

Performs a focused review of the currently staged diff and reports findings
ordered by severity.

## Instructions

1. Run `git diff --staged` (fall back to `git diff HEAD~1` if nothing is staged).
2. For each changed hunk, check for: off-by-one errors, unchecked error paths,
   resource leaks, and missing test updates.
3. Group findings by file and severity. Cite each finding as `file:line`.
4. For style conventions, follow [references/checklist.md](references/checklist.md).

## Examples

Input: a diff adding a new HTTP handler without a timeout.
Output: `server.ts:42 [warning] outbound fetch has no timeout — wrap with AbortSignal.timeout()`.
