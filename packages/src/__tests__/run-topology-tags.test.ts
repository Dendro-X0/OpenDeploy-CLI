import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Command } from 'commander'
import { registerRunCommand } from '../commands/run'

// Record the order in which envSync is called
const calls: string[] = []
vi.mock('../commands/env', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    envSync: vi.fn(async (opts: any) => { calls.push(opts.cwd.split(/[\\/]/).pop() || ''); return }),
    envDiff: vi.fn(async () => {}),
  }
})

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opd-run-topo-'))
  try { return await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

describe('run respects dependsOn layers and --tags selection', () => {
  it('runs projects in topological order and filters by tags', async () => {
    await withTemp(async (dir) => {
      // workspace structure: apps/a, apps/b, apps/c
      await mkdir(join(dir, 'apps', 'a'), { recursive: true })
      await mkdir(join(dir, 'apps', 'b'), { recursive: true })
      await mkdir(join(dir, 'apps', 'c'), { recursive: true })
      await writeFile(join(dir, 'apps', 'a', '.env.local'), 'A=1\n', 'utf8')
      await writeFile(join(dir, 'apps', 'b', '.env.local'), 'B=1\n', 'utf8')
      await writeFile(join(dir, 'apps', 'c', '.env.local'), 'C=1\n', 'utf8')
      const cfg = {
        projects: [
          { name: 'a', path: 'apps/a', provider: 'vercel', envFilePreview: '.env.local', tags: ['core'] },
          { name: 'b', path: 'apps/b', provider: 'vercel', envFilePreview: '.env.local', dependsOn: ['a'], tags: ['core','web'] },
          { name: 'c', path: 'apps/c', provider: 'vercel', envFilePreview: '.env.local', dependsOn: ['b'], tags: ['web'] }
        ]
      }
      await writeFile(join(dir, 'opendeploy.config.json'), JSON.stringify(cfg, null, 2))
      const program = new Command()
      registerRunCommand(program)
      const orig = process.cwd()
      process.chdir(dir)
      try {
        calls.length = 0
        await program.parseAsync(['node','test','run','--sync-env','--tags','web','--config','opendeploy.config.json'])
        // tags=web selects b,c but c depends on b which depends on a. Since a is not tagged, it should not be selected; our implementation filters projects before layering.
        // So only b and c are run, in order b then c.
        expect(calls).toEqual(['b','c'])
        calls.length = 0
        await program.parseAsync(['node','test','run','--sync-env','--projects','a,b,c','--config','opendeploy.config.json'])
        expect(calls).toEqual(['a','b','c'])
      } finally {
        process.chdir(orig)
      }
    })
  })
})
