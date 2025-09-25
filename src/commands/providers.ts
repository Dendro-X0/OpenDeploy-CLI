import { Command } from 'commander'
import { logger, isJsonMode } from '../utils/logger'
import { loadProvider } from '../core/provider-system/provider'

export function registerProvidersCommand(program: Command): void {
  program
    .command('providers')
    .description('List and inspect provider plugins')
    .option('--json', 'Output JSON')
    .option('--id <name>', 'Show info for a specific provider (e.g., vercel, netlify, cloudflare, github)')
    .action(async (opts: { json?: boolean; id?: string }): Promise<void> => {
      try {
        const jsonMode = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        const candidates: readonly string[] = opts.id ? [opts.id] : ['vercel', 'netlify', 'cloudflare', 'github']
        const results: Array<{ id: string; ok: boolean; error?: string; capabilities?: unknown }> = []
        for (const id of candidates) {
          try {
            const p = await loadProvider(id)
            results.push({ id, ok: true, capabilities: p.getCapabilities() })
          } catch (e) {
            results.push({ id, ok: false, error: (e as Error).message })
          }
        }
        if (jsonMode) { logger.json({ ok: true, providers: results, final: true }); return }
        logger.section('Providers')
        for (const r of results) {
          if (r.ok) logger.info(`${r.id}: ready`)
          else logger.warn(`${r.id}: ${r.error}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (isJsonMode(opts.json)) logger.json({ ok: false, message: msg, final: true })
        logger.error(msg)
        process.exitCode = 1
      }
    })
}
