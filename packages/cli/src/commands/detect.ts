import { Command } from 'commander'
import { detectApp, detectCandidates } from '../core/detectors/auto'
import { logger } from '../utils/logger'
import Ajv2020 from 'ajv/dist/2020'
import { detectSummarySchema } from '../schemas/detect-summary.schema'
import type { DetectionResult } from '../types/detection-result'
import type { Framework } from '../types/framework'

/**
 * Register the `detect` command.
 */
export function registerDetectCommand(program: Command): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const validate = ajv.compile(detectSummarySchema as unknown as object)
  const annotate = (obj: Record<string, unknown>): Record<string, unknown> => {
    const ok: boolean = validate(obj) as boolean
    const errs: string[] = Array.isArray(validate.errors) ? validate.errors.map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) : []
    if (process.env.OPD_SCHEMA_STRICT === '1' && errs.length > 0) { process.exitCode = 1 }
    return { ...obj, schemaOk: ok, schemaErrors: errs }
  }
  program
    .command('detect')
    .description('Detect your app (Next, Astro, SvelteKit, Remix, Nuxt; Expo when OPD_EXPERIMENTAL=1)')
    .option('--json', 'Output JSON')
    .action(async (opts: { json?: boolean }): Promise<void> => {
      const cwd: string = process.cwd()
      try {
        if (opts.json === true || process.env.OPD_JSON === '1') logger.setJsonOnly(true)
        const result: DetectionResult = await detectApp({ cwd })
        if (opts.json === true || process.env.OPD_JSON === '1') {
          const summary = { ok: true, action: 'detect' as const, detection: result, final: true }
          logger.jsonPrint(annotate(summary as unknown as Record<string, unknown>))
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
        logger.info(`Candidates     : next${mark('next')}, astro${mark('astro')}, sveltekit${mark('sveltekit')}, remix${mark('remix')}, nuxt${mark('nuxt')}${process.env.OPD_EXPERIMENTAL==='1' ? `, expo${mark('expo')}` : ''}`)
        if (result.environmentFiles.length > 0) {
          logger.info(`Env Files      : ${result.environmentFiles.join(', ')}`)
        } else {
          logger.info('Env Files      : none')
        }
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        if (opts.json === true || process.env.OPD_JSON === '1') {
          logger.jsonPrint(annotate({ ok: false, action: 'detect' as const, message, final: true }))
        } else {
          logger.error(message)
        }
        process.exitCode = 1
      }
    })
}
