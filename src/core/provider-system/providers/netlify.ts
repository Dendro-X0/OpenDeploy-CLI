import type { Provider } from '../provider-interface'
import type { ProviderCapabilities } from '../provider-capabilities'
import type { ProjectRef, BuildInputs, BuildResult, DeployInputs, DeployResult } from '../provider-types'
import { proc, runWithRetry } from '../../../utils/process'
import { join } from 'node:path'
import { fsx } from '../../../utils/fs'
import { detectApp } from '../../detectors/auto'
import { writeFile, stat } from 'node:fs/promises'
import type { DetectionResult } from '../../../types/detection-result'

/**
 * Netlify provider plugin implementing the Provider interface.
 * Uses build-first then deploy --no-build for reliable uploads.
 */
export class NetlifyProvider implements Provider {
  public readonly id: string = 'netlify'

  private envOverlay(): Readonly<Record<string, string>> | undefined {
    const token = process.env.OPD_NETLIFY_AUTH_TOKEN
    if (token && token.length > 0) return { NETLIFY_AUTH_TOKEN: token, CI: '1' }
    return undefined
  }

  private stepTimeout(defaultMs: number): number {
    const envMs = Number(process.env.OPD_TIMEOUT_MS)
    if (Number.isFinite(envMs) && envMs > 0) return Math.max(defaultMs, envMs)
    return defaultMs
  }

  /**
   * Shell-safe JSON for --data across Windows cmd.exe and POSIX shells.
   */
  private jsonArg(data: unknown): string {
    const json: string = JSON.stringify(data)
    if (process.platform === 'win32') {
      // Wrap in double quotes and escape inner quotes
      return `"${json.replace(/\"/g, '\\\"').replace(/"/g, '\\"')}"`
    }
    // POSIX: safe to wrap JSON (double-quoted) inside single quotes since JSON doesn't contain single quotes
    return `'${json}'`
  }

  private async resolveNetlify(cwd: string): Promise<string> {
    const envBin = process.env.OPD_NETLIFY_BIN
    if (envBin && envBin.length > 0) {
      const chk = await proc.run({ cmd: `${envBin} --version`, cwd })
      if (chk.ok) return envBin
    }
    const tryCmd = async (cmd: string): Promise<string | undefined> => {
      const r = await proc.run({ cmd: `${cmd} --version`, cwd })
      return r.ok ? cmd : undefined
    }
    const direct = await tryCmd('netlify'); if (direct) return 'netlify'
    if (process.platform === 'win32') {
      const directCmd = await tryCmd('netlify.cmd'); if (directCmd) return 'netlify.cmd'
      const whereCmd = await proc.run({ cmd: 'where netlify.cmd', cwd }); if (whereCmd.ok) {
        const first = (whereCmd.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0]; if (first) return first
      }
      const whereExe = await proc.run({ cmd: 'where netlify', cwd }); if (whereExe.ok) {
        const first = (whereExe.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0]; if (first) return first
      }
    }
    const npx = await tryCmd('npx -y netlify-cli'); if (npx) return 'npx -y netlify-cli'
    if (process.platform === 'win32') { const npxCmd = await tryCmd('npx.cmd -y netlify-cli'); if (npxCmd) return 'npx.cmd -y netlify-cli' }
    const dlx = await tryCmd('pnpm dlx netlify-cli'); if (dlx) return 'pnpm dlx netlify-cli'
    if (process.platform === 'win32') { const dlxCmd = await tryCmd('pnpm.cmd dlx netlify-cli'); if (dlxCmd) return 'pnpm.cmd dlx netlify-cli' }
    return 'netlify'
  }

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
    const bin = await this.resolveNetlify(cwd)
    const stepTimeout = this.stepTimeout(120_000)
    const ver = await runWithRetry({ cmd: `${bin} --version`, cwd, env: this.envOverlay() }, { timeoutMs: stepTimeout })
    if (!ver.ok) throw new Error('Netlify CLI not found. Install with: npm i -g netlify-cli')
    const who = await runWithRetry({ cmd: `${bin} api getCurrentUser`, cwd, env: this.envOverlay() }, { timeoutMs: stepTimeout })
    if (!who.ok) throw new Error('Netlify not logged in. Run: netlify login')
  }

  public async link(cwd: string, project: ProjectRef): Promise<ProjectRef> {
    const bin = await this.resolveNetlify(cwd)
    // If a siteId is provided, link to it. Else try to create one from folder name.
    const base = cwd.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'site'
    const siteId = project.projectId
    // Reuse existing linked site when present and valid
    try {
      if (!siteId) {
        const state = await fsx.readJson<{ siteId?: string }>(join(cwd, '.netlify', 'state.json'))
        const existing = (state && typeof state.siteId === 'string' && state.siteId.length > 0) ? state.siteId : undefined
        if (existing) {
          const stepTimeout = this.stepTimeout(120_000)
          const chk = await runWithRetry({ cmd: `${bin} api getSite --data ${this.jsonArg({ site_id: existing })}`, cwd, env: this.envOverlay() }, { timeoutMs: stepTimeout })
          if (chk.ok) {
            try { const js = JSON.parse(chk.stdout) as { id?: string; site_id?: string }
              const sid = (typeof js?.site_id === 'string' ? js.site_id : js?.id)
              if (sid && sid.length > 0) return { projectId: sid }
            } catch { /* ignore parse */ }
          }
        }
      }
    } catch { /* ignore */ }
    if (siteId) {
      const stepTimeout = this.stepTimeout(120_000)
      const out = await runWithRetry({ cmd: `${bin} link --id ${siteId}`.trim(), cwd, env: this.envOverlay() }, { timeoutMs: stepTimeout })
      if (!out.ok) throw new Error('Failed to link Netlify site; ensure the site ID is correct')
      return { projectId: siteId }
    }
    // Try to create a new site and link it (non-interactive path first)
    const name = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-+|-+$/g, '') || 'site'
    const desiredName = process.env.OPD_NETLIFY_SITE_NAME && process.env.OPD_NETLIFY_SITE_NAME.length > 0 ? process.env.OPD_NETLIFY_SITE_NAME : name
    // Resolve account slug
    let accountSlug: string | undefined = process.env.OPD_NETLIFY_ACCOUNT_SLUG
    if (!accountSlug) {
      try {
        const acc = await runWithRetry({ cmd: `${bin} api listAccountsForUser`, cwd, env: this.envOverlay() }, { timeoutMs: this.stepTimeout(120_000) })
        if (acc.ok) {
          try {
            const js = JSON.parse(acc.stdout) as Array<{ slug?: string; name?: string; billing_name?: string; default?: boolean }>
            if (Array.isArray(js) && js.length > 0) {
              const preferred = js.find((a) => (a as any).default === true)
              const chosen = preferred ?? js[0]
              accountSlug = (chosen.slug || chosen.name || chosen.billing_name || '').toString()
            }
          } catch { /* ignore parse */ }
        }
      } catch { /* ignore */ }
    }
    if (accountSlug && accountSlug.length > 0) {
      try {
        const create = await runWithRetry({ cmd: `${bin} api createSiteInTeam --account_slug ${accountSlug} --data ${this.jsonArg({ name: desiredName })}`, cwd, env: this.envOverlay() }, { timeoutMs: this.stepTimeout(180_000) })
        if (create.ok) {
          try {
            const js = JSON.parse(create.stdout) as { id?: string }
            if (js && typeof js.id === 'string' && js.id.length > 0) {
              const linkRes = await runWithRetry({ cmd: `${bin} link --id ${js.id}`, cwd, env: this.envOverlay() }, { timeoutMs: this.stepTimeout(120_000) })
              if (!linkRes.ok) throw new Error('Failed to link Netlify site after creation')
              return { projectId: js.id }
            }
          } catch { /* ignore parse */ }
        }
      } catch { /* ignore */ }
    }
    // Fallback to legacy interactive path (may prompt in TTY environments)
    const mk = await runWithRetry({ cmd: `${bin} sites:create --name ${desiredName}`, cwd, env: this.envOverlay() }, { timeoutMs: this.stepTimeout(180_000) })
    if (!mk.ok) {
      const text = (mk.stderr || mk.stdout || '').toLowerCase()
      if (!text.includes('already exists')) throw new Error('Unable to create Netlify site')
    }
    // Read state to get siteId
    try {
      const state = await fsx.readJson<{ siteId?: string }>(join(cwd, '.netlify', 'state.json'))
      if (state && typeof state.siteId === 'string') return { projectId: state.siteId }
    } catch { /* ignore */ }
    return { projectId: undefined }
  }

  public async build(args: BuildInputs): Promise<BuildResult> {
    // If an artifact directory already exists, reuse it and skip Netlify build
    const candidates: string[] = []
    if (args.publishDirHint) candidates.push(args.publishDirHint)
    candidates.push('dist', 'build', 'out', 'public')
    for (const c of candidates) {
      const full = join(args.cwd, c)
      try { if (await fsx.exists(full)) return { ok: true, artifactDir: full } } catch { /* ignore */ }
    }
    // Respect noBuild flag: return best-effort artifact path without invoking Netlify build
    if (args.noBuild === true) {
      const hint = args.publishDirHint ? join(args.cwd, args.publishDirHint) : join(args.cwd, 'dist')
      return { ok: true, artifactDir: hint }
    }
    // Otherwise, run Netlify build to produce the artifact
    const bin = await this.resolveNetlify(args.cwd)
    const ctx = args.envTarget === 'production' ? 'production' : 'deploy-preview'
    const buildTimeout = this.stepTimeout(900_000)
    const out = await runWithRetry(
      { cmd: `${bin} build --context ${ctx}`, cwd: args.cwd, env: this.envOverlay() },
      { timeoutMs: buildTimeout, retries: 1, baseDelayMs: 400 },
    )
    if (!out.ok) return { ok: false, message: out.stderr.trim() || out.stdout.trim() || 'Netlify build failed' }
    // Resolve artifact dir again after build
    for (const c of candidates) {
      const full = join(args.cwd, c)
      try { if (await fsx.exists(full)) return { ok: true, artifactDir: full } } catch { /* ignore */ }
    }
    return { ok: true, artifactDir: args.publishDirHint ? join(args.cwd, args.publishDirHint) : join(args.cwd, 'dist') }
  }

  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const bin = await this.resolveNetlify(args.cwd)
    // Ensure we have an artifact directory; if missing, try to infer it from detection/publishDir
    let artifact: string | undefined = args.artifactDir
    if (!artifact) {
      try {
        const det = await detectApp({ cwd: args.cwd })
        if (det.publishDir) artifact = join(args.cwd, det.publishDir)
      } catch { /* ignore */ }
      if (!artifact) {
        for (const c of ['dist', 'build', 'out', 'public']) {
          const full = join(args.cwd, c)
          try { if (await fsx.exists(full)) { artifact = full; break } } catch { /* ignore */ }
        }
      }
    }
    if (!artifact) return { ok: false, message: 'No artifact directory found. Build your project or specify publishDir.' }
    try { if (!(await fsx.exists(artifact))) return { ok: false, message: `Artifact directory not found: ${artifact}` } } catch { /* ignore */ }
    const siteFlag = args.project.projectId ? ` --site ${args.project.projectId}` : ''
    const prodFlag = args.envTarget === 'production' ? ' --prod' : ''
    const dirFlag = ` --dir ${artifact}`
    const cmd = `${bin} deploy --no-build${prodFlag}${dirFlag}${siteFlag}`.trim()
    const deployTimeout = this.stepTimeout(900_000)
    const out = await runWithRetry(
      { cmd, cwd: args.cwd, env: this.envOverlay() },
      { timeoutMs: deployTimeout, retries: 2, baseDelayMs: 500 },
    )
    if (!out.ok) return { ok: false, message: out.stderr.trim() || out.stdout.trim() || 'Netlify deploy failed' }
    // Try to extract deploy URL
    const m = out.stdout.match(/https?:\/\/[^\s]+\.netlify\.app\b/)
    const url: string | undefined = m?.[0]
    // Compose logs URL using site name and latest deploy id
    let logsUrl: string | undefined
    try {
      let siteName: string | undefined
      if (args.project.projectId) {
        const siteRes = await proc.run(
          { cmd: `${bin} api getSite --data ${this.jsonArg({ site_id: args.project.projectId })}`, cwd: args.cwd, env: this.envOverlay() },
        )
        if (siteRes.ok) {
          try {
            const js = JSON.parse(siteRes.stdout) as { name?: string; admin_url?: string }
            if (typeof js.name === 'string') siteName = js.name
            if (!siteName && typeof js.admin_url === 'string') {
              // Derive name from admin_url: https://app.netlify.com/sites/<name>
              const mm = js.admin_url.match(/\/sites\/([a-z0-9-]+)/i)
              if (mm && mm[1]) siteName = mm[1]
            }
          } catch { /* ignore parse */ }
        }
      }
      // Latest deploy id (per_page=1)
      let deployId: string | undefined
      if (args.project.projectId) {
        const ls = await proc.run(
          { cmd: `${bin} api listSiteDeploys --data ${this.jsonArg({ site_id: args.project.projectId, per_page: 1 })}`, cwd: args.cwd, env: this.envOverlay() },
        )
        if (ls.ok) {
          try {
            const arr = JSON.parse(ls.stdout) as Array<{ id?: string }>
            if (Array.isArray(arr) && arr.length > 0) deployId = arr[0]?.id
          } catch { /* ignore parse */ }
        }
      }
      if (siteName && deployId) logsUrl = `https://app.netlify.com/sites/${siteName}/deploys/${deployId}`
    } catch { /* ignore */ }
    // Fallbacks: parse Logs URL from CLI output or admin_url without id
    if (!logsUrl) {
      const lm = out.stdout.match(/https?:\/\/app\.netlify\.com\/sites\/[a-z0-9-]+\/deploys\/[a-f0-9-]+/i)
      if (lm && lm[0]) logsUrl = lm[0]
    }
    if (!logsUrl && args.project.projectId) {
      try {
        const siteRes2 = await proc.run(
          { cmd: `${bin} api getSite --data ${this.jsonArg({ site_id: args.project.projectId })}`, cwd: args.cwd, env: this.envOverlay() },
        )
        if (siteRes2.ok) {
          const js = JSON.parse(siteRes2.stdout) as { admin_url?: string }
          if (typeof js.admin_url === 'string') logsUrl = `${js.admin_url}/deploys`
        }
      } catch { /* ignore */ }
    }
    return { ok: true, url, logsUrl }
  }

  public async open(_project: ProjectRef): Promise<void> { return }
  public async envList(_project: ProjectRef): Promise<Record<string, string[]>> { return {} }
  public async envSet(_project: ProjectRef, _kv: Record<string, string>): Promise<void> { return }
  public async logs(_project: ProjectRef): Promise<void> { return }

  /**
   * Write netlify.toml using detection hints.
   */
  public async generateConfig(args: { readonly detection: DetectionResult; readonly cwd: string; readonly overwrite: boolean }): Promise<string> {
    const cwd = args.cwd
    const path = join(cwd, 'netlify.toml')
    if (args.overwrite !== true) {
      try { const s = await stat(path); if (s.isFile()) return path } catch { /* not exists */ }
    }
    const framework = args.detection.framework
    if (framework === 'next') {
      // Prefer Next Runtime when present; fall back to legacy plugin
      const nextManifestPath: string = join(cwd, 'node_modules', '@netlify', 'next', 'manifest.yml')
      const hasNextRuntime: boolean = await fsx.exists(nextManifestPath)
      const pluginPkg: string = hasNextRuntime ? '@netlify/next' : '@netlify/plugin-nextjs'
      const header: string = hasNextRuntime ? '# Uses Netlify Next Runtime for Next.js' : '# Uses legacy Netlify Next plugin'
      const safeBuildCmd: string = 'next build'
      const publish = '.next'
      const toml = `# Auto-generated by OpenDeploy CLI\n${header}\n[build]\n  command = "${safeBuildCmd}"\n  publish = "${publish}"\n  [build.environment]\n    NODE_VERSION = "20"\n\n[[plugins]]\n  package = "${pluginPkg}"\n`
      await writeFile(path, toml, 'utf8')
      return path
    }
    if (framework === 'nuxt') {
      const header = '# Auto-generated by OpenDeploy CLI (Nuxt)'
      const safeBuildCmd: string = 'npx nuxi build'
      const publish = '.output/public'
      const toml = `${header}\n[build]\n  command = "${safeBuildCmd}"\n  publish = "${publish}"\n`
      await writeFile(path, toml, 'utf8')
      return path
    }
    const publishDir: string = args.detection.publishDir ?? 'dist'
    const buildCmd: string = (args.detection.buildCommand && String(args.detection.buildCommand).trim().length > 0) ? String(args.detection.buildCommand) : 'npm run build'
    const header = '# Auto-generated by OpenDeploy CLI'
    const toml = `${header}\n[build]\n  command = "${buildCmd}"\n  publish = "${publishDir}"\n`
    await writeFile(path, toml, 'utf8')
    return path
  }
}
