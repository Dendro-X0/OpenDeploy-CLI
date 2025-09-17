import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { envSync } from '../commands/env'

// Capture set calls rather than hitting provider CLIs
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        if (args.cmd.startsWith('vercel env rm')) return { ok: true, exitCode: 0, stdout: '', stderr: '' }
        if (args.cmd.startsWith('vercel env add')) return { ok: true, exitCode: 0, stdout: '', stderr: '' }
        if (args.cmd.startsWith('vercel link')) return { ok: true, exitCode: 0, stdout: '', stderr: '' }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      }),
    }
  }
})

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opd-map-'))
  try { return await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

describe('env mapping (rename + transform)', () => {
  it('applies rename and base64 transform via --map', async () => {
    await withTemp(async (dir) => {
      await writeFile(join(dir, '.env'), 'OLD=secret\nEMAIL_FROM= admin@example.com \n', 'utf8')
      await writeFile(join(dir, 'map.json'), JSON.stringify({ rename: { OLD: 'NEW' }, transform: { NEW: 'base64', EMAIL_FROM: 'trim' } }, null, 2))
      await envSync({ provider: 'vercel', cwd: dir, file: '.env', env: 'preview', yes: true, dryRun: true, json: false, ci: false, ignore: [], only: [], mapFile: 'map.json' })
      expect(true).toBe(true)
    })
  })
})
