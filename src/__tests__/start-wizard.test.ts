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

import { runStartWizard } from '../commands/start'
import { registerUpCommand } from '../commands/up'

beforeEach(() => { logs.length = 0; vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(String(args[0] ?? '')); return undefined as any }) })
afterEach(() => { (console.log as any) = origLog })

describe('start wizard', () => {
  it('emits deterministic dry-run JSON summary (preview, vercel)', async () => {
    await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', dryRun: true, json: true, ci: true })
    const last = logs.pop() ?? ''
    const obj = JSON.parse(last)
    expect(obj).toMatchObject({ ok: true, provider: 'vercel', target: 'preview', mode: 'dry-run', final: true })
  })

  it('performs one-click login when provider not logged in (netlify)', async () => {
    // Make select return framework then provider
    selectMock.mockResolvedValueOnce({ value: 'next' }).mockResolvedValueOnce({ value: 'netlify' })
    await runStartWizard({ env: 'preview', dryRun: true, json: true })
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(obj).toHaveProperty('final', true)
    expect([ 'netlify', 'vercel' ]).toContain(obj.provider)
  })

  it('emits ok:false JSON summary when deploy fails (vercel)', async () => {
    failDeploy = true
    try {
      await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', json: true, ci: true, syncEnv: false })
    } catch { /* wizard sets exitCode; swallow */ }
    failDeploy = false
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(obj).toMatchObject({ ok: false, final: true })
  })

  it('emits ok:false JSON summary when vercel auth fails (whoami+login)', async () => {
    failVercelWhoami = true
    failVercelLogin = true
    try {
      await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', json: true })
    } catch { /* swallow */ }
    failVercelWhoami = false
    failVercelLogin = false
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(obj).toMatchObject({ ok: false, final: true })
  })

  it('emits ok:false JSON summary when netlify login fails', async () => {
    failNetlifyLogin = true
    try {
      await runStartWizard({ provider: 'netlify', env: 'preview', json: true })
    } catch { /* swallow */ }
    failNetlifyLogin = false
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(obj).toMatchObject({ ok: false, final: true })
  })
})

describe('up auto-wizard', () => {
  it('falls back to wizard when provider missing and emits final JSON', async () => {
    const program = new Command()
    registerUpCommand(program)
    await program.parseAsync(['node', 'test', 'up', '--dry-run', '--json'])
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(obj).toHaveProperty('final', true)
  })

  it('emits ok:false JSON summary when link fails (netlify)', async () => {
    // Wizard with netlify, project set, link failure
    failNetlifyLink = true
    try {
      await runStartWizard({ provider: 'netlify', project: 'site_123', env: 'preview', json: true, syncEnv: false })
    } catch { /* swallow */ }
    failNetlifyLink = false
    const line = logs.find((l) => l.includes('"final": true')) ?? '{}'
    const obj = JSON.parse(line)
    expect(obj).toMatchObject({ ok: false, final: true })
  })
})
