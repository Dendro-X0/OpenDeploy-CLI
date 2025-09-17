import { Command } from 'commander'
import { EnvLoader } from '../core/secrets/env'
import { PostgresSeeder } from '../core/seed/postgres'
import { PrismaSeeder } from '../core/seed/prisma'
import { ScriptSeeder } from '../core/seed/script'
import { logger } from '../utils/logger'
import { confirm } from '../utils/prompt'
import { parseEnvFile } from '../core/secrets/env'

interface SeedOptions {
  readonly dbUrl?: string
  readonly file?: string
  readonly env?: 'prod' | 'preview' | 'development'
  readonly dryRun?: boolean
  readonly yes?: boolean
  readonly schema?: 'sql' | 'prisma' | 'script'
  readonly script?: string
  readonly envFile?: string
  readonly json?: boolean
  readonly ci?: boolean
}

function resolveDbUrl(opts: SeedOptions): string | null {
  if (typeof opts.dbUrl === 'string' && opts.dbUrl.length > 0) return opts.dbUrl
  const env = new EnvLoader().load()
  const url: string | undefined = env.DATABASE_URL
  return typeof url === 'string' && url.length > 0 ? url : null
}

function isPostgresUrl(url: string): boolean {
  try { const u = new URL(url); return u.protocol === 'postgres:' || u.protocol === 'postgresql:' } catch { return false }
}

/**
 * Register the `seed` command for Postgres.
 */
export function registerSeedCommand(program: Command): void {
  program
    .command('seed')
    .description('Seed a database (SQL, Prisma, or package.json script)')
    .option('--db-url <url>', 'Postgres connection string (defaults to DATABASE_URL)')
    .option('--file <path>', 'SQL file path (defaults to prisma/seed.sql or seed.sql)')
    .option('--env <env>', 'Target environment: prod | preview | development', 'preview')
    .option('--schema <schema>', 'Seed schema: sql | prisma | script', 'sql')
    .option('--script <name>', 'Package.json script name to run (when --schema script)', 'db:seed')
    .option('--dry-run', 'Print what would happen without executing SQL')
    .option('--yes', 'Skip confirmation prompts')
    .option('--env-file <path>', 'Load additional env vars from a .env file and pass to the seed process')
    .option('--json', 'Output JSON summary')
    .option('--ci', 'CI mode (non-interactive, safer defaults)')
    .action(async (opts: SeedOptions): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        const schema: 'sql' | 'prisma' | 'script' = (opts.schema ?? 'sql')
        const dbUrl: string | null = resolveDbUrl(opts)
        if (schema !== 'script') {
          if (dbUrl === null) throw new Error('Missing database URL. Pass --db-url or set DATABASE_URL in environment/.env')
          if (!isPostgresUrl(dbUrl)) throw new Error('Only Postgres is supported for now. Expect protocol postgres:// or postgresql://')
        }
        if (opts.env === 'prod' && opts.yes !== true && opts.ci !== true) {
          const ok: boolean = await confirm('You are about to run seed against PROD. Continue?', { defaultYes: false })
          if (!ok) { logger.warn('Seed aborted by user'); return }
        }
        // Load extra env from --env-file (if provided) and pass to sub-processes
        let extraEnv: Readonly<Record<string, string>> | undefined
        if (typeof opts.envFile === 'string' && opts.envFile.length > 0) {
          extraEnv = await parseEnvFile({ path: opts.envFile })
        }
        const dry = opts.dryRun === true
        const result: { mode: string; ok: boolean } = { mode: schema, ok: false }
        if (schema === 'prisma') {
          const prisma = new PrismaSeeder()
          await prisma.seed({ cwd, dbUrl: dbUrl!, dryRun: dry, env: extraEnv })
          result.ok = true
        } else if (schema === 'script') {
          const script = new ScriptSeeder()
          await script.seed({ cwd, dbUrl: dbUrl ?? undefined, script: opts.script, dryRun: dry, env: extraEnv })
          result.ok = true
        } else {
          const seeder = new PostgresSeeder()
          await seeder.seed({ dbUrl: dbUrl!, cwd, file: opts.file, dryRun: dry })
          result.ok = true
        }
        if (opts.json === true) logger.json(result)
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
      }
    })
}
