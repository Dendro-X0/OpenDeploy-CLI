/**
 * VercelShim adapts the existing VercelAdapter to the new Provider interface.
 */
import type { Provider } from '../provider-interface'
import type { ProviderCapabilities } from '../provider-capabilities'
import type { ProjectRef, BuildInputs, BuildResult, DeployInputs, DeployResult } from '../provider-types'
import { proc } from '../../../utils/process'
import { VercelAdapter } from '../../../providers/vercel/adapter'
import { detectApp } from '../../detectors/auto'

export class VercelShim implements Provider {
  public readonly id: string = 'vercel'
  public constructor(private readonly adapter: VercelAdapter) {}

  public getCapabilities(): ProviderCapabilities {
    return {
      name: 'Vercel',
      supportsLocalBuild: false,
      supportsRemoteBuild: true,
      supportsStaticDeploy: true,
      supportsServerless: true,
      supportsEdgeFunctions: true,
      supportsSsr: true,
      hasProjectLinking: true,
      envContexts: ['preview', 'production'],
      supportsLogsFollow: true,
      supportsAliasDomains: true,
      supportsRollback: false
    }
  }

  public async detect(cwd: string): Promise<{ readonly framework?: string; readonly publishDir?: string }> {
    try { const det = await detectApp({ cwd }); return { framework: det.framework as string | undefined, publishDir: det.publishDir } } catch { return {} }
  }

  public async validateAuth(_cwd: string): Promise<void> {
    await this.adapter.validateAuth()
  }

  public async link(cwd: string, project: ProjectRef): Promise<ProjectRef> {
    const flags: string[] = ['--yes']
    if (project.projectId) flags.push(`--project ${project.projectId}`)
    if (project.orgId) flags.push(`--org ${project.orgId}`)
    await proc.run({ cmd: `vercel link ${flags.join(' ')}`, cwd })
    return project
  }

  public async build(_args: BuildInputs): Promise<BuildResult> {
    // Vercel prefers remote builds via `vercel deploy`. Treat build as no-op.
    return { ok: true }
  }

  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const prod = args.envTarget === 'production'
    const cmd = prod ? 'vercel deploy --prod --yes' : 'vercel deploy --yes'
    let deployedUrl: string | undefined
    let logsUrl: string | undefined
    const urlRe = /https?:\/\/[^\s]+vercel\.app/g
    const inspectRe = /https?:\/\/[^\s]*vercel\.com[^\s]*/g
    const controller = proc.spawnStream({
      cmd,
      cwd: args.cwd,
      onStdout: (chunk: string): void => {
        const m = chunk.match(urlRe)
        if (!deployedUrl && m && m.length > 0) deployedUrl = m[0]
      },
      onStderr: (chunk: string): void => {
        if (!logsUrl) {
          const m = chunk.match(inspectRe)
          if (m && m.length > 0) logsUrl = m[0]
        }
      }
    })
    const res = await controller.done
    if (!res.ok) return { ok: false, message: 'Vercel deploy failed' }
    return { ok: true, url: deployedUrl, logsUrl }
  }

  public async open(project: ProjectRef): Promise<void> {
    await this.adapter.open(project.projectId ?? '')
  }

  public async envList(_project: ProjectRef): Promise<Record<string, string[]>> {
    // Best-effort list via CLI; we return keys with context arrays
    const out = await proc.run({ cmd: 'vercel env ls', cwd: process.cwd() })
    if (!out.ok) return {}
    const map: Record<string, string[]> = {}
    try {
      const lines = out.stdout.split(/\r?\n/)
      for (const line of lines) {
        const m = line.match(/^(\w[\w_]+)\s+/)
        if (m && m[1]) map[m[1]] = []
      }
    } catch { /* ignore */ }
    return map
  }

  public async envSet(_project: ProjectRef, kv: Record<string, string>): Promise<void> {
    for (const [k, v] of Object.entries(kv)) {
      await proc.run({ cmd: `vercel env add ${k} ${JSON.stringify(v)}`, cwd: process.cwd() })
    }
  }

  public async logs(_project: ProjectRef, _options?: { readonly follow?: boolean }): Promise<void> {
    return
  }
}
