import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { envValidate } from '../commands/env'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opendeploy-test-'))
  try { return await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

describe('envValidate', () => {
  it('validates against builtin:next-basic', async () => {
    await withTempDir<void>(async (dir) => {
      // .env file with required keys
      await writeFile(join(dir, '.env'), 'DATABASE_URL=postgres://\nNEXT_PUBLIC_SITE_URL=https://example.com\n', 'utf8')
      const report = await envValidate({ cwd: dir, file: '.env', schema: 'builtin:next-basic', schemaType: 'keys' })
      expect(report.ok).toBe(true)
      expect(report.missing).toEqual([])
      expect(report.unknown).toEqual([])
    })
  })

  it('reports missing keys from keys schema', async () => {
    await withTempDir<void>(async (dir) => {
      await writeFile(join(dir, '.env'), 'DATABASE_URL=postgres://\n', 'utf8')
      await writeFile(join(dir, 'schema.json'), JSON.stringify({ required: ['DATABASE_URL', 'JWT_SECRET'] }), 'utf8')
      const report = await envValidate({ cwd: dir, file: '.env', schema: 'schema.json', schemaType: 'keys' })
      expect(report.ok).toBe(false)
      expect(report.missing).toEqual(['JWT_SECRET'])
      // unknown are present keys not listed in required; here it's empty
      expect([...report.unknown].sort()).toEqual([])
    })
  })

  it('reads required from jsonschema', async () => {
    await withTempDir<void>(async (dir) => {
      await writeFile(join(dir, '.env'), 'A=1\n', 'utf8')
      await writeFile(join(dir, 'schema.json'), JSON.stringify({ required: ['A','B'] }), 'utf8')
      const report = await envValidate({ cwd: dir, file: '.env', schema: 'schema.json', schemaType: 'jsonschema' })
      expect(report.ok).toBe(false)
      expect(report.missing).toEqual(['B'])
    })
  })
})
