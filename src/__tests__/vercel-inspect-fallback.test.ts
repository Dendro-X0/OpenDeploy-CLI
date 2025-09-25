import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerUpCommand } from '../commands/up'

const calls: string[] = []
let origLog: typeof console.log

vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        calls.push(args.cmd)
        if (args.cmd.startsWith('vercel inspect ')) {
          // Return stdout containing an Inspect URL
          return { ok: true, exitCode: 0, stdout: 'Inspect: https://vercel.com/acme/astro-mini/inspect/dep_123', stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: { cmd: string; cwd?: string; onStdout?: (l: string) => void; onStderr?: (l: string) => void }) => {
        calls.push(args.cmd)
        // Simulate deploy emitting only deployment URL (no inspect URL)
        args.onStdout?.('https://astro-mini-test.vercel.app\n')
        return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
      })
    }
  }
})

describe('vercel inspect fallback (up --json)', () => {
  beforeEach(() => { origLog = console.log })
  afterEach(() => { console.log = origLog })
  it('emits logsUrl via fallback when not present during stream', async () => {
    const program = new Command()
    registerUpCommand(program)
    const lines: string[] = []
    console.log = ((...args: unknown[]) => { lines.push(String(args[0])) }) as any
    await program.parseAsync(['node','test','up','vercel','--env','preview','--json'])
    // Pick the most recent JSON line that looks like the final up summary for vercel
    const candidate = [...lines].reverse().find((l) => {
      return typeof l === 'string' && l.includes('"action":"up"') && l.includes('"provider":"vercel"') && l.includes('"final":true')
    }) ?? (lines[lines.length - 1] ?? '')
    const js = JSON.parse(candidate)
    expect(js.provider).toBe('vercel')
    expect(js.target).toBe('preview')
    expect(typeof js.url).toBe('string')
    expect(js.logsUrl).toContain('vercel.com')
  })
})
