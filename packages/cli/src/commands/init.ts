import { Command } from 'commander'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { logger } from '../utils/logger'
import { confirm } from '../utils/prompt'
import { detectNextApp } from '../core/detectors/next'
import { loadProvider } from '../core/provider-system/provider'

interface InitOptions { readonly json?: boolean }

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize OpenDeploy in this project (choose provider, generate configs, set defaults)')
    .option('--json', 'Output JSON summary')
    .action(async (_opts: InitOptions): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        const detection = await detectNextApp({ cwd })
        logger.section('OpenDeploy Init')
        const useVercel: boolean = await confirm('Use Vercel as a deployment provider?', { defaultYes: true })
        if (!useVercel) { logger.warn('No provider selected. Nothing to do.'); return }
        const autoSyncEnv: boolean = await confirm('Auto-sync .env before deploy (recommended)?', { defaultYes: true })
        const cfg = {
          providers: [
            ...(useVercel ? ['vercel'] as const : [])
          ],
          env: {
            autoSync: autoSyncEnv,
            ignore: [] as string[],
            only: [] as string[],
            failOnAdd: false,
            failOnRemove: false
          }
        }
        // Generate provider configs
        if (useVercel) {
          const ver = await loadProvider('vercel')
          await ver.validateAuth(cwd).catch(() => {/* continue; user can auth later */})
          await ver.generateConfig({ detection, cwd, overwrite: false }).catch(() => {/* ignore */})
          logger.success('Vercel configuration ready')
        }
        // Netlify support removed; please use the official Netlify CLI for config and deploy.
        const path: string = join(cwd, 'opendeploy.config.json')
        await writeFile(path, JSON.stringify(cfg, null, 2), 'utf8')
        logger.success(`Wrote ${path}`)
        logger.note('Tip: run "opendeploy deploy <provider> --sync-env --env prod" for single-command prod deploy')
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
      }
    })
}
