import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { readFile } from 'node:fs/promises'
import { detectPackageManager } from './package-manager'
import { detectMonorepo } from './monorepo'
import { detectEnvFiles } from './env-files'
import type { DetectionResult } from '../../types/detection-result'
import type { PackageJson } from '../../types/package-json'

function hasViteDependency(pkg: PackageJson | null): boolean {
  if (pkg === null) return false
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  return Object.prototype.hasOwnProperty.call(deps, 'vite')
}

function hasViteScript(pkg: PackageJson | null): boolean {
  if (pkg === null) return false
  const scripts = pkg.scripts ?? {}
  const vals = Object.values(scripts).join(' ')
  return /(^|\s)(vite\s+build|vite\b)/.test(vals)
}

async function findViteConfigOutDir(cwd: string): Promise<string | undefined> {
  const candidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']
  for (const f of candidates) {
    const p = join(cwd, f)
    if (await fsx.exists(p)) {
      try {
        const raw = await readFile(p, 'utf8')
        const m = raw.match(/build\s*:\s*\{[^}]*outDir\s*:\s*['"]([^'\"]+)['"]/m)
        if (m && m[1]) return m[1].trim()
      } catch { /* ignore */ }
    }
  }
  return undefined
}

/**
 * Detect a Vite app in the provided cwd.
 */
export async function detectViteApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const pkgPath: string = join(args.cwd, 'package.json')
  const pkg: PackageJson | null = await fsx.readJson<PackageJson>(pkgPath)
  const hasDep = hasViteDependency(pkg)
  const hasScript = hasViteScript(pkg)
  const hasConfig = (await Promise.all([
    fsx.exists(join(args.cwd, 'vite.config.ts')),
    fsx.exists(join(args.cwd, 'vite.config.js')),
    fsx.exists(join(args.cwd, 'vite.config.mjs')),
    fsx.exists(join(args.cwd, 'vite.config.cjs')),
  ])).some(Boolean)
  if (!hasDep && !hasScript && !hasConfig) throw new Error('No Vite signals detected')

  const buildFromPkg: string | undefined = pkg?.scripts?.build
  const outDir = (await findViteConfigOutDir(args.cwd)) ?? 'dist'
  let confidence = 0
  if (hasDep) confidence += 0.6
  if (hasConfig) confidence += 0.3
  if (hasScript) confidence += 0.2
  confidence = Math.min(0.98, Math.max(0.5, confidence))

  const detection: DetectionResult = {
    framework: 'vite',
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: buildFromPkg ?? 'vite build',
    outputDir: outDir,
    publishDir: outDir,
    renderMode: 'static',
    confidence,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  }
  return detection
}
