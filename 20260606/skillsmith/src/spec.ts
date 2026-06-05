/**
 * Constraints from the Agent Skills (SKILL.md) open specification.
 *
 * Source of truth: agentskills.io/specification (Anthropic, Apache-2.0 / CC-BY-4.0),
 * cross-checked against the anthropics/skills reference implementation.
 *
 * Required front matter:
 *   - name        lowercase letters/numbers/hyphens, <= 64 chars, must match folder
 *   - description  non-empty, <= 1024 chars
 *
 * Optional front matter:
 *   - license        SPDX id or reference string
 *   - compatibility  environment notes, <= 500 chars
 *   - metadata       arbitrary string key/value mapping
 *   - allowed-tools  space-delimited list of pre-approved tools (experimental)
 */

export const NAME_MAX = 64;
export const DESCRIPTION_MAX = 1024;
export const COMPATIBILITY_MAX = 500;

/** lowercase alphanumerics, hyphen-separated, no leading/trailing/double hyphen. */
export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const REQUIRED_FIELDS = ["name", "description"] as const;

export const KNOWN_FIELDS = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
] as const;

export type KnownField = (typeof KNOWN_FIELDS)[number];

/** Lint thresholds (best-practice guidance, not hard spec requirements). */
export const LINT = {
  /** Progressive disclosure: keep the SKILL.md body lean; offload detail to references/. */
  bodyMaxLines: 500,
  /** A short description is usually a missed opportunity to help the agent route. */
  descriptionMinLength: 20,
  /** Descriptions should explain *when* to use the skill, not only *what* it does. */
  whenToUseHints: ["when", "use this", "use when", "for ", "to "],
} as const;

/** Directory entries an agent runtime recognises inside a skill bundle. */
export const BUNDLE_DIRS = ["scripts", "references", "assets"] as const;
