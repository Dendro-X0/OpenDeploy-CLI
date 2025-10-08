import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import type { MonorepoTool } from '../../types/monorepo-tool'
import type { PackageJson } from '../../types/package-json'

/**
 * Detect monorepo tooling presence.
 */
export async function detectMonorepo(args: { readonly cwd: string }): Promise<MonorepoTool> {
  const turbo: string = join(args.cwd, 'turbo.json')
  const nx: string = join(args.cwd, 'nx.json')
  const pnpmWs: string = join(args.cwd, 'pnpm-workspace.yaml')
  if (await fsx.exists(turbo)) return 'turborepo'
  if (await fsx.exists(nx)) return 'nx'
  if (await fsx.exists(pnpmWs)) return 'workspaces'
  const pkgPath: string = join(args.cwd, 'package.json')
  const pkg: PackageJson | null = await fsx.readJson<PackageJson>(pkgPath)
  if (pkg !== null && pkg.workspaces !== undefined) return 'workspaces'
  return 'none'
}
