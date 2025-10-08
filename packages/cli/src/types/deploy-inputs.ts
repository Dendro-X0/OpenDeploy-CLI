import type { ProviderName } from './provider-name'
import type { DetectionResult } from './detection-result'

export interface DeployInputs {
  readonly provider: ProviderName
  readonly detection: DetectionResult
  readonly env: 'prod' | 'preview'
  readonly dryRun: boolean
  readonly projectId?: string
  readonly orgId?: string
  readonly envVars: Readonly<Record<string, string>>
}
