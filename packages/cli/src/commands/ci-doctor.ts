/**
 * CI Doctor command.
 * Provides local environment diagnostics and recommendations to mirror CI.
 */
import { Command } from 'commander'
import { logger, isJsonMode } from '../utils/logger'
import { ciDoctor, type CiDoctorResult } from '../utils/ci-doctor'

/**
 * Register the `ci-doctor` command.
 */
export function registerCiDoctorCommand(program: Command): void {
  program
    .command('ci-doctor')
    .description('Diagnose local environment for CI parity and print recommendations')
    .option('--json', 'Output JSON')
    .action(async (opts: { readonly json?: boolean }): Promise<void> => {
      const res: CiDoctorResult = await ciDoctor()
      if (isJsonMode(opts.json)) {
        logger.json({ action: 'ci-doctor', ...res })
        return
      }
      logger.section('CI Doctor')
      logger.info(`Node: ${res.node.version} (${res.node.platform}/${res.node.arch})`)
      logger.info(`pnpm: ${res.pnpm.detected ? res.pnpm.version : 'not detected'} (corepack=${res.pnpm.viaCorepack})`)
      logger.info(`Flags: FORCE_CI=${res.env.OPD_FORCE_CI} NDJSON=${res.env.OPD_NDJSON} JSON=${res.env.OPD_JSON} TEST_NO_SPAWN=${res.env.OPD_TEST_NO_SPAWN} PROVIDER_MODE=${String(res.env.OPD_PROVIDER_MODE)}`)
      logger.section('Summary Grade')
      logger.info(`Grade: ${res.grade.level}`)
      if (res.grade.mustFix.length > 0) {
        logger.section('Must Fix')
        for (const m of res.grade.mustFix) logger.info(`- ${m}`)
      }
      if (res.grade.niceToHave.length > 0) {
        logger.section('Nice to Have')
        for (const m of res.grade.niceToHave) logger.info(`- ${m}`)
      }
      if (res.recommendations.length > 0) {
        logger.section('Recommendations')
        for (const r of res.recommendations) logger.info(`- ${r}`)
      }
      logger.json({ action: 'ci-doctor', ...res })
    })
}
