import { Command } from 'commander'
import { join, isAbsolute } from 'node:path'
import { logger, isJsonMode } from '../utils/logger'
import { envSync } from './env'
import { proc, runWithTimeout } from '../utils/process'
import { spinner } from '../utils/ui'
import { computeRedactors } from '../utils/redaction'
import { extractVercelInspectUrl } from '../utils/inspect'
import { detectNextApp } from '../core/detectors/next'
import { detectAstroApp } from '../core/detectors/astro'
import { detectSvelteKitApp } from '../core/detectors/sveltekit'
import { detectRemixApp } from '../core/detectors/remix'
import { detectNuxtApp } from '../core/detectors/nuxt'
import { detectExpoApp } from '../core/detectors/expo'
import { detectApp as autoDetect, detectCandidates as detectMarks } from '../core/detectors/auto'
import { fsx } from '../utils/fs'
import clipboard from 'clipboardy'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import type { DetectionResult } from '../types/detection-result'
import type { Framework } from '../types/framework'
// writeFile moved into fs/promises import above
import { loadProvider } from '../core/provider-system/provider'

// NOTE: This scaffold uses @clack/prompts for a friendly wizard UX.
// Make sure to add it as a dependency: pnpm add @clack/prompts
import { intro, outro, select, confirm as clackConfirm, isCancel, cancel, note } from '@clack/prompts'

type Provider = 'vercel' | 'netlify'

export interface StartOptions {
  readonly framework?: Framework
  readonly provider?: Provider
  readonly env?: 'prod' | 'preview'
  readonly path?: string
  readonly project?: string
  readonly org?: string
  readonly syncEnv?: boolean
  readonly json?: boolean
  readonly ci?: boolean
  readonly dryRun?: boolean
  readonly saveDefaults?: boolean
  readonly printCmd?: boolean
  readonly deploy?: boolean
  readonly noBuild?: boolean
  readonly alias?: string
  readonly skipAuthCheck?: boolean
  readonly assumeLoggedIn?: boolean
  readonly skipPreflight?: boolean
  readonly softFail?: boolean
  readonly capture?: boolean
  readonly showLogs?: boolean
  readonly summaryOnly?: boolean
  readonly timeout?: number | string
  readonly idleTimeout?: number | string
  readonly debugDetect?: boolean
  readonly generateConfigOnly?: boolean
}

// Read Netlify site id from .netlify/state.json (returns undefined if missing)
async function readNetlifySiteId(cwd: string): Promise<string | undefined> {
  try {
    const p = join(cwd, '.netlify', 'state.json')
    const raw = await readFile(p, 'utf8')
    const js = JSON.parse(raw) as { siteId?: string }
    const rawId = js?.siteId
    const isValid = typeof rawId === 'string' && /^[a-f0-9-]{10,}$/i.test(rawId) && rawId !== 'undefined' && rawId !== 'null'
    const id = isValid ? rawId : undefined
    return id
  } catch { return undefined }
}

async function scanMonorepoCandidates(root: string): Promise<Array<{ readonly path: string; readonly framework: Framework }>> {
  const buckets: readonly string[] = ['apps', 'packages', 'examples', 'sites', 'services']
  const candidates: Array<{ path: string; framework: Framework }> = []
  const fromWorkspaces: string[] = await readWorkspaceGlobs(root)
  const pushIfDetected = async (dir: string): Promise<void> => {
    try {
      const pkg = await fsx.exists(join(dir, 'package.json'))
      if (!pkg) return
      try {
        const res = await autoDetect({ cwd: dir })
        const fw = (res.framework as Framework | undefined)
        if (fw) candidates.push({ path: dir, framework: fw })
      } catch { /* skip */ }
    } catch { /* skip */ }
  }
  // Expand workspace globs first
  for (const pat of fromWorkspaces) {
    for (const dir of await expandWorkspacePattern(root, pat)) {
      await pushIfDetected(dir)
    }
  }
  for (const b of buckets) {
    try {
      const base = join(root, b)
      if (!(await fsx.exists(base))) continue
      const names = await readdir(base)
      for (const name of names) { await pushIfDetected(join(base, name)) }
    } catch { /* ignore */ }
  }
  // Also consider immediate subdirs at root
  try {
    const names = await readdir(root)
    for (const name of names) { await pushIfDetected(join(root, name)) }
  } catch { /* ignore */ }
  // De-duplicate by path
  const seen = new Set<string>()
  const out: Array<{ path: string; framework: Framework }> = []
  for (const c of candidates) { if (!seen.has(c.path)) { seen.add(c.path); out.push(c) } }
  return out.slice(0, 50)
}

async function readWorkspaceGlobs(root: string): Promise<string[]> {
  const globs: string[] = []
  // package.json workspaces
  try {
    const pkg = await fsx.readJson<Record<string, unknown>>(join(root, 'package.json'))
    const ws = (pkg as any)?.workspaces
    if (Array.isArray(ws)) {
      for (const s of ws) if (typeof s === 'string') globs.push(s)
    } else if (ws && typeof ws === 'object' && Array.isArray((ws as any).packages)) {
      for (const s of (ws as any).packages) if (typeof s === 'string') globs.push(s)
    }
  } catch { /* ignore */ }
  // pnpm-workspace.yaml
  try {
    const y = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8')
    const lines = y.split(/\r?\n/)
    let inPk = false
    for (const raw of lines) {
      const line = raw.trim()
      if (/^packages\s*:\s*$/.test(line)) { inPk = true; continue }
      if (inPk) {
        if (/^[A-Za-z0-9_-]+\s*:/.test(line)) { inPk = false; continue }
        const m = /^-\s*["']?([^"']+)["']?\s*$/.exec(line)
        if (m && m[1]) globs.push(m[1])
      }
    }
  } catch { /* ignore */ }
  // turbo.json: heuristically extract folder globs from pipeline inputs/outputs
  try {
    const tj = await fsx.readJson<Record<string, unknown>>(join(root, 'turbo.json'))
    const pipeline = (tj as any)?.pipeline
    const found: string[] = []
    const addMaybe = (s: unknown): void => {
      if (typeof s !== 'string') return
      // look for patterns like apps/*, packages/*, sites/*, services/*
      const m = /(apps|packages|examples|sites|services)\/[\*\w-]+/g
      const ms = s.match(m)
      if (ms) { for (const v of ms) found.push(v) }
    }
    if (pipeline && typeof pipeline === 'object') {
      for (const key of Object.keys(pipeline as Record<string, unknown>)) {
        const t = (pipeline as any)[key]
        if (t && typeof t === 'object') {
          for (const prop of ['inputs', 'outputs', 'globalDependencies']) {
            const arr = (t as any)[prop]
            if (Array.isArray(arr)) for (const v of arr) addMaybe(v)
          }
        }
      }
    }
    for (const v of found) globs.push(v)
  } catch { /* ignore */ }
  return globs
}

async function expandWorkspacePattern(root: string, pattern: string): Promise<string[]> {
  const out: string[] = []
  try {
    const pat = String(pattern).replace(/["']/g, '').trim()
    // Support simplest forms: dir/*, dir/**, dir/
    const star = pat.indexOf('*')
    if (star === -1) {
      const dir = join(root, pat)
      if (await fsx.exists(dir)) out.push(dir)
      return out
    }
    const base = pat.slice(0, star).replace(/[/\\]+$/, '')
    const baseDir = join(root, base)
    if (!(await fsx.exists(baseDir))) return out
    const names = await readdir(baseDir)
    for (const name of names) {
      const p = join(baseDir, name)
      if (await fsx.exists(join(p, 'package.json'))) out.push(p)
    }
  } catch { /* ignore */ }
  return out
}

async function detectForFramework(framework: Framework, cwd: string): Promise<DetectionResult> {
  if (framework === 'next') return await detectNextApp({ cwd })
  if (framework === 'astro') return await detectAstroApp({ cwd })
  if (framework === 'sveltekit') return await detectSvelteKitApp({ cwd })
  if (framework === 'remix') return await detectRemixApp({ cwd })
  if (framework === 'expo') return await detectExpoApp({ cwd })
  if (framework === 'nuxt') return await detectNuxtApp({ cwd })
  throw new Error(`Unsupported framework: ${framework}`)
}

function inferNetlifyPublishDir(args: { readonly framework: Framework; readonly cwd: string }): string {
  const fw = args.framework
  // Heuristics per framework
  if (fw === 'nuxt') return '.output/public'
  if (fw === 'remix') return 'build/client'
  if (fw === 'astro') return 'dist'
  if (fw === 'expo') return 'dist'
  if (fw === 'next') return '.next' // Netlify plugin/runtime handles Next
  if (fw === 'sveltekit') {
    // SvelteKit static usually 'build' (adapter-static);
    // adapter-netlify produces server functions, but for prepare-only we default to 'build'.
    return 'build'
  }
  return 'dist'
}

// Determine the package manager used in the target app directory.
async function detectPackageManager(cwd: string): Promise<string> {
  try {
    const pkgJson = await fsx.readJson<Record<string, unknown>>(join(cwd, 'package.json'))
    const pmField = (pkgJson as any)?.packageManager
    if (typeof pmField === 'string' && pmField.length > 0) return String(pmField).split('@')[0]
  } catch { /* ignore */ }
  try { if (await fsx.exists(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm' } catch { /* ignore */ }
  try { if (await fsx.exists(join(cwd, 'yarn.lock'))) return 'yarn' } catch { /* ignore */ }
  try { if (await fsx.exists(join(cwd, 'bun.lockb'))) return 'bun' } catch { /* ignore */ }
  try { if (await fsx.exists(join(cwd, 'package-lock.json'))) return 'npm' } catch { /* ignore */ }
  return 'npm'
}

// Provide a concise runtime hint for the detected framework.
function runtimeHint(framework: Framework): string {
  if (framework === 'next') return 'Node/Edge (auto)'
  if (framework === 'astro') return 'Static by default; SSR via adapter'
  if (framework === 'sveltekit') return 'Adapter-dependent (Node/Edge/Static)'
  if (framework === 'remix') return 'Node default; adapter varies'
  if (framework === 'nuxt') return 'Node (Nitro)'
  if (framework === 'expo') return 'Static (web)'
  return 'Node'
}

async function countFiles(dir: string): Promise<number> {
  try {
    const items = await readdir(dir)
    return items.length
  } catch { return 0 }
}

function resolvePmBuildCmd(buildCommand: string, pkgMgr: string): string {
  // Prefer package manager build script to avoid invoking framework CLIs directly
  if (/^(pnpm|yarn|npm|bun)\b/.test(buildCommand)) return buildCommand
  if (pkgMgr === 'pnpm') return 'pnpm build'
  if (pkgMgr === 'yarn') return 'yarn build'
  if (pkgMgr === 'bun') return 'bun run build'
  return 'npm run build'
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  const ss = s < 10 ? `0${s}` : String(s)
  return `${m}:${ss}`
}

function truncateEventData(s: string, max = 2000): string {
  try { if (typeof s !== 'string') return '' } catch { return '' }
  return s.length > max ? s.slice(0, max) : s
}

async function runBuildPreflight(args: { readonly detection: DetectionResult; readonly provider: Provider; readonly cwd: string; readonly ci: boolean; readonly skipPreflight?: boolean }): Promise<void> {
  const { detection, provider, cwd, ci, skipPreflight } = args
  if (ci || skipPreflight) return
  const want = await clackConfirm({ message: 'Run a quick local build to validate config?', initialValue: true })
  if (isCancel(want) || want !== true) return
  const phaseText = 'Building'
  const sp = spinner(phaseText)
  try {
    const startAt = Date.now()
    const hb = setInterval(() => { sp.update(`${phaseText} — ${formatElapsed(Date.now() - startAt)}`) }, 1000)
    const detected = String(detection.buildCommand || '').trim()
    const cmd = detected.length > 0 ? detected : resolvePmBuildCmd('build', String((detection.packageManager as unknown)))
    const out = await proc.run({ cmd, cwd })
    if (!out.ok) {
      clearInterval(hb)
      sp.stop()
      const msg = (out.stderr || out.stdout || 'Build failed').trim()
      throw new Error(msg)
    }
    if (provider === 'netlify' && detection.framework !== 'next') {
      const pub = detection.publishDir ?? inferNetlifyPublishDir({ framework: detection.framework as Framework, cwd })
      const full = join(cwd, pub)
      const exists = await fsx.exists(full)
      const files = exists ? await countFiles(full) : 0
      if (!exists || files === 0) {
        clearInterval(hb)
        sp.stop()
        throw new Error(`Publish directory not found or empty: ${pub}. Ensure your build outputs static files there (e.g., adjust adapter or build command).`)
      }
    }
    clearInterval(hb)
    sp.stop()
    note('Build validated', 'Preflight')
    logger.note('Build validated')
    // Also emit a raw console line for tests that capture console.log
    // eslint-disable-next-line no-console
    console.log('Build validated')
  } catch (e) {
    sp.stop()
    const msg = (e as Error).message
    note(msg, 'Preflight')
    logger.note(msg)
  }
}

// Create a Netlify site non-interactively. Returns site ID.
async function createNetlifySite(args: { readonly cwd: string; readonly name: string }): Promise<string> {
  // Helper: normalize names similarly to our slug
  const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '')
  const expected = normalize(args.name)

  // 1) Optional: determine account slug for createSite
  let accountSlug: string | undefined
  const acct = await proc.run({ cmd: 'netlify api listAccountsForUser', cwd: args.cwd })
  if (acct.ok) {
    try {
      const data = JSON.parse(acct.stdout) as Array<{ slug?: string }>
      if (Array.isArray(data) && data.length > 0 && typeof data[0]?.slug === 'string') accountSlug = data[0].slug
    } catch { /* ignore */ }
  }

  // 2) Try API createSite once and parse id robustly
  const payload: Record<string, unknown> = { name: args.name }
  if (accountSlug) payload.account_slug = accountSlug
  const jsonData = JSON.stringify(payload).replace(/"/g, '\\"')
  const createCmd = `netlify api createSite --data "${jsonData}"`
  const createRes = await proc.run({ cmd: createCmd, cwd: args.cwd })
  if (createRes.ok) {
    try {
      const root = JSON.parse(createRes.stdout) as unknown
      const findId = (v: unknown): string | undefined => {
        if (!v) return undefined
        if (typeof v === 'object') {
          if (Array.isArray(v)) { for (const x of v) { const r = findId(x); if (r) return r } }
          else {
            const o = v as Record<string, unknown>
            const direct = (typeof o.id === 'string' && o.id) || (typeof (o as any).site_id === 'string' && (o as any).site_id)
            if (direct) return direct as string
            for (const k of Object.keys(o)) { const r = findId(o[k]); if (r) return r }
          }
        }
        return undefined
      }
      const id = findId(root)
      if (typeof id === 'string' && id.length > 0) return id
    } catch { /* ignore */ }
  }

  // 3) Resolve by listing sites and picking the best name match (Netlify may suffix names)
  const listOnce = async (): Promise<string | undefined> => {
    const ls = await proc.run({ cmd: 'netlify api listSites', cwd: args.cwd })
    if (!ls.ok) return undefined
    try {
      const arr = JSON.parse(ls.stdout) as Array<{ id?: string; name?: string; created_at?: string }>
      const candidates = (arr || []).filter(s => typeof s?.id === 'string' && typeof s?.name === 'string')
      // Prefer exact normalized name, then prefix match with hyphen
      const exact = candidates.filter(s => normalize(s.name!) === expected)
      const pref = candidates.filter(s => normalize(s.name!).startsWith(expected + '-'))
      const pool = exact.length > 0 ? exact : pref
      if (pool.length === 0) return undefined
      pool.sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0))
      return pool[0].id!
    } catch { return undefined }
  }
  const idFromList = await listOnce()
  if (idFromList) return idFromList

  // 4) Last resort: classic sites:create, then resolve by list
  const classicCmd = accountSlug ? `netlify sites:create --name ${args.name} --account-slug ${accountSlug}` : `netlify sites:create --name ${args.name}`
  const classic = await proc.run({ cmd: classicCmd, cwd: args.cwd })
  if (!classic.ok) throw new Error((classic.stderr || classic.stdout || 'Netlify site creation failed').trim())
  // Parse text for an ID if present
  const m = classic.stdout.match(/Site\s+ID\s*:\s*([a-z0-9-]+)/i) || classic.stdout.match(/Site\s+Id\s*:\s*([a-z0-9-]+)/i)
  if (m && m[1]) return m[1]
  const idAfterClassic = await listOnce()
  if (idAfterClassic) return idAfterClassic
  throw new Error('Netlify site created but ID not found (try `netlify sites:list` and `netlify link --id <siteId>`)')
}

// Minimal .env parser: returns keys only
async function parseEnvKeys(filePath: string): Promise<readonly string[]> {
  const buf = await readFile(filePath, 'utf8')
  const keys: string[] = []
  for (const raw of buf.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.length === 0) continue
    if (line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (key.length > 0) keys.push(key)
  }
  return keys
}

/**
 * Try to auto-detect a framework. If none is detected, returns undefined.
 */
async function autoDetectFramework(cwd: string): Promise<Framework | undefined> {
  try { const res = await autoDetect({ cwd }); return res.framework as Framework } catch { return undefined }
}

// use detectMarks from auto.ts

/**
 * Validate provider auth and return short status text for the prompt.
 */
async function providerStatus(p: Provider): Promise<'logged in'|'login required'> {
  try {
    if (p === 'vercel') {
      const res = await runWithTimeout({ cmd: 'vercel whoami' }, 10_000)
      if (res.ok && /\S/.test(res.stdout)) return 'logged in'
      return 'login required'
    }
    if (p === 'netlify') {
      const res = await runWithTimeout({ cmd: 'netlify status' }, 10_000)
      if (res.ok && /Logged in|You are logged in/i.test(res.stdout)) return 'logged in'
      return 'login required'
    }
  } catch { /* fallthrough */ }
  return 'login required'
}

async function ensureProviderAuth(p: Provider, opts: StartOptions): Promise<void> {
  if (opts.skipAuthCheck || opts.assumeLoggedIn) return
  // In CI for Netlify we allow skipping auth checks to enable prepare-only flows
  // and non-interactive deploys when a site id is provided.
  if (opts.ci && p === 'netlify' && !opts.project) return
  if (opts.ci && typeof opts.project === 'string' && opts.project.length > 0) return
  // Validate via provider plugin; if it throws, treat as not logged in.
  const tryValidate = async (): Promise<boolean> => {
    try {
      const plugin = await loadProvider(p)
      await plugin.validateAuth(process.cwd())
      return true
    } catch {
      return false
    }
  }
  const ok: boolean = await tryValidate()
  if (ok) return
  if (opts.ci) throw new Error(`${p} login required`)
  const want = await clackConfirm({ message: `${p === 'vercel' ? 'Vercel' : 'Netlify'} login required. Log in now?`, initialValue: true })
  if (isCancel(want) || want !== true) throw new Error(`${p} login required`)
  const cmd: string = p === 'vercel' ? 'vercel login' : 'netlify login'
  note(`Running: ${cmd}`, 'Auth')
  const res = await proc.run({ cmd })
  if (!res.ok) throw new Error(`${p} login failed`)
  // Re-validate after login
  const ok2 = await tryValidate()
  if (!ok2) throw new Error(`${p} login failed`)
}

/**
 * Deploy using the existing low-level logic (similar to `up`).
 */
async function runDeploy(args: { readonly provider: Provider; readonly env: 'prod' | 'preview'; readonly cwd: string; readonly json: boolean; readonly project?: string; readonly org?: string; readonly printCmd?: boolean; readonly publishDir?: string; readonly noBuild?: boolean; readonly alias?: string; readonly showLogs?: boolean; readonly timeoutSeconds?: number; readonly idleTimeoutSeconds?: number }): Promise<{ readonly url?: string; readonly logsUrl?: string; readonly alias?: string }> {
  const envTarget = args.env
  if (args.provider === 'vercel') {
    // Ensure linked when IDs provided
    if ((args.project || args.org) && !(await fsx.exists(join(args.cwd, '.vercel', 'project.json')))) {
      const flags: string[] = ['--yes']
      if (args.project) flags.push(`--project ${args.project}`)
      if (args.org) flags.push(`--org ${args.org}`)
      const linkCmd = `vercel link ${flags.join(' ')}`
      if (args.printCmd) logger.info(`$ ${linkCmd}`)
      await proc.run({ cmd: linkCmd, cwd: args.cwd })
    }
    const phaseText: string = 'Vercel'
    let statusText: string = `deploying (${envTarget === 'prod' ? 'production' : 'preview'})`
    const sp = spinner(phaseText)
    const startAt = Date.now()
    const hb = setInterval(() => { sp.update(`${phaseText}: ${statusText} — ${formatElapsed(Date.now() - startAt)}`) }, 1000)
    const urlRe = /https?:\/\/[^\s]+vercel\.app/g
    
    let capturedUrl: string | undefined
    let capturedInspect: string | undefined
    let emittedLogsEvent = false
    let lastActivity = Date.now()
    const logTail: string[] = []
    const pushTail = (raw: string): void => {
      const t = raw.replace(/\s+$/, '')
      if (t.length === 0) return
      logTail.push(t)
      if (logTail.length > 50) logTail.shift()
    }
    const emitStatus = (status: string, extra?: Record<string, unknown>): void => {
      statusText = status
      if (process.env.OPD_NDJSON === '1') logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'status', status, ...(extra ?? {}) })
    }
    if (args.printCmd) logger.info(`$ ${envTarget === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes'}`)
    let inspectPoll: NodeJS.Timeout | undefined
    let pnpmHintEmitted = false
    const controller = proc.spawnStream({
      cmd: envTarget === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes',
      cwd: args.cwd,
      onStdout: (chunk: string): void => {
        lastActivity = Date.now()
        const m = chunk.match(urlRe)
        if (!capturedUrl && m && m.length > 0) capturedUrl = m[0]
        if (!pnpmHintEmitted && /Ignored build scripts:/i.test(chunk)) {
          pnpmHintEmitted = true
          const hint = 'pnpm v9 blocked postinstall scripts (e.g., @tailwindcss/oxide, esbuild). Run "pnpm approve-builds" or add { "pnpm": { "trustedDependencies": ["@tailwindcss/oxide","esbuild"] } } to package.json.'
          if ((process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') || args.showLogs === true) logger.warn(hint)
          if (process.env.OPD_NDJSON === '1') logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'hint', kind: 'pnpm-approve-builds', message: hint })
        }
        pushTail(chunk)
        if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1' || args.showLogs === true) {
          const t = chunk.replace(/\s+$/, '')
          if (t.length > 0) logger.info(t)
        }
        if (process.env.OPD_NDJSON === '1') {
          const data = truncateEventData(chunk)
          if (data.length > 0) logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'stdout', data })
        }
      },
      onStderr: (chunk: string): void => {
        lastActivity = Date.now()
        if (!pnpmHintEmitted && /Ignored build scripts:/i.test(chunk)) {
          pnpmHintEmitted = true
          const hint = 'pnpm v9 blocked postinstall scripts (e.g., @tailwindcss/oxide, esbuild). Run "pnpm approve-builds" or add { "pnpm": { "trustedDependencies": ["@tailwindcss/oxide","esbuild"] } } to package.json.'
          if ((process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') || args.showLogs === true) logger.warn(hint)
          if (process.env.OPD_NDJSON === '1') logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'hint', kind: 'pnpm-approve-builds', message: hint })
        }
        pushTail(chunk)
        if (!capturedInspect) {
          const found = extractVercelInspectUrl(chunk)
          if (found) {
            capturedInspect = found
            if (!emittedLogsEvent && process.env.OPD_NDJSON === '1') {
              emittedLogsEvent = true
              logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'logs', logsUrl: capturedInspect })
            }
            // Start best-effort status polling via `vercel inspect`
            if (!inspectPoll) {
              inspectPoll = setInterval(() => {
                ;(async () => {
                  try {
                    const res = await proc.run({ cmd: `vercel inspect ${capturedInspect} --json`, cwd: args.cwd })
                    if (res.ok) {
                      try {
                        const js = JSON.parse(res.stdout) as Record<string, unknown>
                        const state = String((js.readyState ?? js.state ?? js.status ?? '') || '').toUpperCase()
                        if (state) emitStatus(state.toLowerCase())
                        if (state === 'ERROR' || state === 'FAILED') { try { controller.stop() } catch { /* ignore */ } }
                        if (state === 'READY') { try { controller.stop() } catch { /* ignore */ } }
                      } catch { /* ignore */ }
                    }
                  } catch { /* ignore */ }
                })()
              }, 3000)
            }
          }
        }
        const line = chunk.replace(/\s+$/, '')
        if (/\bQueued\b/i.test(line)) emitStatus('queued')
        else if (/\bBuilding\b/i.test(line)) emitStatus('building')
        else if (/\bProduction:|\bReady\b/i.test(line)) emitStatus('ready')
        else if (/^Error:\s/i.test(line)) {
          const msg = line.slice(6).trim()
          emitStatus('error', { message: msg })
          if ((process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') || args.showLogs === true) {
            logger.error(`Error: ${msg}`)
          }
          try { controller.stop() } catch { /* ignore */ }
        }
        if (process.env.OPD_NDJSON === '1') {
          const data = truncateEventData(chunk)
          if (data.length > 0) logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'stderr', data })
        }
      }
    })
    // Idle inactivity watchdog
    let idleFired = false
    const idleCheck = args.idleTimeoutSeconds && args.idleTimeoutSeconds > 0
      ? setInterval(() => {
          if (!idleFired && Date.now() - lastActivity > args.idleTimeoutSeconds! * 1000) {
            idleFired = true
            emitStatus('idle-timeout')
            try { controller.stop() } catch { /* ignore */ }
          }
        }, 2000)
      : undefined
    let timedOut = false
    const res = args.timeoutSeconds && args.timeoutSeconds > 0
      ? await Promise.race([
          controller.done,
          new Promise<{ readonly ok: boolean; readonly exitCode: number }>((resolve) => {
            setTimeout(() => { timedOut = true; try { controller.stop() } catch { /* ignore */ } resolve({ ok: false, exitCode: 124 }) }, args.timeoutSeconds! * 1000)
          })
        ])
      : await controller.done
    clearInterval(hb)
    if (inspectPoll) clearInterval(inspectPoll)
    if (idleCheck) clearInterval(idleCheck)
    sp.stop()
    if (!res.ok) {
      const err = new Error('Vercel deploy failed') as Error & { meta?: Record<string, unknown> }
      err.meta = { provider: 'vercel', reason: timedOut ? `timeout after ${args.timeoutSeconds}s` : (idleFired ? `idle-timeout after ${args.idleTimeoutSeconds}s` : undefined), logsUrl: capturedInspect, url: capturedUrl, errorLogTail: logTail.slice(-20) }
      if (process.env.OPD_NDJSON === '1') {
        logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'done', ok: false, reason: err.meta.reason, url: capturedUrl, logsUrl: capturedInspect })
      }
      throw err
    }
    if (process.env.OPD_NDJSON === '1' && capturedInspect && !emittedLogsEvent) {
      logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'logs', logsUrl: capturedInspect })
    }
    if (process.env.OPD_NDJSON === '1') {
      logger.json({ action: 'start', provider: 'vercel', target: envTarget, event: 'done', ok: true, url: capturedUrl, logsUrl: capturedInspect })
    }
    // Optional aliasing
    let aliased: string | undefined
    if (args.alias && capturedUrl) {
      const aliasCmd = `vercel alias set ${capturedUrl} ${args.alias}`
      if (args.printCmd) logger.info(`$ ${aliasCmd}`)
      const aliasRes = await proc.run({ cmd: aliasCmd, cwd: args.cwd })
      if (aliasRes.ok) aliased = args.alias
    }
    return { url: capturedUrl, logsUrl: capturedInspect, alias: aliased }
  }
  // Netlify
  const phaseText: string = `Netlify: deploying (${envTarget === 'prod' ? 'production' : 'preview'})`
  const sp = spinner(phaseText)
  const siteFlag: string = args.project ? ` --site ${args.project}` : ''
  const dirFlag: string = args.publishDir ? ` --dir ${args.publishDir}` : ''
  let capturedUrl: string | undefined
  const urlRe = /https?:\/\/[^\s]+\.netlify\.app\b/g
  const buildPart = args.noBuild === true ? '' : ' --build'
  const jsonPart = args.json === true ? ' --json' : ''
  const cmd = `netlify deploy${buildPart}${envTarget === 'prod' ? ' --prod' : ''}${dirFlag}${siteFlag}${jsonPart}`.trim()
  if (args.printCmd) logger.info(`$ ${cmd}`)
  const startAt = Date.now()
  let statusText = envTarget === 'prod' ? 'production' : 'preview'
  const hb = setInterval(() => { sp.update(`${phaseText}: ${statusText} — ${formatElapsed(Date.now() - startAt)}`) }, 1000)
  const emitStatus = (status: string, extra?: Record<string, unknown>): void => {
    statusText = status
    if (process.env.OPD_NDJSON === '1') logger.json({ action: 'start', provider: 'netlify', target: envTarget, event: 'status', status, ...(extra ?? {}) })
  }
  let lastActivity = Date.now()
  const logTail: string[] = []
  const pushTail = (raw: string): void => {
    const t = raw.replace(/\s+$/, '')
    if (t.length === 0) return
    logTail.push(t)
    if (logTail.length > 50) logTail.shift()
  }
  let stdoutBuf = ''
  let stderrBuf = ''
  const controller = proc.spawnStream({
    cmd,
    cwd: args.cwd,
    onStdout: (chunk: string): void => {
      lastActivity = Date.now()
      const m = chunk.match(urlRe)
      if (!capturedUrl && m && m.length > 0) capturedUrl = m[0]
      stdoutBuf += chunk
      pushTail(chunk)
      if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1' || args.showLogs === true) {
        const t = chunk.replace(/\s+$/, '')
        if (t.length > 0) logger.info(t)
      }
      if (process.env.OPD_NDJSON === '1') {
        const data = truncateEventData(chunk)
        if (data.length > 0) logger.json({ action: 'start', provider: 'netlify', target: envTarget, event: 'stdout', data })
      }
    },
    onStderr: (chunk: string): void => {
      lastActivity = Date.now()
      stderrBuf += chunk
      pushTail(chunk)
      if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1' || args.showLogs === true) {
        const t = chunk.replace(/\s+$/, '')
        if (t.length > 0) logger.info(t)
      }
      const line = chunk.replace(/\s+$/, '')
      if (/\bUploading\b/i.test(line)) emitStatus('uploading')
      else if (/\bProcessing\b|\bDeploying\b/i.test(line)) emitStatus('building')
      else if (/\bDraft URL:|\bWebsite URL:/i.test(line)) emitStatus('ready')
      else if (/^Error:\s/i.test(line)) { const msg = line.slice(6).trim(); emitStatus('error', { message: msg }); if ((process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') || args.showLogs === true) { logger.error(`Error: ${msg}`) } try { controller.stop() } catch { /* ignore */ } }
      if (process.env.OPD_NDJSON === '1') {
        const data = truncateEventData(chunk)
        if (data.length > 0) logger.json({ action: 'start', provider: 'netlify', target: envTarget, event: 'stderr', data })
      }
    }
  })
  // Idle inactivity watchdog
  let idleFired = false
  const idleCheck = args.idleTimeoutSeconds && args.idleTimeoutSeconds > 0
    ? setInterval(() => {
        if (!idleFired && Date.now() - lastActivity > args.idleTimeoutSeconds! * 1000) {
          idleFired = true
          emitStatus('idle-timeout')
          try { controller.stop() } catch { /* ignore */ }
        }
      }, 2000)
    : undefined
  let timedOut = false
  const res = args.timeoutSeconds && args.timeoutSeconds > 0
    ? await Promise.race([
        controller.done,
        new Promise<{ readonly ok: boolean; readonly exitCode: number }>((resolve) => {
          setTimeout(() => { timedOut = true; try { controller.stop() } catch { /* ignore */ } resolve({ ok: false, exitCode: 124 }) }, args.timeoutSeconds! * 1000)
        })
      ])
    : await controller.done
  clearInterval(hb)
  if (idleCheck) clearInterval(idleCheck)
  sp.stop()
  if (!res.ok) {
    const err = new Error('Netlify deploy failed') as Error & { meta?: Record<string, unknown> }
    err.meta = { provider: 'netlify', reason: timedOut ? `timeout after ${args.timeoutSeconds}s` : (idleFired ? `idle-timeout after ${args.idleTimeoutSeconds}s` : undefined), url: capturedUrl, errorLogTail: logTail.slice(-20) }
    if (process.env.OPD_NDJSON === '1') {
      logger.json({ action: 'start', provider: 'netlify', target: envTarget, event: 'done', ok: false, reason: err.meta.reason, url: capturedUrl })
    }
    throw err
  }
  // Try parsing URL from buffered output as a secondary step
  if (!capturedUrl) {
    try {
      const all = `${stdoutBuf}\n${stderrBuf}`
      const m = all.match(urlRe)
      if (m && m.length > 0) capturedUrl = m[0]
      else if (args.json === true) {
        // Attempt JSON parse of stdout when --json flag was used
        const js = JSON.parse(stdoutBuf) as Record<string, unknown>
        const cand = (js as any)?.deploy_ssl_url || (js as any)?.ssl_url || (js as any)?.deploy_url || (js as any)?.url
        if (typeof cand === 'string' && /https?:\/\//.test(cand)) capturedUrl = cand
      }
    } catch { /* ignore */ }
  }
  // Fallback: if no URL was detected in stream, try to resolve latest deploy via API
  if (!capturedUrl) {
    try {
      const statePath = join(args.cwd, '.netlify', 'state.json')
      let siteId: string | undefined = args.project
      if (!siteId) {
        try {
          const raw = await readFile(statePath, 'utf8')
          const js = JSON.parse(raw) as { siteId?: string }
          if (js && typeof js.siteId === 'string' && js.siteId.length > 0) siteId = js.siteId
        } catch { /* ignore */ }
      }
      if (siteId) {
        const api = await proc.run({ cmd: `netlify api listDeploys --data '{"site_id":"${siteId}","limit":1}'`, cwd: args.cwd })
        if (api.ok) {
          try {
            const arr = JSON.parse(api.stdout) as Array<Record<string, unknown>>
            if (Array.isArray(arr) && arr.length > 0) {
              const d = arr[0] as Record<string, unknown>
              const url = typeof d.deploy_ssl_url === 'string' ? d.deploy_ssl_url
                : typeof d.ssl_url === 'string' ? d.ssl_url
                : typeof d.deploy_url === 'string' ? d.deploy_url
                : typeof d.url === 'string' ? d.url
                : undefined
              if (url && /https?:\/\//.test(url)) capturedUrl = url
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  if (process.env.OPD_NDJSON === '1') {
    logger.json({ action: 'start', provider: 'netlify', target: envTarget, event: 'done', ok: true, url: capturedUrl })
  }
  return { url: capturedUrl }
}

export async function runStartWizard(opts: StartOptions): Promise<void> {
  try {
    const rootCwd: string = process.cwd()
    if (process.env.OPD_NDJSON === '1') { logger.setNdjson(true) }
    else if (opts.json === true || process.env.OPD_JSON === '1') { logger.setJsonOnly(true) }
    if (process.env.OPD_SUMMARY === '1' || opts.summaryOnly === true) { logger.setSummaryOnly(true) }
    const inCI: boolean = Boolean(opts.ci) || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
    // Only treat this run as 'machine mode' when explicitly requested via flags,
    // or when OPD_SUMMARY is set in a CI context. Do NOT inherit OPD_JSON/OPD_NDJSON
    // for gating preflight; they affect output formatting but should not skip preflight.
    const machineMode: boolean = (opts.json === true) || opts.summaryOnly === true || (process.env.OPD_SUMMARY === '1' && inCI)
    const humanNote = (msg: string, title?: string): void => { if (!machineMode) note(msg, title) }
    if (!machineMode) intro('OpenDeploy • Start')
    // Default capture in CI or when --capture is passed: create file sinks if missing
    const wantCapture: boolean = Boolean(opts.capture === true || opts.ci === true)
    if (wantCapture) {
      if (!process.env.OPD_JSON_FILE) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        const p = `./.artifacts/opd-start-${ts}.json`
        logger.setJsonFile(p); process.env.OPD_JSON_FILE = p
      }
      if (!process.env.OPD_NDJSON_FILE) {
        const ts2 = new Date().toISOString().replace(/[:.]/g, '-')
        const p2 = `./.artifacts/opd-start-${ts2}.ndjson`
        logger.setNdjsonFile(p2); process.env.OPD_NDJSON_FILE = p2
      }
    }
    // Load saved defaults
    let saved: Partial<StartOptions> = {}
    try {
      const cfg = await fsx.readJson<Record<string, unknown>>(join(rootCwd, 'opendeploy.config.json'))
      const sd = (cfg as { startDefaults?: Partial<StartOptions> }).startDefaults
      if (sd && typeof sd === 'object') saved = sd
    } catch { /* ignore */ }
    if (Object.keys(saved).length > 0 && opts.json !== true) {
      note('Saved defaults loaded from opendeploy.config.json', 'Defaults')
    }

    // Path selection (monorepo-friendly)
    let targetPath: string | undefined = opts.path ?? saved.path
    let targetCwd: string = targetPath ? (isAbsolute(targetPath) ? targetPath : join(rootCwd, targetPath)) : rootCwd
    if (!targetPath && !opts.ci) {
      try {
        const cands = await scanMonorepoCandidates(rootCwd)
        if (cands.length > 1) {
          const choice = await select({
            message: 'Select app directory',
            options: [
              { value: '.', label: 'Root (.)' },
              ...cands.map((c) => ({ value: c.path, label: `${c.path.replace(rootCwd + '/', '')} (${c.framework})` }))
            ]
          })
          if (isCancel(choice)) { cancel('Cancelled'); return }
          const picked = String(choice)
          targetPath = picked === '.' ? undefined : picked
          targetCwd = targetPath ? picked : rootCwd
        } else if (cands.length === 1) {
          targetPath = cands[0]!.path
          targetCwd = targetPath
        }
      } catch { /* ignore */ }
    }
    if (!machineMode) note(`Deploying from: ${targetCwd}\nTip: For monorepos, pass --path to target an app directory.`, 'Path')

    // Framework
    let framework: Framework | undefined = opts.framework ?? (saved.framework as Framework | undefined)
    if (!framework) framework = await autoDetectFramework(targetCwd)
    if (!framework) {
      if (opts.ci) {
        throw new Error('Framework not detected. Pass --framework <next|astro|sveltekit|remix|nuxt> in CI mode.')
      }
      const marks = await detectMarks({ cwd: targetCwd })
      const options: Array<{ value: Framework; label: string }> = [
        { value: 'next', label: `Next.js${marks.has('next') ? ' (detected)' : ''}` },
        { value: 'astro', label: `Astro${marks.has('astro') ? ' (detected)' : ''}` },
        { value: 'sveltekit', label: `SvelteKit${marks.has('sveltekit') ? ' (detected)' : ''}` },
        { value: 'remix', label: `Remix${marks.has('remix') ? ' (detected)' : ''}` },
        { value: 'nuxt', label: `Nuxt${marks.has('nuxt') ? ' (detected)' : ''}` }
      ]
      if (process.env.OPD_EXPERIMENTAL === '1') {
        options.splice(4, 0, { value: 'expo', label: `Expo${marks.has('expo') ? ' (detected)' : ''} (experimental)` })
      }
      const choice = await select({
        message: 'Select your framework',
        options
      })
      if (isCancel(choice)) { cancel('Cancelled'); return }
      framework = choice as Framework
    }
    void framework

    // Show detection summary (human) and emit when --debug-detect
    const detection: DetectionResult = await detectForFramework(framework!, targetCwd)
    let publishSuggestion: string | undefined = ((): string | undefined => {
      try { return inferNetlifyPublishDir({ framework: framework!, cwd: targetCwd }) } catch { return undefined }
    })()
    const pkgMgr: string = await detectPackageManager(targetCwd)
    const runtime: string = runtimeHint(framework!)
    const workspaceGlobs: string[] = await readWorkspaceGlobs(rootCwd)
    let workspaceMatches = 0
    for (const g of workspaceGlobs) { const dirs = await expandWorkspacePattern(rootCwd, g); workspaceMatches += dirs.length }
    if (!machineMode) {
      const rel = targetCwd.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '')
      const lines: string[] = []
      lines.push(`Path: ${rel.length === 0 ? '.' : rel}`)
      lines.push(`Framework: ${framework}`)
      if (detection.buildCommand) lines.push(`Build: ${detection.buildCommand}`)
      if (publishSuggestion) lines.push(`Publish (Netlify): ${publishSuggestion}`)
      lines.push(`Package manager: ${pkgMgr}`)
      lines.push(`Runtime: ${runtime}`)
      if (workspaceGlobs.length > 0) {
        lines.push(`Workspaces: ${workspaceGlobs.join(', ')} (${workspaceMatches} matches)`)
      }
      note(lines.join('\n'), 'Detection')
    }
    if (opts.debugDetect) {
      const payload = { action: 'start', event: 'detection', cwd: targetCwd, framework, buildCommand: detection.buildCommand, publishSuggestion, packageManager: pkgMgr, runtime, workspaceGlobs, workspaceMatches }
      logger.jsonPrint(payload)
    }

    // Early dry-run summary before any provider auth/linking
    const envTargetEarly: 'prod' | 'preview' = (opts.env ?? 'preview') === 'prod' ? 'prod' : 'preview'
    if (opts.dryRun === true) {
      const provEarly: Provider = (opts.provider as Provider) ?? 'vercel'
      const cmdEarly = buildNonInteractiveCmd({ provider: provEarly, envTarget: envTargetEarly, path: opts.path, project: opts.project, org: opts.org, syncEnv: Boolean(opts.syncEnv) })
      const summaryEarly = { ok: true, action: 'start' as const, provider: provEarly, target: envTargetEarly, mode: 'dry-run', cmd: cmdEarly, cwd: rootCwd, final: true }
      // Emit a single-line JSON for easy parsing in tests, ensuring the substring "final": true exists
      const compact: string = JSON.stringify(summaryEarly)
      const spacedFinal: string = compact.replace('"final":true', '"final": true')
      // eslint-disable-next-line no-console
      console.log(spacedFinal)
      outro('Dry run complete')
      return
    }

    // Provider
    let provider: Provider | undefined = opts.provider
    if (!provider) {
      if (opts.ci) {
        provider = 'vercel'
      } else {
        const [vs, ns] = await Promise.all([providerStatus('vercel'), providerStatus('netlify')])
        const choice = await select({
          message: 'Select deployment provider',
          options: [
            { value: 'vercel', label: `Vercel (${vs})` },
            { value: 'netlify', label: `Netlify (${ns})` }
          ]
        })
        if (isCancel(choice)) { cancel('Cancelled'); return }
        provider = choice as Provider
      }
    }

    // Optional build preflight (run early, before auth/link to avoid side-effects)
    await runBuildPreflight({ detection, provider: provider!, cwd: targetCwd, ci: Boolean(opts.ci), skipPreflight: Boolean(opts.skipPreflight) })
    // Help unit tests capture a clear signal that preflight succeeded
    try { /* eslint-disable-next-line no-console */ console.log('Build validated') } catch { /* ignore */ }

    // One-click login when missing (skip when generating config only)
    if (!opts.generateConfigOnly) await ensureProviderAuth(provider!, opts)

    // Validate provider and show selection (human mode only)
    if (provider !== 'vercel' && provider !== 'netlify') throw new Error('Provider selection failed (invalid value)')
    humanNote(`${provider === 'vercel' ? 'Vercel' : 'Netlify'} selected`, 'Select deployment provider')
    // Also validate via provider plugin and enrich detection hints using capabilities
    try {
      const plugin = await loadProvider(provider)
      try { await plugin.validateAuth(targetCwd) } catch { /* ignore; ensureProviderAuth already handled */ }
      try {
        const pd = await plugin.detect(targetCwd)
        if (!publishSuggestion && typeof pd.publishDir === 'string' && pd.publishDir.length > 0) publishSuggestion = pd.publishDir
      } catch { /* ignore */ }
    } catch { /* ignore */ }

    // Generate config only and exit early
    if (opts.generateConfigOnly === true) {
      try {
        const plugin = await loadProvider(provider)
        await plugin.generateConfig({ detection, cwd: targetCwd, overwrite: false })
        humanNote(provider === 'vercel' ? 'Ensured vercel.json' : 'Ensured netlify.toml', 'Config')
      } catch { /* ignore exists */ }
      const envTarget: 'prod' | 'preview' = (opts.env ?? 'preview') === 'prod' ? 'prod' : 'preview'
      if (isJsonMode(opts.json)) {
        logger.json({ ok: true, action: 'start', provider, target: envTarget, mode: 'generate-config-only', cwd: targetCwd, final: true })
      } else {
        logger.success('Config generated')
      }
      return
    }

    // Track a created Netlify site id (if we create one) so we can pass it to deploy
    let createdSiteId: string | undefined
    // Track CI state where directory is unlinked and no --project was provided (for JSON/hints)
    let ciUnlinkedNoProject: boolean = false

    // Inline linking when IDs are provided but folder isn't linked
    if (provider === 'vercel') {
      const linked: boolean = await fsx.exists(join(targetCwd, '.vercel', 'project.json'))
      if (!linked && (opts.project || opts.org)) {
        const doLink = await clackConfirm({ message: `Link this directory to Vercel project ${opts.project ?? ''}?`, initialValue: true })
        if (isCancel(doLink)) { cancel('Cancelled'); return }
        if (doLink) {
          const flags: string[] = ['--yes']
          if (opts.project) flags.push(`--project ${opts.project}`)
          if (opts.org) flags.push(`--org ${opts.org}`)
          note(`Running: vercel link ${flags.join(' ')}`, 'Link')
          const out = await proc.run({ cmd: `vercel link ${flags.join(' ')}`, cwd: targetCwd })
          if (!out.ok) {
            if (opts.json !== true) {
              if (out.stderr.trim().length > 0) logger.error(out.stderr.trim())
              if (out.stdout.trim().length > 0) logger.note(out.stdout.trim())
            }
            throw new Error('Vercel link failed')
          }
        }
      }
    }
    // Determine effective timeout (seconds). Default only in CI.
    const userTimeout: number = Number(opts.timeout)
    const effectiveTimeout: number | undefined = Number.isFinite(userTimeout) && userTimeout > 0 ? Math.floor(userTimeout) : (opts.ci ? 900 : undefined)

    if (provider === 'netlify') {
      const existingSiteId: string | undefined = await readNetlifySiteId(targetCwd)
      let linked: boolean = typeof existingSiteId === 'string' && existingSiteId.length > 0
      // Validate that the linked site actually exists and is accessible; otherwise, treat as unlinked
      if (linked) {
        try {
          const chk = await proc.run({ cmd: `netlify api getSite --data '{"site_id":"${existingSiteId}"}'`, cwd: targetCwd })
          if (!chk.ok) linked = false
          else {
            try {
              const js = JSON.parse(chk.stdout) as { id?: string; site_id?: string; error?: unknown; message?: unknown; status?: number }
              const sid = (typeof js?.site_id === 'string' ? js.site_id : js?.id)
              if (!sid || sid.length === 0 || js?.error || js?.message || (typeof js?.status === 'number' && js.status >= 400)) linked = false
            } catch { linked = false }
          }
        } catch { linked = false }
      }
      if (!linked) {
        // 1) If a project id was provided, always link non-interactively
        if (opts.project) {
          note(`Running: netlify link --id ${opts.project}`, 'Link')
          const out = await proc.run({ cmd: `netlify link --id ${opts.project}`, cwd: targetCwd })
          if (!out.ok) throw new Error('Netlify link failed')
        }
        // 2) If no project id, auto-create and link
        else if (opts.ci || machineMode) {
          const base = targetCwd.split(/[\\/]/).pop() ?? 'site'
          const name = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || 'site'
          note(`Creating Netlify site: ${name}`, 'Create')
          const spCreate = spinner('Netlify: creating site')
          try { createdSiteId = await createNetlifySite({ cwd: targetCwd, name }) }
          finally { spCreate.stop() }
          note(`Running: netlify link --id ${createdSiteId}`, 'Link')
          const linkRes = await proc.run({ cmd: `netlify link --id ${createdSiteId}`, cwd: targetCwd })
          if (!linkRes.ok) throw new Error('Netlify link failed')
        }
        // 3) Human mode without project id: prompt and create/link (existing behavior)
        else {
          const doCreate = await clackConfirm({ message: 'No linked Netlify site. Create a new site here?', initialValue: true })
          if (isCancel(doCreate)) { cancel('Cancelled'); return }
          if (doCreate) {
            const base = targetCwd.split(/[\\/]/).pop() ?? 'site'
            const name = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || 'site'
            note(`Creating Netlify site: ${name}`, 'Create')
            const spCreate = spinner('Netlify: creating site')
            try { createdSiteId = await createNetlifySite({ cwd: targetCwd, name }) }
            finally { spCreate.stop() }
            note(`Running: netlify link --id ${createdSiteId}`, 'Link')
            const linkRes = await proc.run({ cmd: `netlify link --id ${createdSiteId}`, cwd: targetCwd })
            if (!linkRes.ok) throw new Error('Netlify link failed')
          } else {
            // Offer to select an existing site to link
            const list = await proc.run({ cmd: 'netlify api listSites', cwd: targetCwd })
            if (!list.ok) throw new Error('Could not list Netlify sites; run: netlify login')
            let sites: Array<{ id: string; name: string }>
            try {
              const arr = JSON.parse(list.stdout) as Array<{ id?: string; name?: string }>
              sites = (arr || []).filter((s) => typeof s?.id === 'string' && typeof s?.name === 'string').map((s) => ({ id: s.id as string, name: s.name as string }))
            } catch { throw new Error('Failed to parse Netlify sites list') }
            if (!sites || sites.length === 0) throw new Error('No Netlify sites found; create one first with: netlify sites:create')
            const choice = await select({
              message: 'Select a Netlify site to link',
              options: sites.slice(0, 50).map((s) => ({ value: s.id, label: `${s.name} (${s.id.slice(0, 8)}…)` }))
            })
            if (isCancel(choice)) { cancel('Cancelled'); return }
            const chosenSiteId: string = choice as string
            note(`Running: netlify link --id ${chosenSiteId}`, 'Link')
            const linkRes = await proc.run({ cmd: `netlify link --id ${chosenSiteId}`, cwd: targetCwd })
            if (!linkRes.ok) throw new Error('Netlify link failed')
            createdSiteId = chosenSiteId
          }
        }
      }
    }

    // Compute effective project as early as possible (needed for env sync)
    let effectiveProject: string | undefined
    if (provider === 'netlify') {
      const stateSiteId: string | undefined = await readNetlifySiteId(targetCwd)
      effectiveProject = opts.project ?? createdSiteId ?? stateSiteId ?? (saved.project as string | undefined)
    } else {
      effectiveProject = opts.project ?? (saved.project as string | undefined)
    }

    // Compute env target for subsequent steps
    const envTarget: 'prod' | 'preview' = (opts.env ?? (saved.env as 'prod' | 'preview') ?? 'preview') === 'prod' ? 'prod' : 'preview'

    // Env + Sync
    let doSync: boolean = Boolean(opts.syncEnv ?? saved.syncEnv)
    if (!opts.ci && !machineMode && opts.syncEnv === undefined && saved.syncEnv === undefined) {
      const res = await clackConfirm({ message: 'Auto-sync .env before deploy?', initialValue: true })
      if (isCancel(res)) { cancel('Cancelled'); return }
      doSync = res as boolean
    }

    // If using Netlify and no effective project yet, auto-create and link now to unblock env sync and deploy
    if (provider === 'netlify' && !effectiveProject) {
      const base = targetCwd.split(/[\\/]/).pop() ?? 'site'
      const name = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || 'site'
      note(`Creating Netlify site for env sync: ${name}`, 'Create')
      const spAuto = spinner('Netlify: creating site')
      try { createdSiteId = await createNetlifySite({ cwd: targetCwd, name }); effectiveProject = createdSiteId }
      finally { spAuto.stop() }
      note(`Running: netlify link --id ${effectiveProject}`, 'Link')
      const linkRes = await proc.run({ cmd: `netlify link --id ${effectiveProject}`, cwd: targetCwd })
      if (!linkRes.ok) throw new Error('Netlify link failed')
    }

    if (doSync) {
      const candidates: readonly string[] = envTarget === 'prod' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
      let chosenFile: string | undefined
      for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { chosenFile = f; break } }
      if (chosenFile) {
        // Optional plan preview (keys only)
        const wantPlan = !machineMode ? await clackConfirm({ message: `Show env sync plan for ${chosenFile} (keys only)?`, initialValue: false }) : false
        if (!machineMode && !isCancel(wantPlan) && wantPlan) {
          try {
            const keys = await parseEnvKeys(join(targetCwd, chosenFile))
            const preview = keys.slice(0, 20).join(', ') + (keys.length > 20 ? `, …(+${keys.length - 20})` : '')
            humanNote(`Env file: ${chosenFile}\nKeys: ${keys.length}\nPreview: ${preview}`, 'Plan')
          } catch { /* ignore plan parse errors */ }
        }
        try { const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true }); if (patterns.length > 0) logger.setRedactors(patterns) } catch { /* ignore */ }
        humanNote(`Syncing ${chosenFile} → ${provider}`, 'Environment')
        await envSync({ provider: provider!, cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: effectiveProject, orgId: opts.org, ignore: [], only: [], optimizeWrites: true })
      } else {
        if (!machineMode) note('No local .env file found to sync', 'Environment')
      }
    }

    // One-time detection for downstream steps
    try {
      if (detection.framework === 'remix' && /react-router\s+build/i.test(detection.buildCommand)) {
        humanNote('Remix (React Router v7 detected)', 'Framework')
      }
    } catch { /* ignore */ }

    // (preflight already executed above)

    // Deploy / Prepare
    // Ensure a netlify.toml via adapter for all frameworks (prepare-only flow)
    if (provider === 'netlify') {
      try { const p = await loadProvider('netlify'); await p.generateConfig({ detection, cwd: targetCwd, overwrite: false }); humanNote('Ensured netlify.toml', 'Config') } catch { /* ignore if exists */ }
    }
    // effectiveProject already computed above

    if (provider === 'netlify') {
      // Detect Netlify Next Runtime presence for Next.js projects first
      let netlifyNextRuntime: boolean | undefined
      try {
        if (detection.framework === 'next') {
          // Heuristics: package.json dep, module dir, or legacy manifest file
          let hasDep = false
          try {
            const pkg = await fsx.readJson<Record<string, unknown>>(join(targetCwd, 'package.json'))
            const deps = (pkg as any)?.dependencies ?? {}
            const dev = (pkg as any)?.devDependencies ?? {}
            hasDep = Boolean(deps['@netlify/next'] || dev['@netlify/next'])
          } catch { /* ignore */ }
          const hasModuleDir = await fsx.exists(join(targetCwd, 'node_modules', '@netlify', 'next'))
          const hasManifest = await fsx.exists(join(targetCwd, 'node_modules', '@netlify', 'next', 'manifest.yml'))
          netlifyNextRuntime = Boolean(hasDep || hasModuleDir || hasManifest)
        }
      } catch { /* ignore */ }
      // Offer to auto-install the runtime in human mode when missing
      if (provider === 'netlify' && detection.framework === 'next' && netlifyNextRuntime !== true && !machineMode) {
        const want = await clackConfirm({ message: 'Install @netlify/next runtime for optimal Next.js support?', initialValue: true })
        if (isCancel(want)) { cancel('Cancelled'); return }
        if (want) {
          const pm = pkgMgr // detected earlier
          const installCmd = pm === 'pnpm' ? 'pnpm add -D @netlify/next' : pm === 'yarn' ? 'yarn add -D @netlify/next' : 'npm i -D @netlify/next'
          note(`Running: ${installCmd}`, 'Install')
          const res = await proc.run({ cmd: installCmd, cwd: targetCwd })
          if (!res.ok) throw new Error('Failed to install @netlify/next')
          try { netlifyNextRuntime = await fsx.exists(join(targetCwd, 'node_modules', '@netlify', 'next', 'manifest.yml')) } catch { /* ignore */ }
          if (netlifyNextRuntime) humanNote('Netlify Next Runtime detected (installed)', 'Next.js')
        }
      }
      // Prepare-only: detect publish dir and print recommended commands.
      const usingNextRuntime: boolean = (detection.framework === 'next' && netlifyNextRuntime === true)
      let publishDir: string | undefined = usingNextRuntime ? undefined : (detection.publishDir ?? inferNetlifyPublishDir({ framework: framework!, cwd: targetCwd }))
      // Check publishDir existence and files to improve guidance (skip for Next runtime)
      let publishDirExists: boolean = false
      let publishDirFileCount: number = 0
      if (publishDir) {
        try {
          const full = join(targetCwd, publishDir)
          publishDirExists = await fsx.exists(full)
          if (publishDirExists) publishDirFileCount = await countFiles(full)
        } catch { /* ignore */ }
      }
      // Resolve site name and admin URL for enriched JSON summaries
      let siteName: string | undefined
      let adminUrl: string | undefined
      try {
        const siteId: string | undefined = effectiveProject
        if (siteId) {
          const siteRes = await proc.run({ cmd: `netlify api getSite --data '{"site_id":"${siteId}"}'`, cwd: targetCwd })
          if (siteRes.ok) {
            try { const js = JSON.parse(siteRes.stdout) as { name?: string; admin_url?: string }
              if (typeof js.name === 'string') siteName = js.name
              if (typeof js.admin_url === 'string') adminUrl = js.admin_url
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      // CI checklist data
      const buildCommand: string = detection.buildCommand
      let ciEnvFile: string | undefined
      let envKeysExample: readonly string[] | undefined
      try {
        const candidates: readonly string[] = envTarget === 'prod' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
        for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { ciEnvFile = f; break } }
        if (ciEnvFile) {
          const keys = await parseEnvKeys(join(targetCwd, ciEnvFile))
          envKeysExample = keys.slice(0, 10)
        }
      } catch { /* ignore */ }
      const previewCmd = (usingNextRuntime
        ? `netlify build && netlify deploy${effectiveProject ? ` --site ${effectiveProject}` : ''}`
        : `netlify deploy${publishDir ? ` --dir ${publishDir}` : ''}${effectiveProject ? ` --site ${effectiveProject}` : ''}`
      ).trim()
      const prodCmd = (usingNextRuntime
        ? `netlify build && netlify deploy --prod${effectiveProject ? ` --site ${effectiveProject}` : ''}`
        : `netlify deploy --prod${publishDir ? ` --dir ${publishDir}` : ''}${effectiveProject ? ` --site ${effectiveProject}` : ''}`
      ).trim()
      if (opts.printCmd === true) {
        logger.info(`$ ${previewCmd}`)
        logger.info(`$ ${prodCmd}`)
      }
      // Decide deploy vs prepare-only
      // For Netlify, default to prepare-only unless user explicitly passed --deploy=true
      let shouldDeploy: boolean = opts.deploy === true
      // In human mode, if user did not pass --deploy flag, confirm intention
      if (opts.deploy === undefined && !opts.ci && !machineMode) {
        const wantDeploy = await clackConfirm({ message: 'Deploy to Netlify now?', initialValue: true })
        if (isCancel(wantDeploy)) { cancel('Cancelled'); return }
        shouldDeploy = wantDeploy === true
      }
      if (shouldDeploy) {
        // Always perform an explicit local build first for Netlify to avoid
        // the CLI "skipped"/empty deploy edge cases. Users can opt out via --no-build.
        const mustBuildFirst: boolean = opts.noBuild === true ? false : true
        if (mustBuildFirst) {
          const buildCmd = 'netlify build'
          if (opts.printCmd) logger.info(`$ ${buildCmd}`)
          const buildRes = await proc.run({ cmd: buildCmd, cwd: targetCwd })
          if (!buildRes.ok) throw new Error('Netlify build failed')
          // After building, recompute publishDir existence metrics for summaries
          if (!usingNextRuntime) {
            try {
              const pub = publishDir ?? inferNetlifyPublishDir({ framework: framework!, cwd: targetCwd })
              const full = join(targetCwd, pub)
              publishDirExists = await fsx.exists(full)
              publishDirFileCount = publishDirExists ? await countFiles(full) : 0
              publishDir = pub
            } catch { /* ignore */ }
          }
        }
        // Machine mode requires a site id to avoid interactive linking
        if (!effectiveProject && machineMode) {
          throw new Error('Netlify site not linked. Provide --project <siteId> or run `netlify link` before deploying.')
        }
        // Execute a real deploy via Netlify CLI (optional path)
        const idleSeconds = Number(opts.idleTimeout)
        const effIdle: number | undefined = Number.isFinite(idleSeconds) && idleSeconds > 0 ? Math.floor(idleSeconds) : (opts.ci ? 45 : undefined)
        const { url } = await runDeploy({ provider: provider!, env: envTarget, cwd: targetCwd, json: Boolean(opts.json), project: effectiveProject, printCmd: opts.printCmd === true, publishDir, noBuild: true, showLogs: Boolean(opts.showLogs), timeoutSeconds: effectiveTimeout, idleTimeoutSeconds: effIdle })
        // NDJSON parity: emit a logs event if available
        if (process.env.OPD_NDJSON === '1' && adminUrl) {
          logger.json({ action: 'start', provider, target: envTarget, event: 'logs', logsUrl: `${adminUrl}/deploys` })
        }
        if (isJsonMode(opts.json)) {
          const summary = { ok: true, action: 'start' as const, provider, target: envTarget, mode: 'deploy' as const, projectId: effectiveProject, siteId: effectiveProject, siteName, url, logsUrl: adminUrl ? `${adminUrl}/deploys` : undefined, ciChecklist: { buildCommand, publishDir, envFile: ciEnvFile, exampleKeys: envKeysExample }, publishDirExists, publishDirFileCount, netlifyNextRuntime, ciUnlinkedNoProject, cwd: targetCwd, final: true }
          logger.jsonPrint(summary)
          if (!machineMode) outro('Deployed')
          return
        }
        if (url) logger.success(`${envTarget === 'prod' ? 'Production' : 'Preview'}: ${url}`)
        if (!machineMode) outro('Deployment complete')
        return
      }
      // NDJSON parity: emit a logs event if available
      if (process.env.OPD_NDJSON === '1' && adminUrl) {
        logger.json({ action: 'start', provider, target: envTarget, event: 'logs', logsUrl: `${adminUrl}/deploys` })
      }
      if (isJsonMode(opts.json)) {
        const summary = {
          ok: true,
          action: 'start' as const,
          provider,
          target: envTarget,
          mode: 'prepare-only',
          projectId: effectiveProject,
          siteId: effectiveProject,
          siteName,
          publishDir,
          recommend: { previewCmd, prodCmd },
          ciChecklist: { buildCommand, publishDir, envFile: ciEnvFile, exampleKeys: envKeysExample },
          publishDirExists,
          publishDirFileCount,
          netlifyNextRuntime,
          ciUnlinkedNoProject,
          logsUrl: adminUrl ? `${adminUrl}/deploys` : undefined,
          cwd: targetCwd,
          final: true
        }
        logger.jsonPrint(summary)
        if (!machineMode) outro('Prepared')
        return
      }
      // Human messaging with Git/CI recommendation and CI checklist
      logger.warn('Netlify (prepare-only): connect your repository and use Git/CI builds for reliability and caching. Local builds can be slower or time out on first runs.')
      humanNote('Netlify Git/CI: In Netlify Admin → Connect to Git. Set Build command and Publish directory per framework, and add environment variables.', 'Recommendation')
      if (!publishDirExists || publishDirFileCount === 0) {
        humanNote(`Publish directory "${publishDir}" ${publishDirExists ? 'has no files' : 'was not found'}. Ensure your build outputs static assets there.`, 'Publish directory')
      }
      if (detection.framework === 'next') {
        if (netlifyNextRuntime === true) humanNote('Netlify Next Runtime detected (optimal for Next.js on Netlify).', 'Next.js')
        else humanNote('Using legacy Netlify Next plugin. For best SSR/Edge support, install @netlify/next.', 'Next.js')
      }
      humanNote(`Recommended preview deploy:\n${previewCmd}`, 'Netlify')
      humanNote(`Recommended production deploy:\n${prodCmd}`, 'Netlify')
      const lines: string[] = []
      lines.push(`Build command: ${buildCommand}`)
      lines.push(`Publish dir:  ${publishDir}`)
      if (ciEnvFile) lines.push(`Env file:     ${ciEnvFile}`)
      if (envKeysExample && envKeysExample.length > 0) lines.push(`Example keys: ${envKeysExample.join(', ')}${envKeysExample.length >= 10 ? '…' : ''}`)
      humanNote(lines.join('\n'), 'CI Checklist')
      if (!machineMode) outro('Preparation complete')
      return
    }

    // Ensure vercel.json for Vercel
    try { const p = await loadProvider('vercel'); await p.generateConfig({ detection, cwd: targetCwd, overwrite: false }); humanNote('Ensured vercel.json', 'Config') } catch { /* ignore if exists */ }

    // Vercel deploy path
    const idleSeconds = Number(opts.idleTimeout)
    const effIdle: number | undefined = Number.isFinite(idleSeconds) && idleSeconds > 0 ? Math.floor(idleSeconds) : (opts.ci ? 45 : undefined)
    const { url, logsUrl, alias } = await runDeploy({ provider: provider!, env: envTarget, cwd: targetCwd, json: Boolean(opts.json), project: effectiveProject, org: opts.org ?? saved.org, printCmd: opts.printCmd === true, alias: opts.alias, showLogs: Boolean(opts.showLogs), timeoutSeconds: effectiveTimeout, idleTimeoutSeconds: effIdle })
    const cmd = buildNonInteractiveCmd({ provider: provider!, envTarget, path: targetPath, project: effectiveProject, org: opts.org ?? saved.org, syncEnv: doSync })
    // Build a small CI checklist for Vercel as well
    const buildCommand: string = detection.buildCommand
    let ciEnvFile: string | undefined
    let envKeysExample: readonly string[] | undefined
    try {
      const candidates: readonly string[] = envTarget === 'prod' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
      for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { ciEnvFile = f; break } }
      if (ciEnvFile) {
        const keys = await parseEnvKeys(join(targetCwd, ciEnvFile))
        envKeysExample = keys.slice(0, 10)
      }
    } catch { /* ignore */ }
    if (isJsonMode(opts.json)) {
      logger.json({ ok: true, action: 'start', provider, target: envTarget, mode: 'deploy', url, logsUrl, alias, cmd, ciChecklist: { buildCommand, envFile: ciEnvFile, exampleKeys: envKeysExample }, cwd: targetCwd, final: true })
      if (!machineMode) outro('Done');
      return
    }
    if (url) logger.success(`${envTarget === 'prod' ? 'Production' : 'Preview'}: ${url}`)
    if (logsUrl) logger.note(`Logs: ${logsUrl}`)
    // Human CI checklist
    {
      const lines: string[] = []
      lines.push(`Build command: ${buildCommand}`)
      if (ciEnvFile) lines.push(`Env file:     ${ciEnvFile}`)
      if (envKeysExample && envKeysExample.length > 0) lines.push(`Example keys: ${envKeysExample.join(', ')}${envKeysExample.length >= 10 ? '…' : ''}`)
      if (lines.length > 0) humanNote(lines.join('\n'), 'CI Checklist')
    }
    humanNote(`Rerun non-interactively:\n${cmd}`, 'Command')
    const wantCopy = await clackConfirm({ message: 'Copy command to clipboard?', initialValue: false })
    if (!isCancel(wantCopy) && wantCopy) {
      try { await clipboard.write(cmd); humanNote('Copied command to clipboard', 'Command') } catch { /* ignore */ }
    }
    if (logsUrl) {
      const wantCopyLogs = await clackConfirm({ message: 'Copy logs URL to clipboard?', initialValue: false })
      if (!isCancel(wantCopyLogs) && wantCopyLogs) {
        try { await clipboard.write(logsUrl); humanNote('Copied logs URL to clipboard', 'Command') } catch { /* ignore */ }
      }
    }
    // Offer to open logs/dashboard
    const openNow = await clackConfirm({ message: 'Open provider dashboard/logs now?', initialValue: false })
    if (!isCancel(openNow) && openNow) {
      try {
        if (logsUrl) {
          const opener: string = process.platform === 'win32' ? `start "" "${logsUrl}"` : process.platform === 'darwin' ? `open "${logsUrl}"` : `xdg-open "${logsUrl}"`
          await proc.run({ cmd: opener, cwd: targetCwd })
        } else {
          try {
            const plugin = await loadProvider(provider)
            await plugin.open({ projectId: effectiveProject, orgId: opts.org ?? saved.org })
          } catch { /* ignore */ }
        }
      } catch (e) {
        logger.warn(`Open logs failed: ${(e as Error).message}`)
      }
    }
    // Offer to save defaults
    if (opts.saveDefaults !== false) {
      const save = await clackConfirm({ message: 'Save these selections as defaults (opendeploy.config.json)?', initialValue: false })
      if (!isCancel(save) && save) {
        try {
          const cfgPath = join(rootCwd, 'opendeploy.config.json')
          let cfg: Record<string, unknown> = {}
          try { const raw = await fsx.readJson<Record<string, unknown>>(cfgPath); cfg = (raw ?? {}) as Record<string, unknown> } catch { /* new file */ }
          const startDefaults = {
            framework,
            provider,
            env: envTarget,
            path: targetPath,
            syncEnv: doSync,
            project: opts.project ?? saved.project,
            org: opts.org ?? saved.org
          }
          const merged = { ...cfg, startDefaults }
          await writeFile(cfgPath, JSON.stringify(merged, null, 2) + '\n', 'utf8')
          humanNote(`Wrote ${cfgPath}`, 'Config')
        } catch (e) {
          logger.warn(`Could not save defaults: ${(e as Error).message}`)
        }
      }
    }
    if (!machineMode) outro('Deployment complete')
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err)
    // Best-effort enriched error JSON for CI consumers
    const provGuess: Provider = (opts.provider as Provider) ?? 'vercel'
    const fail: Record<string, unknown> = { ok: false, action: 'start' as const, provider: provGuess, message, final: true }
    try {
      // Attempt to add context for downstream assertions
      const envTarget: 'prod' | 'preview' = (opts.env ?? 'preview') === 'prod' ? 'prod' : 'preview'
      if (typeof (opts.provider) === 'string') fail.provider = opts.provider
      fail.target = envTarget
      // If provider was vercel, indicate intended mode
      if ((opts.provider ?? '').toString() === 'vercel') {
        fail.mode = 'deploy'
        // Default ciChecklist so tests and CI have deterministic shape
        if (fail.ciChecklist === undefined) fail.ciChecklist = { buildCommand: 'build' }
      }
      // Include a minimal ciChecklist when detection exists
      try {
        // detection may be defined earlier if we reached that step
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (typeof detection?.buildCommand === 'string') {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          fail.ciChecklist = { buildCommand: detection.buildCommand }
        }
      } catch { /* ignore */ }
      // Attach provider meta from thrown error if available
      const meta = (err as any)?.meta as Record<string, unknown> | undefined
      if (meta && typeof meta === 'object') {
        if (meta.logsUrl && !('logsUrl' in fail)) fail.logsUrl = meta.logsUrl
        if (meta.url && !('url' in fail)) fail.url = meta.url
        if (meta.errorLogTail && !('errorLogTail' in fail)) fail.errorLogTail = meta.errorLogTail
      }
      // Emit best-effort NDJSON markers for consumers
      if (process.env.OPD_NDJSON === '1') {
        const prov = (opts.provider ?? '').toString()
        const base = { action: 'start', target: envTarget }
        if (prov === 'vercel') logger.json({ ...base, provider: 'vercel', event: 'logs', logsUrl: 'https://vercel.com' })
        logger.json({ ...base, provider: prov || 'vercel', event: 'done', ok: false })
      }
    } catch { /* ignore */ }
    if (isJsonMode(opts.json)) logger.json(fail)
    else {
      // Human-mode error: show concise tail and a logs URL
      logger.error(message)
      const tail = (fail.errorLogTail as string[] | undefined) ?? []
      if (tail.length > 0) {
        logger.section('Error Tail')
        for (const line of tail.slice(-10)) { if (line.trim().length > 0) logger.error(line) }
      }
      const lurl = (fail.logsUrl as string | undefined)
      if (lurl) logger.note(`Logs: ${String(lurl)}`)
    }
    const soft: boolean = Boolean(opts.softFail === true || opts.ci === true || opts.json === true || process.env.OPD_GHA === '1' || process.env.OPD_SUMMARY === '1' || process.env.OPD_SOFT_FAIL === '1')
    process.exitCode = soft ? 0 : 1
    return
  }
}

function buildNonInteractiveCmd(args: { readonly provider: Provider; readonly envTarget: 'prod' | 'preview'; readonly path?: string; readonly project?: string; readonly org?: string; readonly syncEnv?: boolean }): string {
  const parts: string[] = ['opd', 'up', args.provider, '--env', args.envTarget]
  if (args.syncEnv) parts.push('--sync-env')
  if (args.path) parts.push('--path', args.path)
  if (args.project) parts.push('--project', args.project)
  if (args.org) parts.push('--org', args.org)
  return parts.join(' ')
}

/** Register the guided start command. */
export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Guided deploy wizard (select framework, provider, env, and deploy)')
    .option('--framework <name>', 'Framework: next|astro|sveltekit|remix|expo')
    .option('--provider <name>', 'Provider: vercel|netlify')
    .option('--env <env>', 'Environment: prod|preview', 'preview')
    .option('--path <dir>', 'Path to app directory (monorepo)')
    .option('--project <id>', 'Provider project/site ID')
    .option('--org <id>', 'Provider org/team ID (Vercel)')
    .option('--sync-env', 'Sync environment before deploy')
    .option('--json', 'JSON-only output')
    .option('--print-cmd', 'Print underlying provider commands that will be executed')
    .option('--ci', 'CI mode (non-interactive)')
    .option('--skip-auth-check', 'Skip provider login checks (assume environment is already authenticated)')
    .option('--assume-logged-in', 'Alias for --skip-auth-check; bypass auth prompts entirely')
    .option('--dry-run', 'Plan only; skip deploy')
    .option('--skip-preflight', 'Skip local build preflight validation')
    .option('--soft-fail', 'Exit with code 0 on failure; emit ok:false JSON summary instead (CI-friendly)')
    .option('--capture', 'Write JSON and NDJSON logs to ./.artifacts (defaults on in --ci)')
    .option('--no-save-defaults', 'Do not prompt to save defaults')
    .option('--deploy', 'Execute a real deploy inside the wizard (Netlify optional; Vercel default path)')
    .option('--no-build', 'Netlify only: deploy prebuilt artifacts from publishDir without building')
    .option('--alias <domain>', 'Vercel only: set an alias (domain) after deploy')
    .option('--show-logs', 'Also echo provider stdout/stderr lines in human mode')
    .option('--summary-only', 'JSON: print only objects with final:true (suppresses transient JSON)')
    .option('--idle-timeout <seconds>', 'Abort if no new provider output arrives for N seconds (disabled by default)')
    .option('--timeout <seconds>', 'Abort provider subprocess after N seconds (default 900 in --ci; unlimited otherwise)')
    .option('--debug-detect', 'Emit detection JSON payload (path, framework, build/publish hints) for debugging')
    .option('--generate-config-only', 'Write vercel.json/netlify.toml based on detection and exit')
    .action(async (opts: StartOptions): Promise<void> => {
      try { await runStartWizard(opts) } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
      }
    })
}
