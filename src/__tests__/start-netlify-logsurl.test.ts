import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runStartWizard } from '../commands/start'

// Capture final JSON line
const lines: string[] = []
const origLog = console.log

beforeEach(() => { lines.length = 0; vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(String(a[0] ?? '')); return undefined as any }) })
afterEach(() => { (console.log as any) = origLog })

// Do not prompt in tests
vi.mock('@clack/prompts', () => ({ intro: () => {}, outro: () => {}, select: async () => 'next', confirm: async () => true, isCancel: () => false, cancel: () => {}, note: () => {} }))

// Mock process utils to inject admin_url output for netlify deploy path
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      spawnStream: vi.fn((args: { cmd: string; onStdout?: (l: string) => void; onStderr?: (l: string) => void }) => {
        if (args.cmd.startsWith('netlify deploy')) {
          // Simulate final JSON line with admin_url
          args.onStdout?.('{"admin_url":"https://app.netlify.com/sites/my-site"}\n')
          args.onStdout?.('https://my-site.netlify.app\n')
          return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
        }
        return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
      })
    }
  }
})

function lastFinal(): any { for (let i = lines.length - 1; i >= 0; i--) { try { const o = JSON.parse(lines[i]); if (o && o.final) return o } catch { /* ignore */ } } return {} }

describe('start wizard logsUrl (netlify)', () => {
  it.skip('includes logsUrl when admin_url is present', async () => {
    await runStartWizard({ framework: 'next', provider: 'netlify', env: 'prod', json: true, ci: true, syncEnv: false, deploy: true })
    const o = lastFinal()
    expect(o.provider).toBe('netlify')
    expect(o.mode).toBe('deploy')
    expect(String(o.logsUrl || '')).toContain('app.netlify.com')
  })
})
