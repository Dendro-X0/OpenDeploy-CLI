/**
 * Basic types shared by the provider system.
 */

/**
 * Reference to a provider project/site/app.
 */
export interface ProjectRef {
  readonly projectId?: string
  readonly orgId?: string
  readonly slug?: string
}

/**
 * Build inputs that a provider can use to produce artifacts.
 */
export interface BuildInputs {
  readonly cwd: string
  readonly framework?: string
  readonly envTarget: 'preview' | 'production'
  readonly publishDirHint?: string
  readonly noBuild?: boolean
}

/**
 * Result of a build step.
 */
export interface BuildResult {
  readonly ok: boolean
  readonly artifactDir?: string
  readonly logsUrl?: string
  readonly message?: string
}

/**
 * Deploy inputs describing how to deploy the built artifacts.
 */
export interface DeployInputs {
  readonly cwd: string
  readonly envTarget: 'preview' | 'production'
  readonly project: ProjectRef
  readonly artifactDir?: string
  readonly noBuild?: boolean
  readonly alias?: string
}

/**
 * Result of a deploy step.
 */
export interface DeployResult {
  readonly ok: boolean
  readonly url?: string
  readonly logsUrl?: string
  readonly message?: string
}
