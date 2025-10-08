import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { detectPackageManager } from './package-manager'
import { detectMonorepo } from './monorepo'
import { detectEnvFiles } from './env-files'
import type { DetectionResult } from '../../types/detection-result'
import type { PackageJson } from '../../types/package-json'

function hasRemixDependency(pkg: PackageJson | null): boolean {
  if (pkg === null) return false
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  if (Object.prototype.hasOwnProperty.call(deps, 'remix')) return true
  if (Object.prototype.hasOwnProperty.call(deps, '@remix-run/node')) return true
  if (Object.prototype.hasOwnProperty.call(deps, '@remix-run/react')) return true
  // Script heuristic
  const scripts = pkg.scripts ?? {}
  const looksLike = Object.values(scripts).some((s) => typeof s === 'string' && /remix\s+build|remix\s+dev/i.test(s))
  return looksLike
}

/** Detect a Remix app in the provided cwd (best-effort). */
export async function detectRemixApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const pkgPath: string = join(args.cwd, 'package.json')
  const pkg: PackageJson | null = await fsx.readJson<PackageJson>(pkgPath)
  if (!hasRemixDependency(pkg)) throw new Error('No Remix dependency detected in package.json')
  const build: string = pkg?.scripts?.build ?? 'remix build'
  const detection: DetectionResult = {
    framework: 'remix',
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    outputDir: 'build',
    publishDir: 'build/client',
    renderMode: 'hybrid',
    confidence: 0.88,
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  }
  return detection
}
