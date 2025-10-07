import type { Provider } from '../provider-interface'
import type { ProviderCapabilities } from '../provider-capabilities'
import type { BuildInputs, BuildResult, DeployInputs, DeployResult, ProjectRef } from '../provider-types'
import { fsx } from '../../../utils/fs'
import { join } from 'node:path'

/**
 * VirtualProvider: hermetic, deterministic provider used for tests and local parity.
 * It performs no real network or CLI work and returns stable, typed results.
 */
export class VirtualProvider implements Provider {
  public readonly id: string

  public constructor(baseId: string) {
    this.id = `${baseId}-virtual`
  }

  /**
   * Minimal capabilities advertised for docs/UX; can be extended.
   */
  public getCapabilities(): ProviderCapabilities {
    return {
      name: 'Virtual Provider',
      supportsLocalBuild: true,
      supportsRemoteBuild: false,
      supportsStaticDeploy: true,
      supportsServerless: false,
      supportsEdgeFunctions: false,
      supportsSsr: false,
      hasProjectLinking: false,
      envContexts: ['preview', 'production'],
      supportsLogsFollow: true,
      supportsAliasDomains: false,
      supportsRollback: false
    }
  }

  public async detect(_cwd: string): Promise<{ readonly framework?: string; readonly publishDir?: string }> {
    return { framework: 'static', publishDir: 'dist' }
  }

  public async validateAuth(_cwd: string): Promise<void> { return }

  public async link(_cwd: string, project: ProjectRef): Promise<ProjectRef> { return project }

  public async build(args: BuildInputs): Promise<BuildResult> {
    const artifactDir: string = args.publishDirHint ?? 'dist'
    return { ok: true, artifactDir }
  }

  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const env: 'preview' | 'production' = args.envTarget
    const url: string = env === 'production' ? 'https://example-prod.virtual.app' : 'https://example-preview.virtual.app'
    const logsUrl: string = 'https://virtual.dev/provider/logs/abc123'
    return { ok: true, url, logsUrl }
  }

  public async open(_project: ProjectRef): Promise<void> { return }

  public async envList(_project: ProjectRef): Promise<Record<string, string[]>> { return {} }

  public async envSet(_project: ProjectRef, _kv: Record<string, string>): Promise<void> { return }

  public async logs(_project: ProjectRef, _options?: { readonly follow?: boolean }): Promise<void> { return }

  public async generateConfig(args: { readonly detection: { readonly framework?: string; readonly publishDir?: string }; readonly cwd: string; readonly overwrite: boolean }): Promise<string> {
    const filename: string = 'virtual.config.json'
    const path: string = join(args.cwd, filename)
    const exists: boolean = await fsx.exists(path)
    if (!exists || args.overwrite) {
      await fsx.writeJson(path, {
        provider: 'virtual',
        framework: args.detection.framework ?? 'static',
        publishDir: args.detection.publishDir ?? 'dist'
      })
    }
    return filename
  }
}
