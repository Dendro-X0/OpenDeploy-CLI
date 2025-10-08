import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerUpCommand } from '../commands/up'
import { logger } from '../utils/logger'

let jsonSpy: ReturnType<typeof vi.spyOn>
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
          return { ok: true, exitCode: 0, stdout: 'Inspect: https://vercel.com/acme/site/inspect/dep_456', stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: { cmd: string; cwd?: string; onStdout?: (l: string) => void; onStderr?: (l: string) => void }) => {
        calls.push(args.cmd)
        // Simulate deploy emitting only deployment URL (no inspect)
        args.onStdout?.('https://vercel-site-example.vercel.app\n')
        return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
      })
    }
  }
})

vi.mock('../../../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        calls.push(args.cmd)
        if (args.cmd.startsWith('vercel inspect ')) {
          return { ok: true, exitCode: 0, stdout: 'Inspect: https://vercel.com/acme/site/inspect/dep_456', stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: { cmd: string; cwd?: string; onStdout?: (l: string) => void; onStderr?: (l: string) => void }) => {
        calls.push(args.cmd)
        args.onStdout?.('https://vercel-site-example.vercel.app\n')
        return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
      })
    }
  }
})

describe('up vercel emits logsUrl (inspect fallback) in JSON', () => {
  beforeEach(() => { jsonSpy = vi.spyOn(logger, 'jsonPrint').mockImplementation(() => { /* swallow */ }) })
  afterEach(() => { jsonSpy.mockRestore() })
  it('includes logsUrl in summary', async () => {
    const program = new Command()
    registerUpCommand(program)
    await program.parseAsync(['node','test','up','vercel','--env','preview','--json'])
    const last = (jsonSpy.mock.calls.at(-1)?.[0] ?? {}) as any
    expect(last.provider).toBe('vercel')
    expect(last.target).toBe('preview')
    expect((last.logsUrl || '').toString()).toContain('vercel.com')
  })
})
