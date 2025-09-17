import { describe, it, expect } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { envValidate } from '../commands/env'

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'opd-validate-rules-'))
  try { return await fn(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

describe('env validate rules schema', () => {
  it('reports missing and rule violations', async () => {
    await withTemp(async (dir) => {
      // Create a .env that intentionally violates rules
      await writeFile(join(dir, '.env'), [
        'MAIL_PROVIDER=RESEND',
        // Intentionally omit RESEND_API_KEY and EMAIL_FROM to trigger requireIf violations
        'DATABASE_URL=mysql://root@localhost/db' // regex expects postgres*
      ].join('\n'), 'utf8')

      // Create a rules schema
      const schema = {
        required: ['DATABASE_URL', 'MAIL_PROVIDER'],
        regex: { 'DATABASE_URL': '^postgres(ql)?:\/\/' },
        allowed: { 'MAIL_PROVIDER': ['RESEND', 'SMTP'] },
        oneOf: [['RESEND_API_KEY', 'SMTP_PASS']],
        requireIf: [
          { if: 'MAIL_PROVIDER=RESEND', then: ['RESEND_API_KEY', 'EMAIL_FROM'] }
        ]
      }
      const schemaPath = join(dir, 'rules.json')
      await writeFile(schemaPath, JSON.stringify(schema, null, 2))

      const report = await envValidate({ cwd: dir, file: '.env', schema: 'rules.json', schemaType: 'rules' })
      expect(report.ok).toBe(false)
      expect(Array.isArray(report.missing)).toBe(true)
      // Should be missing at least one of the conditional keys
      expect(report.missing.includes('RESEND_API_KEY') || report.missing.includes('EMAIL_FROM')).toBe(true)
      expect(report.violations && report.violations.length).toBeGreaterThan(0)
      // Regex violation on DATABASE_URL
      expect(report.violations?.some(v => v.startsWith('regex:DATABASE_URL'))).toBe(true)
    })
  })
})
