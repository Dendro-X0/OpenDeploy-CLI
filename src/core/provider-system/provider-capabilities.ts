/**
 * ProviderCapabilities describes what a provider can do so the CLI can
 * adapt prompts, flows, and guards without hardcoding provider specifics.
 */
export interface ProviderCapabilities {
  readonly name: string
  readonly supportsLocalBuild: boolean
  readonly supportsRemoteBuild: boolean
  readonly supportsStaticDeploy: boolean
  readonly supportsServerless: boolean
  readonly supportsEdgeFunctions: boolean
  readonly supportsSsr: boolean
  readonly hasProjectLinking: boolean
  readonly envContexts: readonly string[]
  readonly supportsLogsFollow: boolean
  readonly supportsAliasDomains: boolean
  readonly supportsRollback: boolean
}
