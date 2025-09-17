import { Command } from 'commander'
import { logger } from '../utils/logger'
import { detectNextApp } from '../core/detectors/next'
import { VercelAdapter } from '../providers/vercel/adapter'

interface GenerateOptions { readonly overwrite?: boolean; readonly json?: boolean }

/**
 * Register the `generate` command which emits provider-specific config files.
 */
export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate provider configuration files for the detected app')
    .argument('<provider>', 'Target provider: vercel | netlify')
    .option('--overwrite', 'Overwrite existing files')
    .option('--json', 'Output JSON with generated file path')
    .action(async (provider: string, opts: GenerateOptions): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        const detection = await detectNextApp({ cwd })
        if (provider === 'vercel') {
          const adapter = new VercelAdapter()
          const writtenPath: string = await adapter.generateConfig({ detection, overwrite: opts.overwrite === true })
          if (opts.json === true) {
            logger.json({ provider: 'vercel', path: writtenPath })
            return
          }
          logger.success(`Generated Vercel config at ${writtenPath}`)
          return
        }
        if (provider === 'netlify') {
          logger.warn('Netlify generator is not implemented yet for Next.js in the MVP')
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
