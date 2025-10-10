/**
 * Provider workflows interface and loader.
 * Each provider implements a dedicated workflow with prepare/envSync/deploy stages.
 */

import type { DetectionResult } from '../types/detection-result'

export type DeployTarget = 'prod' | 'preview'
export type ProviderKey = 'vercel'

export type PrepareInput = {
  readonly cwd: string
  readonly envTarget: DeployTarget
  readonly projectId?: string
}

export type PrepareResult = {
  readonly detection: DetectionResult
  readonly publishDir: string
  readonly siteId?: string
}

export type EnvSyncInput = {
  readonly cwd: string
  readonly envTarget: DeployTarget
  readonly file: string
  readonly yes: boolean
  readonly dryRun: boolean
  readonly json: boolean
  readonly ci: boolean
  readonly projectId?: string
  readonly mapFile?: string
  readonly ignore?: readonly string[]
  readonly only?: readonly string[]
  readonly optimizeWrites?: boolean
}

export type DeployInput = {
  readonly cwd: string
  readonly envTarget: DeployTarget
  readonly publishDir: string
  readonly projectId?: string
  readonly json: boolean
}

export type DeployResult = {
  readonly ok: boolean
  readonly url?: string
  readonly logsUrl?: string
}

export interface ProviderWorkflow {
  /** Prepare build metadata including detection and publish dir */
  prepare(input: PrepareInput): Promise<PrepareResult>
  /** Sync environment variables if requested */
  envSync(input: EnvSyncInput): Promise<void>
  /** Perform the deployment and return canonical URLs */
  deploy(input: DeployInput): Promise<DeployResult>
}

/** Load a provider workflow implementation */
export const getWorkflow = async (_p: ProviderKey): Promise<ProviderWorkflow> => {
  const mod = await import('../providers/vercel/workflow')
  return mod.workflow
}
