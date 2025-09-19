import { Command } from 'commander'
import { join } from 'node:path'
import { logger } from '../utils/logger'
import { envSync } from './env'
import { proc } from '../utils/process'
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
import { VercelAdapter } from '../providers/vercel/adapter'
import { NetlifyAdapter } from '../providers/netlify/adapter'
import type { DetectionResult } from '../types/detection-result'
import type { Framework } from '../types/framework'
// writeFile moved into fs/promises import above

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

async function countFiles(dir: string): Promise<number> {
  try {
    const items = await readdir(dir)
    return items.length
  } catch { return 0 }
}

async function runBuildPreflight(args: { readonly detection: DetectionResult; readonly provider: Provider; readonly cwd: string; readonly ci: boolean }): Promise<void> {
  const { detection, provider, cwd, ci } = args
  if (ci) return
  const want = await clackConfirm({ message: 'Run a quick local build to validate config?', initialValue: true })
  if (isCancel(want) || want !== true) return
  const sp = spinner('Building')
  try {
    const out = await proc.run({ cmd: detection.buildCommand, cwd })
    if (!out.ok) {
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
        sp.stop()
        throw new Error(`Publish directory not found or empty: ${pub}. Ensure your build outputs static files there (e.g., adjust adapter or build command).`)
      }
    }
    sp.stop()
    note('Build validated', 'Preflight')
    logger.note('Build validated')
  } catch (e) {
    sp.stop()
    const msg = (e as Error).message
    note(msg, 'Preflight')
    logger.note(msg)
  }
}

// Create a Netlify site non-interactively. Returns site ID.
async function createNetlifySite(args: { readonly cwd: string; readonly name: string }): Promise<string> {
  // Try API-based creation (works across CLI versions)
  let accountSlug: string | undefined
  const acct = await proc.run({ cmd: 'netlify api listAccountsForUser', cwd: args.cwd })
  if (acct.ok) {
    try {
      const data = JSON.parse(acct.stdout) as Array<{ slug?: string }>
      if (Array.isArray(data) && data.length > 0 && typeof data[0]?.slug === 'string') accountSlug = data[0].slug
    } catch { /* ignore */ }
  }
  const payloadBase = { name: args.name } as Record<string, unknown>
  if (accountSlug) payloadBase.account_slug = accountSlug
  const json = JSON.stringify(payloadBase).replace(/"/g, '\\"')
  // Use a timeout around the API call to avoid indefinite waits on older CLIs
  const apiCmd = `netlify api createSite --data "${json}"
  `
  try {
    const ctrl = proc.spawnStream({ cmd: apiCmd.trim(), cwd: args.cwd })
    const res = await Promise.race([
      ctrl.done,
      new Promise<{ ok: boolean; exitCode: number }>((resolve) => setTimeout(() => resolve({ ok: false, exitCode: 124 }), 25000))
    ])
    if (res.ok) {
      // Re-run as run() to capture stdout cleanly
      const confirm = await proc.run({ cmd: apiCmd.trim(), cwd: args.cwd })
      if (confirm.ok) {
        try {
          const obj = JSON.parse(confirm.stdout) as { id?: string; site_id?: string }
          const id = (obj.site_id ?? obj.id)
          if (typeof id === 'string' && id.length > 0) return id
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  // Fallback: classic sites:create (parse human output)
  const createClassicCmd = accountSlug ? `netlify sites:create --name ${args.name} --account-slug ${accountSlug}` : `netlify sites:create --name ${args.name}`
  const createClassic = await proc.run({ cmd: createClassicCmd, cwd: args.cwd })
  if (!createClassic.ok) throw new Error((createClassic.stderr || createClassic.stdout || 'Netlify site creation failed').trim())
  const text = createClassic.stdout
  const m1 = text.match(/Site\s+ID\s*:\s*([a-z0-9-]+)/i) || text.match(/Site\s+Id\s*:\s*([a-z0-9-]+)/i)
  if (m1 && m1[1]) return m1[1]
  // Last resort: site URL line, then resolve site by name via listSites
  const ls = await proc.run({ cmd: 'netlify api listSites', cwd: args.cwd })
  if (ls.ok) {
    try {
      const arr = JSON.parse(ls.stdout) as Array<{ id?: string; name?: string }>
      const found = arr.find((s) => s && s.name === args.name)
      if (found && typeof found.id === 'string') return found.id
    } catch { /* ignore */ }
  }
  throw new Error('Netlify site created but ID not found')
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
async function providerStatus(p: Provider): Promise<string> {
  try {
    if (p === 'vercel') { const a = new VercelAdapter(); await a.validateAuth(); return 'logged in' }
    if (p === 'netlify') { const a = new NetlifyAdapter(); await a.validateAuth(); return 'logged in' }
  } catch { return 'login required' }
  return 'unknown'
}

async function ensureProviderAuth(p: Provider): Promise<void> {
  const status: string = await providerStatus(p)
  if (status === 'logged in') return
  const want = await clackConfirm({ message: `${p === 'vercel' ? 'Vercel' : 'Netlify'} login required. Log in now?`, initialValue: true })
  if (isCancel(want) || want !== true) throw new Error(`${p} login required`)
  const cmd: string = p === 'vercel' ? 'vercel login' : 'netlify login'
  note(`Running: ${cmd}`, 'Auth')
  const res = await proc.run({ cmd })
  if (!res.ok) throw new Error(`${p} login failed`)
}

/**
 * Deploy using the existing low-level logic (similar to `up`).
 */
async function runDeploy(args: { readonly provider: Provider; readonly env: 'prod' | 'preview'; readonly cwd: string; readonly json: boolean; readonly project?: string; readonly org?: string; readonly printCmd?: boolean }): Promise<{ readonly url?: string; readonly logsUrl?: string }> {
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
    const sp = spinner(`Vercel: deploying (${envTarget === 'prod' ? 'production' : 'preview'})`)
    let capturedUrl: string | undefined
    let capturedInspect: string | undefined
    const urlRe = /https?:\/\/[^\s]+vercel\.app/g
    if (args.printCmd) logger.info(`$ ${envTarget === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes'}`)
    const controller = proc.spawnStream({
      cmd: envTarget === 'prod' ? 'vercel deploy --prod --yes' : 'vercel deploy --yes',
      cwd: args.cwd,
      onStdout: (chunk: string): void => {
        const m = chunk.match(urlRe)
        if (!capturedUrl && m && m.length > 0) capturedUrl = m[0]
        if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') {
          const t = chunk.replace(/\s+$/, '')
          if (t.length > 0) logger.info(t)
        }
      },
      onStderr: (chunk: string): void => {
        if (!capturedInspect) { const found = extractVercelInspectUrl(chunk); if (found) capturedInspect = found }
      }
    })
    const res = await controller.done
    sp.stop()
    if (!res.ok) throw new Error('Vercel deploy failed')
    return { url: capturedUrl, logsUrl: capturedInspect }
  }
  // Netlify
  const sp = spinner(`Netlify: deploying (${envTarget === 'prod' ? 'production' : 'preview'})`)
  const siteFlag: string = args.project ? ` --site ${args.project}` : ''
  let capturedUrl: string | undefined
  const urlRe = /https?:\/\/[^\s]+\.netlify\.app\b/g
  if (args.printCmd) logger.info(`$ netlify deploy --build${envTarget === 'prod' ? ' --prod' : ''}${siteFlag}`.trim())
  const controller = proc.spawnStream({
    cmd: `netlify deploy --build${envTarget === 'prod' ? ' --prod' : ''}${siteFlag}`.trim(),
    cwd: args.cwd,
    onStdout: (chunk: string): void => {
      const m = chunk.match(urlRe)
      if (!capturedUrl && m && m.length > 0) capturedUrl = m[0]
      if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') {
        const t = chunk.replace(/\s+$/, '')
        if (t.length > 0) logger.info(t)
      }
    },
    onStderr: (chunk: string): void => {
      if (process.env.OPD_JSON !== '1' && process.env.OPD_NDJSON !== '1') {
        const t = chunk.replace(/\s+$/, '')
        if (t.length > 0) logger.info(t)
      }
    }
  })
  const res = await controller.done
  sp.stop()
  if (!res.ok) throw new Error('Netlify deploy failed')
  return { url: capturedUrl }
}

export async function runStartWizard(opts: StartOptions): Promise<void> {
  try {
    const rootCwd: string = process.cwd()
    if (opts.json === true) logger.setJsonOnly(true)
    intro('OpenDeploy • Start')
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

    // Framework
    let framework: Framework | undefined = opts.framework ?? (saved.framework as Framework | undefined)
    if (!framework) framework = await autoDetectFramework(rootCwd)
    if (!framework) {
      const marks = await detectMarks({ cwd: rootCwd })
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
      framework = (choice as { value: Framework }).value
    }
    void framework

    // Early dry-run summary before any provider auth/linking
    const envTargetEarly: 'prod' | 'preview' = (opts.env ?? (saved.env as 'prod' | 'preview') ?? 'preview') === 'prod' ? 'prod' : 'preview'
    if (opts.dryRun === true) {
      const provEarly: Provider = (opts.provider as Provider) ?? (saved.provider as Provider) ?? 'vercel'
      const cmdEarly = buildNonInteractiveCmd({ provider: provEarly, envTarget: envTargetEarly, path: opts.path, project: opts.project, org: opts.org, syncEnv: Boolean(opts.syncEnv) })
      const summaryEarly = { ok: true, provider: provEarly, target: envTargetEarly, mode: 'dry-run', cmd: cmdEarly, final: true }
      logger.json(summaryEarly)
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(summaryEarly))
      outro('Dry run complete')
      return
    }

    // Provider
    let provider: Provider | undefined = opts.provider ?? (saved.provider as Provider | undefined)
    if (!provider) {
      const [vs, ns] = await Promise.all([providerStatus('vercel'), providerStatus('netlify')])
      const choice = await select({
        message: 'Select deployment provider',
        options: [
          { value: 'vercel', label: `Vercel (${vs})` },
          { value: 'netlify', label: `Netlify (${ns})` }
        ]
      })
      if (isCancel(choice)) { cancel('Cancelled'); return }
      provider = (choice as { value: Provider }).value
    }

    // One-click login when missing
    await ensureProviderAuth(provider!)

    // Path
    const targetPath: string | undefined = opts.path ?? saved.path
    const targetCwd: string = targetPath ? join(rootCwd, targetPath) : rootCwd

    // Track a created Netlify site id (if we create one) so we can pass it to deploy
    let createdSiteId: string | undefined

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
    if (provider === 'netlify') {
      const linked: boolean = await fsx.exists(join(targetCwd, '.netlify', 'state.json'))
      if (!linked) {
        if (opts.project) {
          const doLink = await clackConfirm({ message: `Link this directory to Netlify site ${opts.project}?`, initialValue: true })
          if (isCancel(doLink)) { cancel('Cancelled'); return }
          if (doLink) {
            note(`Running: netlify link --id ${opts.project}`, 'Link')
            const out = await proc.run({ cmd: `netlify link --id ${opts.project}`, cwd: targetCwd })
            if (!out.ok) {
              if (opts.json !== true) {
                if (out.stderr.trim().length > 0) logger.error(out.stderr.trim())
                if (out.stdout.trim().length > 0) logger.note(out.stdout.trim())
              }
              throw new Error('Netlify link failed')
            }
          }
        } else {
          // Avoid interactive hang: offer to create a site and then link
          const doCreate = await clackConfirm({ message: 'No linked Netlify site. Create a new site here?', initialValue: true })
          if (isCancel(doCreate)) { cancel('Cancelled'); return }
          if (doCreate) {
            const base = targetCwd.split(/[/\\]/).pop() ?? 'site'
            const name = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'site'
            note(`Creating Netlify site: ${name}`, 'Create')
            const spCreate = spinner('Netlify: creating site')
            try {
              createdSiteId = await createNetlifySite({ cwd: targetCwd, name })
            } catch (e) {
              spCreate.stop()
              throw e
            }
            spCreate.stop()
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
            const chosenSiteId: string = (choice as { value: string }).value
            note(`Running: netlify link --id ${chosenSiteId}`, 'Link')
            const linkRes = await proc.run({ cmd: `netlify link --id ${chosenSiteId}`, cwd: targetCwd })
            if (!linkRes.ok) throw new Error('Netlify link failed')
            createdSiteId = chosenSiteId
          }
        }
      }
    }

    // Compute env target for subsequent steps
    const envTarget: 'prod' | 'preview' = (opts.env ?? (saved.env as 'prod' | 'preview') ?? 'preview') === 'prod' ? 'prod' : 'preview'

    // Env + Sync
    let doSync: boolean = Boolean(opts.syncEnv ?? saved.syncEnv)
    if (!opts.ci && opts.syncEnv === undefined && saved.syncEnv === undefined) {
      const res = await clackConfirm({ message: 'Auto-sync .env before deploy?', initialValue: true })
      if (isCancel(res)) { cancel('Cancelled'); return }
      doSync = res as boolean
    }

    if (doSync) {
      const candidates: readonly string[] = envTarget === 'prod' ? ['.env.production.local', '.env'] : ['.env', '.env.local']
      let chosenFile: string | undefined
      for (const f of candidates) { if (await fsx.exists(join(targetCwd, f))) { chosenFile = f; break } }
      if (chosenFile) {
        // Optional plan preview (keys only)
        const wantPlan = await clackConfirm({ message: `Show env sync plan for ${chosenFile} (keys only)?`, initialValue: false })
        if (!isCancel(wantPlan) && wantPlan) {
          try {
            const keys = await parseEnvKeys(join(targetCwd, chosenFile))
            const preview = keys.slice(0, 20).join(', ') + (keys.length > 20 ? `, …(+${keys.length - 20})` : '')
            note(`Env file: ${chosenFile}\nKeys: ${keys.length}\nPreview: ${preview}`, 'Plan')
          } catch { /* ignore plan parse errors */ }
        }
        try { const patterns = await computeRedactors({ cwd: targetCwd, envFiles: [chosenFile], includeProcessEnv: true }); if (patterns.length > 0) logger.setRedactors(patterns) } catch { /* ignore */ }
        note(`Syncing ${chosenFile} → ${provider}`, 'Environment')
        await envSync({ provider: provider!, cwd: targetCwd, file: chosenFile, env: envTarget, yes: true, ci: Boolean(opts.ci), json: false, projectId: opts.project, orgId: opts.org, ignore: [], only: [], optimizeWrites: true })
      } else {
        note('No local .env file found to sync', 'Environment')
      }
    }

    // One-time detection for downstream steps
    const detection: DetectionResult = await detectForFramework(framework!, targetCwd)
    // Wizard annotation: React Router v7 (Remix family)
    try {
      if (detection.framework === 'remix' && /react-router\s+build/i.test(detection.buildCommand)) {
        note('Remix (React Router v7 detected)', 'Framework')
      }
    } catch { /* ignore */ }

    // Optional build preflight
    await runBuildPreflight({ detection, provider: provider!, cwd: targetCwd, ci: Boolean(opts.ci) })

    // Deploy / Prepare
    // Ensure a netlify.toml via adapter for all frameworks (prepare-only flow)
    if (provider === 'netlify') {
      try {
        const a = new NetlifyAdapter(); await a.generateConfig({ detection, overwrite: false }); note('Ensured netlify.toml', 'Config')
      } catch { /* ignore if exists */ }
    }
    // Use createdSiteId when provider=netlify and no explicit project was provided
    const effectiveProject: string | undefined = provider === 'netlify'
      ? (opts.project ?? createdSiteId ?? (saved.project as string | undefined))
      : (opts.project ?? (saved.project as string | undefined))

    if (provider === 'netlify') {
      // Prepare-only: detect publish dir and print recommended commands.
      const publishDir: string = detection.publishDir ?? inferNetlifyPublishDir({ framework: framework!, cwd: targetCwd })
      // Resolve site name for enriched JSON summaries
      let siteName: string | undefined
      try {
        const siteId: string | undefined = effectiveProject
        if (siteId) {
          const siteRes = await proc.run({ cmd: `netlify api getSite --data '{"site_id":"${siteId}"}'`, cwd: targetCwd })
          if (siteRes.ok) {
            try { const js = JSON.parse(siteRes.stdout) as { name?: string }; if (typeof js.name === 'string') siteName = js.name } catch { /* ignore */ }
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
      const previewCmd = `netlify deploy --dir ${publishDir}${effectiveProject ? ` --site ${effectiveProject}` : ''}`.trim()
      const prodCmd = `netlify deploy --prod --dir ${publishDir}${effectiveProject ? ` --site ${effectiveProject}` : ''}`.trim()
      if (opts.printCmd === true) {
        logger.info(`$ ${previewCmd}`)
        logger.info(`$ ${prodCmd}`)
      }
      if (opts.json === true) {
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
          final: true
        }
        logger.jsonPrint(summary)
        outro('Prepared')
        return
      }
      // Human messaging with Git/CI recommendation and CI checklist
      logger.warn('Netlify (prepare-only): connect your repository and use Git/CI builds for reliability and caching. Local builds can be slower or time out on first runs.')
      note('Netlify Git/CI: In Netlify Admin → Connect to Git. Set Build command and Publish directory per framework, and add environment variables.', 'Recommendation')
      note(`Recommended preview deploy:\n${previewCmd}`, 'Netlify')
      note(`Recommended production deploy:\n${prodCmd}`, 'Netlify')
      const lines: string[] = []
      lines.push(`Build command: ${buildCommand}`)
      lines.push(`Publish dir:  ${publishDir}`)
      if (ciEnvFile) lines.push(`Env file:     ${ciEnvFile}`)
      if (envKeysExample && envKeysExample.length > 0) lines.push(`Example keys: ${envKeysExample.join(', ')}${envKeysExample.length >= 10 ? '…' : ''}`)
      note(lines.join('\n'), 'CI Checklist')
      outro('Preparation complete')
      return
    }

    // Ensure vercel.json for Vercel
    try {
      const va = new VercelAdapter(); await va.generateConfig({ detection, overwrite: false }); note('Ensured vercel.json', 'Config')
    } catch { /* ignore if exists */ }

    // Vercel deploy path (unchanged)
    const { url, logsUrl } = await runDeploy({ provider: provider!, env: envTarget, cwd: targetCwd, json: Boolean(opts.json), project: effectiveProject, org: opts.org ?? saved.org, printCmd: opts.printCmd === true })
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
    if (opts.json === true) {
      logger.json({ ok: true, action: 'start', provider, target: envTarget, mode: 'deploy', url, logsUrl, cmd, ciChecklist: { buildCommand, envFile: ciEnvFile, exampleKeys: envKeysExample }, final: true })
      outro('Done');
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
      if (lines.length > 0) note(lines.join('\n'), 'CI Checklist')
    }
    note(`Rerun non-interactively:\n${cmd}`, 'Command')
    const wantCopy = await clackConfirm({ message: 'Copy command to clipboard?', initialValue: false })
    if (!isCancel(wantCopy) && wantCopy) {
      try { await clipboard.write(cmd); note('Copied command to clipboard', 'Command') } catch { /* ignore */ }
    }
    if (logsUrl) {
      const wantCopyLogs = await clackConfirm({ message: 'Copy logs URL to clipboard?', initialValue: false })
      if (!isCancel(wantCopyLogs) && wantCopyLogs) {
        try { await clipboard.write(logsUrl); note('Copied logs URL to clipboard', 'Command') } catch { /* ignore */ }
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
          if (provider === 'vercel') { const a = new VercelAdapter(); await a.open(effectiveProject) }
          else { const a = new NetlifyAdapter(); await a.open(effectiveProject) }
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
          note(`Wrote ${cfgPath}`, 'Config')
        } catch (e) {
          logger.warn(`Could not save defaults: ${(e as Error).message}`)
        }
      }
    }
    outro('Deployment complete')
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err)
    if (opts.json === true) logger.json({ ok: false, message, final: true })
    process.exitCode = 1
    return
  }
}

function buildNonInteractiveCmd(args: { readonly provider: Provider; readonly envTarget: 'prod' | 'preview'; readonly path?: string; readonly project?: string; readonly org?: string; readonly syncEnv?: boolean }): string {
  const parts: string[] = ['opendeploy', 'up', args.provider, '--env', args.envTarget]
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
    .option('--dry-run', 'Plan only; skip deploy')
    .option('--no-save-defaults', 'Do not prompt to save defaults')
    .action(async (opts: StartOptions): Promise<void> => {
      try { await runStartWizard(opts) } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
      }
    })
}
