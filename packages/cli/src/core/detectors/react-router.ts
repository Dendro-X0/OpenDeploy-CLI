import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DetectionResult } from '../../types/detection-result'
import type { PackageManager } from '../../types/package-manager'
import type { MonorepoTool } from '../../types/monorepo-tool'

async function readJson<T>(path: string): Promise<T | null> {
  try { const s = await readFile(path, 'utf8'); return JSON.parse(s) as T } catch { return null }
}

function detectPm(_pkg: any): PackageManager {
  const ua = typeof process.env.npm_config_user_agent === 'string' ? process.env.npm_config_user_agent : ''
  if (ua.includes('pnpm')) return 'pnpm'
  if (ua.includes('yarn')) return 'yarn'
  if (ua.includes('bun')) return 'bun'
  return 'npm'
}

function detectMonorepo(): MonorepoTool {
  return 'none'
}

export async function detectReactRouterApp(args: { readonly cwd: string }): Promise<DetectionResult> {
  const cwd: string = args.cwd
  const pkg = await readJson<Record<string, any>>(join(cwd, 'package.json'))
  if (!pkg) throw new Error('not a react-router app')
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) } as Record<string, string>
  const scripts = (pkg.scripts ?? {}) as Record<string, string>
  const hasRRDeps = typeof deps['@react-router/dev'] === 'string' || typeof deps['@react-router/node'] === 'string' || typeof deps['@react-router/serve'] === 'string'
  const hasRRBuild = Object.values(scripts).some((s) => /react-router\s+build/i.test(String(s)))
  if (!hasRRDeps && !hasRRBuild) throw new Error('not a react-router app')
  const buildCommand: string = hasRRBuild ? (Object.entries(scripts).find(([, cmd]) => /react-router\s+build/i.test(String(cmd)))?.[1] ?? 'react-router build') : 'react-router build'
  const result: DetectionResult = {
    framework: 'remix',
    rootDir: cwd,
    appDir: cwd,
    hasAppRouter: false,
    packageManager: detectPm(pkg),
    monorepo: detectMonorepo(),
    buildCommand,
    outputDir: 'build',
    publishDir: 'build/client',
    renderMode: 'static',
    confidence: 0.75,
    environmentFiles: ['.env', '.env.local', '.env.production.local']
  }
  return result
}
