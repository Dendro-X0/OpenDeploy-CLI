/**
 * Netlify provider (experimental) that shells out to the official Netlify CLI.
 * Feature-gated via OPD_EXPERIMENTAL_NETLIFY=1 to avoid surprising users.
 */
import { join } from 'node:path'
import { homedir } from 'node:os'
import { stat, writeFile } from 'node:fs/promises'
import type { Provider } from '../provider-interface'
import type { ProviderCapabilities } from '../provider-capabilities'
import type { ProjectRef, BuildInputs, BuildResult, DeployInputs, DeployResult } from '../provider-types'
import type { DetectionResult } from '../../../types/detection-result'
import { proc } from '../../../utils/process'
import { fsx } from '../../../utils/fs'
import handleHints from '../../../utils/hints'

export class NetlifyProvider implements Provider {
  public readonly id: string = 'netlify'

  private static binCache: string | undefined

  private async resolveNetlify(cwd: string): Promise<string> {
    if (NetlifyProvider.binCache) return NetlifyProvider.binCache
    const envBin = process.env.OPD_NETLIFY_BIN
    if (envBin && envBin.length > 0) {
      const chk = await proc.run({ cmd: `${envBin} --version`, cwd })
      if (chk.ok) { NetlifyProvider.binCache = envBin; return envBin }
    }
    // Plain 'netlify'
    const ver = await proc.run({ cmd: 'netlify --version', cwd })
    if (ver.ok) { NetlifyProvider.binCache = 'netlify'; return 'netlify' }
    // Windows shims and where lookup
    if (process.platform === 'win32') {
      const verCmd = await proc.run({ cmd: 'netlify.cmd --version', cwd })
      if (verCmd.ok) { NetlifyProvider.binCache = 'netlify.cmd'; return 'netlify.cmd' }
      const whereCmd = await proc.run({ cmd: 'where netlify.cmd', cwd })
      if (whereCmd.ok) {
        const first = (whereCmd.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0]
        if (first) { NetlifyProvider.binCache = first; return first }
      }
      const whereExe = await proc.run({ cmd: 'where netlify', cwd })
      if (whereExe.ok) {
        const first = (whereExe.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0]
        if (first) { NetlifyProvider.binCache = first; return first }
      }
    }
    // Fallbacks
    const verNpx = await proc.run({ cmd: 'npx -y netlify-cli --version', cwd })
    if (verNpx.ok) { NetlifyProvider.binCache = 'npx -y netlify-cli'; return 'npx -y netlify-cli' }
    if (process.platform === 'win32') {
      const verNpxCmd = await proc.run({ cmd: 'npx.cmd -y netlify-cli --version', cwd })
      if (verNpxCmd.ok) { NetlifyProvider.binCache = 'npx.cmd -y netlify-cli'; return 'npx.cmd -y netlify-cli' }
    }
    const verPnpm = await proc.run({ cmd: 'pnpm dlx netlify-cli --version', cwd })
    if (verPnpm.ok) { NetlifyProvider.binCache = 'pnpm dlx netlify-cli'; return 'pnpm dlx netlify-cli' }
    if (process.platform === 'win32') {
      const verPnpmCmd = await proc.run({ cmd: 'pnpm.cmd dlx netlify-cli --version', cwd })
      if (verPnpmCmd.ok) { NetlifyProvider.binCache = 'pnpm.cmd dlx netlify-cli'; return 'pnpm.cmd dlx netlify-cli' }
    }
    NetlifyProvider.binCache = 'netlify'
    return 'netlify'
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      name: 'Netlify',
      supportsLocalBuild: true,
      supportsRemoteBuild: false,
      supportsStaticDeploy: true,
      supportsServerless: false,
      supportsEdgeFunctions: false,
      supportsSsr: false,
      hasProjectLinking: true,
      envContexts: ['preview', 'production'],
      supportsLogsFollow: false,
      supportsAliasDomains: false,
      supportsRollback: false
    }
  }

  public async detect(cwd: string): Promise<{ readonly framework?: string; readonly publishDir?: string }> {
    try {
      const { detectApp } = await import('../../detectors/auto')
      const det = await detectApp({ cwd })
      return { framework: det.framework as string | undefined, publishDir: det.publishDir ?? 'dist' }
    } catch {
      return { publishDir: 'dist' }
    }
  }

  public async validateAuth(cwd: string): Promise<void> {
    const token: string | undefined = typeof process.env.NETLIFY_AUTH_TOKEN === 'string' ? process.env.NETLIFY_AUTH_TOKEN : undefined
    if (token && token.trim().length > 0) return
    try {
      const cfgPath = join(homedir(), '.netlify', 'config.json')
      const has = await fsx.exists(cfgPath)
      if (has) {
        try {
          const raw = await fsx.readJson<Record<string, unknown>>(cfgPath)
          const cfgToken = typeof (raw as any)?.token === 'string' ? String((raw as any).token) : undefined
          if (cfgToken && cfgToken.trim().length > 0) return
        } catch { /* ignore parse */ }
      }
    } catch { /* ignore */ }
    const bin = await this.resolveNetlify(cwd)
    const ver = await proc.run({ cmd: `${bin} --version`, cwd })
    if (!ver.ok) throw new Error('Netlify CLI not found. Install: npm i -g netlify-cli')
    const st = await proc.run({ cmd: `${bin} status`, cwd })
    if (!st.ok || /not\s+logged\s+in/i.test(st.stdout + st.stderr)) {
      throw new Error('Netlify not logged in. Run: netlify login or set NETLIFY_AUTH_TOKEN')
    }
  }

  public async link(cwd: string, project: ProjectRef): Promise<ProjectRef> {
    const bin = await this.resolveNetlify(cwd)
    const id = project.projectId || project.slug
    if (id && id.length > 0) {
      const out = await proc.run({ cmd: `${bin} link --id ${id}`, cwd })
      void out // best-effort; ignore non-fatal
    }
    return project
  }

  public async build(args: BuildInputs): Promise<BuildResult> {
    // Determine framework if not provided
    let fw = (args.framework || '').toLowerCase()
    if (!fw) {
      try { const det = await this.detect(args.cwd); fw = String(det.framework || '').toLowerCase() } catch { /* ignore */ }
    }
    // Next.js: require static export 'out' (we avoid deploying '.next' via Netlify)
    if (fw === 'next') {
      const hint = args.publishDirHint ? join(args.cwd, args.publishDirHint) : join(args.cwd, 'out')
      const outDir = hint.endsWith('out') ? hint : join(args.cwd, 'out')
      try { if (await fsx.exists(outDir)) return { ok: true, artifactDir: outDir } } catch { /* ignore */ }
      return { ok: false, message: `Next.js static export not found (expected '${outDir}'). Run: next build && next export, or omit --no-build to let Netlify build.` }
    }
    // Generic static frameworks
    const candidates: string[] = []
    if (args.publishDirHint) candidates.push(args.publishDirHint)
    candidates.push('dist', 'build', 'public')
    for (const c of candidates) {
      const full = join(args.cwd, c)
      try { if (await fsx.exists(full)) return { ok: true, artifactDir: full } } catch { /* ignore */ }
    }
    const hint = args.publishDirHint ? join(args.cwd, args.publishDirHint) : join(args.cwd, 'dist')
    return { ok: true, artifactDir: hint }
  }

  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const bin = await this.resolveNetlify(args.cwd)
    // Detect framework to choose sensible defaults
    let framework: string | undefined
    try { const det = await this.detect(args.cwd); framework = det.framework } catch { /* ignore */ }
    // Preferred dir: explicit artifactDir -> else Next 'out' -> else dist
    let dir = args.artifactDir || (framework && framework.toLowerCase() === 'next' ? join(args.cwd, 'out') : join(args.cwd, 'dist'))
    let exists = false
    try { exists = await fsx.exists(dir) } catch { exists = false }
    // If the directory does not exist, attempt to prepare netlify.toml and use --build
    let useBuild = false
    if (!exists) {
      useBuild = true
      // Ensure netlify.toml publishes to the chosen dir; add a sensible build command for Next
      const nlPath = join(args.cwd, 'netlify.toml')
      try {
        const hasNl = await fsx.exists(nlPath)
        if (!hasNl) {
          const isNext = (framework || '').toLowerCase() === 'next'
          const body = isNext
            ? `# Auto-generated by OpenDeploy CLI (Netlify)\n[build]\n  command = \"next build && next export\"\n  publish = \"out\"\n`
            : `# Auto-generated by OpenDeploy CLI (Netlify)\n[build]\n  publish = \"dist\"\n`
          await writeFile(nlPath, body, 'utf8')
          // Align dir with publish for Next
          if (isNext) dir = join(args.cwd, 'out')
        }
      } catch { /* ignore */ }
    }
    // Derive site id
    let siteId: string | undefined = typeof process.env.NETLIFY_SITE_ID === 'string' ? process.env.NETLIFY_SITE_ID : undefined
    if (!siteId) {
      try {
        const stPath = join(args.cwd, '.netlify', 'state.json')
        if (await fsx.exists(stPath)) {
          try { const raw = await fsx.readJson<Record<string, unknown>>(stPath); const s = String((raw as any)?.siteId || '')?.trim(); if (s) siteId = s } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
    if (!siteId) siteId = (args.project?.projectId || args.project?.slug || '').trim() || undefined
    const flags: string[] = [ `--dir ${JSON.stringify(dir)}` ]
    if (siteId) flags.push(`--site ${JSON.stringify(siteId)}`)
    if ((args.envTarget || '').toLowerCase() === 'production') flags.push('--prod')
    if (useBuild) flags.push('--build')
    flags.push('--json')
    const cmd = `${bin} deploy ${flags.join(' ')}`
    const out = await proc.run({ cmd, cwd: args.cwd })
    try { handleHints({ provider: 'netlify', text: (out.stderr || '') + ' ' + (out.stdout || '') }) } catch { /* ignore */ }
    if (!out.ok) {
      // Try to extract message from JSON
      try { const js = JSON.parse(out.stdout) as { message?: string; error?: string }; const m = (js.error || js.message || '').trim(); if (m) return { ok: false, message: m } } catch { /* ignore */ }
      return { ok: false, message: (out.stderr || out.stdout || '').trim() || 'Netlify deploy failed' }
    }
    const urls = (out.stdout.match(/https?:\/\/[^\s]+/g) || []) as string[]
    const deployUrl = urls.find(u => /netlify\.app\b/i.test(u)) || urls[0]
    const logsUrl = urls.find(u => /app\.netlify\.com\//i.test(u))
    return { ok: true, url: deployUrl, logsUrl }
  }

  public async open(_project: ProjectRef): Promise<void> { return }
  public async envList(_project: ProjectRef): Promise<Record<string, string[]>> { return {} }
  public async envSet(_project: ProjectRef, _kv: Record<string, string>): Promise<void> { return }
  public async logs(_project: ProjectRef): Promise<void> { return }

  public async generateConfig(args: { readonly detection: DetectionResult; readonly cwd: string; readonly overwrite: boolean }): Promise<string> {
    void args.detection
    const path = join(args.cwd, 'netlify.toml')
    if (args.overwrite !== true) {
      try { const s = await stat(path); if (s.isFile()) return path } catch { /* not exists */ }
    }
    const body = `# Auto-generated by OpenDeploy CLI (Netlify)\n# Minimal config for static deploys.\n[build]\n  publish = "dist"\n`
    await writeFile(path, body, 'utf8')
    return path
  }
}
