import { Command } from 'commander'
import { join } from 'node:path'
import { fsx } from '../utils/fs'
import { logger } from '../utils/logger'
import { parseEnvFile } from '../core/secrets/env'
import { ScriptSeeder } from '../core/seed/script'
import { PrismaSeeder } from '../core/seed/prisma'
import { PostgresSeeder } from '../core/seed/postgres'
import type { OpenDeployConfig, ProjectConfig } from '../types/config'
import { envSync, envDiff } from './env'
import { mapLimit } from '../utils/concurrency'

type TargetEnv = 'prod' | 'preview'

interface RunOptions {
  readonly env?: TargetEnv
  readonly projects?: string
  readonly tags?: string
  readonly all?: boolean
  readonly dryRun?: boolean
  readonly json?: boolean
  readonly ci?: boolean
  readonly config?: string
  readonly syncEnv?: boolean
  readonly diffEnv?: boolean
  readonly projectId?: string
  readonly orgId?: string
  readonly ignore?: string
  readonly only?: string
  readonly failOnAdd?: boolean
  readonly failOnRemove?: boolean
  readonly concurrency?: number
}

function pickProjects(cfg: OpenDeployConfig, opts: RunOptions): readonly ProjectConfig[] {
  const all = cfg.projects
  const byName = (names: string | undefined): Set<string> => new Set((names ?? '').split(',').map(s => s.trim()).filter(Boolean))
  const wantedNames = byName(opts.projects)
  const wantedTags = byName(opts.tags)
  if (opts.all === true && wantedNames.size === 0 && wantedTags.size === 0) return all
  let sel = all
  if (wantedNames.size > 0) sel = sel.filter(p => wantedNames.has(p.name))
  if (wantedTags.size > 0) sel = sel.filter(p => (p.tags ?? []).some(t => wantedTags.has(t)))
  return sel
}

function isStringArray(val: unknown): val is readonly string[] {
  return Array.isArray(val) && val.every(v => typeof v === 'string')
}

async function loadConfig(cwd: string, file?: string): Promise<OpenDeployConfig> {
  const path: string = join(cwd, file ?? 'opendeploy.config.json')
  const data = await fsx.readJson<OpenDeployConfig>(path)
  if (data === null || !Array.isArray((data as OpenDeployConfig).projects)) {
    throw new Error(`Config not found or invalid: ${path}`)
  }
  // Validate shape with clear messages
  for (let i = 0; i < data.projects.length; i++) {
    const p = data.projects[i] as Partial<ProjectConfig>
    const prefix = `projects[${i}]`
    if (typeof p.name !== 'string' || p.name.trim() === '') throw new Error(`${prefix}.name must be a non-empty string`)
    if (typeof p.path !== 'string' || p.path.trim() === '') throw new Error(`${prefix}.path must be a non-empty string`)
    if (p.provider !== 'vercel') throw new Error(`${prefix}.provider must be "vercel"`)
    if (p.envOnly !== undefined && !isStringArray(p.envOnly)) throw new Error(`${prefix}.envOnly must be an array of strings`)
    if (p.envIgnore !== undefined && !isStringArray(p.envIgnore)) throw new Error(`${prefix}.envIgnore must be an array of strings`)
    if (p.failOnAdd !== undefined && typeof p.failOnAdd !== 'boolean') throw new Error(`${prefix}.failOnAdd must be a boolean`)
    if (p.failOnRemove !== undefined && typeof p.failOnRemove !== 'boolean') throw new Error(`${prefix}.failOnRemove must be a boolean`)
    if (p.tags !== undefined && !isStringArray(p.tags)) throw new Error(`${prefix}.tags must be an array of strings`)
    if (p.dependsOn !== undefined && !isStringArray(p.dependsOn)) throw new Error(`${prefix}.dependsOn must be an array of strings`)
  }
  return data
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Orchestrate env+seed tasks across multiple projects from config')
    .option('--env <env>', 'Environment: prod | preview', 'preview')
    .option('--projects <names>', 'Comma-separated project names to run')
    .option('--tags <tags>', 'Comma-separated tags to filter projects')
    .option('--all', 'Run for all projects')
    .option('--concurrency <n>', 'Max concurrent projects', (v: string) => Number.parseInt(v, 10), 2)
    .option('--dry-run', 'Dry-run mode')
    .option('--json', 'Output JSON summary only')
    .option('--ci', 'CI mode (non-interactive)')
    .option('--config <path>', 'Path to opendeploy.config.json')
    .option('--sync-env', 'Sync env to provider before seeding')
    .option('--diff-env', 'Diff env against provider before seeding')
    .option('--project-id <id>', 'Provider project ID for non-interactive link')
    .option('--org-id <id>', 'Provider org ID for non-interactive link')
    .option('--ignore <patterns>', 'Comma-separated glob patterns to ignore (e.g. NEXT_PUBLIC_*)')
    .option('--only <patterns>', 'Comma-separated glob patterns to include')
    .option('--fail-on-add', 'Exit non-zero if new keys would be added')
    .option('--fail-on-remove', 'Exit non-zero if keys are missing remotely')
    .action(async (opts: RunOptions): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        const env: TargetEnv = (opts.env ?? 'preview')
        const cfg: OpenDeployConfig = await loadConfig(cwd, opts.config)
        const selected: readonly ProjectConfig[] = pickProjects(cfg, opts)
        if (selected.length === 0) throw new Error('No matching projects in config')
        const results: Array<{ name: string; env?: { ok: boolean; mode?: 'sync' | 'diff'; error?: string }; seed?: { ok: boolean; mode?: string; error?: string } }> = []
        // Map project name to config for quick lookup
        const byName = new Map<string, ProjectConfig>(selected.map(p => [p.name, p]))
        // Build indegrees for topo layers
        const indeg = new Map<string, number>()
        for (const p of selected) {
          const deps = (p.dependsOn ?? []).filter(d => byName.has(d))
          indeg.set(p.name, (indeg.get(p.name) ?? 0) + 0)
          for (const d of deps) indeg.set(p.name, (indeg.get(p.name) ?? 0) + 1)
        }
        // Build layers
        const layers: string[][] = []
        const remaining = new Set<string>(selected.map(p => p.name))
        while (remaining.size > 0) {
          const layer: string[] = []
          for (const n of Array.from(remaining)) {
            if ((indeg.get(n) ?? 0) === 0) layer.push(n)
          }
          if (layer.length === 0) throw new Error('Cycle detected in dependsOn graph')
          layers.push(layer)
          // Remove layer and decrement indegrees
          for (const n of layer) {
            remaining.delete(n)
            for (const p of selected) {
              if ((p.dependsOn ?? []).includes(n)) indeg.set(p.name, Math.max(0, (indeg.get(p.name) ?? 0) - 1))
            }
          }
        }
        // Worker to process a single project (env then seed)
        const worker = async (p: ProjectConfig): Promise<void> => {
          const projCwd: string = join(cwd, p.path)
          const envFile: string | undefined = env === 'prod' ? p.envFileProd : p.envFilePreview
          const extraEnv = envFile ? await parseEnvFile({ path: join(projCwd, envFile) }) : undefined
          const envRes: { ok: boolean; mode?: 'sync' | 'diff'; error?: string } = { ok: true }
          try {
            if (opts.diffEnv === true || opts.syncEnv === true) {
              if (!envFile) throw new Error('env file not configured for this environment in config')
              const filePath = envFile
              // Resolve policy precedence: CLI > project > global policy > empty
              const polOnly = (opts.only ?? (p.envOnly?.join(',') ?? (cfg.policy?.envOnly?.join(',') ?? '')))
                .split(',').map(s => s.trim()).filter(Boolean)
              const polIgnore = (opts.ignore ?? (p.envIgnore?.join(',') ?? (cfg.policy?.envIgnore?.join(',') ?? '')))
                .split(',').map(s => s.trim()).filter(Boolean)
              const polFailOnAdd: boolean = (opts.failOnAdd ?? p.failOnAdd ?? cfg.policy?.failOnAdd ?? false) as boolean
              const polFailOnRemove: boolean = (opts.failOnRemove ?? p.failOnRemove ?? cfg.policy?.failOnRemove ?? false) as boolean
              const common = {
                provider: 'vercel' as const,
                cwd: projCwd,
                file: filePath,
                env: env,
                json: opts.json === true,
                ci: opts.ci === true,
                projectId: opts.projectId,
                orgId: opts.orgId,
                ignore: polIgnore,
                only: polOnly,
                failOnAdd: polFailOnAdd,
                failOnRemove: polFailOnRemove,
              }
              if (opts.diffEnv === true) { await envDiff(common); envRes.mode = 'diff' }
              if (opts.syncEnv === true) { await envSync({ ...common, yes: true, dryRun: opts.dryRun === true }); envRes.mode = 'sync' }
            }
          } catch (e) {
            envRes.ok = false
            envRes.error = e instanceof Error ? e.message : String(e)
          }
          const seedRes: { ok: boolean; mode?: string; error?: string } = { ok: true }
          try {
            if (p.seed) {
              const mode = p.seed.schema
              seedRes.mode = mode
              if (mode === 'script') {
                const script = new ScriptSeeder()
                await script.seed({ cwd: projCwd, script: p.seed.script, dryRun: opts.dryRun === true, env: extraEnv })
              } else if (mode === 'prisma') {
                const dbUrl = (extraEnv?.DATABASE_URL ?? process.env.DATABASE_URL ?? '')
                if (!dbUrl) throw new Error('DATABASE_URL missing for prisma seed')
                const prisma = new PrismaSeeder()
                await prisma.seed({ cwd: projCwd, dbUrl, dryRun: opts.dryRun === true, env: extraEnv })
              } else if (mode === 'sql') {
                const dbUrl = (extraEnv?.DATABASE_URL ?? process.env.DATABASE_URL ?? '')
                if (!dbUrl) throw new Error('DATABASE_URL missing for SQL seed')
                const pg = new PostgresSeeder()
                await pg.seed({ cwd: projCwd, dbUrl, dryRun: opts.dryRun === true })
              }
            }
          } catch (e) {
            seedRes.ok = false
            seedRes.error = e instanceof Error ? e.message : String(e)
          }
          results.push({ name: p.name, env: envRes, seed: seedRes })
        }
        // Execute layer by layer respecting dependsOn; within a layer, respect concurrency
        const conc: number = (opts as unknown as { concurrency?: number }).concurrency ?? 2
        for (const layer of layers) {
          const projs = layer.map(name => byName.get(name)!).filter(Boolean)
          await mapLimit(projs, conc, async (p) => { await worker(p) })
        }
        if (opts.json === true) {
          logger.json({ ok: results.every(r => (r.seed?.ok !== false && r.env?.ok !== false)), results })
        } else {
          for (const r of results) {
            if (r.env?.mode) {
              if (r.env.ok) logger.success(`[${r.name}] env ${r.env.mode} ok`)
              else logger.error(`[${r.name}] env ${r.env.mode} failed: ${r.env.error ?? 'unknown'}`)
            }
            if (r.seed?.ok) logger.success(`[${r.name}] seed ok (${r.seed.mode})`)
            else logger.error(`[${r.name}] seed failed: ${r.seed?.error ?? 'unknown'}`)
          }
        }
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
      }
    })
}
