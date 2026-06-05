---
name: commit-helper
description: Use this skill when the user wants to write a conventional-commit message for staged git changes. Summarises the diff and proposes a type, scope, and subject line.
license: Apache-2.0
---

# commit-helper

Draft Conventional Commits messages from staged changes.

## Instructions

1. Run `git diff --cached` to inspect staged changes.
2. Pick a type: feat, fix, docs, refactor, test, chore.
3. Propose `type(scope): subject` under 72 characters, plus a short body.

## Examples

> Staged a bug fix in the auth module → `fix(auth): reject expired refresh tokens`.
