import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NetlifyAdapter } from '../providers/netlify/adapter'
import type { DetectionResult } from '../types/detection-result'

async function makeTmp(): Promise<string> {
  const base: string = tmpdir()
  const folder: string = await mkdtemp(join(base, 'opd-netlify-'))
  return folder
}

function fakeDetection(args: { cwd: string; framework: DetectionResult['framework']; build?: string; publish?: string }): DetectionResult {
  return {
    framework: args.framework,
    rootDir: args.cwd,
    appDir: args.cwd,
    hasAppRouter: false,
    packageManager: 'pnpm',
    monorepo: 'none',
    buildCommand: args.build ?? 'npm run build',
    outputDir: args.publish ?? 'dist',
    publishDir: args.publish ?? 'dist',
    renderMode: 'static',
    confidence: 0.9,
    environmentFiles: []
  }
}

describe('NetlifyAdapter.generateConfig', () => {
  it('writes minimal netlify.toml for Astro with publish and build', async () => {
    const cwd: string = await makeTmp()
    const adapter = new NetlifyAdapter()
    const detection: DetectionResult = fakeDetection({ cwd, framework: 'astro', build: 'astro build', publish: 'dist' })
    const path: string = await adapter.generateConfig({ detection, overwrite: true })
    expect(path.endsWith('netlify.toml')).toBe(true)
    const body: string = await readFile(path, 'utf8')
    expect(body).toContain('publish = "dist"')
    expect(body).toContain('command = "astro build"')
  })

  it('is idempotent when overwrite is false', async () => {
    const cwd: string = await makeTmp()
    const adapter = new NetlifyAdapter()
    const detection: DetectionResult = fakeDetection({ cwd, framework: 'remix', build: 'remix build', publish: 'build/client' })
    const p1: string = await adapter.generateConfig({ detection, overwrite: true })
    const p2: string = await adapter.generateConfig({ detection, overwrite: false })
    expect(p1).toBe(p2)
    const body: string = await readFile(p2, 'utf8')
    expect(body).toContain('publish = "build/client"')
  })
})
