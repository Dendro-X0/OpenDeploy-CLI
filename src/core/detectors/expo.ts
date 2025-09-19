import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { detectPackageManager } from './package-manager'
import { detectMonorepo } from './monorepo'
import { detectEnvFiles } from './env-files'
import type { DetectionResult } from '../../types/detection-result'
import type { PackageJson } from '../../types/package-json'

function hasExpoDependency(pkg: PackageJson | null): boolean {
  if (pkg === null) return false
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  if (Object.prototype.hasOwnProperty.call(deps, 'expo')) return true
  // Typical Expo apps include expo package and expo scripts
  const scripts = pkg.scripts ?? {}
  const looksLike = Object.values(scripts).some((s) => typeof s === 'string' && /expo\s+(start|build|run|prebuild)/i.test(s))
  return looksLike
}

/** Detect an Expo app in the provided cwd (best-effort). */
export async function detectExpoApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const pkgPath: string = join(args.cwd, 'package.json')
  const pkg: PackageJson | null = await fsx.readJson<PackageJson>(pkgPath)
  if (!hasExpoDependency(pkg)) throw new Error('No Expo dependency detected in package.json')
  const build: string = pkg?.scripts?.build ?? 'expo build'
  const detection: DetectionResult = {
    framework: 'expo',
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    outputDir: 'dist',
    publishDir: 'dist',
    renderMode: 'static',
    confidence: 0.6,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  }
  return detection
}
