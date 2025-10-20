import { Command } from 'commander'
import { registerDetectCommand } from './commands/detect'
import { registerDoctorCommand } from './commands/doctor'
import { registerGenerateCommand } from './commands/generate'
import { registerDeployCommand, registerAliasCommand } from './commands/deploy'
import { registerEnvCommand } from './commands/env'
import { registerSeedCommand } from './commands/seed'
import { logger } from './utils/logger'
import { setColorMode, type ColorMode } from './utils/colors'
import { registerRunCommand } from './commands/run'
import { registerInitCommand } from './commands/init'
import { registerCompletionCommand } from './commands/completion'
import { registerPromoteCommand } from './commands/promote'
import { registerExplainCommand } from './commands/explain'
import { registerRollbackCommand } from './commands/rollback'
import { registerProvidersCommand } from './commands/providers'
import { registerPlanCommand } from './commands/plan'
import { registerUpCommand } from './commands/up'
import { registerStartCommand } from './commands/start'
import { registerTestMatrixCommand } from './commands/test-matrix'
import { computeRedactors } from './utils/redaction'
import { fsx } from './utils/fs'
import { join, resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { registerCiLogsCommand } from './commands/ci-logs'
import { registerScanCommand } from './commands/scan'
import { registerCiDoctorCommand } from './commands/ci-doctor'
import { registerCiRunCommand } from './commands/ci-run'
import { registerNdjsonValidateCommand } from './commands/ndjson-validate'
import { registerCiGenerateCommand } from './commands/ci-generate'
import { registerCiDiffCommand } from './commands/ci-diff'

const VERSION: string = '1.2.0-rc.2'

function main(): void {
  const program: Command = new Command()
  program.name('opendeploy')
  program.description('OpenDeploy CLI — cross-provider deployment assistant for the modern web stack')
  // Expose lowercase -v as a shorthand in addition to default -V
  program.version(VERSION, '-v, --version', 'output the version number')
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
  program.option('--gha', 'GitHub Actions-friendly defaults (implies --json --summary-only --timestamps, sets annotation/file sinks)')
  // Shorthand: run wizard with -s / --start
  if (process.argv.includes('-s') || process.argv.includes('--start')) {
    const ix = process.argv.findIndex((a) => a === '-s' || a === '--start')
    if (ix !== -1) process.argv.splice(ix, 1)
    // inject 'start' as the first subcommand argument position
    if (!process.argv.slice(2).includes('start')) process.argv.splice(2, 0, 'start')
  }
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
  // GitHub Actions convenience
  if (process.argv.includes('--gha')) {
    // JSON summary with timestamps
    logger.setJsonOnly(true); process.env.OPD_JSON = '1'
    logger.setSummaryOnly(true); process.env.OPD_SUMMARY = '1'
    logger.setTimestamps(true); process.env.OPD_TS = '1'
    // Default files if none provided
    if (!process.env.OPD_JSON_FILE) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const p = `./.artifacts/opendeploy-${ts}.json`
      logger.setJsonFile(p); process.env.OPD_JSON_FILE = p
    }
    if (!process.env.OPD_NDJSON_FILE) {
      const ts2 = new Date().toISOString().replace(/[:.]/g, '-')
      const p2 = `./.artifacts/opendeploy-${ts2}.ndjson`
      logger.setNdjsonFile(p2); process.env.OPD_NDJSON_FILE = p2
    }
    if (!process.env.OPD_GHA_ANN) process.env.OPD_GHA_ANN = 'warning'
    process.env.OPD_GHA = '1'
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
  } else if (process.env.OPD_JSON_FILE) {
    // Honor env var when flag not provided
    logger.setJsonFile(process.env.OPD_JSON_FILE)
  }
  const ndjsonFileIx = process.argv.findIndex((a) => a === '--ndjson-file')
  if (ndjsonFileIx !== -1) {
    let p = process.argv[ndjsonFileIx + 1]
    if (!p || p.startsWith('-')) {
      const ts2 = new Date().toISOString().replace(/[:.]/g, '-')
      p = `./.artifacts/opendeploy-${ts2}.ndjson`
    }
    logger.setNdjsonFile(p)
    process.env.OPD_NDJSON_FILE = p
  } else if (process.env.OPD_NDJSON_FILE) {
    logger.setNdjsonFile(process.env.OPD_NDJSON_FILE)
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
  // Initialize redaction patterns from local env files and process.env (best-effort, non-blocking)
  const isCI: boolean = process.env.CI === 'true' || process.env.CI === '1' || process.env.GITHUB_ACTIONS === 'true' || process.env.OPD_FORCE_CI === '1'
  if (isCI) process.env.OPD_FORCED_REDACT = '1'
  if (isCI || process.env.OPD_NO_REDACT !== '1') {
    void computeRedactors({ cwd: process.cwd(), envFiles: ['.env', '.env.local', '.env.production.local'], includeProcessEnv: true })
      .then((patterns) => { if (Array.isArray(patterns) && patterns.length > 0) logger.setRedactors(patterns) })
      .catch(() => { /* ignore redactor init errors */ })
  }
  // In CI, reject project-local cache dir configuration by disabling cache
  void (async () => {
    try {
      if (!isCI) return
      const cwd = process.cwd()
      const cacheDirEnv: string | undefined = process.env.OPD_CACHE_DIR
      if (cacheDirEnv) {
        const c = resolve(cacheDirEnv).replace(/\\/g,'/')
        const p = resolve(cwd).replace(/\\/g,'/')
        const inProject: boolean = c.startsWith(p.endsWith('/') ? p : p + '/')
        if (inProject) {
          process.env.OPD_DISABLE_CACHE = '1'
          const isJson = process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1'
          if (!isJson) logger.warn('CI: OPD_CACHE_DIR points inside project; caching disabled')
        }
      }
    } catch { /* ignore */ }
  })()
  // Tiny security banner (human mode only) — warns on risky conditions with concise suggestions
  void (async () => {
    try {
      const isJson: boolean = process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1'
      if (isJson) return
      const cwd: string = process.cwd()
      const cacheDirEnv: string | undefined = process.env.OPD_CACHE_DIR
      const cacheDisabled: boolean = process.env.OPD_DISABLE_CACHE === '1' || process.env.OPD_SAFE_MODE === '1' || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
      const redactionEnabled: boolean = process.env.OPD_NO_REDACT !== '1'
      const stateInProject: boolean = process.env.OPD_STATE_IN_PROJECT === '1'
      const legacyCache: boolean = await fsx.exists(join(cwd, '.opendeploy', 'cache.json'))
      let gitignoreHasOpd: boolean = false
      try { const buf = await readFile(join(cwd, '.gitignore'), 'utf8'); gitignoreHasOpd = /(\n|^)\.opendeploy\/(\s|$)/.test(buf) } catch { /* ignore */ }
      let cacheDirRisk: boolean = false
      try { if (cacheDirEnv) { const c = resolve(cacheDirEnv).replace(/\\/g,'/'); const p = resolve(cwd).replace(/\\/g,'/'); cacheDirRisk = c.startsWith(p.endsWith('/') ? p : p + '/') } } catch { /* ignore */ }
      const risks: string[] = []
      if (!cacheDisabled && cacheDirRisk) risks.push('cache=project-path')
      if (!redactionEnabled) risks.push('redaction=off')
      if (stateInProject) risks.push('state=project')
      if (legacyCache) risks.push('legacy-cache')
      if (!gitignoreHasOpd) risks.push('gitignore-missing')
      if (risks.length > 0) {
        const tips: string[] = []
        if (!cacheDisabled) tips.push('set OPD_SAFE_MODE=1 or OPD_DISABLE_CACHE=1')
        if (cacheDirRisk) tips.push('move OPD_CACHE_DIR outside project')
        if (!redactionEnabled) tips.push('avoid OPD_NO_REDACT=1')
        if (stateInProject) tips.push('unset OPD_STATE_IN_PROJECT')
        if (!gitignoreHasOpd) tips.push('add .opendeploy/ to .gitignore')
        logger.note(`Security: risks=[${risks.join(', ')}]; tips=[${tips.join('; ')}]`)
      }
    } catch { /* ignore banner errors */ }
  })()
  registerDetectCommand(program)
  registerDoctorCommand(program)
  registerGenerateCommand(program)
  registerDeployCommand(program)
  registerEnvCommand(program)
  registerSeedCommand(program)
  registerRunCommand(program)
  registerInitCommand(program)
  registerCompletionCommand(program)
  registerPromoteCommand(program)
  registerExplainCommand(program)
  registerRollbackCommand(program)
  registerProvidersCommand(program)
  registerPlanCommand(program)
  registerUpCommand(program)
  registerStartCommand(program)
  registerCiLogsCommand(program)
  registerScanCommand(program)
  registerAliasCommand(program)
  registerTestMatrixCommand(program)
  registerCiDoctorCommand(program)
  registerCiRunCommand(program)
  registerNdjsonValidateCommand(program)
  registerCiGenerateCommand(program)
  registerCiDiffCommand(program)
  program.parseAsync(process.argv)
    .then(() => {})
    .catch((err: unknown) => {
      const message: string = err instanceof Error ? err.message : String(err)
      const isJson = process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1'
      const alreadyHandled = process.env.OPD_HANDLED === '1'
      if (isJson) {
        if (!alreadyHandled) {
          logger.jsonPrint({ ok: false, action: 'error', message, final: true })
        }
        process.exit(1)
      } else {
        // Avoid stack by default for cleaner UX; use --verbose for more later
        // eslint-disable-next-line no-console
        console.error(`Error: ${message}`)
        process.exit(1)
      }
    })
}

main()
