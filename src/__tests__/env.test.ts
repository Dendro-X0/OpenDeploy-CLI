import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseEnvFile } from '../core/secrets/env'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'opendeploy-env-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('parseEnvFile', () => {
  it('trims values and expands variables', async () => {
    const p = join(dir, '.env')
    const content = [
      'A=  foo  ',
      'B=$A-suf',
      'C=${A}-x',
      'EMPTY=   ',
    ].join('\n')
    await writeFile(p, content, 'utf8')
    process.env.EXT = 'extv'
    const out = await parseEnvFile({ path: p })
    expect(out.A).toBe('foo')
    expect(out.B).toBe('foo-suf')
    expect(out.C).toBe('foo-x')
    expect(Object.hasOwn(out, 'EMPTY')).toBe(false)
  })
})
