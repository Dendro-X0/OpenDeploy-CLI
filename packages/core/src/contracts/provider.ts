/**
 * Provider contracts for vNext.
 * Public types used by CLI and providers.
 */

/** Canonical provider identifiers. */
export type ProviderId = 'github-pages' | 'vercel' | 'cloudflare-pages'

/** Provider capability descriptor. */
export interface ProviderCapabilities {
  readonly name: string
  readonly supportsLocalBuild: boolean
  readonly supportsRemoteBuild: boolean
  readonly supportsStaticDeploy: boolean
  readonly supportsSsr: boolean
  readonly supportsLogsFollow: boolean
}

/** Detection result for framework and publish directory. */
export interface Detected {
  readonly framework?: string
  readonly publishDir?: string
}

/** Build inputs provided to a provider implementation. */
export interface BuildInputs {
  readonly cwd: string
  readonly framework?: string
  readonly publishDirHint?: string
  readonly noBuild?: boolean
}

/** Build result produced by a provider. */
export interface BuildResult {
  readonly ok: boolean
  readonly artifactDir?: string
  readonly message?: string
  readonly hints?: readonly Hint[]
}

/** Deploy inputs provided to a provider implementation. */
export interface DeployInputs {
  readonly cwd: string
  readonly artifactDir?: string
  readonly env?: 'production' | 'preview'
  readonly timeoutSeconds?: number
}

/** Deploy result produced by a provider. */
export interface DeployResult {
  readonly ok: boolean
  readonly url?: string
  readonly logsUrl?: string
  readonly message?: string
  readonly hints?: readonly Hint[]
}

/** Generate-config inputs. */
export interface GenerateArgs {
  readonly cwd: string
  readonly overwrite?: boolean
  readonly detection: Detected
}

/** Structured remediation hint. */
export interface Hint {
  readonly code: string
  readonly message: string
  readonly action?: string
}

/**
 * Provider implementation boundary (vNext).
 * Implementations should be pure and platform-agnostic, delegating to
 * a ProcessRunner for process execution concerns.
 */
export interface Provider {
  readonly id: ProviderId
  getCapabilities(): ProviderCapabilities
  detect(cwd: string): Promise<Detected>
  build(args: BuildInputs): Promise<BuildResult>
  deploy(args: DeployInputs): Promise<DeployResult>
  generateConfig?(args: GenerateArgs): Promise<string>
}
