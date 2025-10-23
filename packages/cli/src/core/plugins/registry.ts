import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { detectPackageManager } from '../detectors/package-manager'
import { detectMonorepo } from '../detectors/monorepo'
import { detectEnvFiles } from '../detectors/env-files'
import type { DetectionResult } from '../../types/detection-result'
import type { Framework } from '../../types/framework'
import type { StackPluginModule, StackDetectResult, ProviderPluginModule } from './contracts'
import { loadBuiltinStackPlugin } from './builtins'
import { logger } from '../../utils/logger'
import { PLUGIN_API_VERSION } from './contracts'

function normalizeFramework(name: string): Framework | string {
  const n = name.toLowerCase()
  if (n === 'next' || n === 'astro' || n === 'sveltekit' || n === 'remix' || n === 'expo' || n === 'nuxt' || n === 'vite') return n as Framework
  return n
}

export async function loadProviderPluginById(args: { readonly id: string }): Promise<ProviderPluginModule | undefined> {
  const id = args.id.toLowerCase()
  const candidates = [
    `@opendeploy/provider-${id}`,
    `opendeploy-provider-${id}`
  ]
  for (const name of candidates) {
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'load:start', kind: 'provider', id })
    const mod = await tryImport<ProviderPluginModule | { default?: ProviderPluginModule }>(name)
    const plugin = (mod && (mod as any).plugin) ? (mod as any).plugin : (mod && (mod as any).default && (mod as any).default.plugin) ? (mod as any).default.plugin : undefined
    const version: string | undefined = (mod as any)?.version ?? (mod as any)?.default?.version
    checkVersionAndEmit('provider', id, version)
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'load:end', kind: 'provider', id, ok: Boolean(plugin) })
    if (plugin) return { id, plugin, version: version ?? '0.0.0' } as ProviderPluginModule
  }
  return undefined
}

async function tryImport<T = unknown>(spec: string): Promise<T | undefined> {
  try { return (await import(spec)) as unknown as T } catch { return undefined }
}

function parseSemver(v: string): { major: number; minor: number; patch: number } {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v))
  return { major: Number(m?.[1] ?? 0), minor: Number(m?.[2] ?? 0), patch: Number(m?.[3] ?? 0) }
}

function checkVersionAndEmit(kind: 'stack' | 'provider', id: string, pluginVersion: string | undefined): void {
  const api = parseSemver(PLUGIN_API_VERSION)
  const pl = parseSemver(pluginVersion ?? '0.0.0')
  const okMajor: boolean = api.major === pl.major
  if (!okMajor) {
    logger.json({ action: 'plugin', event: 'version-mismatch', kind, id, required: PLUGIN_API_VERSION, found: pluginVersion ?? 'unknown' })
    if (process.env.OPD_STRICT_PLUGIN_VERSION === '1') {
      // Fail hard when strict mode is enabled, after emitting the NDJSON event.
      throw new Error(`Plugin API version mismatch for ${kind}:${id}. Required ${PLUGIN_API_VERSION}, found ${pluginVersion ?? 'unknown'}`)
    }
  } else {
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'version-ok', kind, id, version: pluginVersion ?? 'unknown' })
  }
}

function mapStackDetectToDetection(cwd: string, s: StackDetectResult, pm: string, mono: string, envFiles: readonly string[]): DetectionResult {
  const buildCmd = Array.isArray(s.buildCommand) ? s.buildCommand.join(' ') : String(s.buildCommand || 'build')
  const conf = Math.max(0.5, Math.min(0.99, (Number(s.matchScore || 50) / 100)))
  return {
    framework: normalizeFramework(s.framework) as Framework,
    rootDir: cwd,
    appDir: cwd,
    hasAppRouter: false,
    packageManager: (pm as any),
    monorepo: (mono as any),
    buildCommand: buildCmd,
    outputDir: s.outputDir,
    publishDir: s.staticExport ? s.outputDir : undefined,
    renderMode: s.staticExport ? 'static' : 'hybrid',
    confidence: conf,
    environmentFiles: [...envFiles]
  }
}

export async function detectStacksFromPlugins(args: { readonly cwd: string }): Promise<DetectionResult[]> {
  const cwd = args.cwd
  const pkg = await fsx.readJson<Record<string, any>>(join(cwd, 'package.json'))
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const names = Object.keys(deps || {})
  const stackPkgs = names.filter(n => /^(?:@opendeploy\/stack-|opendeploy-stack-)/.test(n))
  if (stackPkgs.length === 0) return []
  const pm = await detectPackageManager({ cwd })
  const mono = await detectMonorepo({ cwd })
  const envFiles = await detectEnvFiles({ cwd })
  const out: DetectionResult[] = []
  for (const modName of stackPkgs) {
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'load:start', kind: 'stack', id: modName })
    const mod = await tryImport<StackPluginModule | { default?: StackPluginModule }>(modName)
    const plugin = (mod && (mod as any).plugin) ? (mod as any).plugin : (mod && (mod as any).default && (mod as any).default.plugin) ? (mod as any).default.plugin : undefined
    const version: string | undefined = (mod as any)?.version ?? (mod as any)?.default?.version
    checkVersionAndEmit('stack', modName, version)
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'load:end', kind: 'stack', id: modName, ok: Boolean(plugin) })
    if (!plugin || typeof plugin.detect !== 'function') continue
    try {
      if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'detect:start', kind: 'stack', id: modName, cwd })
      const res = await plugin.detect({ cwd })
      if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'detect:end', kind: 'stack', id: modName, ok: Boolean(res) })
      if (res) out.push(mapStackDetectToDetection(cwd, res, pm as unknown as string, mono as unknown as string, envFiles))
    } catch { /* ignore faulty plugin */ }
  }
  return out
}

export async function loadStackPluginByFramework(args: { readonly cwd: string; readonly framework: string }): Promise<StackPluginModule | undefined> {
  const cwd = args.cwd
  const fw = args.framework.toLowerCase()
  const pkg = await fsx.readJson<Record<string, any>>(join(cwd, 'package.json'))
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const names = Object.keys(deps || {})
  // Heuristic: @opendeploy/stack-<fw> or opendeploy-stack-<fw>
  const candidates = [
    `@opendeploy/stack-${fw}`,
    `opendeploy-stack-${fw}`
  ]
  for (const name of candidates) {
    if (!names.includes(name)) continue
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'load:start', kind: 'stack', id: name })
    const mod = await tryImport<StackPluginModule | { default?: StackPluginModule }>(name)
    const plugin = (mod && (mod as any).plugin) ? (mod as any).plugin : (mod && (mod as any).default && (mod as any).default.plugin) ? (mod as any).default.plugin : undefined
    const version: string | undefined = (mod as any)?.version ?? (mod as any)?.default?.version
    checkVersionAndEmit('stack', name, version)
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'plugin', event: 'load:end', kind: 'stack', id: name, ok: Boolean(plugin) })
    if (plugin) return { plugin, version: version ?? '0.0.0' } as StackPluginModule
  }
  // Fallback to built-in adapter for the framework
  const builtin = loadBuiltinStackPlugin(fw)
  if (builtin) return builtin
  return undefined
}
