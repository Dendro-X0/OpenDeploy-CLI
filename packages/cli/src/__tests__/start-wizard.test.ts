import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Capture console output
const logs: string[] = []
const origLog = console.log

let failDeploy = false
let failVercelWhoami = false
let failVercelLogin = false

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
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: any) => {
        if (typeof args?.cmd === 'string' && args.cmd.includes('vercel deploy')) {
          // Simulate an Inspect line on stderr so wizard can capture logsUrl
          if (typeof args.onStderr === 'function') {
            args.onStderr('Inspect: https://vercel.com/acme/app/inspections/deploy_123')
          }
          if (failDeploy) {
            return { done: Promise.resolve({ ok: false, exitCode: 1 }) }
          }
          return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
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

// Mock fsx.exists to avoid touching real filesystem
vi.mock('../utils/fs', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    fsx: {
      ...(real.fsx ?? {}),
      exists: vi.fn(async (p: string) => {
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

// Hoisted flags to control provider auth behavior
const { mockFailVercelAuth } = vi.hoisted(() => ({
  mockFailVercelAuth: { value: false }
}))

// Mock provider loader to inject auth failures deterministically
vi.mock('../core/provider-system/provider', () => ({
  loadProvider: async (name: string) => {
    return {
      id: name,
      getCapabilities: () => ({
        name: 'Vercel',
        supportsLocalBuild: true,
        supportsRemoteBuild: true,
        supportsStaticDeploy: true,
        supportsServerless: true,
        supportsEdgeFunctions: true,
        supportsSsr: true,
        hasProjectLinking: true,
        envContexts: ['preview','production'],
        supportsLogsFollow: true,
        supportsAliasDomains: true,
        supportsRollback: false
      }),
      async detect() { return {} },
      async validateAuth() {
        if (name === 'vercel' && mockFailVercelAuth.value) throw new Error('not logged in')
        return
      },
      async link(_cwd: string, proj: any) { return proj },
      async build(_args: any) { return { ok: true } },
      async deploy(_args: any) { return { ok: true } },
      async open() { return },
      async envList() { return {} },
      async envSet() { return },
      async logs() { return },
      async generateConfig() { return 'noop' }
    }
  }
}))

import { runStartWizard } from '../commands/start'
import { registerUpCommand } from '../commands/up'

beforeEach(() => { logs.length = 0; mockFailVercelAuth.value = false; vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any }) })
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

  it('vercel JSON summary includes ciChecklist (deploy mode)', async () => {
    await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', json: true, ci: true, syncEnv: false })
    const obj = getLastStartJson()
    expect(obj).toHaveProperty('provider', 'vercel')
    expect(obj).toHaveProperty('mode', 'deploy')
    expect(obj).toHaveProperty('ciChecklist')
    expect(obj.ciChecklist).toHaveProperty('buildCommand')
  })

  it('emits NDJSON logs event for Vercel (deploy)', async () => {
    const prev = process.env.OPD_NDJSON
    process.env.OPD_NDJSON = '1'
    try {
      await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', ci: true, syncEnv: false })
    } finally {
      if (prev === undefined) delete process.env.OPD_NDJSON; else process.env.OPD_NDJSON = prev
    }
    const logsEventLine = [...logs].reverse().find((l) => {
      try { const o = JSON.parse(l); return o && o.action === 'start' && o.event === 'logs' && typeof o.logsUrl === 'string' } catch { return false }
    }) ?? '{}'
    const evt = JSON.parse(logsEventLine)
    expect(evt).toHaveProperty('event', 'logs')
    expect(evt).toHaveProperty('logsUrl')
    expect(String(evt.logsUrl)).toContain('vercel.com')
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
})
