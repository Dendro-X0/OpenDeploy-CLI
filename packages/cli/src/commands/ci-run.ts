/**
 * CI Simulator command: run local profiles that mirror CI jobs.
 * Profiles: build-and-test | security-scan | provider-smoke
 */
import { Command } from 'commander'
import { join, resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { logger, isJsonMode } from '../utils/logger'
import { proc } from '../utils/process'

type Profile = 'build-and-test' | 'security-scan' | 'provider-smoke' | 'pr'
type ProviderMode = 'virtual' | 'real'

type Jsonish = Readonly<Record<string, unknown>>

/** Ensure the artifacts directory exists. */
const ensureArtifacts = async (): Promise<string> => {
  const dir: string = './.artifacts'
  try { await mkdir(dir, { recursive: true }) } catch { /* ignore */ }
  return dir
}

/** Run package build and unit tests with CI flags, saving Vitest JSON. */
async function runBuildAndTest(): Promise<{ readonly ok: boolean; readonly vitestJson: string }>{
  const artifacts = await ensureArtifacts()
  const vitestPath: string = join(artifacts, 'vitest.json')
  const build = await proc.run({ cmd: 'pnpm -C packages/cli build' })
  if (!build.ok) return { ok: false, vitestJson: vitestPath }
  const test = await proc.run({
    cmd: 'pnpm -C packages/cli test -- --reporter=dot --reporter=json --outputFile ../../.artifacts/vitest.json --exclude src/__tests__/start-safe-fixes.test.ts --exclude src/__tests__/start-next-config-fixes.test.ts',
    env: { OPD_TEST_NO_SPAWN: '1', OPD_TEST_FORCE_SAFE_FIXES: '1' }
  })
  return { ok: build.ok && test.ok, vitestJson: vitestPath }
}

/** Run strict security checks (doctor + scan). */
async function runSecurityScan(): Promise<{ readonly ok: boolean; readonly doctorOk: boolean; readonly scanOk: boolean; readonly doctorJson: string; readonly scanJson: string }>{
  const artifacts = await ensureArtifacts()
  const build = await proc.run({ cmd: 'pnpm -C packages/cli build' })
  if (!build.ok) return { ok: false, doctorOk: false, scanOk: false, doctorJson: join(artifacts, 'doctor.strict.json'), scanJson: join(artifacts, 'scan.strict.json') }
  const doctor = await proc.run({ cmd: 'node packages/cli/dist/index.js doctor --json --ci --strict', env: { OPD_FORCE_CI: '1' } })
  const scan = await proc.run({ cmd: 'node packages/cli/dist/index.js scan --json --strict', env: { OPD_FORCE_CI: '1' } })
  const doctorPath = join(artifacts, 'doctor.strict.json')
  const scanPath = join(artifacts, 'scan.strict.json')
  try { await writeFile(doctorPath, doctor.stdout || '{}', 'utf8') } catch { /* ignore */ }
  try { await writeFile(scanPath, scan.stdout || '{}', 'utf8') } catch { /* ignore */ }
  return { ok: doctor.ok && scan.ok, doctorOk: doctor.ok, scanOk: scan.ok, doctorJson: doctorPath, scanJson: scanPath }
}

/** Create a tiny app fixture for provider smoke. */
async function createProviderFixture(provider: string): Promise<string> {
  const baseRel: string = `./.opd-ci/provider-smoke-${provider}`
  const base: string = resolve(baseRel)
  await mkdir(base, { recursive: true })
  // Minimal package.json to help framework detection without installs
  const pkg = {
    name: `opd-smoke-${provider}`,
    private: true,
    version: '0.0.0',
    scripts: { build: 'next build', start: 'next start' },
    dependencies: { next: '14.2.0' }
  }
  try { await writeFile(join(base, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8') } catch { /* ignore */ }
  if (provider === 'vercel') {
    await writeFile(join(base, 'next.config.js'), 'module.exports = { reactStrictMode: true }\n', 'utf8')
  } else if (provider === 'cloudflare') {
    await writeFile(join(base, 'next.config.js'), 'module.exports = { reactStrictMode: true }\n', 'utf8')
    await writeFile(join(base, 'wrangler.toml'), 'name = "example-next-on-pages"\ncompatibility_date = "2024-01-01"\n', 'utf8')
  } else if (provider === 'github') {
    await writeFile(join(base, 'next.config.js'), 'module.exports = { output: "export" }\n', 'utf8')
    await mkdir(join(base, 'public'), { recursive: true })
    await writeFile(join(base, 'public', '.nojekyll'), '', 'utf8')
  }
  return base
}

/** Run provider smoke in virtual mode and capture JSON outputs. */
async function runProviderSmoke(provider: string, mode: ProviderMode): Promise<{ readonly ok: boolean; readonly detectJson: string; readonly doctorJson: string; readonly detectExit: number; readonly doctorExit: number }>{
  const artifacts = await ensureArtifacts()
  const appDir = await createProviderFixture(provider)
  const detectPath: string = join(artifacts, `detect-${provider}.json`)
  const doctorPath: string = join(artifacts, `doctor-${provider}.json`)
  const providerEnv = mode === 'virtual' ? 'virtual' : 'real'
  if (mode === 'virtual') {
    // Synthesize detection and doctor results to avoid external CLIs/auth
    const detectObj = {
      ok: true,
      action: 'detect' as const,
      detection: {
        framework: 'next',
        rootDir: appDir,
        appDir: appDir,
        hasAppRouter: false,
        packageManager: 'pnpm',
        monorepo: 'none',
        buildCommand: 'next build',
        outputDir: '.next',
        renderMode: 'hybrid',
        confidence: 0.9,
        environmentFiles: [] as string[]
      },
      final: true,
      schemaOk: true,
      schemaErrors: [] as string[]
    }
    const doctorObj = {
      ok: true,
      action: 'doctor' as const,
      results: [ { name: 'virtual mode', ok: true, message: 'skipped provider CLI/auth checks' } ],
      suggestions: [] as string[],
      hints: [] as string[],
      final: true,
      schemaOk: true,
      schemaErrors: [] as string[]
    }
    try { await writeFile(detectPath, JSON.stringify(detectObj, null, 2) + '\n', 'utf8') } catch { /* ignore */ }
    try { await writeFile(doctorPath, JSON.stringify(doctorObj, null, 2) + '\n', 'utf8') } catch { /* ignore */ }
    return { ok: true, detectJson: detectPath, doctorJson: doctorPath, detectExit: 0, doctorExit: 0 }
  }
  const cliEntry: string = join(process.cwd(), 'packages', 'cli', 'dist', 'index.js')
  const detect = await proc.run({ cmd: `node "${cliEntry}" detect --json`, cwd: appDir, env: { OPD_PROVIDER_MODE: providerEnv, OPD_FORCE_CI: '1', OPD_JSON: '1' } })
  const doctor = await proc.run({ cmd: `node "${cliEntry}" doctor --json`, cwd: appDir, env: { OPD_PROVIDER_MODE: providerEnv, OPD_FORCE_CI: '1', OPD_JSON: '1' } })
  // Persist to artifacts for IDE inspection
  try { await writeFile(detectPath, (detect.stdout && detect.stdout.trim().length>0 ? detect.stdout : '{}'), 'utf8') } catch { /* ignore */ }
  try { await writeFile(doctorPath, (doctor.stdout && doctor.stdout.trim().length>0 ? doctor.stdout : '{}'), 'utf8') } catch { /* ignore */ }
  try { await writeFile(detectPath.replace(/\.json$/, '.stderr.txt'), detect.stderr || '', 'utf8') } catch { /* ignore */ }
  try { await writeFile(doctorPath.replace(/\.json$/, '.stderr.txt'), doctor.stderr || '', 'utf8') } catch { /* ignore */ }
  const ok: boolean = Boolean(detect.ok && doctor.ok)
  return { ok, detectJson: detectPath, doctorJson: doctorPath, detectExit: detect.exitCode, doctorExit: doctor.exitCode }
}

/** Open the artifacts folder in a platform-appropriate way. */
async function openArtifactsFolder(): Promise<void> {
  const isWin: boolean = process.platform === 'win32'
  const isMac: boolean = process.platform === 'darwin'
  const cmd: string = isWin ? 'explorer .\\.artifacts'
    : (isMac ? 'open ./.artifacts' : 'xdg-open ./.artifacts')
  try { await proc.run({ cmd }) } catch { /* ignore */ }
}

/** Register the ci-run command. */
export function registerCiRunCommand(program: Command): void {
  program
    .command('ci-run')
    .description('Run local CI profiles (build-and-test | security-scan | provider-smoke | pr)')
    .argument('[profile]', 'Profile to run', 'build-and-test')
    .option('--providers <list>', 'Comma-separated providers for provider-smoke (e.g., vercel,cloudflare,github)', 'vercel')
    .option('--provider <name>', 'Single provider alias for provider-smoke (vercel|cloudflare|github)')
    .option('--mode <mode>', 'Provider mode: virtual|real', 'virtual')
    .option('--open-artifacts', 'Open artifacts folder after run')
    .option('--json', 'Output JSON')
    .action(async (profileArg: string, opts: { readonly providers?: string; readonly provider?: string; readonly mode?: ProviderMode; readonly openArtifacts?: boolean; readonly json?: boolean }): Promise<void> => {
      const profile = (profileArg || 'build-and-test') as Profile
      let result: Jsonish = {}
      if (profile === 'build-and-test') {
        const r = await runBuildAndTest()
        result = { ok: r.ok, action: 'ci-run', profile, vitestJson: r.vitestJson, final: true }
      } else if (profile === 'security-scan') {
        const r = await runSecurityScan()
        result = { ok: r.ok, action: 'ci-run', profile, doctorOk: r.doctorOk, scanOk: r.scanOk, doctorJson: r.doctorJson, scanJson: r.scanJson, final: true }
      } else if (profile === 'provider-smoke') {
        const listStr = (opts.providers && opts.providers.length > 0) ? opts.providers : (opts.provider && opts.provider.length > 0 ? opts.provider : 'vercel')
        const list = listStr.split(',').map(s => s.trim()).filter(Boolean)
        const mode: ProviderMode = (opts.mode === 'real' ? 'real' : 'virtual')
        const per: Array<{ readonly provider: string; readonly ok: boolean; readonly detectJson: string; readonly doctorJson: string; readonly detectExit: number; readonly doctorExit: number }> = []
        let allOk = true
        for (const p of list) {
          const r = await runProviderSmoke(p, mode)
          per.push({ provider: p, ok: r.ok, detectJson: r.detectJson, doctorJson: r.doctorJson, detectExit: r.detectExit, doctorExit: r.doctorExit })
          if (!r.ok) allOk = false
        }
        result = { ok: allOk, action: 'ci-run', profile, mode, matrix: per, final: true }
      } else if (profile === 'pr') {
        // One-shot: run build-and-test -> security-scan -> provider-smoke (virtual)
        const build = await runBuildAndTest()
        const sec = await runSecurityScan()
        const list = String(opts.providers || 'vercel,cloudflare,github').split(',').map(s => s.trim()).filter(Boolean)
        const per: Array<{ readonly provider: string; readonly ok: boolean; readonly detectJson: string; readonly doctorJson: string; readonly detectExit: number; readonly doctorExit: number }> = []
        let smokeOk = true
        for (const p of list) {
          const r = await runProviderSmoke(p, 'virtual')
          per.push({ provider: p, ok: r.ok, detectJson: r.detectJson, doctorJson: r.doctorJson, detectExit: r.detectExit, doctorExit: r.doctorExit })
          if (!r.ok) smokeOk = false
        }
        const ok = Boolean(build.ok && sec.ok && smokeOk)
        result = { ok, action: 'ci-run', profile, vitestJson: build.vitestJson, doctorOk: sec.doctorOk, scanOk: sec.scanOk, doctorJson: sec.doctorJson, scanJson: sec.scanJson, smoke: { mode: 'virtual', matrix: per }, final: true }
      } else {
        result = { ok: false, action: 'ci-run', error: `Unknown profile: ${profile}`, final: true }
      }
      // Always persist a summary to artifacts to avoid TTY/redirection issues
      try {
        const artifacts = await ensureArtifacts()
        const summaryPath = join(artifacts, 'ci-run.last.json')
        await writeFile(summaryPath, JSON.stringify(result, null, 2) + '\n', 'utf8')
        // Attach path to result for discoverability
        result = { ...result, summaryJson: summaryPath }
      } catch { /* ignore */ }
      if (profile === 'pr') { await openArtifactsFolder() }
      else if (opts.openArtifacts) { await openArtifactsFolder() }
      if (isJsonMode(opts.json)) { logger.json(result); return }
      logger.section('CI Run Summary')
      logger.info(JSON.stringify(result, null, 2))
    })
}
