import { Command } from 'commander'
import { detectNextApp } from '../core/detectors/next'
import { logger } from '../utils/logger'
import type { DetectionResult } from '../types/detection-result'

/**
 * Register the `detect` command.
 */
export function registerDetectCommand(program: Command): void {
  program
    .command('detect')
    .description('Detect a Next.js app and its configuration')
    .option('--json', 'Output JSON')
    .action(async (opts: { json?: boolean }): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        if (opts.json === true) logger.setJsonOnly(true)
        const result: DetectionResult = await detectNextApp({ cwd })
        if (opts.json === true) {
          logger.json(result)
          return
        }
        logger.info('Framework      : Next.js')
        logger.info(`Root Dir       : ${result.rootDir}`)
        logger.info(`App Dir        : ${result.appDir}`)
        logger.info(`App Router     : ${result.hasAppRouter ? 'yes' : 'no'}`)
        logger.info(`Package Manager: ${result.packageManager}`)
        logger.info(`Monorepo Tool  : ${result.monorepo}`)
        logger.info(`Build Command  : ${result.buildCommand}`)
        logger.info(`Output Dir     : ${result.outputDir}`)
        if (result.environmentFiles.length > 0) {
          logger.info(`Env Files      : ${result.environmentFiles.join(', ')}`)
        } else {
          logger.info('Env Files      : none')
        }
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
      }
    })
}
