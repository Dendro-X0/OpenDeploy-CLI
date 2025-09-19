import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { detectPackageManager } from './package-manager'
import { detectMonorepo } from './monorepo'
import { detectEnvFiles } from './env-files'
import type { DetectionResult } from '../../types/detection-result'
import type { PackageJson } from '../../types/package-json'

function hasNuxtDependency(pkg: PackageJson | null): boolean {
  if (pkg === null) return false
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  return Object.prototype.hasOwnProperty.call(deps, 'nuxt')
}

/** Detect a Nuxt app in the provided cwd (Nuxt 3/4). */
export async function detectNuxtApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const pkgPath: string = join(args.cwd, 'package.json')
  const pkg: PackageJson | null = await fsx.readJson<PackageJson>(pkgPath)
  if (!hasNuxtDependency(pkg)) throw new Error('No Nuxt dependency detected in package.json')
  const scripts = pkg?.scripts ?? {}
  const build: string = scripts.build ?? 'nuxt build'
  const usesGenerate: boolean = /nuxt\s+generate|nuxi\s+generate/i.test(build)
  const detection: DetectionResult = {
    framework: 'nuxt',
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    // Nuxt outputs to .output by default (Nitro). Static generate -> .output/public
    outputDir: '.output',
    publishDir: usesGenerate ? '.output/public' : undefined,
    renderMode: usesGenerate ? 'static' : 'hybrid',
    confidence: 0.9,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  }
  return detection
}
