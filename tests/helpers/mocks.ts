import { vi } from 'vitest'

export function envNoopMock() {
  return { envSync: vi.fn(async () => { /* no-op */ }) }
}

export function netlifyAdapterNoopMock() {
  return { NetlifyAdapter: class { async generateConfig(): Promise<void> { /* no-op */ } } }
}

export function detectorMockNextDist() {
  return { detectApp: vi.fn(async () => ({ framework: 'next', publishDir: 'dist' })) }
}

export function detectorMockRemixBuildClient() {
  return { detectApp: vi.fn(async () => ({ framework: 'remix', publishDir: 'build/client' })) }
}

export function makeProcessMockNetlify(real: any, opts?: { readonly deployUrl?: string; readonly siteName?: string; readonly deployId?: string }) {
  const deployUrl = opts?.deployUrl ?? 'https://example.netlify.app'
  const siteName = opts?.siteName ?? 'example-site'
  const deployId = opts?.deployId ?? 'dep_abc'
  return {
    ...real,
    runWithRetry: vi.fn(async (args: { cmd: string }) => {
      if (args.cmd.startsWith('netlify deploy')) {
        return { ok: true, exitCode: 0, stdout: `Deploy complete\n ${deployUrl}`, stderr: '' }
      }
      if (args.cmd.includes('netlify env:list') && args.cmd.includes('--json')) {
        const json = JSON.stringify([
          { key: 'NEXTAUTH_URL', values: [ { context: 'production', value: 'https://prod.example.com' }, { context: 'dev', value: 'http://localhost:3000' } ] },
          { key: 'AUTH_SECRET', values: [ { context: 'production', value: 'secret_prod' } ] }
        ])
        return { ok: true, exitCode: 0, stdout: json, stderr: '' }
      }
      return { ok: true, exitCode: 0, stdout: '', stderr: '' }
    }),
    proc: {
      ...real.proc,
      run: vi.fn(async (args: { cmd: string }) => {
        if (args.cmd.startsWith('netlify link')) {
          return { ok: true, exitCode: 0, stdout: 'Already linked', stderr: '' }
        }
        if (args.cmd.startsWith('netlify api listSiteDeploys')) {
          return { ok: true, exitCode: 0, stdout: JSON.stringify([{ id: deployId }]), stderr: '' }
        }
        if (args.cmd.startsWith('netlify api getSite')) {
          return { ok: true, exitCode: 0, stdout: JSON.stringify({ name: siteName }), stderr: '' }
        }
        if (args.cmd.startsWith('netlify deploy')) {
          return { ok: true, exitCode: 0, stdout: `Deploy complete\n ${deployUrl}`, stderr: '' }
        }
        return { ok: true, exitCode: 0, stdout: '', stderr: '' }
      })
    }
  }
}
