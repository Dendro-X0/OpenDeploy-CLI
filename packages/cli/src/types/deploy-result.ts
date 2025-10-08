export interface DeployResult {
  readonly url: string
  readonly projectId: string
  readonly logsUrl?: string
  readonly provider?: string
  readonly target?: 'prod' | 'preview'
  readonly durationMs?: number
}
