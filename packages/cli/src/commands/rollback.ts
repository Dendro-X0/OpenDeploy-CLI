import { Command } from 'commander'
import { join } from 'node:path'
import { logger, isJsonMode } from '../utils/logger'
import { spinner } from '../utils/ui'
import { proc, runWithRetry } from '../utils/process'
import { fsx } from '../utils/fs'
import { printDeploySummary } from '../utils/summarize'
import Ajv from 'ajv'
import { rollbackSummarySchema } from '../schemas/rollback-summary.schema'

interface RollbackOptions {
  readonly alias?: string
  readonly to?: string
  readonly path?: string
  readonly json?: boolean
  readonly project?: string
  readonly org?: string
  readonly dryRun?: boolean
  readonly printCmd?: boolean
  readonly retries?: string
  readonly timeoutMs?: string
  readonly baseDelayMs?: string
}

/**
 * Register the `rollback` command.
 *
 * - Vercel: choose previous production or a specific target and repoint an alias to it.
 * - Netlify: best-effort restore of the previous production deploy via API; fallback to dashboard instructions.
 */
export function registerRollbackCommand(program: Command): void {
  const ajv = new Ajv({ allErrors: true, strict: false })
  const validate = ajv.compile(rollbackSummarySchema as unknown as object)
  const annotate = (obj: Record<string, unknown>): Record<string, unknown> => {
    const ok: boolean = validate(obj) as boolean
    const errs: string[] = Array.isArray(validate.errors) ? validate.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
    if (process.env.OPD_SCHEMA_STRICT === '1' && errs.length > 0) { process.exitCode = 1 }
    return { ...obj, schemaOk: ok, schemaErrors: errs }
  }
  program
    .command('rollback')
    .description('Rollback production to a previous successful deployment (provider-specific)')
    .argument('<provider>', 'Target provider: vercel | netlify')
    .option('--alias <domain>', 'Production alias/domain (Vercel)')
    .option('--to <urlOrSha>', 'Specific deployment URL or commit SHA to rollback to (provider-dependent)')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--json', 'Output JSON result')
    .option('--dry-run', 'Do not execute actual rollback')
    .option('--project <id>', 'Provider project/site ID (Netlify siteId; optional)')
    .option('--org <id>', 'Provider org/team ID (Vercel)')
    .option('--print-cmd', 'Print underlying provider commands that will be executed')
    .option('--retries <n>', 'Retries for provider commands (default 2)')
    .option('--timeout-ms <ms>', 'Timeout per provider command in milliseconds (default 120000)')
    .option('--base-delay-ms <ms>', 'Base delay for exponential backoff with jitter (default 300)')
    .action(async (provider: string, opts: RollbackOptions): Promise<void> => {
      const rootCwd: string = process.cwd()
      const targetCwd: string = opts.path ? join(rootCwd, opts.path) : rootCwd
      try {
        if (opts.retries) process.env.OPD_RETRIES = String(Math.max(0, Number(opts.retries) || 0))
        if (opts.timeoutMs) process.env.OPD_TIMEOUT_MS = String(Math.max(0, Number(opts.timeoutMs) || 0))
        if (opts.baseDelayMs) process.env.OPD_BASE_DELAY_MS = String(Math.max(0, Number(opts.baseDelayMs) || 0))
        const jsonMode: boolean = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        // Early dry-run summary to avoid side effects
        if (opts.dryRun === true) {
          const prov: 'vercel' | 'netlify' = provider === 'netlify' ? 'netlify' : 'vercel'
          const base = { ok: true, provider: prov, action: 'rollback' as const, target: 'prod' as const }
          const cmdPlan: string[] = prov === 'vercel'
            ? [
                `vercel list --json -n 20`,
                ...(opts.alias ? [`vercel alias set ${opts.to ?? '<deployment-url>'} ${opts.alias}`] : [])
              ]
            : [
                `netlify api listSiteDeploys --data '{"site_id":"${opts.project ?? '<site-id>'}","per_page":10}'${opts.project ? ' --site ' + opts.project : ''}`.trim(),
                `netlify api restoreDeploy --data '{"deploy_id":"<deploy-id>"}'${opts.project ? ' --site ' + opts.project : ''}`.trim()
              ]
          if (jsonMode) {
            logger.jsonPrint(annotate({ ...base, cmdPlan, final: true }))
          } else {
            logger.info(`[dry-run] rollback ${prov}`)
          }
          return
        }
        if (provider === 'vercel') {
          if (!opts.alias && !opts.to) {
            const msg = 'Provide --alias <domain> (required for repoint) and/or --to <url|sha> to target a specific deployment.'
            if (jsonMode) { logger.jsonPrint(annotate({ ok: false, action: 'rollback' as const, provider: 'vercel' as const, message: msg, final: true })); return }
            logger.error(msg)
            return
          }
          const targetLink: string = join(targetCwd, '.vercel', 'project.json')
          const rootLink: string = join(rootCwd, '.vercel', 'project.json')
          const targetIsLinked: boolean = await fsx.exists(targetLink)
          const rootIsLinked: boolean = await fsx.exists(rootLink)
          const runCwd: string = targetIsLinked ? targetCwd : (rootIsLinked ? rootCwd : targetCwd)
          let url: string | undefined = opts.to
          const sp = spinner('Vercel: resolving production history')
          try {
            if (!url) {
              const listCmd = 'vercel list --json -n 20'
              if (opts.printCmd) logger.info(`$ ${listCmd}`)
              const ls = await runWithRetry({ cmd: listCmd, cwd: runCwd })
              if (ls.ok) {
                try {
                  const arr = JSON.parse(ls.stdout) as Array<Record<string, unknown>>
                  const prod = arr.filter((d) => String((d as { target?: unknown }).target ?? '').toLowerCase() === 'production' && String((d as { state?: unknown }).state ?? '').toLowerCase() === 'ready')
                  // Choose previous production (index 1)
                  const prev = prod.length >= 2 ? prod[1] : prod[0]
                  const frag = prev ? (prev as { url?: unknown }).url : undefined
                  if (typeof frag === 'string' && frag.length > 0) url = frag.startsWith('http') ? frag : `https://${frag}`
                } catch { /* ignore JSON parse */ }
                if (!url) {
                  const m = ls.stdout.match(/https?:\/\/[^\s]+vercel\.app/)
                  url = m?.[0]
                }
              }
            }
            // If --to was provided but isn't a URL, try resolving via `vercel inspect`
            if (url && !/^https?:\/\//i.test(url)) {
              try {
                const insp = await proc.run({ cmd: `vercel inspect ${url}`, cwd: runCwd })
                const text: string = (insp.stdout || '') + '\n' + (insp.stderr || '')
                const m = text.match(/https?:\/\/[^\s]+vercel\.app/g)
                if (m && m.length > 0) url = m[0]
              } catch { /* ignore */ }
              if (!/^https?:\/\//i.test(url)) throw new Error(`Could not resolve URL from --to=${opts.to}. Provide a URL or a resolvable ref.`)
            }
          } finally { sp.stop() }
          if (!url) throw new Error('Could not resolve a previous production deployment')
          if (!opts.alias) {
            const msg = `Resolved candidate: ${url}. Provide --alias <domain> to repoint production.`
            if (jsonMode) { logger.jsonPrint(annotate({ ok: true, provider: 'vercel', action: 'rollback', target: 'prod', candidate: url, needsAlias: true, final: true })); return }
            logger.info(msg)
            return
          }
          const aliasCmd = `vercel alias set ${url} ${opts.alias}`.trim()
          if (opts.printCmd) logger.info(`$ ${aliasCmd}`)
          const res = await runWithRetry({ cmd: aliasCmd, cwd: runCwd })
          if (!res.ok) throw new Error(res.stderr.trim() || res.stdout.trim() || 'Failed to point alias to previous deployment')
          if (jsonMode) { logger.jsonPrint(annotate({ ok: true, provider: 'vercel', action: 'rollback', target: 'prod', to: url, url: `https://${opts.alias}`, alias: `https://${opts.alias}`, final: true })); return }
          logger.success(`Rolled back production → ${opts.alias}`)
          if (opts.alias) printDeploySummary({ provider: 'vercel', target: 'prod', url: `https://${opts.alias}` })
          return
        }
        if (provider === 'netlify') {
          const siteFlag: string = opts.project ? ` --site ${opts.project}` : ''
          // Get previous production deploy id
          const sp = spinner('Netlify: resolving previous production deploy')
          const listCmd = `netlify api listSiteDeploys --data '{"site_id":"${opts.project ?? ''}","per_page":10}'${siteFlag}`
          if (opts.printCmd) logger.info(`$ ${listCmd}`)
          const ls = await runWithRetry({ cmd: listCmd, cwd: targetCwd })
          sp.stop()
          if (!ls.ok) throw new Error(ls.stderr.trim() || ls.stdout.trim() || 'Failed to list Netlify deploys')
          let prevId: string | undefined
          let siteName: string | undefined
          try {
            const arr = JSON.parse(ls.stdout) as Array<{ id?: string; context?: string; state?: string }>
            const prod = arr.filter(d => (d.context ?? '').toLowerCase() === 'production' && (d.state ?? '').toLowerCase() === 'ready')
            if (prod.length >= 2) prevId = prod[1].id
            else if (prod.length === 1) prevId = prod[0].id
          } catch { /* ignore */ }
          // Resolve site name for dashboard URL
          try {
            const siteCmd = `netlify api getSite --data '{"site_id":"${opts.project ?? ''}"}'${siteFlag}`
            if (opts.printCmd) logger.info(`$ ${siteCmd}`)
            const siteRes = await runWithRetry({ cmd: siteCmd, cwd: targetCwd })
            if (siteRes.ok) {
              const js = JSON.parse(siteRes.stdout) as { name?: string }
              if (typeof js.name === 'string') siteName = js.name
            }
          } catch { /* ignore */ }
          if (!prevId) {
            const dash = siteName ? `https://app.netlify.com/sites/${siteName}/deploys` : undefined
            const msg = `Could not resolve previous production deploy. ${dash ? `Open: ${dash}` : ''}`
            if (jsonMode) { logger.jsonPrint(annotate({ ok: false, provider: 'netlify', action: 'rollback', target: 'prod', message: msg, dashboard: dash, final: true })); return }
            logger.error(msg)
            return
          }
          // Attempt restore via API (may require CLI auth + permissions)
          const restoreCmd = `netlify api restoreDeploy --data '{"deploy_id":"${prevId}"}'${siteFlag}`
          if (opts.printCmd) logger.info(`$ ${restoreCmd}`)
          const restore = await runWithRetry({ cmd: restoreCmd, cwd: targetCwd })
          if (!restore.ok) {
            const dash = siteName ? `https://app.netlify.com/sites/${siteName}/deploys/${prevId}` : undefined
            if (jsonMode) { logger.jsonPrint(annotate({ ok: false, provider: 'netlify', action: 'rollback', target: 'prod', message: 'Restore failed. Use dashboard to restore.', dashboard: dash, final: true })); return }
            logger.warn('Netlify restore API failed. Open the dashboard to restore this deploy:')
            if (dash) logger.info(dash)
            return
          }
          if (jsonMode) { logger.jsonPrint(annotate({ ok: true, provider: 'netlify', action: 'rollback', target: 'prod', deployId: prevId, final: true })); return }
          logger.success(`Requested restore of deploy ${prevId}`)
          printDeploySummary({ provider: 'netlify', target: 'prod' })
          return
        }
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        if (isJsonMode(opts.json)) logger.jsonPrint(annotate({ ok: false, action: 'rollback', provider, message: msg, final: true }))
        logger.error(msg)
        process.exitCode = 1
      }
    })
}
