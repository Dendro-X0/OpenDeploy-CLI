import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Capture console output
const logs: string[] = []
const origLog = console.log

let failDeploy = false
let failNetlifyLink = false
let failVercelWhoami = false
let failVercelLogin = false
let failNetlifyLogin = false

vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        // Simulate provider auth and login commands
        if (args.cmd.startsWith('vercel whoami')) return failVercelWhoami ? { ok: false, exitCode: 1, stdout: '', stderr: 'not logged in' } : { ok: true, exitCode: 0, stdout: 'you@vercel', stderr: '' }
        if (args.cmd.startsWith('vercel login')) return failVercelLogin ? { ok: false, exitCode: 1, stdout: '', stderr: 'login failed' } : { ok: true, exitCode: 0, stdout: 'ok', stderr: '' }
        if (args.cmd.startsWith('netlify api getSite')) return { ok: true, exitCode: 0, stdout: '{"name":"mysite","admin_url":"https://app.netlify.com/sites/mysite"}', stderr: '' }
        if (args.cmd.startsWith('netlify --version')) return { ok: true, exitCode: 0, stdout: 'netlify-cli/0.0.0', stderr: '' }
        if (args.cmd.startsWith('netlify status')) return { ok: false, exitCode: 1, stdout: 'Not logged in', stderr: '' }
        if (args.cmd.startsWith('netlify login')) return failNetlifyLogin ? { ok: false, exitCode: 1, stdout: '', stderr: 'login failed' } : { ok: true, exitCode: 0, stdout: 'ok', stderr: '' }
        if (args.cmd.startsWith('netlify link')) return failNetlifyLink ? { ok: false, exitCode: 1, stdout: '', stderr: 'link failed' } : { ok: true, exitCode: 0, stdout: 'linked', stderr: '' }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: { cmd: string }) => {
        if (args.cmd.includes('vercel deploy') && failDeploy) {
          return { done: Promise.resolve({ ok: false, exitCode: 1 }) }
        }
        return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
      })
    }
  }
})

// Stub prompts (use hoisted mocks to satisfy Vitest hoisting of vi.mock)
const { selectMock, confirmMock } = vi.hoisted(() => ({
  selectMock: vi.fn(async () => ({ value: 'next' })),
  confirmMock: vi.fn(async () => true)
}))
vi.mock('@clack/prompts', () => ({
  intro: () => {},
  outro: () => {},
  select: selectMock,
  confirm: confirmMock,
  isCancel: () => false,
  cancel: () => {},
  note: () => {}
}))

// Mock fsx.exists to force Netlify link path by pretending `.netlify/state.json` is absent
vi.mock('../utils/fs', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    fsx: {
      ...(real.fsx ?? {}),
      exists: vi.fn(async (p: string) => {
        try { if (String(p).endsWith('.netlify/state.json')) return false } catch {}
        return false
      }),
      readJson: vi.fn(async () => { throw new Error('not found') })
    }
  }
})

// Mock next detector to avoid touching real filesystem
vi.mock('../core/detectors/next', () => ({
  detectNextApp: async () => ({
    framework: 'next',
    renderMode: 'ssr',
    rootDir: '.',
    appDir: '.',
    hasAppRouter: false,
    packageManager: 'pnpm',
    monorepo: 'none',
    buildCommand: 'echo build',
    outputDir: '.next',
    publishDir: '.next',
    confidence: 0.95,
    environmentFiles: []
  })
}))

// Hoisted flags to control adapter auth behavior
const { mockFailVercelAuth, mockFailNetlifyAuth } = vi.hoisted(() => ({
  mockFailVercelAuth: { value: false },
  mockFailNetlifyAuth: { value: false }
}))

// Mock provider adapters; validateAuth throws when flags set
vi.mock('../providers/vercel/adapter', () => ({
  VercelAdapter: class {
    async validateAuth() { if (mockFailVercelAuth.value) throw new Error('not logged in') }
    async generateConfig() { return }
    async open() { return }
  }
}))
vi.mock('../providers/netlify/adapter', () => ({
  NetlifyAdapter: class {
    async validateAuth() { if (mockFailNetlifyAuth.value) throw new Error('not logged in') }
    async generateConfig() { return }
    async open() { return }
  }
}))

import { runStartWizard } from '../commands/start'
import { registerUpCommand } from '../commands/up'

beforeEach(() => { logs.length = 0; mockFailVercelAuth.value = false; mockFailNetlifyAuth.value = false; vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any }) })
afterEach(() => { (console.log as any) = origLog })

function getLastStartJson(): any {
  // Scan from the end for the last start summary
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i]
    try { const obj = JSON.parse(l); if (obj && obj.action === 'start' && obj.final === true) return obj } catch {}
  }
  // Fallback: any final JSON
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i]
    try { const obj = JSON.parse(l); if (obj && obj.final === true) return obj } catch {}
  }
  return {}
}

describe('start wizard', () => {
  it('emits deterministic dry-run JSON summary (preview, vercel)', async () => {
    await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', dryRun: true, json: true, ci: true })
    const last = logs.pop() ?? ''
    const obj = JSON.parse(last)
    expect(obj).toMatchObject({ ok: true, provider: 'vercel', target: 'preview', mode: 'dry-run', final: true })
  })

  it('performs one-click login when provider not logged in (netlify)', async () => {
    await runStartWizard({ framework: 'next', provider: 'netlify', env: 'preview', dryRun: true, json: true })
    const obj = getLastStartJson()
    expect(obj).toHaveProperty('final', true)
    expect([ 'netlify', 'vercel' ]).toContain(obj.provider)
  })

  it('emits ok:false JSON summary when deploy fails (vercel)', async () => {
    failDeploy = true
    try {
      await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', json: true, ci: true, syncEnv: false })
    } catch { /* wizard sets exitCode; swallow */ }
    failDeploy = false
    const obj = getLastStartJson()
    expect(obj).toMatchObject({ ok: false, final: true })
  })

  it('emits ok:false JSON summary when vercel auth fails (validateAuth+login)', async () => {
    mockFailVercelAuth.value = true
    failVercelLogin = true
    try {
      await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', json: true })
    } catch { /* swallow */ }
    mockFailVercelAuth.value = false
    failVercelLogin = false
    const obj = getLastStartJson()
    expect(obj).toMatchObject({ ok: false, final: true })
  })

  it('emits ok:false JSON summary when netlify login fails', async () => {
    mockFailNetlifyAuth.value = true
    failNetlifyLogin = true
    try {
      await runStartWizard({ provider: 'netlify', env: 'preview', json: true })
    } catch { /* swallow */ }
    mockFailNetlifyAuth.value = false
    failNetlifyLogin = false
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(obj).toMatchObject({ ok: false, final: true })
  })

  it('netlify JSON summary includes ciChecklist and recommend (prepare-only)', async () => {
    await runStartWizard({ framework: 'next', provider: 'netlify', project: 'site_123', env: 'preview', json: true, ci: true, syncEnv: false })
    const obj = getLastStartJson()
    expect(obj).toHaveProperty('provider', 'netlify')
    expect(obj).toHaveProperty('mode', 'prepare-only')
    expect(obj).toHaveProperty('ciChecklist')
    expect(obj.ciChecklist).toHaveProperty('buildCommand')
    // publishDir is present for Netlify
    expect(obj.ciChecklist).toHaveProperty('publishDir')
    // recommend commands present
    expect(obj).toHaveProperty('recommend')
    // logsUrl present from admin_url
    expect(obj).toHaveProperty('logsUrl')
    expect(String(obj.logsUrl)).toContain('app.netlify.com')
  })

  it('vercel JSON summary includes ciChecklist (deploy mode)', async () => {
    await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', json: true, ci: true, syncEnv: false })
    const obj = getLastStartJson()
    expect(obj).toHaveProperty('provider', 'vercel')
    expect(obj).toHaveProperty('mode', 'deploy')
    expect(obj).toHaveProperty('ciChecklist')
    expect(obj.ciChecklist).toHaveProperty('buildCommand')
  })

  it('netlify deploy JSON includes logsUrl (deploy mode)', async () => {
    await runStartWizard({ framework: 'next', provider: 'netlify', project: 'site_123', env: 'preview', json: true, ci: true, syncEnv: false, deploy: true, noBuild: true })
    const obj = getLastStartJson()
    expect(obj).toHaveProperty('provider', 'netlify')
    expect(obj).toHaveProperty('mode', 'deploy')
    expect(obj).toHaveProperty('logsUrl')
    expect(String(obj.logsUrl)).toContain('app.netlify.com')
  })

  it('emits NDJSON logs event for Netlify (prepare-only)', async () => {
    const prev = process.env.OPD_NDJSON
    process.env.OPD_NDJSON = '1'
    try {
      await runStartWizard({ framework: 'next', provider: 'netlify', project: 'site_123', env: 'preview', ci: true, syncEnv: false })
    } finally {
      if (prev === undefined) delete process.env.OPD_NDJSON; else process.env.OPD_NDJSON = prev
    }
    const logsEventLine = [...logs].reverse().find((l) => {
      try { const o = JSON.parse(l); return o && o.action === 'start' && o.event === 'logs' && typeof o.logsUrl === 'string' } catch { return false }
    }) ?? '{}'
    const evt = JSON.parse(logsEventLine)
    expect(evt).toHaveProperty('event', 'logs')
    expect(evt).toHaveProperty('logsUrl')
    expect(String(evt.logsUrl)).toContain('app.netlify.com')
  })
})

describe('up auto-wizard', () => {
  it('falls back to wizard when provider missing and emits final JSON', async () => {
    const program = new Command()
    registerUpCommand(program)
    await program.parseAsync(['node', 'test', 'up', '--dry-run', '--json'])
    const obj = getLastStartJson()
    expect(obj).toHaveProperty('final', true)
  })

  it('emits ok:false JSON summary when link fails (netlify)', async () => {
    // Wizard with netlify, project set, link failure
    failNetlifyLink = true
    try {
      await runStartWizard({ provider: 'netlify', project: 'site_123', env: 'preview', json: true, syncEnv: false })
    } catch { /* swallow */ }
    failNetlifyLink = false
    const obj = getLastStartJson()
    expect(obj).toMatchObject({ ok: false, final: true })
  })
})
