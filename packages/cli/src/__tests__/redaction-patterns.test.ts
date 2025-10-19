import { describe, it, expect } from 'vitest'
import { computeRedactors } from '../utils/redaction'
import { logger } from '../utils/logger'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function applyAll(msg: string, res: RegExp[]): string {
  let out = msg
  for (const r of res) out = out.replace(r, '******')
  return out
}

describe('redaction patterns', () => {
  it('redacts .env and process.env literals and common encodings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opd-redact-'))
    const secret = 's3cr3tV@lue!'
    const b64 = Buffer.from(secret, 'utf8').toString('base64')
    const b64url = b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const enc = encodeURIComponent(secret)
    await writeFile(join(dir, '.env'), `SECRET=${secret}\nNEXT_PUBLIC_OK=public`, 'utf8')
    const res = await computeRedactors({ cwd: dir, envFiles: ['.env'], includeProcessEnv: false })
    const text = `literal:${secret} b64:${b64} b64url:${b64url} enc:${enc}`
    const red = applyAll(text, res)
    expect(red).not.toContain(secret)
    expect(red).not.toContain(b64)
    expect(red).not.toContain(b64url)
    expect(red).not.toContain(enc)
    await rm(dir, { recursive: true, force: true })
  })

  it('includes default token regex (JWT, GitHub PAT, Stripe, AWS, Google)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opd-redact-'))
    await writeFile(join(dir, '.env'), '', 'utf8')
    const res = await computeRedactors({ cwd: dir, envFiles: ['.env'], includeProcessEnv: false })
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsIm5hbWUiOiJKYW5lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const gh = 'ghp_abcdefghijklmnopqrstuvwxyz12'
    const stripe = 'sk_test_ABCDEFGHIJKLMNOP'
    const akid = 'AKIA1234567890ABCDEF'
    const gcp = 'GOCSPX-ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const text = [jwt, gh, stripe, akid, gcp].join(' ')
    const red = applyAll(text, res)
    expect(red).not.toContain(jwt)
    expect(red).not.toContain(gh)
    expect(red).not.toContain(stripe)
    expect(red).not.toContain(akid)
    expect(red).not.toContain(gcp)
    await rm(dir, { recursive: true, force: true })
  })

  it('does not redact public env keys (NEXT_PUBLIC_)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opd-redact-'))
    await writeFile(join(dir, '.env'), 'NEXT_PUBLIC_API=https://example.com', 'utf8')
    const res = await computeRedactors({ cwd: dir, envFiles: ['.env'], includeProcessEnv: false })
    const text = 'URL: https://example.com'
    const red = applyAll(text, res)
    expect(red).toContain('https://example.com')
    await rm(dir, { recursive: true, force: true })
  })
})
