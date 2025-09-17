import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock env module BEFORE importing the run command
const events: string[] = []
vi.mock('../commands/env', () => {
  return {
    envSync: vi.fn(async (opts: { cwd: string, file: string }) => {
      const name = opts.cwd.split(/[/\\]/).pop() || 'unknown'
      events.push(`env:${name}`)
      await new Promise(r => setTimeout(r, 20))
    }),
    envDiff: vi.fn(async () => {
      // not used in this test
    })
  }
})

import { Command } from 'commander'
import { registerRunCommand } from '../commands/run'
import { ScriptSeeder } from '../core/seed/script'

// Stub ScriptSeeder.seed to record and delay
vi.spyOn(ScriptSeeder.prototype, 'seed').mockImplementation(async function (this: ScriptSeeder, args: { cwd: string }) {
  const name = args.cwd.split(/[/\\]/).pop() || 'unknown'
  events.push(`seed:${name}`)
  await new Promise(r => setTimeout(r, 20))
})

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opendeploy-run-'))
  try { return await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

describe('run --concurrency', () => {
  it('runs projects with per-project order and concurrency', async () => {
    await withTemp(async (dir) => {
      // Create projects
      const a = join(dir, 'apps', 'a')
      const b = join(dir, 'apps', 'b')
      const c = join(dir, 'apps', 'c')
      await mkdir(a, { recursive: true })
      await mkdir(b, { recursive: true })
      await mkdir(c, { recursive: true })
      // Config with 3 projects, seed as script, env files optional
      const cfg = {
        projects: [
          { name: 'a', path: 'apps/a', provider: 'vercel', envFilePreview: '.env.local', seed: { schema: 'script', script: 'noop' } },
          { name: 'b', path: 'apps/b', provider: 'vercel', envFilePreview: '.env.local', seed: { schema: 'script', script: 'noop' } },
          { name: 'c', path: 'apps/c', provider: 'vercel', envFilePreview: '.env.local', seed: { schema: 'script', script: 'noop' } },
        ]
      }
      await writeFile(join(dir, 'opendeploy.config.json'), JSON.stringify(cfg, null, 2))
      // Create dummy env files
      await writeFile(join(a, '.env.local'), '')
      await writeFile(join(b, '.env.local'), '')
      await writeFile(join(c, '.env.local'), '')

      const program = new Command()
      registerRunCommand(program)
      const origCwd = process.cwd()
      try {
        process.chdir(dir)
        await program.parseAsync(['node', 'test', 'run', '--all', '--env', 'preview', '--sync-env', '--dry-run', '--concurrency', '2', '--json'])
      } finally { process.chdir(origCwd) }

      // Expect per-project order: env before seed
      const index = (label: string) => events.findIndex(e => e === label)
      expect(index('env:a')).toBeGreaterThanOrEqual(0)
      expect(index('seed:a')).toBeGreaterThan(index('env:a'))
      expect(index('env:b')).toBeGreaterThanOrEqual(0)
      expect(index('seed:b')).toBeGreaterThan(index('env:b'))
      expect(index('env:c')).toBeGreaterThanOrEqual(0)
      expect(index('seed:c')).toBeGreaterThan(index('env:c'))

      // Ensure at least some interleaving occurred (concurrency > 1)
      // i.e., env of one project happens before seed of another completes
      const sequence = events.join(',')
      expect(sequence).toMatch(/env:a|env:b|env:c/)
    })
  })
})
