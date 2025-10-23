/**
 * Adapter to use the vNext @opendeploy/provider-vercel within the
 * existing CLI provider system (legacy interface expected by commands).
 */
import type { Provider as LegacyProvider } from '../provider-interface'
import type { ProviderCapabilities } from '../provider-capabilities'
import type { ProjectRef, BuildInputs as LegacyBuildInputs, BuildResult as LegacyBuildResult, DeployInputs as LegacyDeployInputs, DeployResult as LegacyDeployResult } from '../provider-types'
import type { DetectionResult } from '../../../types/detection-result'
import { VercelProvider as VNextProvider } from '@opendeploy/provider-vercel'

export class VercelVNextAdapter implements LegacyProvider {
  public readonly id: string = 'vercel'
  private readonly impl = new VNextProvider()

  public getCapabilities(): ProviderCapabilities {
    const caps = this.impl.getCapabilities()
    return {
      name: caps.name,
      supportsLocalBuild: caps.supportsLocalBuild,
      supportsRemoteBuild: caps.supportsRemoteBuild,
      supportsStaticDeploy: caps.supportsStaticDeploy,
      supportsServerless: true,
      supportsEdgeFunctions: true,
      supportsSsr: caps.supportsSsr,
      hasProjectLinking: true,
      envContexts: ['preview','production'],
      supportsLogsFollow: caps.supportsLogsFollow,
      supportsAliasDomains: true,
      supportsRollback: false
    }
  }

  public async detect(cwd: string): Promise<{ readonly framework?: string; readonly publishDir?: string }> {
    return await this.impl.detect(cwd)
  }

  public async validateAuth(_cwd: string): Promise<void> { return }

  public async link(cwd: string, project: ProjectRef): Promise<ProjectRef> {
    if (project.projectId || project.slug) return project
    const base = cwd.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'app'
    return { projectId: base, slug: base }
  }

  public async build(args: LegacyBuildInputs): Promise<LegacyBuildResult> {
    const r = await this.impl.build({ cwd: args.cwd, framework: args.framework, publishDirHint: args.publishDirHint, noBuild: args.noBuild })
    return { ok: r.ok, artifactDir: r.artifactDir, message: r.message }
  }

  public async deploy(args: LegacyDeployInputs): Promise<LegacyDeployResult> {
    const env = args.envTarget === 'production' ? 'production' : 'preview'
    const r = await this.impl.deploy({ cwd: args.cwd, artifactDir: args.artifactDir, env })
    return { ok: r.ok, url: r.url, logsUrl: r.logsUrl, message: r.message }
  }

  public async open(_project: ProjectRef): Promise<void> { return }
  public async envList(_project: ProjectRef): Promise<Record<string, string[]>> { return {} }
  public async envSet(_project: ProjectRef, _kv: Record<string, string>): Promise<void> { return }
  public async logs(_project: ProjectRef): Promise<void> { return }

  public async generateConfig(args: { readonly detection: DetectionResult; readonly cwd: string; readonly overwrite: boolean }): Promise<string> {
    return await this.impl.generateConfig({ detection: { framework: args.detection.framework, publishDir: args.detection.publishDir }, cwd: args.cwd, overwrite: args.overwrite })
  }
}
