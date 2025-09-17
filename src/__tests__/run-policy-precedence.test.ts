import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock env commands to capture options
const calls: Array<{ only: string[]; ignore: string[]; failOnAdd?: boolean; failOnRemove?: boolean }> = []
vi.mock('../commands/env', () => {
  return {
    envSync: vi.fn(async (opts: { only?: string[]; ignore?: string[]; failOnAdd?: boolean; failOnRemove?: boolean }) => {
      calls.push({ only: opts.only ?? [], ignore: opts.ignore ?? [], failOnAdd: opts.failOnAdd, failOnRemove: opts.failOnRemove })
    }),
    envDiff: vi.fn(async () => {})
  }
})

import { Command } from 'commander'
import { registerRunCommand } from '../commands/run'

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opd-run-pol-'))
  try { return await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

describe('run policy precedence', () => {
  it('applies CLI > project > policy defaults', async () => {
    await withTemp(async (dir) => {
      const a = join(dir, 'apps', 'web')
      await mkdir(a, { recursive: true })
      // Policy defaults (low)
      const cfg = {
        policy: {
          envOnly: ['DATABASE_URL'],
          envIgnore: ['NEXT_PUBLIC_*'],
          failOnAdd: false,
          failOnRemove: true
        },
        projects: [
          {
            name: 'web', path: 'apps/web', provider: 'vercel', envFilePreview: '.env.local',
            // Project overrides (medium)
            envOnly: ['NEXT_PUBLIC_SITE_URL'],
            failOnAdd: true
          }
        ]
      }
      await writeFile(join(dir, 'opendeploy.config.json'), JSON.stringify(cfg, null, 2))
      // Local env file
      await writeFile(join(a, '.env.local'), 'NEXT_PUBLIC_SITE_URL=http://localhost:3000\nDATABASE_URL=postgres://user')
      const program = new Command()
      registerRunCommand(program)
      const origCwd = process.cwd()
      try {
        process.chdir(dir)
        // CLI overrides (highest): --only takes precedence; keep project/policy ignored merged via code precedence
        await program.parseAsync(['node','test','run','--projects','web','--sync-env','--env','preview','--only','NEXT_PUBLIC_*,DATABASE_*','--json'])
      } finally { process.chdir(origCwd) }
      expect(calls.length).toBe(1)
      const call = calls[0]
      expect(call.only).toEqual(['NEXT_PUBLIC_*','DATABASE_*'])
      // ignore should come from project/policy; project had NEXT_PUBLIC_* already, but CLI only did not touch ignore
      expect(Array.isArray(call.ignore)).toBe(true)
      expect(call.failOnAdd).toBe(true)      // from project override
      expect(call.failOnRemove).toBe(true)   // from policy default
    })
  })
})
