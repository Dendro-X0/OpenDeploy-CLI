import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
// Mock process helpers to avoid real provider CLI calls (must be before imports)
vi.mock('../utils/process', async (orig) => {
  const real = await orig<any>()
  return {
    ...real,
    runWithRetry: vi.fn(async (args: { cmd: string; cwd?: string }) => ({ ok: true, exitCode: 0, stdout: '', stderr: '' })),
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        const c = args.cmd
        if (c.startsWith('vercel env pull')) {
          const parts = c.split(/\s+/)
          const outIx = parts.findIndex(p => p === 'pull') + 1
          const outPath = parts[outIx]
          if (outPath) await writeFile(outPath, '', 'utf8')
          return { ok: true, exitCode: 0, stdout: '', stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      })
    }
  }
})

import { envDiff } from '../commands/env'

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opd-env-diff-ci-'))
  try { return await fn(dir) } finally {
    // Retry cleanup on Windows EBUSY/EPERM
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

describe('env diff --ci strict exit codes', () => {
  it('sets non-zero exit when differences exist and --ci', async () => {
    await withTemp(async (dir) => {
      // local .env with a key not present remotely
      await writeFile(join(dir, '.env'), 'ONLY_LOCAL=1\n', 'utf8')
      try {
        await envDiff({ provider: 'netlify', cwd: dir, file: '.env', env: 'preview', ci: true })
        expect(process.exitCode).toBe(1)
      } finally {
        process.exitCode = 0
      }
    })
  }, 20000)

  it('obeys --fail-on-add/--fail-on-remove in CI', async () => {
    await withTemp(async (dir) => {
      await writeFile(join(dir, '.env'), 'A=1\n', 'utf8')
      try {
        await envDiff({ provider: 'netlify', cwd: dir, file: '.env', env: 'preview', ci: true, failOnAdd: true })
        expect(process.exitCode).toBe(1)
      } finally {
        process.exitCode = 0
      }
    })
  }, 20000)
})
