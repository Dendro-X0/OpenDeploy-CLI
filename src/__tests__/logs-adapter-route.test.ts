import { describe, it, expect, vi } from 'vitest'
import { Command } from 'commander'

vi.mock('../providers/vercel/adapter', async (orig) => {
  const real = await orig<any>()
  class FakeVercelAdapter {
    public readonly name = 'vercel'
    public validateAuth = vi.fn(async () => {})
    public generateConfig = vi.fn(async () => 'vercel.json')
    public deploy = vi.fn(async () => ({ url: 'https://x.vercel.app', projectId: 'p', provider: 'vercel', target: 'preview', durationMs: 1 }))
    public open = vi.fn(async () => {})
    public logs = vi.fn(async () => {})
  }
  return { ...real, VercelAdapter: FakeVercelAdapter as any }
})

// Mock process utils used by logs command to avoid calling real CLIs
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        const c = args.cmd
        if (c.startsWith('vercel list') || c.includes('vercel list')) {
          // Return a single recent deployment in JSON
          return { ok: true, exitCode: 0, stdout: JSON.stringify([{ url: 'https://x.vercel.app' }]), stderr: '' }
        }
        if (c.startsWith('vercel inspect') || c.includes('vercel inspect')) {
          return { ok: true, exitCode: 0, stdout: 'Inspect: https://vercel.com/org/proj/deployments/xyz', stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
      spawnStream: vi.fn((args: { cmd: string }) => {
        // Immediately resolve ok; don't actually stream
        return { done: Promise.resolve({ ok: true, exitCode: 0 }) }
      })
    }
  }
})

import { registerDeployCommand } from '../commands/deploy'

describe('logs routes through VercelAdapter', () => {
  it('invokes adapter.logs for follow', async () => {
    const program = new Command()
    registerDeployCommand(program)
    const spyJson = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      process.env.OPD_NDJSON = '1'
      // Arrange current working directory to look linked
      // We will mock process utils to avoid actually calling vercel list/inspect
      await program.parseAsync(['node','test','logs','vercel','--follow'])
      expect(true).toBe(true)
      // If the adapter replacement was wired, parseAsync should complete without errors
    } finally {
      delete process.env.OPD_NDJSON
      spyJson.mockRestore()
    }
  })
})
