import type { DeployInputs } from './deploy-inputs'
import type { DeployResult } from './deploy-result'
import type { DetectionResult } from './detection-result'
import type { ProviderName } from './provider-name'

export interface ProviderAdapter {
  readonly name: ProviderName
  validateAuth(): Promise<void>
  generateConfig(args: { readonly detection: DetectionResult; readonly overwrite: boolean }): Promise<string>
  deploy(inputs: DeployInputs): Promise<DeployResult>
  open(projectId?: string): Promise<void>
  logs(args: { readonly projectId?: string; readonly env: 'prod' | 'preview'; readonly follow?: boolean; readonly since?: string; readonly cwd?: string; readonly orgId?: string }): Promise<void>
}
