import type { Provider } from './provider-interface'
import type { ProviderPluginModule } from '../plugins/contracts'
import { loadProviderPluginById } from '../plugins/registry'
import type { ProviderCapabilities } from './provider-capabilities'
import type { ProjectRef, BuildInputs as LegacyBuildInputs, BuildResult as LegacyBuildResult, DeployInputs as LegacyDeployInputs, DeployResult as LegacyDeployResult } from './provider-types'
import type { DetectionResult } from '../../types/detection-result'
import { logger } from '../../utils/logger'
import { computeRedactors } from '../../utils/redaction'

class ProviderPluginAdapter implements Provider {
  public readonly id: string
  private readonly mod: ProviderPluginModule
  constructor(id: string, mod: ProviderPluginModule) { this.id = id; this.mod = mod }
  public getCapabilities(): ProviderCapabilities {
    const caps = this.mod.plugin.getCapabilities()
    return {
      name: caps.name,
      supportsLocalBuild: caps.supportsLocalBuild,
      supportsRemoteBuild: caps.supportsRemoteBuild,
      supportsStaticDeploy: caps.supportsStaticDeploy,
      supportsServerless: caps.supportsServerless,
      supportsEdgeFunctions: false,
      supportsSsr: caps.supportsServerless || false,
      hasProjectLinking: true,
      envContexts: ['preview','production'],
      supportsLogsFollow: caps.supportsLogsFollow,
      supportsAliasDomains: caps.supportsAliasDomains,
      supportsRollback: caps.supportsRollback,
    }
  }
  public async detect(_cwd: string): Promise<{ readonly framework?: string; readonly publishDir?: string }> { return {} }
  public async validateAuth(_cwd: string): Promise<void> { await this.mod.plugin.validateAuth({ json: false, ndjson: false, ci: false }) }
  public async link(_cwd: string, project: ProjectRef): Promise<ProjectRef> { return project }
  public async build(args: LegacyBuildInputs): Promise<LegacyBuildResult> {
    // Provider plugins typically do not build. Assume stack plugin performed build earlier.
    const artifact = args.publishDirHint || 'dist'
    return { ok: true, artifactDir: artifact, message: undefined }
  }
  public async deploy(args: LegacyDeployInputs): Promise<LegacyDeployResult> {
    const env = args.envTarget === 'production' ? 'production' : 'preview'
    const target: 'preview' | 'prod' = env === 'production' ? 'prod' : 'preview'
    const outputDir: string = args.artifactDir ?? 'dist'
    // Provide context to plugin for logging and redaction
    try {
      const redactors = await computeRedactors({ cwd: args.cwd, includeProcessEnv: true })
      logger.setRedactors(redactors)
      this.mod.plugin.setContext?.({
        cwd: args.cwd,
        json: true,
        ndjson: process.env.OPD_NDJSON === '1',
        ci: process.env.OPD_FORCE_CI === '1' || process.env.CI === '1' || process.env.GITHUB_ACTIONS === 'true',
        log: { info: (m: string) => logger.info(m), warn: (m: string) => logger.warn(m), error: (m: string) => logger.error(m), success: (m: string) => logger.success(m), note: (m: string) => logger.note(m) },
        nd: (event: Record<string, unknown>) => logger.json({ action: 'provider', id: this.id, ...event })
      })
    } catch { /* ignore context failures */ }
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'provider', event: 'deploy:start', id: this.id, target, outputDir })
    const r = await this.mod.plugin.deployStatic({ cwd: args.cwd, outputDir, target, env: process.env as Record<string,string>, json: false, ndjson: false, ci: false })
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'provider', event: 'deploy:end', id: this.id, ok: r.ok, url: r.url, logsUrl: r.logsUrl })
    return { ok: r.ok, url: r.url, logsUrl: r.logsUrl, message: undefined }
  }
  public async open(_project: ProjectRef): Promise<void> { return }
  public async envList(_project: ProjectRef): Promise<Record<string, string[]>> { return {} }
  public async envSet(_project: ProjectRef, _kv: Record<string, string>): Promise<void> { return }
  public async logs(_project: ProjectRef): Promise<void> { return }
  public async generateConfig(_args: { readonly detection: DetectionResult; readonly cwd: string; readonly overwrite: boolean }): Promise<string> { return '' }
  public async rollback(_project: ProjectRef, _to?: string): Promise<LegacyDeployResult> { return { ok: false } }
}

/**
 * Simple dynamic loader for providers. In future we can support a registry file,
 * user-installed packages, and workspace-local providers.
 */
export async function loadProvider(id: string): Promise<Provider> {
  const normalized = id.toLowerCase()
  // Virtual mode: force provider to 'virtual' for hermetic tests
  if ((process.env.OPD_PROVIDER_MODE ?? '').toLowerCase() === 'virtual') {
    const mod = await import('./providers/virtual')
    return new mod.VirtualProvider(normalized)
  }
  // External provider plugin preferred when available
  try {
    const mod = await loadProviderPluginById({ id: normalized })
    if (mod && mod.plugin) return new ProviderPluginAdapter(normalized, mod)
  } catch { /* ignore and fallback to built-ins */ }
  // Built-in providers
  if (normalized === 'vercel') {
    try {
      const mod = await import('./providers/vercel-vnext-adapter')
      return new mod.VercelVNextAdapter()
    } catch {
      const legacy = await import('./providers/vercel')
      return new legacy.VercelProvider()
    }
  }
  if (normalized === 'cloudflare' || normalized === 'cloudflare-pages') {
    try {
      const mod = await import('./providers/cloudflare-pages-vnext-adapter')
      return new mod.CloudflarePagesVNextAdapter()
    } catch {
      const legacy = await import('./providers/cloudflare-pages')
      return new legacy.CloudflarePagesProvider()
    }
  }
  if (normalized === 'github' || normalized === 'github-pages') {
    // Use the vNext adapter that wraps @opendeploy/provider-github-pages
    try {
      const mod = await import('./providers/github-pages-vnext-adapter')
      return new mod.GithubPagesVNextAdapter()
    } catch {
      // Fallback to legacy internal provider
      const legacy = await import('./providers/github-pages')
      return new legacy.GithubPagesProvider()
    }
  }
  // Future: dynamic import from @opendeploy/provider-<id>
  try {
    const mod = await import(`@opendeploy/provider-${normalized}`)
    return mod.default as Provider
  } catch {
    throw new Error(`Unknown provider: ${id}`)
  }
}
