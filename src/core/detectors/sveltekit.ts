import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { detectPackageManager } from './package-manager'
import { detectMonorepo } from './monorepo'
import { detectEnvFiles } from './env-files'
import type { DetectionResult } from '../../types/detection-result'
import type { PackageJson } from '../../types/package-json'

function hasSvelteKitDependency(pkg: PackageJson | null): boolean {
  if (pkg === null) return false
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  // Primary indicator
  if (Object.prototype.hasOwnProperty.call(deps, '@sveltejs/kit')) return true
  // Secondary: some templates include "svelte" and infer kit via scripts (best-effort)
  if (Object.prototype.hasOwnProperty.call(deps, 'svelte')) {
    const scripts = pkg.scripts ?? {}
    const hasKitScript = Object.values(scripts).some((s) => typeof s === 'string' && /svelte-?kit|vite\s+build/i.test(s))
    if (hasKitScript) return true
  }
  return false
}

/** Detect a SvelteKit app in the provided cwd (best-effort). */
export async function detectSvelteKitApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const pkgPath: string = join(args.cwd, 'package.json')
  const pkg: PackageJson | null = await fsx.readJson<PackageJson>(pkgPath)
  if (!hasSvelteKitDependency(pkg)) throw new Error('No SvelteKit dependency detected in package.json')
  const build: string = pkg?.scripts?.build ?? 'vite build'
  const detection: DetectionResult = {
    framework: 'sveltekit',
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    // Output varies by adapter; use a conventional folder for reference
    outputDir: 'build',
    publishDir: 'build',
    renderMode: 'hybrid',
    confidence: 0.85,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  }
  return detection
}
