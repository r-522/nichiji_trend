/** Lifecycle scripts that npm v12 stops running by default. */
export const BLOCKED_LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall"] as const;

export type BlockedLifecycleScript = (typeof BLOCKED_LIFECYCLE_SCRIPTS)[number];

/** Why a package will be affected by the npm v12 defaults. */
export type FindingKind =
  | "install-script" // declares preinstall/install/postinstall
  | "implicit-node-gyp" // ships binding.gyp, npm runs node-gyp rebuild implicitly
  | "git-dependency" // resolved from a git URL, blocked by --allow-git=none
  | "remote-dependency"; // resolved from a non-registry tarball URL, blocked by --allow-remote=none

export interface Finding {
  kind: FindingKind;
  /** Package name, e.g. "esbuild". */
  name: string;
  version: string;
  /** node_modules path or lockfile key the finding came from. */
  location: string;
  /** Which lifecycle scripts are declared (install-script findings only). */
  scripts?: BlockedLifecycleScript[];
  /** The git/remote URL the package resolves from (git/remote findings only). */
  resolved?: string;
  /** True when the package is a direct dependency of the audited project. */
  direct: boolean;
}

export interface AuditSource {
  /** Absolute path of the audited project. */
  projectDir: string;
  lockfileFound: boolean;
  nodeModulesFound: boolean;
}

export interface AuditResult {
  source: AuditSource;
  findings: Finding[];
}

/** Subset of package.json we care about. */
export interface PackageManifest {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/** Subset of a lockfile v2/v3 "packages" entry. */
export interface LockfilePackageEntry {
  version?: string;
  resolved?: string;
  hasInstallScript?: boolean;
  link?: boolean;
  dev?: boolean;
}

export interface Lockfile {
  lockfileVersion?: number;
  packages?: Record<string, LockfilePackageEntry>;
}
