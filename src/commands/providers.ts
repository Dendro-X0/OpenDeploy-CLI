import { Command } from 'commander'
import { logger, isJsonMode } from '../utils/logger'
import { loadProvider } from '../core/provider-system/provider'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { fsx } from '../utils/fs'
import { renderGithubPagesWorkflow } from '../utils/workflows'

export function registerProvidersCommand(program: Command): void {
  program
    .command('providers')
    .description('List and inspect provider plugins')
    .option('--json', 'Output JSON')
    .option('--id <name>', 'Show info for a specific provider (e.g., vercel, netlify, cloudflare, github)')
    .option('--emit-workflow', 'When --id=github, write a GitHub Pages deploy workflow to .github/workflows/deploy-pages.yml')
    .option('--base-path <path>', 'Base path for site (e.g., /repo). Overrides auto-inference from package name')
    .option('--site-origin <url>', 'Public site origin (e.g., https://<owner>.github.io)')
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
        // Optional: emit GitHub Pages workflow when requested
        const wantWorkflow = (opts as any).emitWorkflow === true || (opts as any)['emit-workflow'] === true
        if (wantWorkflow) {
          const id = (opts.id || '').toLowerCase()
          if (id !== 'github') throw new Error('--emit-workflow currently only supports --id=github')
          const cwd = process.cwd()
          const pkgPath = join(cwd, 'package.json')
          let basePath = typeof (opts as any).basePath === 'string' ? String((opts as any).basePath).trim() : ''
          if (basePath.length === 0) {
            try {
              const pkg = await fsx.readJson<Record<string, unknown>>(pkgPath)
              const name = String((pkg as any)?.name || '').replace(/^@[^/]+\//, '')
              if (name) basePath = `/${name}`
            } catch { /* ignore, fallback below */ }
            if (basePath.length === 0) basePath = '/site'
          }
          const siteOrigin: string | undefined = typeof (opts as any).siteOrigin === 'string' ? String((opts as any).siteOrigin).trim() : undefined
          const wfDir = join(cwd, '.github', 'workflows')
          await mkdir(wfDir, { recursive: true })
          const wfPath = join(wfDir, 'deploy-pages.yml')
          const content = renderGithubPagesWorkflow({ basePath, siteOrigin })
          await writeFile(wfPath, content, 'utf8')
          if (jsonMode) { logger.json({ ok: true, action: 'emit-workflow', provider: 'github', path: wfPath, basePath, siteOrigin, final: true }); return }
          logger.info(`Wrote GitHub Pages workflow: ${wfPath}`)
          logger.info(`Base path: ${basePath}${siteOrigin ? ` • Site origin: ${siteOrigin}` : ''}`)
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
