import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import { detectPackageManager } from './package-manager'
import { detectMonorepo } from './monorepo'
import { detectEnvFiles } from './env-files'
import type { DetectionResult } from '../../types/detection-result'
import type { PackageJson } from '../../types/package-json'

function hasNextDependency(pkg: PackageJson | null): boolean {
  if (pkg === null) return false
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  return Object.prototype.hasOwnProperty.call(deps, 'next')
}

/**
 * Detect a Next.js app in the provided cwd.
 */
export async function detectNextApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const pkgPath: string = join(args.cwd, 'package.json')
  const pkg: PackageJson | null = await fsx.readJson<PackageJson>(pkgPath)
  if (!hasNextDependency(pkg)) throw new Error('No Next.js dependency detected in package.json')
  const hasApp: boolean = await fsx.exists(join(args.cwd, 'app'))
  const hasPages: boolean = await fsx.exists(join(args.cwd, 'pages'))
  const build: string = pkg?.scripts?.build ?? 'next build'
  const detection: DetectionResult = {
    framework: 'next',
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: hasApp && !hasPages ? true : hasApp,
    packageManager: await detectPackageManager({ cwd: args.cwd }),
    monorepo: await detectMonorepo({ cwd: args.cwd }),
    buildCommand: build,
    outputDir: '.next',
    environmentFiles: await detectEnvFiles({ cwd: args.cwd })
  }
  return detection
}
