import { detectPackageManager } from '../../core/detectors/package-manager'
import { proc } from '../../utils/process'
import { logger } from '../../utils/logger'

export interface PrismaSeedArgs {
  readonly cwd: string
  readonly dbUrl: string
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

function commandForPm(pm: 'pnpm' | 'yarn' | 'npm' | 'bun'): string {
  if (pm === 'pnpm') return 'pnpm exec prisma db seed'
  if (pm === 'yarn') return 'yarn prisma db seed'
  if (pm === 'bun') return 'bunx prisma db seed'
  return 'npx prisma db seed'
}

/**
 * Runs `prisma db seed` using the project's package manager.
 */
export class PrismaSeeder {
  public async seed(args: PrismaSeedArgs): Promise<void> {
    const pm = await detectPackageManager({ cwd: args.cwd })
    const cmd: string = commandForPm(pm)
    if (args.dryRun === true) {
      logger.info(`Dry-run: would execute "${cmd}" with DATABASE_URL=${maskUrl(args.dbUrl)}`)
      return
    }
    const mergedEnv: Record<string, string> = { ...(args.env ?? {}), DATABASE_URL: args.dbUrl }
    const out = await proc.run({ cmd, cwd: args.cwd, env: mergedEnv })
    if (!out.ok) throw new Error(out.stderr.trim() || out.stdout.trim() || 'Prisma seed failed')
    logger.success('Prisma seed complete')
  }
}
