import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const ENABLE_NETLIFY: boolean = process.env.OPD_ENABLE_NETLIFY === '1'
const d = ENABLE_NETLIFY ? describe : describe.skip
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Capture JSON logs from logger
import { logger } from '../utils/logger'

// Mock fsx.readJson to return a linked site id
vi.mock('../utils/fs', async (orig) => {
  const mod = await orig<any>()
  return {
    ...mod,
    fsx: {
      ...mod.fsx,
      readJson: vi.fn(async (p: string) => {
        if (p.replace(/\\/g,'/').endsWith('/.netlify/state.json')) {
          return { siteId: 'site_123' }
        }
        return null
      })
    }
  }
})

// Mock proc.run to simulate Netlify CLI for env operations
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    runWithRetry: vi.fn(async (args: { cmd: string; cwd?: string }) => {
      if (args.cmd.includes('env:list') && args.cmd.includes('--json')) {
        const json = JSON.stringify([
          { key: 'NEXTAUTH_URL', values: [ { context: 'production', value: 'https://prod.example.com' }, { context: 'dev', value: 'http://localhost:3000' } ] },
          { key: 'AUTH_SECRET', values: [ { context: 'production', value: 'secret_prod' } ] }
        ])
        return { ok: true, exitCode: 0, stdout: json, stderr: '' }
      }
      return { ok: true, exitCode: 0, stdout: '', stderr: '' }
    }),
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string, cwd?: string }) => {
        const cmd = args.cmd
        if (cmd.includes('netlify link')) {
          return { ok: true, exitCode: 0, stdout: 'Already linked', stderr: '' }
        }
        if (cmd.includes('netlify env:list')) {
          const json = JSON.stringify([
            { key: 'NEXTAUTH_URL', values: [ { context: 'production', value: 'https://prod.example.com' }, { context: 'dev', value: 'http://localhost:3000' } ] },
            { key: 'AUTH_SECRET', values: [ { context: 'production', value: 'secret_prod' } ] }
          ])
          return { ok: true, exitCode: 0, stdout: json, stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      })
    }
  }
})

import { envDiff } from '../commands/env'

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opd-env-'))
  try { return await fn(dir) } finally {
    let attempt = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try { await rm(dir, { recursive: true, force: true }); break } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if ((code === 'EBUSY' || code === 'EPERM') && attempt < 5) {
          await new Promise(r => setTimeout(r, 60 * (attempt + 1)))
          attempt++
          continue
        }
        break
      }
    }
  }
}

d('Netlify env --context', () => {
  const jsons: unknown[] = []
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    jsons.length = 0
    logSpy = vi.spyOn(logger, 'jsonPrint').mockImplementation((obj: unknown) => { jsons.push(obj) })
  })
  afterEach(() => { logSpy.mockRestore() })

  it('uses production context values when diffing', async () => {
    await withTemp(async (dir) => {
      // project dir with linked .netlify/state.json structure
      await mkdir(join(dir, '.netlify'), { recursive: true })
      // local env file matches remote production values
      await writeFile(join(dir, '.env.production.local'), 'NEXTAUTH_URL=https://prod.example.com\nAUTH_SECRET=secret_prod\n')
      await envDiff({ provider: 'netlify', cwd: dir, file: '.env.production.local', env: 'prod', json: true, ci: false, projectId: undefined, orgId: undefined, ignore: [], only: [] })
      const last = jsons.at(-1) as any
      expect(last).toBeTruthy()
      expect(last.provider).toBe('netlify')
      expect(last.ok).toBe(true)
      expect(Array.isArray(last.added)).toBe(true)
      expect(Array.isArray(last.removed)).toBe(true)
      expect(Array.isArray(last.changed)).toBe(true)
      expect(last.added.length).toBe(0)
      expect(last.removed.length).toBe(0)
      expect(last.changed.length).toBe(0)
    })
  }, 20000)
})
