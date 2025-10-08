import type { ProviderCapabilities } from './provider-capabilities'
import type { ProjectRef, BuildInputs, BuildResult, DeployInputs, DeployResult } from './provider-types'
import type { DetectionResult } from '../../types/detection-result'

/**
 * The Provider interface is implemented by each provider plugin (e.g. vercel, netlify, cloudflare).
 */
export interface Provider {
  readonly id: string
  getCapabilities(): ProviderCapabilities
  detect(cwd: string): Promise<{ readonly framework?: string; readonly publishDir?: string }>
  validateAuth(cwd: string): Promise<void>
  link(cwd: string, project: ProjectRef): Promise<ProjectRef>
  build(args: BuildInputs): Promise<BuildResult>
  deploy(args: DeployInputs): Promise<DeployResult>
  open(project: ProjectRef): Promise<void>
  envList(project: ProjectRef): Promise<Record<string, string[]>>
  envSet(project: ProjectRef, kv: Record<string, string>): Promise<void>
  logs(project: ProjectRef, options?: { readonly follow?: boolean }): Promise<void>
  /**
   * Generate provider-specific config files (e.g. vercel.json, netlify.toml) in cwd.
   * Returns the absolute or relative path to the written config file.
   */
  generateConfig(args: { readonly detection: DetectionResult; readonly cwd: string; readonly overwrite: boolean }): Promise<string>
  rollback?(project: ProjectRef, to?: string): Promise<DeployResult>
}
