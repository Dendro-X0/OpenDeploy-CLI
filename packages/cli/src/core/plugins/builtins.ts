import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { proc } from '../../utils/process'
import { detectNextApp } from '../detectors/next'
import { detectAstroApp } from '../detectors/astro'
import { detectSvelteKitApp } from '../detectors/sveltekit'
import { detectRemixApp } from '../detectors/remix'
import { detectNuxtApp } from '../detectors/nuxt'
import { detectViteApp } from '../detectors/vite'
import type { DetectionResult } from '../../types/detection-result'
import { logger } from '../../utils/logger'
import type { StackPluginModule, StackDetectResult, StackPlugin, StackBuildResult } from './contracts'

type DetectFn = (args: { readonly cwd: string }) => Promise<DetectionResult>

const detectors: Record<string, DetectFn> = {
  next: detectNextApp,
  astro: detectAstroApp,
  sveltekit: detectSvelteKitApp,
  remix: detectRemixApp,
  nuxt: detectNuxtApp,
  vite: detectViteApp,
}

function toStackDetect(cwd: string, d: DetectionResult): StackDetectResult {
  const buildCmdArr: string[] = String(d.buildCommand || 'build').split(/\s+/).filter(Boolean)
  const outDir: string = d.publishDir ?? d.outputDir
  const configFiles: string[] = []
  if (d.framework === 'next') configFiles.push('next.config.ts', 'next.config.js', 'next.config.mjs')
  if (d.framework === 'astro') configFiles.push('astro.config.mjs', 'astro.config.ts', 'astro.config.js')
  if (d.framework === 'sveltekit') configFiles.push('svelte.config.js', 'svelte.config.ts')
  if (d.framework === 'remix') configFiles.push('remix.config.js', 'remix.config.ts')
  if (d.framework === 'nuxt') configFiles.push('nuxt.config.ts', 'nuxt.config.js')
  if (d.framework === 'vite') configFiles.push('vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs')
  return {
    matchScore: Math.max(50, Math.min(99, Math.round(d.confidence * 100))),
    rootDir: cwd,
    framework: d.framework,
    isMonorepo: d.monorepo !== 'none',
    packageManager: d.packageManager,
    configFiles,
    environmentFiles: d.environmentFiles,
    buildCommand: buildCmdArr,
    outputDir: outDir,
    staticExport: d.renderMode === 'static' || Boolean(d.publishDir),
    notes: [],
  }
}

function makeBuiltinStackPlugin(framework: string, detectFn: DetectFn): StackPluginModule {
  const plugin: StackPlugin = {
    async detect(args) {
      try { const d = await detectFn({ cwd: args.cwd }); return toStackDetect(args.cwd, d) } catch { return undefined }
    },
    async build(args) {
      try {
        const d = await detectFn({ cwd: args.cwd })
        const cmd: string = d.buildCommand && d.buildCommand.trim().length > 0 ? d.buildCommand : defaultBuildCommand(d.framework)
        if (process.env.OPD_NDJSON === '1') logger.json({ action: 'stack', event: 'build:start', framework: d.framework, cwd: args.cwd, cmd })
        const res = await proc.run({ cmd, cwd: args.cwd, env: args.env })
        const ok: boolean = res.ok
        const outputDir: string = d.publishDir ?? d.outputDir
        const result: StackBuildResult = { ok, outputDir, staticExport: d.renderMode === 'static' || Boolean(d.publishDir), artifacts: ok ? [outputDir] : undefined, final: ok ? true : undefined }
        if (process.env.OPD_NDJSON === '1') logger.json({ action: 'stack', event: 'build:end', framework: d.framework, cwd: args.cwd, ok, outputDir })
        return result
      } catch {
        if (process.env.OPD_NDJSON === '1') logger.json({ action: 'stack', event: 'build:end', framework: 'unknown', cwd: args.cwd, ok: false })
        return { ok: false, outputDir: 'dist', staticExport: false }
      }
    },
    async verify(args) {
      const out = args.outputDir
      const exists: boolean = await fsx.exists(join(args.cwd, out))
      return exists ? [] : [`Output dir not found: ${out}`]
    },
    envHints() { return [] }
  }
  return { plugin, version: '1.0.0' }
}

function defaultBuildCommand(framework: string): string {
  if (framework === 'next') return 'next build'
  if (framework === 'astro') return 'astro build'
  if (framework === 'sveltekit') return 'vite build'
  if (framework === 'remix') return 'remix build'
  if (framework === 'nuxt') return 'nuxi build'
  if (framework === 'vite') return 'vite build'
  return 'npm run build'
}

export function loadBuiltinStackPlugin(framework: string): StackPluginModule | undefined {
  const fw = framework.toLowerCase()
  const fn = detectors[fw]
  if (!fn) return undefined
  return makeBuiltinStackPlugin(fw, fn)
}
