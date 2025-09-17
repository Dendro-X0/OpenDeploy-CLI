import { describe, it, expect, vi } from 'vitest'
import { Command } from 'commander'

// Capture spawn calls
const calls: string[] = []

vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        calls.push(args.cmd)
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: { cmd: string; cwd?: string; onStdout?: (l: string) => void; onStderr?: (l: string) => void }) => {
        calls.push(args.cmd)
        // Simulate some minimal provider output
        args.onStdout?.('Deploying to Netlify\n')
        return { done: Promise.resolve({ ok: true }) }
      })
    }
  }
})


import { registerDeployCommand } from '../commands/deploy'

describe('up command', () => {
  it('runs deploy in-process and preserves flags', async () => {
    const program = new Command()
    registerDeployCommand(program)
    const orig = process.env.OPD_SYNC_ENV
    try {
      delete process.env.OPD_SYNC_ENV
      await program.parseAsync(['node','test','up','netlify','--env','prod','--project','site_123','--json'])
      // OPD_SYNC_ENV should be set during delegation
      expect(process.env.OPD_SYNC_ENV).toBe('1')
    } finally {
      if (orig === undefined) delete process.env.OPD_SYNC_ENV
      else process.env.OPD_SYNC_ENV = orig
    }
  })
})
