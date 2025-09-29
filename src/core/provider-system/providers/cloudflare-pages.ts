/**
 * Cloudflare Pages provider (minimal) to validate the provider interface.
 * This implementation favors local builds (static) and deploys via `wrangler pages deploy`.
 */
import { join } from 'node:path'
import { stat, writeFile } from 'node:fs/promises'
import { proc } from '../../../utils/process'
import type { Provider } from '../provider-interface'
import type { DetectionResult } from '../../../types/detection-result'
import type { ProviderCapabilities } from '../provider-capabilities'
import type { ProjectRef, BuildInputs, BuildResult, DeployInputs, DeployResult } from '../provider-types'
import { fsx } from '../../../utils/fs'
import { detectApp as autoDetect } from '../../detectors/auto'

/**
 * Cloudflare Pages provider implementing the Provider interface.
 */
export class CloudflarePagesProvider implements Provider {
  public readonly id: string = 'cloudflare'

  private async resolveWrangler(cwd: string): Promise<string> {
    // Environment override first
    const envBin = process.env.OPD_WRANGLER_BIN
    if (envBin && envBin.length > 0) {
      const chk = await proc.run({ cmd: `${envBin} --version`, cwd })
      if (chk.ok) return envBin
    }
    // Try plain 'wrangler'
    const ver = await proc.run({ cmd: 'wrangler --version', cwd })
    if (ver.ok) return 'wrangler'
    // On Windows, global npm bins often expose a .cmd shim and absolute paths via 'where'
    if (process.platform === 'win32') {
      const verCmd = await proc.run({ cmd: 'wrangler.cmd --version', cwd })
      if (verCmd.ok) return 'wrangler.cmd'
      // Prefer absolute .cmd path when available
      const whereCmd = await proc.run({ cmd: 'where wrangler.cmd', cwd })
      if (whereCmd.ok) {
        const first = (whereCmd.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0]
        if (first) return first
      }
      const whereExe = await proc.run({ cmd: 'where wrangler', cwd })
      if (whereExe.ok) {
        const first = (whereExe.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0]
        if (first) return first
      }
    }
    // Try NPX fallback
    const verNpx = await proc.run({ cmd: 'npx -y wrangler --version', cwd })
    if (verNpx.ok) return 'npx -y wrangler'
    if (process.platform === 'win32') {
      const verNpxCmd = await proc.run({ cmd: 'npx.cmd -y wrangler --version', cwd })
      if (verNpxCmd.ok) return 'npx.cmd -y wrangler'
    }
    // Try PNPM DLX fallback
    const verPnpm = await proc.run({ cmd: 'pnpm dlx wrangler --version', cwd })
    if (verPnpm.ok) return 'pnpm dlx wrangler'
    if (process.platform === 'win32') {
      const verPnpmCmd = await proc.run({ cmd: 'pnpm.cmd dlx wrangler --version', cwd })
      if (verPnpmCmd.ok) return 'pnpm.cmd dlx wrangler'
    }
    // Fallback to 'wrangler' to surface a meaningful error downstream
    return 'wrangler'
  }

  /** Return capability declaration used by the CLI to adapt flows */
  public getCapabilities(): ProviderCapabilities {
    return {
      name: 'Cloudflare Pages',
      supportsLocalBuild: true,
      supportsRemoteBuild: false,
      supportsStaticDeploy: true,
      supportsServerless: true, // via Pages Functions
      supportsEdgeFunctions: true,
      supportsSsr: true,
      hasProjectLinking: true, // project name
      envContexts: ['preview', 'production'],
      supportsLogsFollow: false,
      supportsAliasDomains: false,
      supportsRollback: false
    }
  }

  /** Heuristic detection using our auto detector */
  public async detect(cwd: string): Promise<{ readonly framework?: string; readonly publishDir?: string }> {
    try {
      const det = await autoDetect({ cwd })
      return { framework: det.framework as string | undefined, publishDir: det.publishDir ?? 'dist' }
    } catch {
      return { publishDir: 'dist' }
    }
  }

  /** Validate wrangler auth is ready */
  public async validateAuth(cwd: string): Promise<void> {
    const bin = await this.resolveWrangler(cwd)
    // Check wrangler availability
    const ver = await proc.run({ cmd: `${bin} --version`, cwd })
    if (!ver.ok) throw new Error('Wrangler not found. Install with: npm i -g wrangler')
    // whoami: login required for Pages deploys
    const who = await proc.run({ cmd: `${bin} whoami`, cwd })
    if (!who.ok) throw new Error('Wrangler not logged in. Run: wrangler login')
  }

  /** Linking is name-based for Pages; we accept and return the provided ref */
  public async link(cwd: string, project: ProjectRef): Promise<ProjectRef> {
    // Derive a sensible default project name when none is provided
    const base = cwd.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'site'
    const name = (project.projectId || project.slug || base)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'site'
    // Try to create the project; if it already exists, ignore the error
    // Prefer specifying production branch when supported; fall back if unknown flag
    const bin = await this.resolveWrangler(cwd)
    const tryCreate = async (cmd: string): Promise<boolean> => {
      const out = await proc.run({ cmd, cwd })
      if (out.ok) return true
      const text = (out.stderr || out.stdout || '').toLowerCase()
      if (text.includes('already exists') || text.includes('exists')) return true
      return false
    }
    const created = await tryCreate(`${bin} pages project create ${name} --production-branch main`)
    if (!created) {
      // Fallback without extra flags
      await tryCreate(`${bin} pages project create ${name}`)
    }
    return { projectId: name, orgId: project.orgId, slug: name }
  }

  /**
   * Build is user-project specific; we expect the caller to have built already
   * when necessary. We return an artifactDir derived from publishDirHint when available.
   */
  public async build(args: BuildInputs): Promise<BuildResult> {
    // We do not run user builds here; we only resolve an artifact directory.
    const candidates: string[] = []
    if (args.publishDirHint) candidates.push(args.publishDirHint)
    candidates.push('dist', 'build', 'out', 'public')
    for (const c of candidates) {
      const full = join(args.cwd, c)
      try { if (await fsx.exists(full)) return { ok: true, artifactDir: full } } catch { /* ignore */ }
    }
    // If nothing exists yet, return hint-based path or default dist
    const hint = args.publishDirHint ? join(args.cwd, args.publishDirHint) : join(args.cwd, 'dist')
    return { ok: true, artifactDir: hint }
  }

  /** Deploys using wrangler pages deploy <dir> --project-name <name> */
  public async deploy(args: DeployInputs): Promise<DeployResult> {
    const bin = await this.resolveWrangler(args.cwd)
    const projectName: string | undefined = args.project.projectId ?? args.project.slug
    const dir: string = args.artifactDir || join(args.cwd, 'dist')
    try { if (!(await fsx.exists(dir))) return { ok: false, message: `Artifact directory not found: ${dir}. Run your build or set publishDir.` } } catch { /* ignore */ }
    const projFlag = projectName ? ` --project-name ${projectName}` : ''
    const cmd = `${bin} pages deploy ${dir}${projFlag}`
    const out = await proc.run({ cmd, cwd: args.cwd })
    if (!out.ok) {
      const msg = (out.stderr || out.stdout || '').trim() || 'Cloudflare deploy failed'
      return { ok: false, message: msg }
    }
    // Try to parse deployment and dashboard URLs from stdout
    const urls = (out.stdout.match(/https?:\/\/[^\s]+/g) || []) as string[]
    const deployUrl = urls.find(u => /\.pages\.dev\b/i.test(u)) || urls[0]
    // Best-effort dashboard/logs URL
    let logsUrl: string | undefined
    logsUrl = urls.find(u => /dash\.cloudflare\.com\//i.test(u))
    if (!logsUrl && projectName) {
      // Generic dashboard deep-link; account segment is resolved by Cloudflare automatically
      logsUrl = `https://dash.cloudflare.com/?to=/:account/pages/view/${projectName}`
    }
    return { ok: true, url: deployUrl, logsUrl }
  }

  public async open(_project: ProjectRef): Promise<void> { return }
  public async envList(_project: ProjectRef): Promise<Record<string, string[]>> { return {} }
  public async envSet(_project: ProjectRef, _kv: Record<string, string>): Promise<void> { return }
  public async logs(_project: ProjectRef): Promise<void> { return }
  /**
   * Generate a minimal wrangler.toml. This file is optional for static Pages,
   * but we create it as a convenient placeholder and return its path.
   */
  public async generateConfig(args: { readonly detection: DetectionResult; readonly cwd: string; readonly overwrite: boolean }): Promise<string> {
    void args.detection
    const path = join(args.cwd, 'wrangler.toml')
    if (args.overwrite !== true) {
      try { const s = await stat(path); if (s.isFile()) return path } catch { /* not exists */ }
    }
    const base = args.cwd.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'site'
    const name = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-+|-+$/g, '') || 'site'
    const body = `# Auto-generated by OpenDeploy CLI (Cloudflare Pages)\n# This minimal file is optional for static Pages.\n# Add a functions directory and additional settings as needed.\nname = "${name}"\n`
    await writeFile(path, body, 'utf8')
    return path
  }
}
