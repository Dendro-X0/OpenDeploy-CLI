import { Command } from 'commander'
import { join } from 'node:path'
import { logger, isJsonMode } from '../utils/logger'
import { spinner } from '../utils/ui'
import { proc, runWithRetry } from '../utils/process'

import { fsx } from '../utils/fs'
import { printDeploySummary } from '../utils/summarize'
import Ajv from 'ajv'
import { promoteSummarySchema } from '../schemas/promote-summary.schema'

interface PromoteOptions {
  readonly alias?: string
  readonly from?: string
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
 * Register the `promote` command.
 *
 * - Vercel: resolve latest preview deployment and assign an alias domain to it (production promotion by alias).
 */
export function registerPromoteCommand(program: Command): void {
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false })
  const validate = ajv.compile(promoteSummarySchema as unknown as object)
  const annotate = (obj: Record<string, unknown>): Record<string, unknown> => {
    const ok: boolean = validate(obj) as boolean
    const errs: string[] = Array.isArray(validate.errors) ? validate.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
    if (process.env.OPD_SCHEMA_STRICT === '1' && errs.length > 0) { process.exitCode = 1 }
    return { ...obj, schemaOk: ok, schemaErrors: errs }
  }
  program
    .command('promote')
    .description('Promote a preview to production (Vercel)')
    .argument('<provider>', 'Target provider: vercel')
    .option('--alias <domain>', 'Production alias/domain (Vercel)')
    .option('--from <urlOrSha>', 'Vercel: preview URL or commit SHA to promote; Netlify: deployId to restore')
    .option('--path <dir>', 'Path to app directory (for monorepos)')
    .option('--json', 'Output JSON result')
    .option('--dry-run', 'Do not execute actual promotion')
    .option('--project <id>', 'Provider project/site ID')
    .option('--org <id>', 'Provider org/team ID (Vercel)')
    .option('--print-cmd', 'Print underlying provider commands that will be executed')
    .option('--retries <n>', 'Retries for provider commands (default 2)')
    .option('--timeout-ms <ms>', 'Timeout per provider command in milliseconds (default 120000)')
    .option('--base-delay-ms <ms>', 'Base delay for exponential backoff with jitter (default 300)')
    .action(async (provider: string, opts: PromoteOptions): Promise<void> => {
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
          const base = { ok: true, provider: 'vercel' as const, action: 'promote' as const, target: 'prod' as const }
          const cmdPlan: string[] = (opts.alias ? [
            opts.from ? `vercel alias set ${opts.from} ${opts.alias}` : `vercel alias set <preview-url> ${opts.alias}`,
            ...(opts.from ? [] : [`vercel list --json -n 10`])
          ] : [ `vercel list --json -n 10` ])
          if (jsonMode) { logger.jsonPrint(annotate({ ...base, from: opts.from, alias: opts.alias ? `https://${opts.alias}` : undefined, cmdPlan, final: true })) }
          else { logger.info(`[dry-run] promote vercel (alias=${opts.alias ?? 'none'})`) }
          return
        }
        if (provider === 'vercel') {
          if (!opts.alias) {
            const msg = 'Missing --alias <domain>. Provide the production domain to point to the preview.'
            if (jsonMode) { logger.jsonPrint(annotate({ ok: false, action: 'promote' as const, provider: 'vercel' as const, message: msg, final: true })); return }
            logger.error(msg)
            return
          }
          let previewUrl: string | undefined
          if (opts.from) {
            if (opts.from.startsWith('http')) {
              previewUrl = opts.from
            } else {
              // Try to resolve a preview URL from a commit/identifier via `vercel inspect`
              try {
                const insp = await proc.run({ cmd: `vercel inspect ${opts.from}`, cwd: targetCwd })
                const text: string = (insp.stdout || '') + '\n' + (insp.stderr || '')
                const m = text.match(/https?:\/\/[^\s]+vercel\.app/g)
                if (m && m.length > 0) previewUrl = m[0]
              } catch { /* ignore */ }
              if (!previewUrl) throw new Error(`Could not resolve preview URL from --from=${opts.from}. Provide a preview URL or a resolvable ref.`)
            }
          } else {
            // Resolve latest preview
            const sp = spinner('Vercel: resolving latest preview')
            try {
              const listRes = await proc.run({ cmd: 'vercel list --json -n 10', cwd: targetCwd })
              if (listRes.ok) {
                try {
                  const arr = JSON.parse(listRes.stdout) as Array<{ url?: string; readyState?: string; target?: string }>
                  const previews = arr.filter(d => (d.target ?? '').toLowerCase() !== 'production' && (d.readyState ?? '').toLowerCase() === 'ready')
                  previewUrl = previews[0]?.url ? (previews[0].url!.startsWith('http') ? previews[0].url! : `https://${previews[0].url!}`) : undefined
                } catch { /* ignore */ }
              }
            } finally { sp.stop() }
          }
          if (!previewUrl) throw new Error('Could not resolve a recent preview deployment URL')
          const aliasCmd = `vercel alias set ${previewUrl} ${opts.alias}`.trim()
          if (opts.printCmd) logger.info(`$ ${aliasCmd}`)
          const set = await runWithRetry({ cmd: aliasCmd, cwd: targetCwd })
          if (!set.ok) throw new Error(set.stderr.trim() || set.stdout.trim() || 'Failed to set alias for preview')
          if (jsonMode) { logger.jsonPrint(annotate({ ok: true, provider: 'vercel', action: 'promote', target: 'prod', from: previewUrl, url: `https://${opts.alias}`, alias: `https://${opts.alias}`, final: true })); return }
          logger.success(`Promoted preview → ${opts.alias}`)
          printDeploySummary({ provider: 'vercel', target: 'prod', url: `https://${opts.alias}` })
          return
        }
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        if (isJsonMode(opts.json)) logger.jsonPrint(annotate({ ok: false, action: 'promote', provider, message: msg, final: true }))
        logger.error(msg)
        process.exitCode = 1
      }
    })
}
