import { join } from 'node:path'
import { fsx } from '../../utils/fs'
import type { PackageManager } from '../../types/package-manager'

/**
 * Detect the package manager based on lockfiles.
 */
export async function detectPackageManager(args: { readonly cwd: string }): Promise<PackageManager> {
  const lockBun1: string = join(args.cwd, 'bun.lockb')
  const lockBun2: string = join(args.cwd, 'bun.lock')
  const lockPnpm: string = join(args.cwd, 'pnpm-lock.yaml')
  const lockYarn: string = join(args.cwd, 'yarn.lock')
  const lockNpm: string = join(args.cwd, 'package-lock.json')
  if (await fsx.exists(lockBun1) || await fsx.exists(lockBun2)) return 'bun'
  if (await fsx.exists(lockPnpm)) return 'pnpm'
  if (await fsx.exists(lockYarn)) return 'yarn'
  if (await fsx.exists(lockNpm)) return 'npm'
  return 'pnpm'
}
