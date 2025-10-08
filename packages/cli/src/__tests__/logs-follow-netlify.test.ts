import { describe, it, expect, vi } from 'vitest'
const ENABLE_NETLIFY: boolean = process.env.OPD_ENABLE_NETLIFY === '1'
const d = ENABLE_NETLIFY ? describe : describe.skip
import { Command } from 'commander'

// Mock process utils to simulate Netlify API
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  let step = 0
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        const c = args.cmd
        if (c.includes('netlify api listSiteDeploys')) {
          // Return a single recent deploy id
          return { ok: true, exitCode: 0, stdout: JSON.stringify([{ id: 'dep_1', state: 'processing', commit_ref: 'abc' }]), stderr: '' }
        }
        if (c.includes('netlify api getSite')) {
          // Resolve site name for dashboard URL
          return { ok: true, exitCode: 0, stdout: JSON.stringify({ name: 'example-site' }), stderr: '' }
        }
        if (c.includes('netlify api getDeploy')) {
          // Progress through states: processing -> building -> ready
          step += 1
          const state = step === 1 ? 'processing' : step === 2 ? 'building' : 'ready'
          return { ok: true, exitCode: 0, stdout: JSON.stringify({ state }), stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      })
    }
  }
})

import { registerDeployCommand } from '../commands/deploy'
import { logger } from '../utils/logger'

d('deploy logs netlify --follow', () => {
  it('emits NDJSON status events until ready', async () => {
    const program = new Command()
    registerDeployCommand(program)
    const jsons: unknown[] = []
    const spy = vi.spyOn(logger, 'json').mockImplementation((o: unknown) => { jsons.push(o) })
    const origNd = process.env.OPD_NDJSON
    try {
      process.env.OPD_NDJSON = '1'
      await program.parseAsync(['node','test','logs','netlify','--project','site_123','--follow'])
      // Should emit logs:start, multiple nl:deploy:status, then logs:end
      const types = jsons.map((x: any) => x?.event).filter(Boolean)
      expect(types[0]).toBe('logs:start')
      expect(types.some((t: any) => t === 'nl:deploy:status')).toBe(true)
      expect(types.at(-1)).toBe('logs:end')
      const end = jsons.at(-1) as any
      expect(end.ok).toBe(true)
    } finally {
      spy.mockRestore()
      if (origNd === undefined) delete process.env.OPD_NDJSON
      else process.env.OPD_NDJSON = origNd
    }
  }, 15000)
})
