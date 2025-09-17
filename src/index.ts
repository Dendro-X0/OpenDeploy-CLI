import { Command } from 'commander'
import { registerDetectCommand } from './commands/detect'
import { registerDoctorCommand } from './commands/doctor'
import { registerGenerateCommand } from './commands/generate'
import { registerDeployCommand } from './commands/deploy'
import { registerEnvCommand } from './commands/env'
import { registerSeedCommand } from './commands/seed'
import { logger } from './utils/logger'
import { setColorMode, type ColorMode } from './utils/colors'
import { registerRunCommand } from './commands/run'
import { registerInitCommand } from './commands/init'
import { registerCompletionCommand } from './commands/completion'

const VERSION: string = '0.1.0'

function main(): void {
  const program: Command = new Command()
  program.name('opendeploy')
  program.description('OpenDeploy CLI — Next.js-first, cross-provider deployment assistant')
  program.version(VERSION)
  // Global options (parsed by Commander, but we set verbosity pre-parse for early logs as well)
  program.option('--verbose', 'Verbose output')
  program.option('--json', 'JSON-only output (suppresses non-JSON logs)')
  program.option('--quiet', 'Error-only output (suppresses info/warn/success)')
  program.option('--no-emoji', 'Disable emoji prefixes for logs')
  program.option('--compact-json', 'Compact JSON (one line)')
  program.option('--ndjson', 'Newline-delimited JSON streaming (implies --json)')
  program.option('--timestamps', 'Prefix human logs and JSON with ISO timestamps')
  program.option('--summary-only', 'Only print final JSON summary objects (objects with { final: true })')
  program.option('--color <mode>', 'Color mode: auto|always|never', 'auto')
  program.option('--json-file [path]', 'Also write JSON output lines to file (appends)')
  program.option('--ndjson-file [path]', 'Also write NDJSON output lines to file (appends)')
  program.option('--gha-annotations <mode>', 'GitHub annotations: error|warning|off', 'warning')
  // Pre-parse lightweight check to set verbose level for early output
  if (process.argv.includes('--verbose')) {
    logger.setLevel('debug')
    process.env.OPD_VERBOSE = '1'
  }
  if (process.argv.includes('--json')) {
    logger.setJsonOnly(true)
    process.env.OPD_JSON = '1'
  }
  if (process.argv.includes('--quiet')) {
    logger.setLevel('error')
    process.env.OPD_QUIET = '1'
  }
  if (process.argv.includes('--no-emoji')) {
    logger.setNoEmoji(true)
    process.env.OPD_NO_EMOJI = '1'
  }
  if (process.argv.includes('--compact-json')) {
    logger.setJsonCompact(true)
    process.env.OPD_JSON_COMPACT = '1'
  }
  if (process.argv.includes('--ndjson')) {
    logger.setNdjson(true)
    process.env.OPD_NDJSON = '1'
  }
  if (process.argv.includes('--timestamps')) {
    logger.setTimestamps(true)
    process.env.OPD_TS = '1'
  }
  if (process.argv.includes('--summary-only')) {
    logger.setSummaryOnly(true)
    process.env.OPD_SUMMARY = '1'
  }
  // Parse json-file and ndjson-file
  const jsonFileIx = process.argv.findIndex((a) => a === '--json-file')
  if (jsonFileIx !== -1) {
    let p = process.argv[jsonFileIx + 1]
    if (!p || p.startsWith('-')) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      p = `./.artifacts/opendeploy-${ts}.json`
    }
    logger.setJsonFile(p)
    process.env.OPD_JSON_FILE = p
  }
  const ndjsonFileIx = process.argv.findIndex((a) => a === '--ndjson-file')
  if (ndjsonFileIx !== -1) {
    let p = process.argv[ndjsonFileIx + 1]
    if (!p || p.startsWith('-')) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      p = `./.artifacts/opendeploy-${ts}.ndjson`
    }
    logger.setNdjsonFile(p)
    process.env.OPD_NDJSON_FILE = p
  }
  // Parse GitHub annotations mode
  const ghaIx = process.argv.findIndex((a) => a === '--gha-annotations')
  if (ghaIx !== -1 && process.argv[ghaIx + 1]) {
    const mode = process.argv[ghaIx + 1]
    process.env.OPD_GHA_ANN = mode
  }
  // Parse color mode from argv quickly (do not rely on Commander parse yet)
  const colorIx = process.argv.findIndex((a) => a === '--color')
  if (colorIx !== -1 && process.argv[colorIx + 1]) {
    const m = process.argv[colorIx + 1] as ColorMode
    setColorMode(m)
    process.env.OPD_COLOR = m
  } else {
    setColorMode('auto')
    process.env.OPD_COLOR = 'auto'
  }
  registerDetectCommand(program)
  registerDoctorCommand(program)
  registerGenerateCommand(program)
  registerDeployCommand(program)
  registerEnvCommand(program)
  registerSeedCommand(program)
  registerRunCommand(program)
  registerInitCommand(program)
  registerCompletionCommand(program)
  program.parseAsync(process.argv)
    .then(() => {})
    .catch((err: unknown) => {
      const message: string = err instanceof Error ? err.message : String(err)
      // Avoid stack by default for cleaner UX; use --verbose for more later
      // eslint-disable-next-line no-console
      console.error(`Error: ${message}`)
      process.exitCode = 1
    })
}

main()
