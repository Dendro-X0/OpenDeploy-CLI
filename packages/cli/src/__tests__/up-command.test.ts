import { describe, it, expect, vi } from 'vitest'
import { Command } from 'commander'

// Capture spawn calls
const calls: string[] = []

// Avoid env sync side effects and provider file writes
vi.mock('../commands/env', () => ({ envSync: vi.fn(async () => { /* no-op */ }) }))
vi.mock('../core/provider-system/provider', async (orig) => {
  // Prefer real loader (which respects OPD_PROVIDER_MODE=virtual) when virtual mode is enabled
  const mode = String(process.env.OPD_PROVIDER_MODE ?? '').toLowerCase()
  if (mode === 'virtual') {
    const real = await orig<any>()
    return real
  }
  return {
    loadProvider: async (name: string) => ({
      id: name,
      async validateAuth() { /* no-op */ },
      async generateConfig() { return 'noop' },
      async open() { /* no-op */ },
      getCapabilities: () => ({ name, supportsLocalBuild: true, supportsRemoteBuild: true, supportsStaticDeploy: true, supportsServerless: true, supportsEdgeFunctions: true, supportsSsr: true, hasProjectLinking: true, envContexts: ['preview','production'], supportsLogsFollow: true, supportsAliasDomains: true, supportsRollback: false })
    })
  }
})
vi.mock('../core/detectors/auto', () => ({ detectApp: vi.fn(async () => ({ framework: 'next', publishDir: 'dist' })) }))

vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    runWithRetry: vi.fn(async (args: { cmd: string }) => {
      if (args.cmd.startsWith('netlify deploy')) {
        return { ok: true, exitCode: 0, stdout: 'Website URL: https://example.netlify.app', stderr: '' }
      }
      return { ok: true, exitCode: 0, stdout: '', stderr: '' }
    }),
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


import { registerUpCommand } from '../commands/up'

describe('up command', () => {
  it('runs deploy in-process and preserves flags', async () => {
    const program = new Command()
    registerUpCommand(program)
    const orig = process.env.OPD_SYNC_ENV
    try {
      delete process.env.OPD_SYNC_ENV
      await program.parseAsync(['node','test','up','netlify','--env','prod','--project','site_123','--json','--dry-run'])
      // OPD_SYNC_ENV should be set during delegation
      expect(process.env.OPD_SYNC_ENV).toBe('1')
    } finally {
      if (orig === undefined) delete process.env.OPD_SYNC_ENV
      else process.env.OPD_SYNC_ENV = orig
    }
  }, 20000)
})
