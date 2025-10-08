import { Command } from 'commander'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { parseEnvFile } from '../core/secrets/env'
import { logger } from '../utils/logger'
import { formatDiffHuman } from '../utils/format'
import { spinner } from '../utils/ui'
import { mapProviderError } from '../utils/errors'
import { isJsonMode } from '../utils/logger'
import { printEnvPullSummary, printEnvSyncSummary, printEnvDiffSummary } from '../utils/summarize'
import { confirm } from '../utils/prompt'
import { proc, runWithRetry } from '../utils/process'
import { fsx } from '../utils/fs'
import { getCached, setCached } from '../utils/cache'
import Ajv from 'ajv'
import { envSummarySchema } from '../schemas/env-summary.schema'

type EnvTarget = 'prod' | 'preview' | 'development' | 'all'

interface SyncOptions {
  readonly file?: string
  readonly env?: EnvTarget
  readonly yes?: boolean
  readonly dryRun?: boolean
  readonly json?: boolean
  readonly ci?: boolean
  readonly projectId?: string
  readonly orgId?: string
  readonly ignore?: string
  readonly only?: string
  readonly failOnAdd?: boolean
  readonly failOnRemove?: boolean
  readonly optimizeWrites?: boolean
  readonly map?: string
  readonly printCmd?: boolean
  readonly retries?: string
  readonly timeoutMs?: string
  readonly baseDelayMs?: string
}

// Ajv validator for env summaries (top-level so helpers can use it)
const envAjv = new Ajv({ allErrors: true, strict: false })
const envSchemaValidate = envAjv.compile(envSummarySchema as unknown as object)
function annotateEnv(obj: Record<string, unknown>): Record<string, unknown> {
  const ok: boolean = envSchemaValidate(obj) as boolean
  const errs: string[] = Array.isArray(envSchemaValidate.errors) ? envSchemaValidate.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
  if (process.env.OPD_SCHEMA_STRICT === '1' && errs.length > 0) { process.exitCode = 1 }
  return { ...obj, schemaOk: ok, schemaErrors: errs }
}

// ---------------- Netlify parity ----------------
async function getNetlifySiteId(cwd: string, projectId?: string): Promise<string | undefined> {
  if (projectId) return projectId
  try {
    const st = await fsx.readJson<{ readonly siteId?: string }>(join(cwd, '.netlify', 'state.json'))
    if (st && typeof st.siteId === 'string' && st.siteId.length > 0) return st.siteId
  } catch { /* ignore */ }
  return undefined
}

async function fetchNetlifyEnvMap(args: { readonly cwd: string; readonly projectId?: string; readonly context?: string; readonly printCmd?: boolean }): Promise<Record<string, string>> {
  try {
    const siteId: string | undefined = await getNetlifySiteId(args.cwd, args.projectId)
    const siteFlag: string = siteId ? ` --site ${siteId}` : ''
    // Prefer JSON output when supported
    const listJsonCmd = `netlify env:list --json${siteFlag}`.trim()
    if (args.printCmd) logger.info(`$ ${listJsonCmd}`)
    const jsonRes = await runWithRetry({ cmd: listJsonCmd, cwd: args.cwd })
    if (jsonRes.ok) {
      try {
        const data = JSON.parse(jsonRes.stdout) as Array<{ key: string; values?: Array<{ context?: string; value?: string }> }>
        const map: Record<string, string> = {}
        for (const item of data) {
          const v = (args.context
            ? item.values?.find(x => (x.context ?? '').toLowerCase() === args.context?.toLowerCase() && typeof x.value === 'string')?.value
            : undefined) ?? item.values?.find(x => typeof x.value === 'string')?.value
          if (typeof v === 'string') map[item.key] = v
        }
        return map
      } catch { /* fallthrough to plain parsing */ }
    }
    // Fallback: parse plain list output
    const listCmd = `netlify env:list${siteFlag}`.trim()
    if (args.printCmd) logger.info(`$ ${listCmd}`)
    const out = await runWithRetry({ cmd: listCmd, cwd: args.cwd })
    if (!out.ok) return {}
    const map: Record<string, string> = {}
    for (const line of out.stdout.split(/\r?\n/)) {
      const mEq = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      const mSp = !mEq ? line.match(/^([A-Z0-9_]+)\s+(.+)$/) : null
      const k = mEq?.[1] ?? mSp?.[1]
      const v = mEq?.[2] ?? mSp?.[2]
      if (k && typeof v === 'string' && v.length > 0) map[k] = v.trim()
    }
    return map
  } catch {
    return {}
  }
}

async function pullNetlify(args: { readonly cwd: string; readonly out?: string; readonly json: boolean; readonly projectId?: string; readonly context?: string; readonly printCmd?: boolean }): Promise<void> {
  const sp = spinner('Netlify: pulling env')
  try {
    const siteId = await getNetlifySiteId(args.cwd, args.projectId)
    await ensureNetlifyLinked({ cwd: args.cwd, projectId: siteId, printCmd: args.printCmd })
    const outFile: string = args.out ?? '.env.local'
    const remote = await fetchNetlifyEnvMap({ cwd: args.cwd, projectId: siteId, context: args.context, printCmd: args.printCmd })
    const content: string = Object.entries(remote).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
    await writeFile(join(args.cwd, outFile), content, 'utf8')
    if (args.json === true) logger.jsonPrint(annotateEnv({ ok: true, action: 'env' as const, subcommand: 'pull' as const, provider: 'netlify' as const, out: outFile, count: Object.keys(remote).length, final: true }))
    else { sp.succeed(`Netlify: pulled to ${outFile}`); logger.success(`Pulled Netlify env to ${outFile}`); printEnvPullSummary({ provider: 'netlify', out: outFile, count: Object.keys(remote).length }) }
  } finally { sp.stop() }
}

async function syncNetlify(args: { readonly cwd: string; readonly file: string; readonly yes: boolean; readonly dryRun: boolean; readonly json: boolean; readonly ci: boolean; readonly projectId?: string; readonly ignore?: readonly string[]; readonly only?: readonly string[]; readonly optimizeWrites?: boolean; readonly mapFile?: string; readonly printCmd?: boolean }): Promise<void> {
  const envPath: string = join(args.cwd, args.file)
  const original = await parseEnvFile({ path: envPath })
  const kv = await applyEnvMapping({ cwd: args.cwd, kv: original, mapFile: args.mapFile })
  const entriesAll = Object.entries(kv)
  const entries = entriesAll.filter(([k]) => allowKey(k, args.only ?? [], args.ignore ?? []))
  if (entries.length === 0) { logger.warn(`No variables found in ${args.file}. Nothing to sync.`); return }
  const siteId: string | undefined = await getNetlifySiteId(args.cwd, args.projectId)
  await ensureNetlifyLinked({ cwd: args.cwd, projectId: siteId, printCmd: args.printCmd })
  // Optimize writes by reading remote once
  let remoteMap: Record<string, string> | undefined
  if (args.optimizeWrites === true && !args.dryRun) {
    try { remoteMap = await fetchNetlifyEnvMap({ cwd: args.cwd, projectId: siteId, printCmd: args.printCmd }) } catch { /* ignore */ }
  }
  const results: Array<{ key: string; status: 'set' | 'skipped' | 'failed'; error?: string }> = []
  for (const [key, value] of entries) {
    const go = args.yes === true || args.ci === true || args.dryRun === true ? true : await confirm(`Set ${key}=${mask(value)} to Netlify?`, { defaultYes: true })
    if (!go) continue
    if (args.dryRun === true) { logger.info(`[dry-run] netlify env:set ${key} ← ${mask(value)}`); results.push({ key, status: 'skipped' }); continue }
    if (args.optimizeWrites === true && remoteMap && remoteMap[key] === value) {
      logger.info(`Skip (same) ${key}`)
      results.push({ key, status: 'skipped' })
      continue
    }
    // Avoid passing --site as older/newer Netlify CLIs may not support it for env:set
    const setCmd = `netlify env:set ${key} ${JSON.stringify(value)}`.trim()
    if (args.printCmd) logger.info(`$ ${setCmd}`)
    const res = await runWithRetry({ cmd: setCmd, cwd: args.cwd })
    if (res.ok) { logger.success(`Set ${key}`); results.push({ key, status: 'set' }) }
    else { const errMsg: string = res.stderr.trim() || res.stdout.trim(); logger.warn(`Failed to set ${key}: ${errMsg}`); results.push({ key, status: 'failed', error: errMsg }) }
  }
  if (args.json === true) {
    const ok = results.every(r => r.status !== 'failed')
    logger.jsonPrint(annotateEnv({ ok, action: 'env' as const, subcommand: 'sync' as const, provider: 'netlify' as const, file: args.file, envs: results, final: true }))
  }
  else {
    const setCount = results.filter(r => r.status === 'set').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    const failedCount = results.filter(r => r.status === 'failed').length
    printEnvSyncSummary({ provider: 'netlify', file: args.file, setCount, skippedCount, failedCount })
  }
}

async function diffNetlify(args: { readonly cwd: string; readonly file: string; readonly json: boolean; readonly ci: boolean; readonly projectId?: string; readonly context?: string; readonly ignore?: readonly string[]; readonly only?: readonly string[]; readonly failOnAdd?: boolean; readonly failOnRemove?: boolean; readonly printCmd?: boolean }): Promise<void> {
  const sp = spinner('Netlify: diffing env')
  const localPath: string = join(args.cwd, args.file)
  const allLocal = await parseEnvFile({ path: localPath })
  const local: Record<string, string> = {}
  for (const [k, v] of Object.entries(allLocal)) if (allowKey(k, args.only ?? [], args.ignore ?? [])) local[k] = v
  const siteId: string | undefined = await getNetlifySiteId(args.cwd, args.projectId)
  await ensureNetlifyLinked({ cwd: args.cwd, projectId: siteId, printCmd: args.printCmd })
  const remote = await fetchNetlifyEnvMap({ cwd: args.cwd, projectId: siteId, context: args.context, printCmd: args.printCmd })
  const keys = Array.from(new Set([...Object.keys(local), ...Object.keys(remote)])).sort()
  const added: string[] = []
  const removed: string[] = []
  const changed: Array<{ key: string; local: string; remote: string }> = []
  for (const k of keys) {
    const l = local[k]
    const r = remote[k]
    if (l === undefined && r !== undefined) removed.push(k)
    else if (l !== undefined && r === undefined) added.push(k)
    else if (l !== undefined && r !== undefined && l !== r) changed.push({ key: k, local: l, remote: r })
  }
  const ok: boolean = added.length === 0 && removed.length === 0 && changed.length === 0
  if (args.json === true) logger.jsonPrint(annotateEnv({ ok, action: 'env' as const, subcommand: 'diff' as const, provider: 'netlify' as const, added, removed, changed, final: true }))
  else {
    sp.stop()
    if (ok) logger.success('No differences between local file and Netlify environment.')
    else logger.info('\n' + formatDiffHuman({ added, removed, changed }))
    const total = added.length + removed.length + changed.length
    printEnvDiffSummary({
      provider: 'netlify',
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      ok,
      addedKeys: total <= 10 ? added : undefined,
      removedKeys: total <= 10 ? removed : undefined,
      changedKeys: total <= 10 ? changed.map(c => c.key) : undefined
    })
    const inCI = args.ci === true || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
    if (!ok && inCI) {
      const addIsError = args.ci === true || args.failOnAdd === true
      const removeIsError = args.ci === true || args.failOnRemove === true
      const addTag = addIsError ? 'error' : 'warning'
      const removeTag = removeIsError ? 'error' : 'warning'
      const changedTag = args.ci === true ? 'error' : 'warning'
      for (const k of added) console.log(`::${addTag} ::Only local: ${k}`)
      for (const k of removed) console.log(`::${removeTag} ::Only remote: ${k}`)
      for (const c of changed) console.log(`::${changedTag} ::Changed: ${c.key}`)
    }
  }
  if (!ok && (args.ci === true || args.failOnAdd === true || args.failOnRemove === true)) {
    const addHit = args.failOnAdd === true && added.length > 0
    const removeHit = args.failOnRemove === true && removed.length > 0
    if (args.ci === true || addHit || removeHit) process.exitCode = 1
  }
}

async function ensureNetlifyLinked(args: { readonly cwd: string; readonly projectId?: string; readonly printCmd?: boolean }): Promise<void> {
  // Netlify: link the directory to a site id when provided
  if (!args.projectId) return
  const linkCmd = `netlify link --id ${args.projectId}`
  if (args.printCmd) logger.info(`$ ${linkCmd}`)
  const res = await runWithRetry({ cmd: linkCmd, cwd: args.cwd })
  if (!res.ok && !res.stdout.toLowerCase().includes('already linked')) {
    throw new Error('Directory not linked to Netlify site. Run: netlify link --id <siteId>')
  }
}

// Programmatic wrappers for use by other commands (e.g., run)
export async function envSync(opts: {
  readonly provider: 'vercel' | 'netlify'
  readonly cwd: string
  readonly file: string
  readonly env: EnvTarget
  readonly yes?: boolean
  readonly dryRun?: boolean
  readonly json?: boolean
  readonly ci?: boolean
  readonly projectId?: string
  readonly orgId?: string
  readonly ignore?: readonly string[]
  readonly only?: readonly string[]
  readonly failOnAdd?: boolean
  readonly failOnRemove?: boolean
  readonly optimizeWrites?: boolean
  readonly mapFile?: string
}): Promise<void> {
  if (opts.provider === 'vercel') {
    await syncVercel({
      cwd: opts.cwd,
      file: opts.file,
      env: opts.env,
      yes: opts.yes === true,
      dryRun: opts.dryRun === true,
      json: opts.json === true,
      ci: opts.ci === true,
      projectId: opts.projectId,
      orgId: opts.orgId,
      ignore: opts.ignore,
      only: opts.only,
      failOnAdd: opts.failOnAdd,
      failOnRemove: opts.failOnRemove,
      optimizeWrites: opts.optimizeWrites,
      mapFile: opts.mapFile,
    })
    return
  }
  await syncNetlify({
    cwd: opts.cwd,
    file: opts.file,
    yes: opts.yes === true,
    dryRun: opts.dryRun === true,
    json: opts.json === true,
    ci: opts.ci === true,
    projectId: opts.projectId,
    ignore: opts.ignore,
    only: opts.only,
    optimizeWrites: opts.optimizeWrites,
    mapFile: opts.mapFile,
  })
}

export async function envDiff(opts: {
  readonly provider: 'vercel' | 'netlify'
  readonly cwd: string
  readonly file: string
  readonly env: EnvTarget
  readonly json?: boolean
  readonly ci?: boolean
  readonly projectId?: string
  readonly orgId?: string
  readonly ignore?: readonly string[]
  readonly only?: readonly string[]
  readonly failOnAdd?: boolean
  readonly failOnRemove?: boolean
}): Promise<void> {
  if (opts.provider === 'vercel') {
    await diffVercel({
      cwd: opts.cwd,
      file: opts.file,
      env: opts.env,
      json: opts.json === true,
      ci: opts.ci === true,
      projectId: opts.projectId,
      orgId: opts.orgId,
      ignore: opts.ignore,
      only: opts.only,
      failOnAdd: opts.failOnAdd,
      failOnRemove: opts.failOnRemove,
    })
    return
  }
  await diffNetlify({
    cwd: opts.cwd,
    file: opts.file,
    json: opts.json === true,
    ci: opts.ci === true,
    projectId: opts.projectId,
    ignore: opts.ignore,
    only: opts.only,
    failOnAdd: opts.failOnAdd,
    failOnRemove: opts.failOnRemove,
  })
}

async function ensureLinked(args: { readonly cwd: string; readonly projectId?: string; readonly orgId?: string; readonly printCmd?: boolean }): Promise<void> {
  const flags: string[] = ['--yes']
  if (args.projectId) flags.push(`--project ${args.projectId}`)
  if (args.orgId) flags.push(`--org ${args.orgId}`)
  const linkCmd = `vercel link ${flags.join(' ')}`.trim()
  if (args.printCmd) logger.info(`$ ${linkCmd}`)
  const res = await runWithRetry({ cmd: linkCmd, cwd: args.cwd })
  if (!res.ok && !res.stdout.toLowerCase().includes('already linked')) {
    throw new Error('Project not linked to Vercel. Run: vercel link')
  }
}

async function pullVercel(args: { readonly cwd: string; readonly env: EnvTarget; readonly out?: string; readonly json: boolean; readonly ci: boolean; readonly projectId?: string; readonly orgId?: string; readonly printCmd?: boolean }): Promise<void> {
  const sp = spinner('Vercel: pulling env')
  const vercelEnv: 'production' | 'preview' | 'development' = (args.env === 'prod' ? 'production' : args.env === 'preview' ? 'preview' : 'development')
  const outFile: string = args.out ?? defaultOutFile(args.env)
  // Ensure linked project (non-dry operation by nature)
  await ensureLinked({ cwd: args.cwd, projectId: args.projectId, orgId: args.orgId, printCmd: args.printCmd })
  const pullCmd = `vercel env pull ${outFile} --environment ${vercelEnv}`
  if (args.printCmd) logger.info(`$ ${pullCmd}`)
  const res = await runWithRetry({ cmd: pullCmd, cwd: args.cwd })
  if (!res.ok) throw new Error(res.stderr.trim() || res.stdout.trim() || 'Failed to pull env from Vercel')
  if (args.json === true) logger.jsonPrint(annotateEnv({ ok: true, action: 'env' as const, subcommand: 'pull' as const, provider: 'vercel' as const, environment: vercelEnv, out: outFile, final: true }))
  else {
    sp.succeed(`Vercel: pulled to ${outFile}`)
    logger.success(`Pulled ${vercelEnv} env to ${outFile}`)
    try { const parsed = await parseEnvFile({ path: join(args.cwd, outFile) }); printEnvPullSummary({ provider: 'vercel', env: (args.env === 'prod' ? 'prod' : args.env === 'preview' ? 'preview' : 'development'), out: outFile, count: Object.keys(parsed).length }) } catch { /* ignore count */ }
  }
}

function toVercelEnv(t: EnvTarget): readonly string[] {
  if (t === 'all') return ['production', 'preview'] as const
  if (t === 'prod') return ['production'] as const
  if (t === 'preview') return ['preview'] as const
  return ['development'] as const
}

function defaultOutFile(t: EnvTarget): string {
  if (t === 'prod') return '.env.production.local'
  if (t === 'preview') return '.env.preview.local'
  if (t === 'development') return '.env.local'
  return '.env.local'
}

function mask(val: string): string {
  if (val.length <= 4) return '*'.repeat(val.length)
  return `${val.slice(0, 2)}****${val.slice(-2)}`
}

export function toPatterns(list?: string): readonly string[] {
  if (!list) return []
  return list.split(',').map(s => s.trim()).filter(Boolean)
}

export function matchPattern(str: string, pattern: string): boolean {
  // Simple glob: * => .*, escape others
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  const re = new RegExp(`^${escaped}$`, 'i')
  return re.test(str)
}

export function allowKey(key: string, only: readonly string[], ignore: readonly string[]): boolean {
  if (only.length > 0 && !only.some(p => matchPattern(key, p))) return false
  if (ignore.length > 0 && ignore.some(p => matchPattern(key, p))) return false
  return true
}

type MappingSpec = {
  readonly rename?: Record<string, string>
  readonly transform?: Record<string, 'base64' | 'trim' | 'upper' | 'lower'>
}

async function applyEnvMapping(args: { readonly cwd: string; readonly kv: Record<string, string>; readonly mapFile?: string }): Promise<Record<string, string>> {
  if (!args.mapFile) return args.kv
  const p: string = join(args.cwd, args.mapFile)
  let spec: MappingSpec | null = null
  try {
    spec = await fsx.readJson<MappingSpec>(p)
  } catch { /* ignore invalid mapping file */ }
  if (spec === null) return args.kv
  const out: Record<string, string> = {}
  const ren: Record<string, string> = spec.rename ?? {}
  const tf: Record<string, 'base64' | 'trim' | 'upper' | 'lower'> = spec.transform ?? {}
  for (const [k, v] of Object.entries(args.kv)) {
    const preT: string = tf[k] ? applyTransform(v, tf[k]) : v
    const newKey: string = ren[k] ?? k
    const postT: string = tf[newKey] ? applyTransform(preT, tf[newKey]) : preT
    out[newKey] = postT
  }
  return out
}

function applyTransform(val: string, kind: 'base64' | 'trim' | 'upper' | 'lower'): string {
  if (kind === 'base64') return Buffer.from(val, 'utf8').toString('base64')
  if (kind === 'trim') return val.trim()
  if (kind === 'upper') return val.toUpperCase()
  if (kind === 'lower') return val.toLowerCase()
  return val
}

async function syncVercel(args: { readonly cwd: string; readonly file: string; readonly env: EnvTarget; readonly yes: boolean; readonly dryRun: boolean; readonly json: boolean; readonly ci: boolean; readonly projectId?: string; readonly orgId?: string; readonly ignore?: readonly string[]; readonly only?: readonly string[]; readonly failOnAdd?: boolean; readonly failOnRemove?: boolean; readonly optimizeWrites?: boolean; readonly mapFile?: string; readonly printCmd?: boolean }): Promise<void> {
  const envPath: string = join(args.cwd, args.file)
  const original = await parseEnvFile({ path: envPath })
  const kv = await applyEnvMapping({ cwd: args.cwd, kv: original, mapFile: args.mapFile })
  const entriesAll = Object.entries(kv)
  const entries = entriesAll.filter(([k]) => allowKey(k, args.only ?? [], args.ignore ?? []))
  if (entries.length === 0) {
    logger.warn(`No variables found in ${args.file}. Nothing to sync.`)
    return
  }
  // Ensure linked project (vercel link) unless dry-run
  if (!args.dryRun) {
    try { await ensureLinked({ cwd: args.cwd, projectId: args.projectId, orgId: args.orgId, printCmd: args.printCmd }) } catch (e) { logger.warn('Project may not be linked. Run `vercel link` if sync fails.') }
  }
  // If strict flags are present, compute diff against remote and set exit code when violated
  if ((args.failOnAdd || args.failOnRemove) && !args.dryRun) {
    const vercelEnv: 'production' | 'preview' | 'development' = (args.env === 'prod' ? 'production' : args.env === 'preview' ? 'preview' : 'development')
    const tmpDir: string = await mkdtemp(join(tmpdir(), 'opendeploy-'))
    const tmpFile: string = join(tmpDir, `.env.remote.${vercelEnv}`)
    const pullCmd = `vercel env pull ${tmpFile} --environment ${vercelEnv}`
  if (args.printCmd) logger.info(`$ ${pullCmd}`)
  const pulled = await runWithRetry({ cmd: pullCmd, cwd: args.cwd })
    if (pulled.ok) {
      const remote = await parseEnvFile({ path: tmpFile })
      await rm(tmpDir, { recursive: true, force: true })
      const localMap: Record<string, string> = Object.fromEntries(entries)
      const keys = new Set([...Object.keys(localMap), ...Object.keys(remote)])
      let addCount = 0; let removeCount = 0
      for (const k of keys) {
        const inLocal = localMap[k] !== undefined
        const inRemote = remote[k] !== undefined
        if (inLocal && !inRemote) addCount++
        if (!inLocal && inRemote) removeCount++
      }
      if ((args.failOnAdd && addCount > 0) || (args.failOnRemove && removeCount > 0)) {
        process.exitCode = 1
      }
    }
  }
  const targets: readonly string[] = toVercelEnv(args.env)
  // Optimize writes: fetch remote maps once per target and skip same-values
  const remoteByEnv: Record<string, Record<string, string>> = {}
  if (args.optimizeWrites === true && !args.dryRun) {
    for (const t of targets) {
      try {
        const cacheKey = `vercel:env:${t}`
        const cached = await getCached<Record<string, string>>({ cwd: args.cwd, key: cacheKey, ttlMs: 60_000 })
        if (cached) { remoteByEnv[t] = cached; continue }
        const tmpDir: string = await mkdtemp(join(tmpdir(), 'opendeploy-remote-'))
        const tmpFile: string = join(tmpDir, `.env.remote.${t}`)
        const pullCmd = `vercel env pull ${tmpFile} --environment ${t}`
        if (args.printCmd) logger.info(`$ ${pullCmd}`)
        const pulled = await runWithRetry({ cmd: pullCmd, cwd: args.cwd })
        if (pulled.ok) {
          const m = await parseEnvFile({ path: tmpFile })
          remoteByEnv[t] = m
          await setCached({ cwd: args.cwd, key: cacheKey, value: m })
        }
        await rm(tmpDir, { recursive: true, force: true })
      } catch { /* ignore and continue without optimization for this env */ }
    }
  }
  const results: Array<{ key: string; environments: string[]; status: 'set' | 'skipped' | 'failed'; error?: string }> = []
  for (const [key, value] of entries) {
    const go = args.yes === true || args.ci === true || args.dryRun === true
      ? true
      : await confirm(`Set ${key}=${mask(value)} to Vercel?`, { defaultYes: true })
    if (!go) continue
    const touched: string[] = []
    for (const t of targets) {
      if (args.dryRun === true) {
        logger.info(`[dry-run] vercel env set ${key} (${t}) ← ${mask(value)}`)
        touched.push(t)
        continue
      }
      // Skip if optimize-writes and remote value matches
      if (args.optimizeWrites === true && remoteByEnv[t] && remoteByEnv[t][key] === value) {
        logger.info(`Skip (same) ${key} in ${t}`)
        touched.push(t)
        continue
      }
      // Remove existing value (if any) to ensure clean update.
      const rmCmd = `vercel env rm ${key} ${t} -y`
      if (args.printCmd) logger.info(`$ ${rmCmd}`)
      await runWithRetry({ cmd: rmCmd, cwd: args.cwd })
      const addCmd = `vercel env add ${key} ${t}`
      if (args.printCmd) logger.info(`$ ${addCmd}`)
      const res = await runWithRetry({ cmd: addCmd, cwd: args.cwd, stdin: `${value}` })
      if (res.ok) { logger.success(`Set ${key} in ${t}`); touched.push(t) }
      else {
        const errMsg: string = res.stderr.trim() || res.stdout.trim()
        logger.warn(`Failed to set ${key} in ${t}: ${errMsg}`)
      }
    }
    results.push({ key, environments: touched, status: touched.length > 0 ? (args.dryRun ? 'skipped' : 'set') : 'failed' })
  }
  if (args.json === true) {
    const ok = results.every(r => r.status !== 'failed')
    logger.jsonPrint(annotateEnv({ ok, action: 'env' as const, subcommand: 'sync' as const, provider: 'vercel' as const, file: args.file, envs: results, final: true }))
  }
  else {
    const setCount = results.filter(r => r.status === 'set').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    const failedCount = results.filter(r => r.status === 'failed').length
    printEnvSyncSummary({ provider: 'vercel', file: args.file, setCount, skippedCount, failedCount })
  }
}

async function diffVercel(args: { readonly cwd: string; readonly file: string; readonly env: EnvTarget; readonly json: boolean; readonly ci: boolean; readonly projectId?: string; readonly orgId?: string; readonly ignore?: readonly string[]; readonly only?: readonly string[]; readonly failOnAdd?: boolean; readonly failOnRemove?: boolean; readonly printCmd?: boolean }): Promise<void> {
  const sp = spinner('Vercel: diffing env')
  const localPath: string = join(args.cwd, args.file)
  const allLocal = await parseEnvFile({ path: localPath })
  // Filter local by patterns
  const local: Record<string, string> = {}
  for (const [k, v] of Object.entries(allLocal)) {
    if (allowKey(k, args.only ?? [], args.ignore ?? [])) local[k] = v
  }
  await ensureLinked({ cwd: args.cwd, projectId: args.projectId, orgId: args.orgId })
  const vercelEnv: 'production' | 'preview' | 'development' = (args.env === 'prod' ? 'production' : args.env === 'preview' ? 'preview' : 'development')
  // Pull remote env into a temp file to read values
  const tmpDir: string = await mkdtemp(join(tmpdir(), 'opendeploy-'))
  const tmpFile: string = join(tmpDir, `.env.remote.${vercelEnv}`)
  const pulled = await proc.run({ cmd: `vercel env pull ${tmpFile} --environment ${vercelEnv}`, cwd: args.cwd })
  if (!pulled.ok) throw new Error(pulled.stderr.trim() || pulled.stdout.trim() || 'Failed to pull remote env')
  const remote = await parseEnvFile({ path: tmpFile })
  await rm(tmpDir, { recursive: true, force: true })
  // Compute diff
  const keys = Array.from(new Set([...Object.keys(local), ...Object.keys(remote)])).sort()
  const added: string[] = [] // present locally but not remotely
  const removed: string[] = [] // present remotely but not locally
  const changed: Array<{ key: string; local: string; remote: string }> = []
  for (const k of keys) {
    const l = local[k]
    const r = remote[k]
    if (l === undefined && r !== undefined) removed.push(k)
    else if (l !== undefined && r === undefined) added.push(k)
    else if (l !== undefined && r !== undefined && l !== r) changed.push({ key: k, local: l, remote: r })
  }
  const ok: boolean = added.length === 0 && removed.length === 0 && changed.length === 0
  if (args.json === true) {
    logger.jsonPrint(annotateEnv({ ok, action: 'env' as const, subcommand: 'diff' as const, provider: 'vercel' as const, env: vercelEnv, added, removed, changed, final: true }))
  } else {
    sp.stop()
    if (ok) logger.success('No differences between local file and remote environment.')
    else logger.info('\n' + formatDiffHuman({ added, removed, changed }))
    const mappedEnv = vercelEnv === 'production' ? 'prod' : vercelEnv
    const total = added.length + removed.length + changed.length
    printEnvDiffSummary({
      provider: 'vercel',
      env: mappedEnv as 'prod' | 'preview' | 'development',
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      ok,
      addedKeys: total <= 10 ? added : undefined,
      removedKeys: total <= 10 ? removed : undefined,
      changedKeys: total <= 10 ? changed.map(c => c.key) : undefined
    })
    const inCI = args.ci === true || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
    if (!ok && inCI) {
      const addIsError = args.ci === true || args.failOnAdd === true
      const removeIsError = args.ci === true || args.failOnRemove === true
      const addTag = addIsError ? 'error' : 'warning'
      const removeTag = removeIsError ? 'error' : 'warning'
      const changedTag = args.ci === true ? 'error' : 'warning'
      for (const k of added) console.log(`::${addTag} ::Only local: ${k}`)
      for (const k of removed) console.log(`::${removeTag} ::Only remote: ${k}`)
      for (const c of changed) console.log(`::${changedTag} ::Changed: ${c.key}`)
    }
  }
  if (!ok && (args.ci === true || args.failOnAdd === true || args.failOnRemove === true)) {
    const addHit = args.failOnAdd === true && added.length > 0
    const removeHit = args.failOnRemove === true && removed.length > 0
    if (args.ci === true || addHit || removeHit) process.exitCode = 1
  }
}

/**
 * Register `env` command with `sync` for Vercel.
 */
export function registerEnvCommand(program: Command): void {
  const env = program.command('env').description('Manage environment variables on providers')
  env
    .command('sync')
    .description('Sync variables from a .env file to a provider')
    .argument('<provider>', 'Target provider: vercel|netlify')
    .option('--file <path>', 'Path to .env file', '.env')
    .option('--env <target>', 'Environment: prod|preview|development|all', 'preview')
    .option('--yes', 'Accept all prompts')
    .option('--dry-run', 'Print changes without applying them')
    .option('--json', 'Output JSON summary')
    .option('--print-cmd', 'Print underlying provider commands that will be executed')
    .option('--ci', 'CI mode (non-interactive, fail fast)')
    .option('--project-id <id>', 'Provider project ID for non-interactive link')
    .option('--org-id <id>', 'Provider org ID for non-interactive link')
    .option('--ignore <patterns>', 'Comma-separated glob patterns to ignore (e.g. NEXT_PUBLIC_*)')
    .option('--only <patterns>', 'Comma-separated glob patterns to include')
    .option('--fail-on-add', 'Exit non-zero if new keys would be added')
    .option('--fail-on-remove', 'Exit non-zero if keys are missing remotely')
    .option('--optimize-writes', 'Only update keys that differ remotely (reduces API calls)')
    .option('--map <file>', 'Mapping file for key rename and value transforms')
    .option('--retries <n>', 'Retries for provider commands (default 2)')
    .option('--timeout-ms <ms>', 'Timeout per provider command in milliseconds (default 120000)')
    .option('--base-delay-ms <ms>', 'Base delay for exponential backoff with jitter (default 300)')
    .action(async (provider: string, opts: SyncOptions): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0))
        if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0))
        if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0))
        const jsonMode: boolean = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        const envTarget = (opts.env ?? 'preview') as EnvTarget
        const prov = provider === 'netlify' ? 'netlify' : provider === 'vercel' ? 'vercel' : undefined
        if (!prov) { logger.error(`Unknown provider: ${provider}`); process.exitCode = 1; return }
        if (prov === 'vercel') {
          await syncVercel({ cwd, file: opts.file ?? '.env', env: envTarget, yes: opts.yes === true, dryRun: opts.dryRun === true, json: jsonMode, ci: opts.ci === true, projectId: opts.projectId, orgId: opts.orgId, ignore: toPatterns(opts.ignore), only: toPatterns(opts.only), failOnAdd: opts.failOnAdd === true, failOnRemove: opts.failOnRemove === true, optimizeWrites: opts.optimizeWrites === true, mapFile: opts.map, printCmd: opts.printCmd === true })
        } else {
          await syncNetlify({ cwd, file: opts.file ?? '.env', yes: opts.yes === true, dryRun: opts.dryRun === true, json: jsonMode, ci: opts.ci === true, projectId: opts.projectId, ignore: toPatterns(opts.ignore), only: toPatterns(opts.only), optimizeWrites: opts.optimizeWrites === true, mapFile: opts.map, printCmd: opts.printCmd === true })
        }
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        const prov = provider === 'netlify' ? 'netlify' : provider === 'vercel' ? 'vercel' : provider
        const info = mapProviderError(prov, raw)
        if (isJsonMode(opts.json)) {
          logger.jsonPrint({ ok: false, action: 'env' as const, subcommand: 'sync' as const, provider: prov, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
        }
        logger.error(`${info.message} (${info.code})`)
        if (info.remedy) logger.info(`Try: ${info.remedy}`)
        process.exitCode = 1
      }
    })

  env
    .command('pull')
    .description('Pull variables from a provider into a local .env file')
    .argument('<provider>', 'Target provider: vercel | netlify')
    .option('--env <target>', 'Environment: prod|preview|development', 'preview')
    .option('--out <path>', 'Output file path (default depends on env)')
    .option('--json', 'Output JSON summary')
    .option('--ci', 'CI mode (non-interactive)')
    .option('--project-id <id>', 'Provider project ID for non-interactive link')
    .option('--org-id <id>', 'Provider org ID for non-interactive link')
    .option('--ignore <patterns>', 'Comma-separated glob patterns to ignore (e.g. NEXT_PUBLIC_*)')
    .option('--only <patterns>', 'Comma-separated glob patterns to include')
    .option('--context <name>', 'Netlify context: production|deploy-preview|branch|dev')
    .option('--retries <n>', 'Retries for provider commands (default 2)')
    .option('--timeout-ms <ms>', 'Timeout per provider command in milliseconds (default 120000)')
    .option('--base-delay-ms <ms>', 'Base delay for exponential backoff with jitter (default 300)')
    .action(async (provider: string, opts: { env?: EnvTarget; out?: string; json?: boolean; ci?: boolean; projectId?: string; orgId?: string; ignore?: string; only?: string; context?: string; printCmd?: boolean; retries?: string; timeoutMs?: string; baseDelayMs?: string }): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0))
        if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0))
        if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0))
        const jsonMode: boolean = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        const prov = provider === 'netlify' ? 'netlify' : provider === 'vercel' ? 'vercel' : undefined
        if (!prov) { logger.error(`Unknown provider: ${provider}`); process.exitCode = 1; return }
        if (prov === 'vercel') {
          const envTarget = (opts.env ?? 'preview') as EnvTarget
          await pullVercel({ cwd, env: envTarget, out: opts.out, json: jsonMode, ci: opts.ci === true, projectId: opts.projectId, orgId: opts.orgId, printCmd: opts.printCmd === true })
        } else {
          await pullNetlify({ cwd, out: opts.out, json: jsonMode, projectId: opts.projectId, context: opts.context, printCmd: opts.printCmd === true })
        }
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        const provName = provider === 'netlify' ? 'netlify' : provider === 'vercel' ? 'vercel' : provider
        const info = mapProviderError(provName, raw)
        if (isJsonMode(opts.json)) {
          logger.jsonPrint({ ok: false, action: 'env' as const, subcommand: 'pull' as const, provider: provName, code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
        }
        logger.error(`${info.message} (${info.code})`)
        if (info.remedy) logger.info(`Try: ${info.remedy}`)
        process.exitCode = 1
      }
    })

  env
    .command('diff')
    .description('Compare local .env values to provider environment (no changes)')
    .argument('<provider>', 'Target provider: vercel | netlify')
    .option('--file <path>', 'Path to local .env file', '.env')
    .option('--env <target>', 'Environment: prod|preview|development', 'preview')
    .option('--json', 'Output JSON diff')
    .option('--print-cmd', 'Print underlying provider commands that will be executed')
    .option('--ci', 'CI mode (exit non-zero on differences)')
    .option('--project-id <id>', 'Provider project ID for non-interactive link')
    .option('--org-id <id>', 'Provider org ID for non-interactive link')
    .option('--ignore <patterns>', 'Comma-separated glob patterns to ignore (e.g. NEXT_PUBLIC_*)')
    .option('--only <patterns>', 'Comma-separated glob patterns to include')
    .option('--fail-on-add', 'Exit non-zero if new keys would be added')
    .option('--fail-on-remove', 'Exit non-zero if keys are missing remotely')
    .option('--context <name>', 'Netlify context: production|deploy-preview|branch|dev')
    .option('--retries <n>', 'Retries for provider commands (default 2)')
    .option('--timeout-ms <ms>', 'Timeout per provider command in milliseconds (default 120000)')
    .option('--base-delay-ms <ms>', 'Base delay for exponential backoff with jitter (default 300)')
    .action(async (provider: string, opts: { file?: string; env?: EnvTarget; json?: boolean; ci?: boolean; projectId?: string; orgId?: string; ignore?: string; only?: string; failOnAdd?: boolean; failOnRemove?: boolean; context?: string; printCmd?: boolean; retries?: string; timeoutMs?: string; baseDelayMs?: string }): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0))
        if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0))
        if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0))
        const jsonMode: boolean = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        const prov = provider === 'netlify' ? 'netlify' : provider === 'vercel' ? 'vercel' : undefined
        if (!prov) { logger.error(`Unknown provider: ${provider}`); process.exitCode = 1; return }
        if (prov === 'vercel') {
          const envTarget = (opts.env ?? 'preview') as EnvTarget
          await diffVercel({ cwd, file: opts.file ?? '.env', env: envTarget, json: jsonMode, ci: opts.ci === true, projectId: opts.projectId, orgId: opts.orgId, ignore: toPatterns(opts.ignore), only: toPatterns(opts.only), failOnAdd: opts.failOnAdd === true, failOnRemove: opts.failOnRemove === true, printCmd: opts.printCmd === true })
        } else {
          await diffNetlify({ cwd, file: opts.file ?? '.env', json: jsonMode, ci: opts.ci === true, projectId: opts.projectId, ignore: toPatterns(opts.ignore), only: toPatterns(opts.only), failOnAdd: opts.failOnAdd === true, failOnRemove: opts.failOnRemove === true, context: opts.context, printCmd: opts.printCmd === true })
        }
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
      }
    })

  // Experimental: env validate (hidden/experimental scaffold)
  env
    .command('validate')
    .description('[experimental] Validate a local .env against a schema of required keys')
    .option('--file <path>', 'Path to local .env file', '.env')
    .option('--schema <path>', 'Path to schema JSON or builtin:<name>')
    .option('--schema-type <type>', 'Schema type: keys | rules | jsonschema', 'keys')
    .option('--json', 'Output JSON report')
    .option('--ci', 'CI mode (exit non-zero on violations)')
    .action(async (opts: { file?: string; schema?: string; schemaType?: 'keys' | 'jsonschema'; json?: boolean; ci?: boolean }): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        const report = await envValidate({ cwd, file: opts.file ?? '.env', schema: opts.schema, schemaType: opts.schemaType ?? 'keys' })
        if (opts.json === true) logger.json(report)
        else {
          if (report.ok) logger.success('Validation passed: all required keys present')
          else logger.warn(`Missing required keys: ${report.missing.join(', ')}`)
        }
        if (!report.ok && opts.ci === true) process.exitCode = 1
      } catch (err) {
        const raw: string = err instanceof Error ? err.message : String(err)
        const info = mapProviderError('env', raw)
        if (process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1' || opts.json === true) {
          logger.jsonPrint({ ok: false, action: 'env' as const, subcommand: 'validate' as const, provider: 'env', code: info.code, message: info.message, remedy: info.remedy, error: raw, final: true })
        }
        logger.error(`${info.message} (${info.code})`)
        if (info.remedy) logger.info(`Try: ${info.remedy}`)
        process.exitCode = 1
      }
    })
}

export async function envValidate(args: { readonly cwd: string; readonly file: string; readonly schema?: string; readonly schemaType: 'keys' | 'rules' | 'jsonschema' }): Promise<{ readonly ok: boolean; readonly file: string; readonly schemaPath?: string; readonly required: readonly string[]; readonly missing: readonly string[]; readonly unknown: readonly string[]; readonly violations?: readonly string[]; readonly requiredCount: number; readonly presentCount: number; readonly missingCount: number; readonly unknownCount: number; readonly violationCount?: number }> {
  const filePath: string = join(args.cwd, args.file)
  if (!args.schema) throw new Error('Missing --schema <path>')
  const builtins: Record<string, readonly string[]> = {
    'next-basic': ['DATABASE_URL', 'NEXT_PUBLIC_SITE_URL'],
    'next-prisma': ['DATABASE_URL', 'DIRECT_URL'],
    'next-auth': ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
    'better-auth': ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'],
    // New builtins
    'drizzle': ['DATABASE_URL'],
    'supabase': ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    'stripe': ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
    'paypal': ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE', 'PAYPAL_WEBHOOK_ID'],
    // Storage / providers
    's3': ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET'],
    'r2': ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'],
    'cloudinary': ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_PUBLIC_BASE_URL'],
    'cloudinary-next': ['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'],
    // Email / analytics / auth / cache / upload
    'resend': ['RESEND_API_KEY'],
    'posthog': ['NEXT_PUBLIC_POSTHOG_KEY', 'POSTHOG_HOST'],
    'clerk': ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
    'upstash-redis': ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    'uploadthing': ['UPLOADTHING_SECRET', 'NEXT_PUBLIC_UPLOADTHING_APP_ID'],
    // OAuth
    'google-oauth': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    'github-oauth': ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    // SMTP & Email basics
    'smtp-basic': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS'],
    'email-basic': ['EMAIL_FROM'],
    // Utility
    'admin-emails': ['ADMIN_EMAILS'],
    'email-provider': ['MAIL_PROVIDER'],
    // S3-compatible naming variant and app-specific bundles
    's3-compat': ['S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT', 'S3_PUBLIC_BASE_URL', 'S3_FORCE_PATH_STYLE'],
    'media-worker': ['FFMPEG_PATH', 'MEDIA_PREVIEW_SECONDS', 'MEDIA_WORKER_POLL_MS', 'MEDIA_WORKER_LOOKBACK_MS'],
    'upload-limits': ['MAX_UPLOAD_MB', 'MEDIA_DAILY_LIMIT'],
    'resend-plus': ['RESEND_API_KEY', 'RESEND_AUDIENCE_ID'],
    // Profiles (composed)
    'blogkit': [
      // DB + ORM
      'DATABASE_URL',
      // Auth & OAuth
      ...['BETTER_AUTH_SECRET'],
      ...['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GITHUB_CLIENT_ID','GITHUB_CLIENT_SECRET'],
      // Email
      ...['MAIL_PROVIDER','EMAIL_FROM','RESEND_API_KEY','SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS']
    ],
    'ecommercekit': [
      // DB
      'DATABASE_URL',
      // Payment
      ...['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MODE','PAYPAL_WEBHOOK_ID'],
      // Storage
      ...['AWS_REGION','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','S3_BUCKET'],
      // Email
      ...['MAIL_PROVIDER','EMAIL_FROM','RESEND_API_KEY','SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS']
    ],
  }
  // Support composition: comma-separated schemas (builtins and/or file paths)
  const parts: readonly string[] = args.schema.split(',').map((s: string) => s.trim()).filter(Boolean)
  const requiredSet = new Set<string>()
  const schemaPathsUsed: string[] = []
  // Additional rule collections
  const regexRules: Array<{ readonly key: string; readonly pattern: string }> = []
  const allowedValues: Record<string, readonly string[]> = {}
  const oneOfGroups: ReadonlyArray<ReadonlyArray<string>> = []
  const requireIfRules: Array<{ readonly if: { readonly key: string; readonly value?: string }; readonly then: readonly string[] }> = []
  for (const part of parts) {
    if (part.startsWith('builtin:')) {
      const name: string = part.slice('builtin:'.length)
      const arr = builtins[name]
      if (!arr) throw new Error(`Unknown builtin schema: ${name}`)
      for (const k of arr) requiredSet.add(k)
    } else {
      const p = join(args.cwd, part)
      schemaPathsUsed.push(p)
      const type: 'keys' | 'rules' | 'jsonschema' = args.schemaType
      if (type === 'jsonschema') {
        const js = await fsx.readJson<{ readonly required?: readonly string[] }>(p)
        if (js === null) throw new Error(`Schema not found or invalid: ${p}`)
        for (const k of (Array.isArray(js.required) ? js.required : [])) requiredSet.add(k)
      } else if (type === 'rules') {
        const rules = await fsx.readJson<{ readonly required?: readonly string[]; readonly regex?: Record<string, string>; readonly allowed?: Record<string, readonly string[]>; readonly oneOf?: ReadonlyArray<ReadonlyArray<string>>; readonly requireIf?: ReadonlyArray<{ readonly if: string; readonly then: readonly string[] }> }>(p)
        if (rules === null) throw new Error(`Schema not found or invalid: ${p}`)
        for (const k of (Array.isArray(rules.required) ? rules.required : [])) requiredSet.add(k)
        if (rules.regex) {
          for (const [key, pattern] of Object.entries(rules.regex)) regexRules.push({ key, pattern })
        }
        if (rules.allowed) {
          for (const [key, vals] of Object.entries(rules.allowed)) allowedValues[key] = vals
        }
        if (Array.isArray(rules.oneOf)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          (oneOfGroups as any).push(...rules.oneOf)
        }
        if (Array.isArray(rules.requireIf)) {
          for (const ri of rules.requireIf) {
            const [k, v] = ri.if.split('=')
            requireIfRules.push({ if: { key: k, value: v }, then: ri.then })
          }
        }
      } else {
        const keysSchema = await fsx.readJson<{ readonly required?: readonly string[] }>(p)
        if (keysSchema === null) throw new Error(`Schema not found or invalid: ${p}`)
        for (const k of (Array.isArray(keysSchema.required) ? keysSchema.required : [])) requiredSet.add(k)
      }
    }
  }
  const required: readonly string[] = Array.from(requiredSet)
  const schemaPath: string | undefined = schemaPathsUsed.length > 0 ? schemaPathsUsed.join(',') : undefined
  const envMap: Record<string, string> = await parseEnvFile({ path: filePath })
  const presentKeys: readonly string[] = Object.keys(envMap)
  const missing: string[] = required.filter(k => !(k in envMap))
  const unknown: string[] = required.length > 0 ? presentKeys.filter(k => !required.includes(k)) : []
  // Apply rule validations if any
  const violations: string[] = []
  // regex rules
  for (const rr of regexRules) {
    const val: string | undefined = envMap[rr.key]
    if (val !== undefined) {
      const re: RegExp = new RegExp(rr.pattern)
      if (!re.test(val)) violations.push(`regex:${rr.key} does not match ${rr.pattern}`)
    }
  }
  // allowed values
  for (const [k, vals] of Object.entries(allowedValues)) {
    const val: string | undefined = envMap[k]
    if (val !== undefined && !vals.includes(val)) violations.push(`allowed:${k} must be one of ${vals.join('|')}`)
  }
  // oneOf groups: at least one of the keys must be present
  for (const group of oneOfGroups) {
    const okGroup: boolean = group.some((k: string) => envMap[k] !== undefined)
    if (!okGroup) violations.push(`oneOf: one of [${group.join(', ')}] must be present`)
  }
  // requireIf conditions
  for (const ri of requireIfRules) {
    const actual: string | undefined = envMap[ri.if.key]
    const cond: boolean = ri.if.value ? actual === ri.if.value : actual !== undefined
    if (cond) {
      for (const need of ri.then) {
        if (envMap[need] === undefined) {
          violations.push(`requireIf: ${need} is required when ${ri.if.key}${ri.if.value ? `=${ri.if.value}` : ''}`)
          if (!missing.includes(need)) missing.push(need)
        }
      }
    }
  }
  const ok: boolean = missing.length === 0 && violations.length === 0
  return {
    ok,
    file: filePath,
    schemaPath,
    required,
    missing,
    unknown,
    violations: violations.length > 0 ? violations : undefined,
    requiredCount: required.length,
    presentCount: presentKeys.length,
    missingCount: missing.length,
    unknownCount: unknown.length,
    violationCount: violations.length > 0 ? violations.length : undefined
  }
}
