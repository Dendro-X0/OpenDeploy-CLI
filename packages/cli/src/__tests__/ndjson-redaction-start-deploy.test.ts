import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { runStartWizard } from '../commands/start'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock provider validateAuth to avoid real CLI calls
vi.mock('../core/provider-system/provider', () => ({
  loadProvider: async () => ({
    id: 'vercel',
    getCapabilities: () => ({
      name: 'Vercel', supportsLocalBuild: true, supportsRemoteBuild: true, supportsStaticDeploy: true,
      supportsServerless: true, supportsEdgeFunctions: true, supportsSsr: true, hasProjectLinking: true,
      envContexts: ['preview','production'], supportsLogsFollow: true, supportsAliasDomains: true, supportsRollback: false
    }),
    async detect() { return {} as any },
    async validateAuth() { return },
    async link() { return }, async build() { return { ok: true } }, async deploy() { return { ok: true } },
    async open() { return }, async envList() { return {} }, async envSet() { return }, async logs() { return }, async generateConfig() { return 'noop' }
  })
}))

// Mock process-pref to emit NDJSON stdout events that include the secret value
vi.mock('../utils/process-pref', () => ({
  spawnStreamPreferred: (args: { onStdout?: (c: string) => void; onStderr?: (c: string) => void }) => {
    // Emit both stdout and stderr lines that contain the secret to validate redaction
    setTimeout(() => { args.onStdout?.('Building... using SECRET_ONE=SuperSecret123!') }, 0)
    setTimeout(() => { args.onStderr?.('Error: Another$ecret456 not found') }, 1)
    return { controller: { stop() {} }, done: Promise.resolve({ ok: true, exitCode: 0 }) }
  }
}))

// Capture console output (NDJSON lines go to console.log via logger.json)
const lines: string[] = []
const origLog = console.log

beforeEach(() => {
  lines.length = 0
  // Capture console.log
  // eslint-disable-next-line no-console
  console.log = ((...args: unknown[]) => { lines.push(String(args[0] ?? '')); return undefined as any }) as any
})

afterEach(() => { (console.log as any) = origLog })

async function withTempEnv(content: string, fn: (cwd: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'opd-ndjson-'))
  try {
    await writeFile(join(dir, '.env'), content, 'utf8')
    // Run test logic in this directory
    const prevCwd = process.cwd()
    try {
      process.chdir(dir)
      await fn(dir)
    } finally {
      process.chdir(prevCwd)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function notInAnyEncoding(text: string, secret: string): boolean {
  const b64 = Buffer.from(secret, 'utf8').toString('base64')
  const b64url = b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const enc = encodeURIComponent(secret)
  return !text.includes(secret) && !text.includes(b64) && !text.includes(b64url) && !text.includes(enc)
}

describe('NDJSON streaming redaction (start/deploy)', () => {
  it('does not leak .env literal in NDJSON (start dry-run)', async () => {
    const prevNd = process.env.OPD_NDJSON
    process.env.OPD_NDJSON = '1'
    try {
      await withTempEnv('SECRET_ONE=SuperSecret123!\n', async (cwd) => {
        await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', dryRun: true, ci: true, json: false, syncEnv: false })
        const joined = lines.join('\n')
        expect(notInAnyEncoding(joined, 'SuperSecret123!')).toBe(true)
      })
    } finally {
      if (prevNd === undefined) delete process.env.OPD_NDJSON; else process.env.OPD_NDJSON = prevNd
    }
  })

  it('does not leak .env literal in NDJSON (deploy mode)', async () => {
    const prevNd = process.env.OPD_NDJSON
    process.env.OPD_NDJSON = '1'
    try {
      await withTempEnv('SECRET_TWO=Another$ecret456\n', async (cwd) => {
        await runStartWizard({ framework: 'next', provider: 'vercel', env: 'preview', ci: true, json: false, syncEnv: false })
        const joined = lines.join('\n')
        expect(notInAnyEncoding(joined, 'Another$ecret456')).toBe(true)
      })
    } finally {
      if (prevNd === undefined) delete process.env.OPD_NDJSON; else process.env.OPD_NDJSON = prevNd
    }
  })
})
