import type { ProviderWorkflow, PrepareInput, PrepareResult, EnvSyncInput, DeployInput, DeployResult } from '../../core/workflow'
import type { DetectionResult } from '../../types/detection-result'
import { envSync as envSyncCmd } from '../../commands/env'

export const workflow: ProviderWorkflow = {
  async prepare(input: PrepareInput): Promise<PrepareResult> {
    let detection: DetectionResult
    try {
      const auto = await import('../../core/detectors/auto')
      detection = await auto.detectApp({ cwd: input.cwd }) as DetectionResult
    } catch {
      detection = {
        framework: 'next',
        rootDir: input.cwd,
        appDir: input.cwd,
        hasAppRouter: true,
        packageManager: 'npm',
        monorepo: 'none',
        buildCommand: 'npm run build',
        outputDir: '.next',
        publishDir: '.next',
        renderMode: 'hybrid',
        confidence: 0.5,
        environmentFiles: []
      }
    }
    const publishDir = detection.publishDir || '.next'
    return { detection, publishDir }
  },

  async envSync(input: EnvSyncInput): Promise<void> {
    await envSyncCmd({
      provider: 'vercel',
      cwd: input.cwd,
      file: input.file,
      env: input.envTarget,
      yes: input.yes,
      dryRun: input.dryRun,
      json: input.json,
      ci: input.ci,
      projectId: input.projectId,
      ignore: input.ignore,
      only: input.only,
      optimizeWrites: input.optimizeWrites,
      mapFile: input.mapFile
    })
  },

  async deploy(_input: DeployInput): Promise<DeployResult> {
    // Not used; Vercel deploy remains handled in existing code paths.
    return { ok: false }
  }
}
