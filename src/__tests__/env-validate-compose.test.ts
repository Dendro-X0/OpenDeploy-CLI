import { describe, it, expect } from 'vitest'
import { envValidate } from '../commands/env'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opendeploy-test-'))
  try { return await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

describe('envValidate composition', () => {
  it('merges required keys from multiple builtins and a file', async () => {
    await withTempDir<void>(async (dir) => {
      await writeFile(join(dir, '.env'), 'GOOGLE_CLIENT_ID=x\nEMAIL_FROM=y@example.com\nS3_REGION=us-east-1\n', 'utf8')
      await writeFile(join(dir, 'custom.json'), JSON.stringify({ required: ['S3_BUCKET','S3_ACCESS_KEY_ID'] }), 'utf8')
      const report = await envValidate({
        cwd: dir,
        file: '.env',
        schema: 'builtin:google-oauth,builtin:email-basic,custom.json',
        schemaType: 'keys'
      })
      expect(report.required).toEqual(expect.arrayContaining(['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','EMAIL_FROM','S3_BUCKET','S3_ACCESS_KEY_ID']))
      expect(report.missing).toEqual(expect.arrayContaining(['GOOGLE_CLIENT_SECRET','S3_BUCKET','S3_ACCESS_KEY_ID']))
      expect(report.ok).toBe(false)
    })
  })
})
