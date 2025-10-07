import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from 'pg'
import { fsx } from '../../utils/fs'
import { logger } from '../../utils/logger'

export interface PostgresSeedArgs {
  readonly dbUrl: string
  readonly cwd: string
  readonly file?: string
  readonly dryRun?: boolean
}

function inferDefaultSeedPath(cwd: string): string | null {
  const candidates: readonly string[] = [
    join(cwd, 'prisma', 'seed.sql'),
    join(cwd, 'seed.sql')
  ]
  for (const p of candidates) if (fsx.exists(p) instanceof Promise) { /* noop for TS */ }
  return null
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

function needsSsl(dbUrl: string): boolean {
  return dbUrl.includes('sslmode=require') || dbUrl.includes('neon.tech') || dbUrl.includes('render.com') || dbUrl.includes('vercel-storage.com')
}

/**
 * PostgresSeeder executes a SQL seed file against a Postgres database.
 */
export class PostgresSeeder {
  public async seed(args: PostgresSeedArgs): Promise<void> {
    const filePath: string | null = await this.resolveFilePath({ cwd: args.cwd, file: args.file })
    if (filePath === null) throw new Error('No seed file found. Provide --file or add prisma/seed.sql or seed.sql')
    const sql: string = await this.readSql({ path: filePath })
    if (args.dryRun === true) {
      logger.info(`Dry-run: would execute ${sql.length} characters of SQL on ${maskUrl(args.dbUrl)}`)
      return
    }
    await this.execute({ dbUrl: args.dbUrl, sql })
    logger.success(`Seed complete on ${maskUrl(args.dbUrl)}`)
  }

  private async resolveFilePath(args: { readonly cwd: string; readonly file?: string }): Promise<string | null> {
    if (args.file !== undefined) return join(args.cwd, args.file)
    const p1: string = join(args.cwd, 'prisma', 'seed.sql')
    if (await fsx.exists(p1)) return p1
    const p2: string = join(args.cwd, 'seed.sql')
    if (await fsx.exists(p2)) return p2
    return null
  }

  private async readSql(args: { readonly path: string }): Promise<string> {
    const buf: string = await readFile(args.path, 'utf8')
    return buf.replace(/^\uFEFF/, '').trim()
  }

  private async execute(args: { readonly dbUrl: string; readonly sql: string }): Promise<void> {
    const client: Client = new Client({ connectionString: args.dbUrl, ssl: needsSsl(args.dbUrl) ? { rejectUnauthorized: false } : undefined })
    try {
      await client.connect()
      await client.query('BEGIN')
      await client.query(args.sql)
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      const message: string = err instanceof Error ? err.message : String(err)
      throw new Error(`Seed failed: ${message}`)
    } finally {
      await client.end().catch(() => {})
    }
  }
}
