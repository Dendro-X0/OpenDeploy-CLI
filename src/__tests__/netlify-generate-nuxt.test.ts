import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProvider } from '../core/provider-system/provider'
import type { DetectionResult } from '../types/detection-result'

async function makeTmp(): Promise<string> {
  const base: string = tmpdir()
  const folder: string = await mkdtemp(join(base, 'opd-netlify-'))
  return folder
}

function fakeDetection(args: { cwd: string; build?: string }): DetectionResult {
  return {
    framework: 'nuxt',
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: 'pnpm',
    monorepo: 'none',
    buildCommand: args.build ?? 'npx nuxi build',
    outputDir: '.output',
    publishDir: '.output/public',
    renderMode: 'hybrid',
    confidence: 0.9,
    environmentFiles: []
  }
}

describe('Netlify provider generateConfig (Nuxt)', () => {
  it('writes netlify.toml with nuxi build and .output/public', async () => {
    const cwd: string = await makeTmp()
    const plugin = await loadProvider('netlify')
    const detection: DetectionResult = fakeDetection({ cwd })
    const path: string = await plugin.generateConfig({ detection, cwd, overwrite: true })
    expect(path.endsWith('netlify.toml')).toBe(true)
    const body: string = await readFile(path, 'utf8')
    expect(body).toContain('command = "npx nuxi build"')
    expect(body).toContain('publish = ".output/public"')
  })
})
