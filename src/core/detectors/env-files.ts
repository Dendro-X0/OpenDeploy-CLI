import { join } from 'node:path'
import { fsx } from '../../utils/fs'

/**
 * Detect environment files present in the project root.
 */
export async function detectEnvFiles(args: { readonly cwd: string }): Promise<readonly string[]> {
  const candidates: readonly string[] = ['.env', '.env.local', '.env.production', '.env.development']
  const found: string[] = []
  for (const f of candidates) {
    const p: string = join(args.cwd, f)
    if (await fsx.exists(p)) found.push(f)
  }
  return found
}
