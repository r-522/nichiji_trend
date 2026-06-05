---
name: Bad_Skill
description: does stuff
foo: bar
---

# Bad Skill

This skill intentionally violates the spec so the validator has something to
catch: the `name` uses uppercase and an underscore (and does not match the
folder), the `description` is too short to be useful, `foo` is an unknown
field, and there is no `license`.
