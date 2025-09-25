import { join } from 'node:path'
import { proc } from '../../../utils/process'
import type { Provider } from '../provider'
import type { ProviderCapabilities } from '../provider-capabilities'
import type { ProjectRef, BuildInputs, BuildResult, DeployInputs, DeployResult } from '../provider-types'
import { fsx } from '../../../utils/fs'
import { NetlifyAdapter } from '../../../providers/netlify/adapter'
import { detectApp } from '../../detectors/auto'

export class NetlifyShim implements Provider {
  public readonly id: string = 'netlify'
  public constructor(private readonly adapter: NetlifyAdapter) {}

  public getCapabilities(): ProviderCapabilities {
    return {
      name: 'Netlify',
      supportsLocalBuild: true,
      supportsRemoteBuild: false,
      supportsStaticDeploy: true,
      supportsServerless: true,
      supportsEdgeFunctions: true,
      supportsSsr: true,
      hasProjectLinking: true,
      envContexts: ['production', 'deploy-preview'],
      supportsLogsFollow: false,
      supportsAliasDomains: false,
      supportsRollback: false
    }
  }

  public async detect(cwd: string): Promise<{ readonly framework?: string; readonly publishDir?: string }> {
    try { const det = await detectApp({ cwd }); return { framework: det.framework as string | undefined, publishDir: det.publishDir } } catch { return {} }
  }

  public async validateAuth(cwd: string): Promise<void> {
    await this.adapter.validateAuth()
  }

  public async link(cwd: string, project: ProjectRef): Promise<ProjectRef> {
    if (project.projectId) {
      const out = await proc.run({ cmd: `netlify link --id ${project.projectId}` , cwd })
      if (!out.ok) throw new Error('Netlify link failed')
    }
    return project
  }

  public async build(args: BuildInputs): Promise<BuildResult> {
    if (args.noBuild === true) return { ok: true, artifactDir: args.publishDirHint ? join(args.cwd, args.publishDirHint) : undefined }
    const ctx = args.envTarget === 'production' ? 'production' : 'deploy-preview'
    const res = await proc.run({ cmd: `netlify build --context ${ctx}`, cwd: args.cwd })
    if (!res.ok) return { ok: false, message: res.stderr.trim() || res.stdout.trim() || 'Netlify build failed' }
    const artifactDir = args.publishDirHint ? join(args.cwd, args.publishDirHint) : undefined
    return { ok: true, artifactDir }
  }

  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const siteFlag = args.project.projectId ? ` --site ${args.project.projectId}` : ''
    const prodFlag = args.envTarget === 'production' ? ' --prod' : ''
    const dirFlag = args.artifactDir ? ` --dir ${args.artifactDir}` : ''
    const cmd = `netlify deploy --no-build${prodFlag}${dirFlag}${siteFlag}`.trim()
    const out = await proc.run({ cmd, cwd: args.cwd })
    if (!out.ok) return { ok: false, message: out.stderr.trim() || out.stdout.trim() || 'Netlify deploy failed' }
    const m = out.stdout.match(/https?:\/\/[^\s]+\.netlify\.app\b/)
    const url: string | undefined = m?.[0]
    // Best-effort logs URL via API if linked
    let logsUrl: string | undefined
    try {
      const siteId = args.project.projectId
      if (siteId) {
        const siteRes = await proc.run({ cmd: `netlify api getSite --data '{"site_id":"${siteId}"}'`, cwd: args.cwd })
        if (siteRes.ok) {
          const js = JSON.parse(siteRes.stdout) as { admin_url?: string }
          if (typeof js.admin_url === 'string') logsUrl = `${js.admin_url}/deploys`
        }
      }
    } catch { /* ignore */ }
    return { ok: true, url, logsUrl }
  }

  public async open(project: ProjectRef): Promise<void> {
    await this.adapter.open(project.projectId ?? '')
  }

  public async envList(project: ProjectRef): Promise<Record<string, string[]>> {
    const out = await proc.run({ cmd: 'netlify env:list --json', cwd: process.cwd() })
    if (!out.ok) return {}
    try {
      const arr = JSON.parse(out.stdout) as Array<{ key?: string; values?: Array<{ context?: string; value?: string }> }>
      const map: Record<string, string[]> = {}
      for (const item of arr) {
        const key = item.key
        if (!key) continue
        map[key] = (item.values || []).map(v => v.value || '')
      }
      return map
    } catch { return {} }
  }

  public async envSet(project: ProjectRef, kv: Record<string, string>): Promise<void> {
    for (const [k, v] of Object.entries(kv)) {
      await proc.run({ cmd: `netlify env:set ${k} ${JSON.stringify(v)}`, cwd: process.cwd() })
    }
  }

  public async logs(_project: ProjectRef, _options?: { readonly follow?: boolean }): Promise<void> {
    // No unified logs follow via CLI for now; users can navigate to logsUrl
    return
  }
}
