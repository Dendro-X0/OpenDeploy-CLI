/**
 * CI Doctor utility: inspects local environment and provides recommendations
 * to reproduce GitHub Actions CI runs locally with the same flags and tooling.
 *
 * The goal is to eliminate tag/PR churn by validating versions, flags,
 * and common pitfalls up-front. Output is JSON-friendly and stable.
 */

import { proc } from '../utils/process'

/** Read-only result shape for CI Doctor. */
export interface CiDoctorResult {
  readonly ok: boolean
  readonly node: {
    readonly version: string
    readonly platform: NodeJS.Platform
    readonly arch: string
  }
  readonly pnpm: {
    readonly detected: boolean
    readonly version: string
    readonly viaCorepack: boolean
  }
  readonly env: {
    readonly OPD_FORCE_CI: boolean
    readonly OPD_NDJSON: boolean
    readonly OPD_JSON: boolean
    readonly OPD_TEST_NO_SPAWN: boolean
    readonly OPD_PROVIDER_MODE: string | null
  }
  readonly recommendations: readonly string[]
  readonly grade: {
    readonly level: 'A' | 'B' | 'C' | 'D'
    readonly mustFix: readonly string[]
    readonly niceToHave: readonly string[]
  }
  readonly final: true
}

/**
 * Execute a command and return stdout trimmed, or an empty string.
 */
async function safeCmd(cmd: string): Promise<{ readonly ok: boolean; readonly stdout: string }>{
  try {
    const r = await proc.run({ cmd })
    if (!r.ok) return { ok: false, stdout: '' }
    return { ok: true, stdout: r.stdout.trim() }
  } catch {
    return { ok: false, stdout: '' }
  }
}

/**
 * Determine whether pnpm appears to come from Corepack.
 * This is a heuristic: we check `corepack --version` availability and prefer Corepack usage.
 */
async function detectCorepackPnpm(): Promise<boolean> {
  const c = await safeCmd('corepack --version')
  if (!c.ok) return false
  // If corepack is available, prefer it. This is a hint, not a guarantee.
  return true
}

/**
 * Perform CI Doctor checks and return a structured summary.
 */
export async function ciDoctor(): Promise<CiDoctorResult> {
  const nodeVersion: string = process.version
  const platform: NodeJS.Platform = process.platform
  const arch: string = process.arch

  const pnpmRes = await safeCmd('pnpm -v')
  const pnpmDetected: boolean = pnpmRes.ok && pnpmRes.stdout.length > 0
  const pnpmVersion: string = pnpmDetected ? pnpmRes.stdout : ''
  const viaCorepack: boolean = await detectCorepackPnpm()

  const envFlags = {
    OPD_FORCE_CI: process.env.OPD_FORCE_CI === '1',
    OPD_NDJSON: process.env.OPD_NDJSON === '1',
    OPD_JSON: process.env.OPD_JSON === '1',
    OPD_TEST_NO_SPAWN: process.env.OPD_TEST_NO_SPAWN === '1',
    OPD_PROVIDER_MODE: process.env.OPD_PROVIDER_MODE ?? null
  }

  const recs: string[] = []
  const mustFix: string[] = []
  const niceToHave: string[] = []

  // Node recommendation
  if (!/^v(18|19|20|21)\./.test(nodeVersion)) {
    const m = 'Use Node 20.x on CI and locally for parity (actions/setup-node@v4).'
    recs.push(m); mustFix.push(m)
  }

  // pnpm recommendation
  if (!pnpmDetected) {
    const m = 'Install pnpm (prefer pnpm/action-setup@v4 in CI).'
    recs.push(m); mustFix.push(m)
  }

  // Corepack guidance (optional)
  if (pnpmDetected && !viaCorepack) {
    const m = 'Enable Corepack or explicitly set pnpm with pnpm/action-setup@v4 for reproducibility.'
    recs.push(m); niceToHave.push(m)
  }

  // OPD flags recommended for PR-like runs
  if (envFlags.OPD_PROVIDER_MODE !== 'virtual') {
    const m = 'Set OPD_PROVIDER_MODE=virtual for PR-style runs to avoid real provider flakiness.'
    recs.push(m); mustFix.push(m)
  }
  if (!envFlags.OPD_FORCE_CI) {
    const m = 'Set OPD_FORCE_CI=1 to enforce non-interactive provider CLIs and stable outputs.'
    recs.push(m); mustFix.push(m)
  }
  if (!envFlags.OPD_TEST_NO_SPAWN) {
    const m = 'Set OPD_TEST_NO_SPAWN=1 to avoid external process flakiness in unit tests.'
    recs.push(m); niceToHave.push(m)
  }

  // NDJSON/JSON guidance
  if (!envFlags.OPD_NDJSON && !envFlags.OPD_JSON) {
    const m = 'Use --ndjson (or OPD_NDJSON=1) when consuming streamed events in CI to simplify parsing.'
    recs.push(m); niceToHave.push(m)
  }

  const ok: boolean = pnpmDetected && /^v(18|19|20|21)\./.test(nodeVersion)
  // Grade calculation: A = no must-fix; B = 1 must-fix; C = 2+ must-fix; D = critical missing (pnpm or wrong Node)
  let level: 'A' | 'B' | 'C' | 'D' = 'A'
  const critical = (!pnpmDetected) || (!/^v(18|19|20|21)\./.test(nodeVersion))
  if (critical) level = 'D'
  else if (mustFix.length >= 2) level = 'C'
  else if (mustFix.length === 1) level = 'B'

  return {
    ok,
    node: { version: nodeVersion, platform, arch },
    pnpm: { detected: pnpmDetected, version: pnpmVersion, viaCorepack },
    env: envFlags,
    recommendations: recs,
    grade: { level, mustFix, niceToHave },
    final: true
  }
}
