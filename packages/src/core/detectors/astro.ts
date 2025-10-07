import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { detectPackageManager } from './package-manager'
import { detectMonorepo } from './monorepo'
import { detectEnvFiles } from './env-files'
import type { DetectionResult } from '../../types/detection-result'
import type { PackageJson } from '../../types/package-json'

function hasAstroDependency(pkg: PackageJson | null): boolean {
  if (pkg === null) return false
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  return Object.prototype.hasOwnProperty.call(deps, 'astro')
}

/** Detect an Astro app in the provided cwd. */
export async function detectAstroApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const pkgPath: string = join(args.cwd, 'package.json')
  const pkg: PackageJson | null = await fsx.readJson<PackageJson>(pkgPath)
  if (!hasAstroDependency(pkg)) throw new Error('No Astro dependency detected in package.json')
  const build: string = pkg?.scripts?.build ?? 'astro build'
  const detection: DetectionResult = {
    framework: 'astro',
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    outputDir: 'dist',
    publishDir: 'dist',
    renderMode: 'static',
    confidence: 0.9,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  }
  return detection
}
