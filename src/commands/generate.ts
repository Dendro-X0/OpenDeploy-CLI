import { Command } from 'commander'
import { stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { logger, isJsonMode } from '../utils/logger'
import { detectApp } from '../core/detectors/auto'
import { loadProvider } from '../core/provider-system/provider'

interface GenerateOptions { readonly overwrite?: boolean; readonly json?: boolean }

/**
 * Register the `generate` command which emits provider-specific config files.
 */
export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate configuration files for the detected app (Vercel, Netlify) or turborepo pipeline')
    .argument('<provider>', 'Target: vercel | netlify | turbo')
    .option('--overwrite', 'Overwrite existing files')
    .option('--json', 'Output JSON with generated file path')
    .action(async (provider: string, opts: GenerateOptions): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        const jsonMode: boolean = isJsonMode(opts.json)
        if (jsonMode) logger.setJsonOnly(true)
        const detection = await detectApp({ cwd })
        if (provider === 'vercel') {
          const plugin = await loadProvider('vercel')
          const writtenPath: string = await plugin.generateConfig({ detection, cwd, overwrite: opts.overwrite === true })
          if (jsonMode) {
            const summary = { ok: true, action: 'generate' as const, provider: 'vercel' as const, path: writtenPath, final: true }
            logger.jsonPrint(summary)
            return
          }
          logger.success(`Generated Vercel config at ${writtenPath}`)
          return
        }
        if (provider === 'netlify') {
          const plugin = await loadProvider('netlify')
          const writtenPath: string = await plugin.generateConfig({ detection, cwd, overwrite: opts.overwrite === true })
          if (jsonMode) {
            const summary = { ok: true, action: 'generate' as const, provider: 'netlify' as const, path: writtenPath, final: true }
            logger.jsonPrint(summary)
            return
          }
          logger.success(`Generated Netlify config at ${writtenPath}`)
          return
        }
        if (provider === 'turbo') {
          const path: string = join(cwd, 'turbo.json')
          const exists = async (): Promise<boolean> => { try { const s = await stat(path); return s.isFile() } catch { return false } }
          if (opts.overwrite === true || !(await exists())) {
            const turbo = {
              tasks: {
                build: {
                  dependsOn: ['^build'],
                  outputs: ['.next/**', '!.next/cache/**', 'dist/**']
                }
              }
            }
            await writeFile(path, `${JSON.stringify(turbo, null, 2)}\n`, 'utf8')
          }
          if (jsonMode) {
            logger.jsonPrint({ ok: true, action: 'generate' as const, provider: 'turbo' as const, path, final: true })
            return
          }
          logger.success(`Generated Turborepo config at ${path}`)
          return
        }
        logger.error(`Unknown provider: ${provider}`)
        process.exitCode = 1
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
      }
    })
}
