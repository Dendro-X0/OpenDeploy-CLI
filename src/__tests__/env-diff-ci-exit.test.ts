import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { envDiff } from '../commands/env'

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opd-env-diff-ci-'))
  try { return await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

describe('env diff --ci strict exit codes', () => {
  it('sets non-zero exit when differences exist and --ci', async () => {
    await withTemp(async (dir) => {
      // local .env with a key not present remotely
      await writeFile(join(dir, '.env'), 'ONLY_LOCAL=1\n', 'utf8')
      // mock process run to emulate remote env with no keys
      const mod = await import('../utils/process')
      const spy = vi.spyOn(mod.proc, 'run').mockImplementation(async (args: { cmd: string }) => {
        const c = args.cmd
        if (c.startsWith('vercel env pull')) {
          // Extract output file path: vercel env pull <file> --environment <env>
          const parts = c.split(/\s+/)
          const outIx = parts.findIndex(p => p === 'pull') + 1
          const outPath = parts[outIx]
          if (outPath) {
            await writeFile(outPath, '', 'utf8')
          }
          return { ok: true, exitCode: 0, stdout: '', stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      })
      try {
        await envDiff({ provider: 'vercel', cwd: dir, file: '.env', env: 'preview', ci: true })
        expect(process.exitCode).toBe(1)
      } finally {
        spy.mockRestore()
        process.exitCode = 0
      }
    })
  })

  it('obeys --fail-on-add/--fail-on-remove in CI', async () => {
    await withTemp(async (dir) => {
      await writeFile(join(dir, '.env'), 'A=1\n', 'utf8')
      const mod = await import('../utils/process')
      const spy = vi.spyOn(mod.proc, 'run').mockImplementation(async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }))
      try {
        await envDiff({ provider: 'vercel', cwd: dir, file: '.env', env: 'preview', ci: true, failOnAdd: true })
        expect(process.exitCode).toBe(1)
      } finally {
        spy.mockRestore()
        process.exitCode = 0
      }
    })
  })
})
