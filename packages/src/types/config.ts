export type Provider = "vercel"

export interface ProjectSeedConfig {
  readonly schema: "sql" | "prisma" | "script"
  readonly script?: string
}

/** Global environment policy defaults applied when project values and CLI flags are not provided. */
export interface EnvPolicy {
  /** Patterns for keys to include (glob: * supported) */
  readonly envOnly?: readonly string[]
  /** Patterns for keys to ignore (glob: * supported) */
  readonly envIgnore?: readonly string[]
  /** Fail CI when local has keys not present remotely */
  readonly failOnAdd?: boolean
  /** Fail CI when remote has keys missing locally */
  readonly failOnRemove?: boolean
}

export interface ProjectConfig {
  readonly name: string
  readonly path: string
  readonly provider: Provider
  readonly envFilePreview?: string
  readonly envFileProd?: string
  readonly seed?: ProjectSeedConfig
  /** Tags to select this project in run orchestrations */
  readonly tags?: readonly string[]
  /** Project names this project depends on; these will run before this project */
  readonly dependsOn?: readonly string[]
  /** Patterns for keys to include (glob: * supported), e.g. ["NEXT_PUBLIC_*","DATABASE_URL"] */
  readonly envOnly?: readonly string[]
  /** Patterns for keys to ignore (glob: * supported), e.g. ["NEXT_PUBLIC_*"] */
  readonly envIgnore?: readonly string[]
  /** Fail CI when local has keys not present remotely (for env diff/sync pre-checks) */
  readonly failOnAdd?: boolean
  /** Fail CI when remote has keys missing locally (for env diff/sync pre-checks) */
  readonly failOnRemove?: boolean
}

export interface OpenDeployConfig {
  /** Optional global env policy defaults applied for all projects */
  readonly policy?: EnvPolicy
  readonly projects: readonly ProjectConfig[]
}
