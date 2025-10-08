import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runStartWizard } from '../commands/start'

// Capture console JSON lines
const lines: string[] = []
const origLog = console.log

beforeEach(() => {
  lines.length = 0
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(String(a[0] ?? '')); return undefined as any })
})
afterEach(() => { (console.log as any) = origLog })

// No prompts in non-interactive test
vi.mock('@clack/prompts', () => ({ intro: () => {}, outro: () => {}, select: async () => 'next', confirm: async () => true, isCancel: () => false, cancel: () => {}, note: () => {} }))

// Mock provider loader so start wizard's vercel generateConfig is a no-op
vi.mock('../core/provider-system/provider', () => ({
  loadProvider: async (name: string) => {
    if (name === 'vercel') { return { generateConfig: async () => 'vercel.json' } }
    throw new Error('unexpected provider in start-vercel-logsurl.test')
  }
}))

// Mock process utils to simulate vercel deploy that does not print inspect URL, and a working inspect fallback
const calls: string[] = []
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        calls.push(args.cmd)
        if (args.cmd.startsWith('vercel inspect ')) {
          return { ok: true, exitCode: 0, stdout: 'Inspect: https://vercel.com/acme/site/inspect/dep_xyz', stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: { cmd: string; onStdout?: (l: string) => void; onStderr?: (l: string) => void }) => {
        calls.push(args.cmd)
        if (args.cmd.startsWith('vercel deploy')) {
          args.onStdout?.('https://site-example.vercel.app\n')
        }
        return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
      })
    }
  }
})

// Also mock relative path that providers might import (defensive)
vi.mock('../../../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        calls.push(args.cmd)
        if (args.cmd.startsWith('vercel inspect ')) {
          return { ok: true, exitCode: 0, stdout: 'Inspect: https://vercel.com/acme/site/inspect/dep_xyz', stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: { cmd: string; onStdout?: (l: string) => void; onStderr?: (l: string) => void }) => {
        calls.push(args.cmd)
        if (args.cmd.startsWith('vercel deploy')) {
          args.onStdout?.('https://site-example.vercel.app\n')
        }
        return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
      })
    }
  }
})

function lastFinal(): any {
  for (let i = lines.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(lines[i]); if (o && o.final) return o } catch { /* ignore */ }
  }
  return {}
}

describe('start wizard logsUrl (vercel)', () => {
  it.skip('includes logsUrl (inspect fallback) in final JSON summary', async () => {
    await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', json: true, ci: true, syncEnv: false })
    const o = lastFinal()
    expect(o.provider).toBe('vercel')
    expect(o.mode).toBe('deploy')
    expect(String(o.logsUrl || '')).toContain('vercel.com')
  })
})
