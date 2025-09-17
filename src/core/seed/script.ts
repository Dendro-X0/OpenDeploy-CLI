import { detectPackageManager } from '../../core/detectors/package-manager'
import { proc } from '../../utils/process'
import { logger } from '../../utils/logger'
import type { PackageManager } from '../../types/package-manager'

export interface ScriptSeedArgs {
  readonly cwd: string
  readonly dbUrl?: string
  readonly script?: string
  readonly dryRun?: boolean
  readonly env?: Readonly<Record<string, string>>
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url)
    const user: string = u.username
    const host: string = u.hostname
    const db: string = u.pathname.replace(/^\//, '')
    return `postgres://${user !== '' ? user : 'user'}@${host}/${db}`
  } catch {
    return 'postgres://***'
  }
}

function pmRun(pm: PackageManager, script: string): string {
  if (pm === 'pnpm') return `pnpm run ${script}`
  if (pm === 'yarn') return `yarn ${script}`
  if (pm === 'bun') return `bun run ${script}`
  return `npm run ${script}`
}

/**
 * Runs a user-defined package.json script for seeding (works well with Drizzle setups).
 */
export class ScriptSeeder {
  public async seed(args: ScriptSeedArgs): Promise<void> {
    const pm = await detectPackageManager({ cwd: args.cwd })
    const script: string = args.script ?? 'db:seed'
    const cmd: string = pmRun(pm, script)
    if (args.dryRun === true) {
      const target: string = args.dbUrl ? maskUrl(args.dbUrl) : '(inherited)'
      logger.info(`Dry-run: would execute "${cmd}" with DATABASE_URL=${target}`)
      return
    }
    const mergedEnv: Record<string, string> = { ...(args.env ?? {}) }
    if (args.dbUrl) mergedEnv.DATABASE_URL = args.dbUrl
    const out = await proc.run({ cmd, cwd: args.cwd, env: Object.keys(mergedEnv).length ? mergedEnv : undefined })
    if (!out.ok) throw new Error(out.stderr.trim() || out.stdout.trim() || `Seeding script failed: ${script}`)
    logger.success('Script seed complete')
  }
}
