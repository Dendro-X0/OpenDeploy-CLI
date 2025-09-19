import { stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProviderAdapter } from '../../types/provider-adapter'
import type { DetectionResult } from '../../types/detection-result'
import type { DeployInputs } from '../../types/deploy-inputs'
import type { DeployResult } from '../../types/deploy-result'
import { readFile } from 'node:fs/promises'
import { proc } from '../../utils/process'
import { ensureLinked } from './link'

/**
 * Vercel provider adapter.
 * Handles generating `vercel.json` and (later) deploy operations via Vercel CLI/API.
 */
export class VercelAdapter implements ProviderAdapter {
  public readonly name = 'vercel'
  public async validateAuth(): Promise<void> {
    const who = await proc.run({ cmd: 'vercel whoami' })
    if (!who.ok) throw new Error('Not logged in to Vercel. Run: vercel login')
  }
  public async generateConfig(args: { readonly detection: DetectionResult; readonly overwrite: boolean }): Promise<string> {
    const root: string = args.detection.rootDir
    const path: string = join(root, 'vercel.json')
    if (args.overwrite !== true) {
      try { const s = await stat(path); if (s.isFile()) return path } catch { /* file not found, continue */ }
    }
    const config: Record<string, unknown> = {
      $schema: 'https://openapi.vercel.sh/vercel.json',
      version: 2,
      // Next.js is auto-detected by Vercel. Keep minimal config for portability.
      // Optionally, we include buildCommand if a custom build is provided.
      buildCommand: args.detection.buildCommand
    }
    // For static builds (e.g., Astro, SvelteKit static, Remix family static), include outputDirectory
    if (args.detection.publishDir) {
      config.outputDirectory = args.detection.publishDir
    }
    const content: string = `${JSON.stringify(config, null, 2)}\n`
    await writeFile(path, content, 'utf8')
    return path
  }
  public async deploy(inputs: DeployInputs): Promise<DeployResult> {
    const cwd: string = inputs.detection.rootDir
    if (inputs.dryRun) return { url: '', projectId: await this.readProjectId({ cwd }) ?? '' }
    await ensureLinked({ cwd, projectId: inputs.projectId, orgId: inputs.orgId })
    const flags: string = inputs.env === 'prod' ? '--prod --yes' : '--yes'
    const t0: number = Date.now()
    const out = await proc.run({ cmd: `vercel ${flags}`, cwd })
    const durationMs: number = Date.now() - t0
    if (!out.ok) throw new Error(out.stderr.trim() || 'Vercel deploy failed')
    const url: string = this.extractUrl(out.stdout)
    const logsUrl: string | undefined = this.extractLogsUrl(out.stdout)
    const projectId: string = await this.readProjectId({ cwd }) ?? ''
    if (url.length === 0) throw new Error('Vercel deploy succeeded but no URL found in output')
    return { url, projectId, logsUrl, provider: 'vercel', target: inputs.env, durationMs }
  }
  public async open(projectId?: string): Promise<void> {
    void projectId
    const cwd: string = process.cwd()
    const out = await proc.run({ cmd: 'vercel open', cwd })
    if (!out.ok) throw new Error(out.stderr.trim() || out.stdout.trim() || 'Failed to open Vercel dashboard')
  }
  public async logs(args: { readonly projectId?: string; readonly env: 'prod' | 'preview'; readonly follow?: boolean; readonly since?: string; readonly cwd?: string; readonly orgId?: string }): Promise<void> {
    // Best-effort: use current working directory (must be linked) and list deployments
    const cwd: string = args.cwd ?? process.cwd()
    const n = 1
    const flags: string[] = ['list', '--json', '-n', String(n)]
    if (args.env === 'prod') flags.push('--prod')
    if (args.projectId) flags.push('--project', args.projectId)
    const listCmd: string = `vercel ${flags.join(' ')}`
    const ls = await proc.run({ cmd: listCmd, cwd })
    if (!ls.ok) throw new Error(ls.stderr.trim() || ls.stdout.trim() || 'Failed to list deployments')
    let depUrl: string | undefined
    try {
      const arr = JSON.parse(ls.stdout) as Array<Record<string, unknown>>
      if (Array.isArray(arr) && arr.length > 0) {
        const chosen = arr[0] as Record<string, unknown>
        const urlFrag: unknown = (chosen as { url?: unknown }).url
        if (typeof urlFrag === 'string') depUrl = urlFrag.startsWith('http') ? urlFrag : `https://${urlFrag}`
      }
    } catch { /* ignore */ }
    if (!depUrl) {
      const m = ls.stdout.match(/https?:\/\/[^\s]+vercel\.app/)
      if (m) depUrl = m[0]
    }
    if (!depUrl) throw new Error('No recent deployment found')
    // Tail logs (do not handle NDJSON here; caller owns formatting)
    const since = args.since ? ` --since ${args.since}` : ''
    const follow = args.follow === true ? ' -f' : ''
    const ctrl = proc.spawnStream({ cmd: `vercel logs ${depUrl}${follow}${since}`.trim(), cwd })
    await ctrl.done
  }

  private extractUrl(text: string): string {
    const m: RegExpMatchArray | null = text.match(/https?:\/\/[^\s]+\.vercel\.app\b/)
    return m?.[0] ?? ''
  }

  private extractLogsUrl(text: string): string | undefined {
    const m: RegExpMatchArray | null = text.match(/https?:\/\/vercel\.com\/[^\s]+/)
    return m?.[0]
  }

  private async readProjectId(args: { readonly cwd: string }): Promise<string | null> {
    try {
      const p: string = join(args.cwd, '.vercel', 'project.json')
      const buf: string = await readFile(p, 'utf8')
      const data = JSON.parse(buf) as { projectId?: string }
      return typeof data.projectId === 'string' ? data.projectId : null
    } catch { return null }
  }

  // ensureLinked moved to providers/vercel/link
}
