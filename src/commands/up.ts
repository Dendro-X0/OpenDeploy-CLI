import { Command } from 'commander'
import { join } from 'node:path'
import { logger, isJsonMode } from '../utils/logger'
import { fsx } from '../utils/fs'
import { spinner } from '../utils/ui'
import { startHeartbeat, type Stopper } from '../utils/progress'
import { proc, runWithRetry } from '../utils/process'
import { envSync } from './env'
import { printDeploySummary } from '../utils/summarize'
import { computeRedactors } from '../utils/redaction'
import { extractVercelInspectUrl } from '../utils/inspect'
import { runStartWizard } from './start'
import { detectApp } from '../core/detectors/auto'
import { NetlifyAdapter } from '../providers/netlify/adapter'
import type { Framework } from '../types/framework'

interface UpOptions {
  readonly path?: string
  readonly json?: boolean
  readonly ci?: boolean
  readonly syncEnv?: boolean
  readonly alias?: string
  readonly project?: string
  readonly org?: string
  readonly env?: 'prod' | 'preview'
  readonly dryRun?: boolean
  readonly printCmd?: boolean
  readonly retries?: string
  readonly timeoutMs?: string
  readonly baseDelayMs?: string
  readonly ndjson?: boolean
  readonly noBuild?: boolean
}

function inferPublishDir(fw: Framework): string {
  if (fw === 'nuxt') return '.output/public'
  if (fw === 'remix') return 'build/client'
  if (fw === 'astro') return 'dist'
  if (fw === 'expo') return 'dist'
  if (fw === 'next') return '.next'
  if (fw === 'sveltekit') return 'build'
  return 'dist'
}

/**
 * Register the `up` command (preview deploy with smart defaults).
 * - Detects Next.js app
 * - Optionally syncs env from local file (optimized writes)
 * - Deploys to preview on selected provider
 * - Optionally assigns alias (Vercel)
 */
export function registerUpCommand(program: Command): void {
  program
    .command('up')
    .description('Deploy to preview with safe defaults (env sync + deploy)')
    .argument('[provider]', 'Target provider: vercel | netlify')
    .option('--env <env>', 'Environment: prod | preview', 'preview')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--json', 'Output JSON result')
    .option('--ci', 'CI mode (non-interactive)')
    .option('--dry-run', 'Do not execute actual deployment')
    .option('--sync-env', 'Sync environment from local .env before deploy')
    .option('--alias <domain>', 'After deploy, assign this alias to the deployment (vercel only)')
    .option('--project <id>', 'Provider project/site ID')
    .option('--org <id>', 'Provider org/team ID (Vercel)')
    .option('--print-cmd', 'Print underlying provider commands that will be executed')
    .option('--retries <n>', 'Retries for provider commands (default 2)')
    .option('--timeout-ms <ms>', 'Timeout per provider command in milliseconds (default 120000)')
    .option('--base-delay-ms <ms>', 'Base delay for exponential backoff with jitter (default 300)')
    .option('--ndjson', 'Output NDJSON events for progress')
    .option('--no-build', 'Skip local build; deploy existing publish directory (Netlify)')
    .action(async (provider: string | undefined, opts: UpOptions): Promise<void> => {
      const rootCwd: string = process.cwd()
      const targetCwd: string = opts.path ? join(rootCwd, opts.path) : rootCwd
      try {
        const jsonMode: boolean = isJsonMode(opts.json)
        const ndjsonOn: boolean = opts.ndjson === true || process.env.OPD_NDJSON === '1'
        if (jsonMode) logger.setJsonOnly(true)
        if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0))
        if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0))
        if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0))
        // If provider is missing, fall back to the guided wizard
        if (!provider) {
          await runStartWizard({ provider: undefined, env: (opts.env === 'prod' ? 'prod' : 'preview'), path: opts.path, project: opts.project, org: opts.org, syncEnv: Boolean(opts.syncEnv), json: Boolean(opts.json), ci: Boolean(opts.ci), dryRun: Boolean(opts.dryRun) })
          return
        }
        // Signal to any nested flows/tools that env sync is desired for single-command up
        process.env.OPD_SYNC_ENV = '1'
        // Detection is optional for generic providers; keep 'up' framework-agnostic
        // Env sync first (preview)
        const envTarget: 'prod' | 'preview' = opts.env === 'prod' ? 'prod' : 'preview'
        // Early dry-run summary
        if (opts.dryRun === true) {
          if (jsonMode) {
            const prov: 'vercel' | 'netlify' = provider === 'netlify' ? 'netlify' : 'vercel'
            const cmdPlan: string[] = []
            if (prov === 'vercel') {
              if (opts.project || opts.org) cmdPlan.push(`vercel link --yes${opts.project ? ` --project ${opts.project}` : ''}${opts.org ? ` --org ${opts.org}` : ''}`.trim())
              cmdPlan.push(envTarget === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes')
              if (opts.alias) cmdPlan.push(`vercel alias set <deployment-url> ${opts.alias}`)
            } else {
              // Best-effort publishDir inference without side effects
              let publishDir = 'dist'
              try {
                const det = await detectApp({ cwd: targetCwd })
                publishDir = det.publishDir ?? inferPublishDir(det.framework as Framework)
              } catch {
                try {
                  const pkgRaw = await (await import('node:fs/promises')).readFile(join(targetCwd, 'package.json'), 'utf8')
                  const scripts = (JSON.parse(pkgRaw).scripts ?? {}) as Record<string, string>
                  const hasRR = Object.values(scripts).some((s) => /react-router\s+build/i.test(String(s)))
                  if (hasRR) publishDir = 'build/client'
                } catch { /* ignore */ }
              }
              cmdPlan.push(`netlify deploy --build${envTarget === 'prod' ? ' --prod' : ''} --dir ${publishDir}${opts.project ? ` --site ${opts.project}` : ''}`.trim())
            }
            const summary = { ok: true, action: 'up' as const, provider: prov, target: envTarget, mode: 'dry-run', cmdPlan, final: true }
            logger.jsonPrint(summary)
          } else {
            logger.info(`[dry-run] up ${provider} (env=${envTarget})`)
          }
          return
        }
        const wantSync: boolean = opts.syncEnv === true || process.env.OPD_SYNC_ENV === '1'
        if (wantSync) {
          const candidates: readonly string[] = envTarget === 'prod' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
          let chosenFile: string | undefined
          for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { chosenFile = f; break } }
          if (chosenFile) {
            logger.section('Environment')
            logger.note(`Syncing ${chosenFile} → ${provider}`)
            if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'envSyncStart', provider, target: envTarget, file: chosenFile })
            try {
              // Strengthen redaction: load secrets from selected env file and process.env
              try { const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true }); if (patterns.length > 0) logger.setRedactors(patterns) } catch { /* ignore */ }
              await envSync({ provider: provider === 'netlify' ? 'netlify' : 'vercel', cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [], optimizeWrites: true })
              logger.success('Environment sync complete')
              if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'envSyncDone', provider, target: envTarget })
            } catch (e) {
              logger.warn(`Env sync skipped: ${(e as Error).message}`)
            }
          } else {
            logger.note('No local .env file found to sync')
          }
        }
        if (provider === 'vercel') {
          // Prefer linked app directory (target) if available; otherwise root if only root is linked
          const targetLink: string = join(targetCwd, '.vercel', 'project.json')
          const rootLink: string = join(rootCwd, '.vercel', 'project.json')
          const targetIsLinked: boolean = await fsx.exists(targetLink)
          const rootIsLinked: boolean = await fsx.exists(rootLink)
          const runCwd: string = targetIsLinked ? targetCwd : (rootIsLinked && !targetIsLinked ? rootCwd : targetCwd)
          if (runCwd !== targetCwd) logger.info(`Using linked directory for Vercel deploy: ${runCwd}`)
          // Ensure link when IDs are provided and chosen cwd is not already linked
          if ((opts.project || opts.org) && !(await fsx.exists(join(runCwd, '.vercel', 'project.json')))) {
            const flags: string[] = ['--yes']
            if (opts.project) flags.push(`--project ${opts.project}`)
            if (opts.org) flags.push(`--org ${opts.org}`)
            if (opts.printCmd) logger.info(`$ vercel link ${flags.join(' ')}`)
            if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'linking', provider: 'vercel', cwd: runCwd, flags })
            await runWithRetry({ cmd: `vercel link ${flags.join(' ')}`, cwd: runCwd })
          }
          const sp = spinner(`Vercel: deploying (${envTarget === 'prod' ? 'production' : 'preview'})`)
          const stop: Stopper = startHeartbeat({ label: 'vercel deploy', hint: 'Tip: opendeploy open vercel', intervalMs: ndjsonOn ? 5000 : 10000 })
          let capturedUrl: string | undefined
          let capturedInspect: string | undefined
          const urlRe = /https?:\/\/[^\s]+vercel\.app/g
          if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'deployStart', provider: 'vercel', target: envTarget })
          const controller = proc.spawnStream({
            cmd: envTarget === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes',
            cwd: runCwd,
            onStdout: (chunk: string): void => {
              const m = chunk.match(urlRe)
              if (!capturedUrl && m && m.length > 0) {
                capturedUrl = m[0]
                if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'url', provider: 'vercel', url: capturedUrl })
              }
              if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') {
                const t = chunk.replace(/\s+$/, '')
                if (t.length > 0) logger.info(t)
              }
            },
            onStderr: (chunk: string): void => {
              if (!capturedInspect) {
                const found = extractVercelInspectUrl(chunk)
                if (found) {
                  capturedInspect = found
                  if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'logsUrl', provider: 'vercel', logsUrl: capturedInspect })
                }
              }
            }
          })
          const res = await controller.done
          stop(); sp.stop()
          if (!res.ok) throw new Error('Vercel deploy failed')
          // Fallback: resolve Inspect URL after deploy when not captured from stream
          if (!capturedInspect && capturedUrl) {
            try {
              const insp = await proc.run({ cmd: `vercel inspect ${capturedUrl}`, cwd: runCwd })
              const text: string = (insp.stdout || '') + '\n' + (insp.stderr || '')
              const found = extractVercelInspectUrl(text)
              if (found) capturedInspect = found
            } catch { /* ignore */ }
          }
          if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'deployed', provider: 'vercel', target: envTarget, url: capturedUrl, logsUrl: capturedInspect })
          // Optional alias
          let aliasUrl: string | undefined
          if (capturedUrl && opts.alias) {
            const aliasCmd = `vercel alias set ${capturedUrl} ${opts.alias}`.trim()
            if (opts.printCmd) logger.info(`$ ${aliasCmd}`)
            const al = await runWithRetry({ cmd: aliasCmd, cwd: runCwd })
            if (al.ok) aliasUrl = `https://${opts.alias}`
            if (ndjsonOn && aliasUrl) logger.json({ ok: true, action: 'up', stage: 'aliasSet', provider: 'vercel', aliasUrl })
          }
          if (jsonMode) { logger.jsonPrint({ ok: true, action: 'up' as const, provider: 'vercel' as const, target: envTarget, url: capturedUrl, logsUrl: capturedInspect, aliasUrl, final: true }); return }
          if (capturedUrl) logger.success(`${envTarget === 'prod' ? 'Production' : 'Preview'}: ${capturedUrl}`)
          if (aliasUrl) logger.success(`Aliased: ${aliasUrl}`)
          printDeploySummary({ provider: 'vercel', target: envTarget, url: capturedUrl, logsUrl: capturedInspect })
          return
        }
        if (provider === 'netlify') {
          // Detect to compute publishDir and ensure minimal config
          let publishDir: string = 'dist'
          try {
            const det = await detectApp({ cwd: targetCwd })
            // Ensure netlify.toml (idempotent)
            try { const a = new NetlifyAdapter(); await a.generateConfig({ detection: det, overwrite: false }) } catch { /* ignore */ }
            publishDir = det.publishDir ?? inferPublishDir(det.framework as Framework)
          } catch {
            // Fallback: react-router (Remix family) static output
            try {
              const pkgPath = join(targetCwd, 'package.json')
              const raw = await (await import('node:fs/promises')).readFile(pkgPath, 'utf8')
              const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
              const scripts = pkg.scripts ?? {}
              const hasRR = Object.values(scripts).some((s) => /react-router\s+build/i.test(String(s)))
              if (hasRR) publishDir = 'build/client'
            } catch { /* ignore */ }
          }
          const sp = spinner(`Netlify: deploying (${envTarget === 'prod' ? 'production' : 'preview'})`)
          const siteFlag: string = opts.project ? ` --site ${opts.project}` : ''
          const dirFlag: string = ` --dir ${publishDir}`
          const buildFlag: string = opts.noBuild === true ? '' : ' --build'
          const cmd: string = `netlify deploy${buildFlag}${envTarget === 'prod' ? ' --prod' : ''}${dirFlag}${siteFlag}`.trim()
          if (opts.printCmd) logger.info(`$ ${cmd}`)
          if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'deployStart', provider: 'netlify', target: envTarget, cmd })
          const stop: Stopper = startHeartbeat({ label: 'netlify deploy', hint: 'Tip: connect repo for CI builds', intervalMs: ndjsonOn ? 5000 : 10000 })
          const res = await runWithRetry({ cmd, cwd: targetCwd }, { timeoutMs: Math.max(120000, Number(process.env.OPD_TIMEOUT_MS) || 300000) })
          stop(); sp.stop()
          if (!res.ok) throw new Error(res.stderr.trim() || res.stdout.trim() || 'Netlify deploy failed')
          const m = res.stdout.match(/https?:\/\/[^\s]+\.netlify\.app\b/)
          const url = m?.[0]
          // Best-effort resolve dashboard logs URL
          let logsUrl: string | undefined
          try {
            // Resolve siteId
            let siteId: string | undefined = opts.project
            if (!siteId) {
              try {
                const stRaw = await fsx.readJson<{ siteId?: string }>(join(targetCwd, '.netlify', 'state.json'))
                if (stRaw && typeof stRaw.siteId === 'string') siteId = stRaw.siteId
              } catch { /* ignore */ }
            }
            if (siteId) {
              // Get latest deploy id
              const ls = await proc.run({ cmd: `netlify api listSiteDeploys --data '{"site_id":"${siteId}","per_page":1}'`, cwd: targetCwd })
              let deployId: string | undefined
              if (ls.ok) {
                try { const arr = JSON.parse(ls.stdout) as Array<{ id?: string }>; deployId = arr?.[0]?.id } catch { /* ignore */ }
              }
              // Get site name to form dashboard URL
              const siteRes = await proc.run({ cmd: `netlify api getSite --data '{"site_id":"${siteId}"}'`, cwd: targetCwd })
              let siteName: string | undefined
              if (siteRes.ok) {
                try { const js = JSON.parse(siteRes.stdout) as { name?: string }; if (typeof js.name === 'string') siteName = js.name } catch { /* ignore */ }
              }
              if (siteName && deployId) logsUrl = `https://app.netlify.com/sites/${siteName}/deploys/${deployId}`
            }
          } catch { /* ignore */ }
          if (ndjsonOn) logger.json({ ok: true, action: 'up', stage: 'deployed', provider: 'netlify', target: envTarget, url, logsUrl })
          if (jsonMode) { logger.jsonPrint({ ok: true, action: 'up' as const, provider: 'netlify' as const, target: envTarget, url, logsUrl, final: true }); return }
          logger.success(url ? `${envTarget === 'prod' ? 'Production' : 'Preview'}: ${url}` : (envTarget === 'prod' ? 'Production ready' : 'Preview ready'))
          printDeploySummary({ provider: 'netlify', target: envTarget, url, logsUrl })
          return
        }
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        if (isJsonMode(opts.json)) { logger.jsonPrint({ ok: false, action: 'up' as const, provider, message: msg, final: true }) }
        logger.error(msg)
        process.exitCode = 1
      }
    })
}
