import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectPackageManager } from '../core/detectors/package-manager'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'opendeploy-pm-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('detectPackageManager', () => {
  it('detects pnpm via pnpm-lock.yaml', async () => {
    await writeFile(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9', 'utf8')
    expect(await detectPackageManager({ cwd: dir })).toBe('pnpm')
  })
  it('detects yarn via yarn.lock', async () => {
    await writeFile(join(dir, 'yarn.lock'), '# yarn lock', 'utf8')
    expect(await detectPackageManager({ cwd: dir })).toBe('yarn')
  })
  it('detects npm via package-lock.json', async () => {
    await writeFile(join(dir, 'package-lock.json'), '{"lockfileVersion":3}', 'utf8')
    expect(await detectPackageManager({ cwd: dir })).toBe('npm')
  })
  it('detects bun via bun.lockb', async () => {
    await writeFile(join(dir, 'bun.lockb'), '', 'utf8')
    expect(await detectPackageManager({ cwd: dir })).toBe('bun')
  })
})
