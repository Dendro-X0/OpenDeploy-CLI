import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

export type CliResult = { readonly status: number | null; readonly stdout: string; readonly stderr: string }

export function createTempProject(name: string, files: Record<string, string>): { readonly cwd: string; readonly cleanup: () => void } {
  const base: string = mkdtempSync(join(tmpdir(), `opd-${name}-`))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(base, rel)
    try { mkdirSync(dirname(p), { recursive: true }) } catch { /* ignore */ }
    writeFileSync(p, content, 'utf8')
  }
  const cleanup = (): void => { try { rmSync(base, { recursive: true, force: true }) } catch { /* ignore */ } }
  return { cwd: base, cleanup }
}

export function runCliJson(cwd: string, args: string[]): { readonly status: number | null; readonly json: any; readonly raw: string } {
  const cli = join(process.cwd(), 'dist', 'index.js')
  const env = { ...process.env, OPD_SKIP_VALIDATE: '1', OPD_SKIP_ASSET_SANITY: '1', OPD_FORCE_CI: '1' }
  const res = spawnSync(process.execPath, [cli, '--json', ...args], { cwd, encoding: 'utf8', env, timeout: 15000 })
  const out = (res.stdout || '').trim()
  let json: any
  try { json = JSON.parse(out.split(/\r?\n/).filter(Boolean).pop() || '{}') } catch { json = {} }
  return { status: res.status, json, raw: out }
}
