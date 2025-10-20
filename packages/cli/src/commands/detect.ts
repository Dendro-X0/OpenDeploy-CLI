import { Command } from 'commander'
import { detectApp, detectCandidates } from '../core/detectors/auto'
import { fsx } from '../utils/fs'
import { join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { logger } from '../utils/logger'
import Ajv from 'ajv'
import { detectSummarySchema } from '../schemas/detect-summary.schema'
import type { DetectionResult } from '../types/detection-result'
import type { Framework } from '../types/framework'

/**
 * Register the `detect` command.
 */
export function registerDetectCommand(program: Command): void {
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false })
  const validate = ajv.compile(detectSummarySchema as unknown as object)
  const annotate = (obj: Record<string, unknown>): Record<string, unknown> => {
    const ok: boolean = validate(obj) as boolean
    const errs: string[] = Array.isArray(validate.errors) ? validate.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
    if (process.env.OPD_SCHEMA_STRICT === '1' && errs.length > 0) { process.exitCode = 1 }
    return { ...obj, schemaOk: ok, schemaErrors: errs }
  }
  program
    .command('detect')
    .description('Detect your app (Next, Astro, SvelteKit, Remix, Nuxt, Vite; Expo when OPD_EXPERIMENTAL=1)')
    .option('--json', 'Output JSON')
    .option('--scan', 'Scan common monorepo folders and workspace globs to list candidate apps')
    .option('--path <dir>', 'Directory to detect (defaults to CWD)')
    .action(async (opts: { json?: boolean; scan?: boolean; path?: string }): Promise<void> => {
      const baseCwd: string = process.cwd()
      const cwd: string = (typeof opts.path === 'string' && opts.path.length > 0) ? join(baseCwd, opts.path) : baseCwd
      try {
        if (opts.json === true || process.env.OPD_JSON === '1') logger.setJsonOnly(true)
        if (opts.scan) {
          const candidates = await scanMonorepoCandidates(cwd)
          if (opts.json === true || process.env.OPD_JSON === '1') {
            logger.json({ ok: candidates.length > 0, action: 'detect', scan: true, candidates, final: true })
            return
          }
          if (candidates.length === 0) {
            logger.info('No candidate apps found (scan).')
          } else {
            logger.info('Candidate apps:')
            for (const c of candidates) logger.info(` - ${c.framework}: ${c.path}`)
          }
          return
        }
        const result: DetectionResult = await detectApp({ cwd })
        if (opts.json === true || process.env.OPD_JSON === '1') {
          const summary = { ok: true, action: 'detect' as const, detection: result, final: true }
          logger.json(annotate(summary as unknown as Record<string, unknown>))
          return
        }
        // Human output
        const candidates: ReadonlySet<Framework> = await detectCandidates({ cwd })
        const mark = (fw: Framework): string => candidates.has(fw) ? ' (detected)' : ''
        logger.info(`Framework      : ${result.framework}`)
        logger.info(`Render Mode    : ${result.renderMode}`)
        logger.info(`Root Dir       : ${result.rootDir}`)
        logger.info(`App Dir        : ${result.appDir}`)
        logger.info(`App Router     : ${result.hasAppRouter ? 'yes' : 'no'}`)
        logger.info(`Package Manager: ${result.packageManager}`)
        logger.info(`Monorepo Tool  : ${result.monorepo}`)
        logger.info(`Build Command  : ${result.buildCommand}`)
        logger.info(`Output Dir     : ${result.outputDir}`)
        if (result.publishDir) logger.info(`Publish Dir    : ${result.publishDir}`)
        logger.info(`Confidence     : ${result.confidence.toFixed(2)}`)
        logger.info(`Candidates     : next${mark('next')}, astro${mark('astro')}, sveltekit${mark('sveltekit')}, remix${mark('remix')}, nuxt${mark('nuxt')}, vite${mark('vite')}${process.env.OPD_EXPERIMENTAL==='1' ? `, expo${mark('expo')}` : ''}`)
        if (result.environmentFiles.length > 0) {
          logger.info(`Env Files      : ${result.environmentFiles.join(', ')}`)
        } else {
          logger.info('Env Files      : none')
        }
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        if (opts.json === true || process.env.OPD_JSON === '1') {
          logger.json(annotate({ ok: false, action: 'detect' as const, message, final: true }))
        } else {
          logger.error(message)
        }
        process.exitCode = 1
      }
    })
}

async function scanMonorepoCandidates(root: string): Promise<Array<{ readonly path: string; readonly framework: Framework }>> {
  const buckets: readonly string[] = ['apps', 'packages', 'examples', 'sites', 'services']
  const out: Array<{ path: string; framework: Framework }> = []
  const seen = new Set<string>()
  const add = (p: string, fw: Framework): void => { if (!seen.has(p)) { seen.add(p); out.push({ path: p, framework: fw }) } }
  const pushIfDetected = async (dir: string): Promise<void> => {
    try {
      if (!(await fsx.exists(join(dir, 'package.json')))) return
      try { const res = await detectApp({ cwd: dir }); const fw = res.framework as Framework | undefined; if (fw) add(dir, fw) } catch { /* ignore */ }
    } catch { /* ignore */ }
  }
  // Workspace globs
  for (const pat of await readWorkspaceGlobs(root)) {
    for (const dir of await expandWorkspacePattern(root, pat)) await pushIfDetected(dir)
  }
  // Buckets
  for (const b of buckets) {
    try {
      const base = join(root, b)
      if (!(await fsx.exists(base))) continue
      for (const name of await readdir(base)) await pushIfDetected(join(base, name))
    } catch { /* ignore */ }
  }
  // Immediate children
  try { for (const name of await readdir(root)) await pushIfDetected(join(root, name)) } catch { /* ignore */ }
  return out.slice(0, 50)
}

async function readWorkspaceGlobs(root: string): Promise<string[]> {
  const globs: string[] = []
  try {
    const pkg = await fsx.readJson<Record<string, unknown>>(join(root, 'package.json'))
    const ws = (pkg as any)?.workspaces
    if (Array.isArray(ws)) for (const s of ws) if (typeof s === 'string') globs.push(s)
    else if (ws && typeof ws === 'object' && Array.isArray((ws as any).packages)) for (const s of (ws as any).packages) if (typeof s === 'string') globs.push(s)
  } catch { /* ignore */ }
  try {
    const y = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8')
    const lines = y.split(/\r?\n/); let inPk = false
    for (const raw of lines) {
      const line = raw.trim()
      if (/^packages\s*:\s*$/.test(line)) { inPk = true; continue }
      if (inPk) {
        if (/^[A-Za-z0-9_-]+\s*:/.test(line)) { inPk = false; continue }
        const m = /^-\s*["']?([^"']+)["']?\s*$/.exec(line)
        if (m && m[1]) globs.push(m[1])
      }
    }
  } catch { /* ignore */ }
  return globs
}

async function expandWorkspacePattern(root: string, pattern: string): Promise<string[]> {
  const out: string[] = []
  try {
    const pat = String(pattern).replace(/["']/g, '').trim()
    const star = pat.indexOf('*')
    if (star === -1) { const dir = join(root, pat); if (await fsx.exists(dir)) out.push(dir); return out }
    const base = pat.slice(0, star).replace(/[\/]+$/, '')
    const baseDir = join(root, base)
    if (!(await fsx.exists(baseDir))) return out
    for (const name of await readdir(baseDir)) {
      const p = join(baseDir, name)
      if (await fsx.exists(join(p, 'package.json'))) out.push(p)
    }
  } catch { /* ignore */ }
  return out
}
