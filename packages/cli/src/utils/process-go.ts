import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { RunStreamArgs, StreamController } from './process'

export interface GoRunStreamArgs extends RunStreamArgs {
  readonly timeoutSeconds?: number
  readonly idleTimeoutSeconds?: number
  readonly pty?: boolean
  readonly cols?: number
  readonly rows?: number
}

// -------- Generic request runner (non-streaming helpers) --------

type GoRequestPayload = Readonly<Record<string, unknown>>

interface GoDone {
  readonly ok: boolean
  readonly exitCode: number
  readonly reason?: string
  readonly extra?: Readonly<Record<string, unknown>>
}

async function goRequest(payload: GoRequestPayload, opts?: { readonly cwd?: string }): Promise<GoDone> {
  const bin = resolveGoBin()
  const { file, argv } = getSpawnCommand(bin)
  const cp: ChildProcessWithoutNullStreams = spawn(file, argv, { stdio: ['pipe', 'pipe', 'pipe'], cwd: opts?.cwd, windowsHide: true })
  cp.stdin.setDefaultEncoding('utf8')
  cp.stdin.write(JSON.stringify(payload) + '\n')
  cp.stdin.end()
  let result: GoDone | undefined
  let bufOut = ''
  let bufErr = ''
  cp.stdout.setEncoding('utf8')
  cp.stderr.setEncoding('utf8')
  const handleLine = (line: string): void => {
    const t = line.trim()
    if (t.length === 0) return
    try {
      const ev = JSON.parse(t) as GoEvent
      if (ev.event === 'done' && ev.final === true) {
        const ok: boolean = ev.ok === true
        const exitCode: number = Number.isFinite(ev.exitCode) ? (ev.exitCode as number) : (ok ? 0 : 1)
        result = { ok, exitCode, reason: ev.reason, extra: (ev.extra ?? {}) as Readonly<Record<string, unknown>> }
      }
    } catch {
      // ignore non-JSON lines (or surface as debug via stderr aggregation)
    }
  }
  cp.stdout.on('data', (d: string) => {
    bufOut += d
    let idx: number
    while ((idx = bufOut.indexOf('\n')) !== -1) {
      const part = bufOut.slice(0, idx)
      bufOut = bufOut.slice(idx + 1)
      handleLine(part)
    }
  })
  cp.stderr.on('data', (d: string) => { bufErr += d })
  const code: number = await new Promise<number>((resolve) => {
    cp.on('close', (c: number | null) => resolve(c ?? 1))
  })
  if (!result) return { ok: code === 0, exitCode: code }
  return result
}

export async function goZipDir(args: { readonly src: string; readonly dest: string; readonly prefix?: string; readonly cwd?: string }): Promise<{ readonly ok: boolean; readonly exitCode: number; readonly dest?: string; readonly reason?: string }> {
  const res = await goRequest({ action: 'zip-dir', src: args.src, dest: args.dest, prefix: args.prefix ?? '' }, { cwd: args.cwd })
  const dest = typeof res.extra?.dest === 'string' ? String(res.extra?.dest) : undefined
  return { ok: res.ok, exitCode: res.exitCode, dest, reason: res.reason }
}

export async function goTarDir(args: { readonly src: string; readonly dest: string; readonly prefix?: string; readonly gzip?: boolean; readonly cwd?: string }): Promise<{ readonly ok: boolean; readonly exitCode: number; readonly dest?: string; readonly reason?: string }> {
  const res = await goRequest({ action: 'tar-dir', src: args.src, dest: args.dest, prefix: args.prefix ?? '', targz: args.gzip === true }, { cwd: args.cwd })
  const dest = typeof res.extra?.dest === 'string' ? String(res.extra?.dest) : undefined
  return { ok: res.ok, exitCode: res.exitCode, dest, reason: res.reason }
}

export async function goChecksumFile(args: { readonly src: string; readonly algo?: 'sha256'; readonly cwd?: string }): Promise<{ readonly ok: boolean; readonly exitCode: number; readonly digest?: string; readonly reason?: string }> {
  const res = await goRequest({ action: 'checksum-file', src: args.src, algo: args.algo ?? 'sha256' }, { cwd: args.cwd })
  const digest = typeof res.extra?.digest === 'string' ? String(res.extra?.digest) : undefined
  return { ok: res.ok, exitCode: res.exitCode, digest, reason: res.reason }
}

export async function goNetlifyDeployDir(args: { readonly src: string; readonly site: string; readonly prod?: boolean; readonly cwd?: string }): Promise<{ readonly ok: boolean; readonly exitCode: number; readonly url?: string; readonly logsUrl?: string; readonly deployId?: string; readonly reason?: string }> {
  const res = await goRequest({ action: 'netlify-deploy-dir', src: args.src, site: args.site, prod: args.prod === true }, { cwd: args.cwd })
  const url: string | undefined = typeof res.extra?.url === 'string' ? String(res.extra?.url) : undefined
  const logsUrl: string | undefined = typeof res.extra?.logsUrl === 'string' ? String(res.extra?.logsUrl) : undefined
  const deployId: string | undefined = typeof res.extra?.deployId === 'string' ? String(res.extra?.deployId) : undefined
  return { ok: res.ok, exitCode: res.exitCode, url, logsUrl, deployId, reason: res.reason }
}

interface GoEvent {
  readonly action?: string
  readonly event?: 'hello' | 'stdout' | 'stderr' | 'status' | 'error' | 'done'
  readonly data?: string
  readonly ok?: boolean
  readonly exitCode?: number
  readonly final?: boolean
  readonly reason?: string
  readonly extra?: Readonly<Record<string, unknown>>
}

function resolveGoBin(): string {
  const override = process.env.OPD_GO_BIN
  if (override && override.length > 0) return override
  const exe = process.platform === 'win32' ? 'opd-go.exe' : 'opd-go'
  const local = join(process.cwd(), '.bin', exe)
  if (existsSync(local)) return local
  return 'opd-go'
}

function defaultPty(): boolean {
  if (process.env.OPD_PTY === '1') return true
  if (process.env.OPD_PTY === '0') return false
  const stdoutWs: NodeJS.WriteStream | undefined = (typeof process.stdout !== 'undefined' ? (process.stdout as NodeJS.WriteStream) : undefined)
  const interactive: boolean = Boolean(stdoutWs && typeof stdoutWs.isTTY === 'boolean' && stdoutWs.isTTY)
  const ci: boolean = process.env.CI === '1' || process.env.CI === 'true'
  const jsonMode: boolean = process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1'
  return interactive && !ci && !jsonMode
}

function buildRequest(args: GoRunStreamArgs): string {
  const wantPty: boolean = typeof args.pty === 'boolean' ? args.pty : defaultPty()
  const req = {
    action: 'run-stream',
    cmd: args.cmd,
    cwd: args.cwd ?? '',
    timeoutSec: args.timeoutSeconds ?? 0,
    idleTimeoutSec: args.idleTimeoutSeconds ?? 0,
    env: args.env ?? {},
    pty: wantPty,
    cols: Number.isFinite(Number(args.cols)) ? Number(args.cols) : undefined,
    rows: Number.isFinite(Number(args.rows)) ? Number(args.rows) : undefined
  }
  return JSON.stringify(req)
}

export function goSpawnStream(args: GoRunStreamArgs): StreamController {
  const bin = resolveGoBin()
  const { file, argv } = getSpawnCommand(bin)
  const cp: ChildProcessWithoutNullStreams = spawn(file, argv, { stdio: ['pipe', 'pipe', 'pipe'], cwd: args.cwd, windowsHide: true })
  cp.stdin.setDefaultEncoding('utf8')
  const req = buildRequest(args)
  cp.stdin.write(req + '\n')
  cp.stdin.end()

  let resolveFn: ((v: { readonly ok: boolean; readonly exitCode: number; readonly reason?: string }) => void) | undefined
  const done = new Promise<{ readonly ok: boolean; readonly exitCode: number; readonly reason?: string }>((resolve) => { resolveFn = resolve })
  let protocolVersion: string | undefined

  const handleLine = (line: string): void => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return
    try {
      const js = JSON.parse(trimmed) as GoEvent
      if (js.event === 'hello') {
        const pv = (typeof js.extra?.protocolVersion === 'string') ? String(js.extra?.protocolVersion) : undefined
        protocolVersion = pv
        return
      }
      if (js.event === 'stdout' && typeof js.data === 'string') args.onStdout?.(js.data + '\n')
      else if (js.event === 'stderr' && typeof js.data === 'string') args.onStderr?.(js.data + '\n')
      else if (js.event === 'done' && js.final === true) {
        const ok: boolean = js.ok === true
        const exitCode: number = Number.isFinite(js.exitCode) ? (js.exitCode as number) : (ok ? 0 : 1)
        resolveFn?.({ ok, exitCode, reason: js.reason })
      }
    } catch {
      // If parsing fails, surface as stderr text for visibility
      args.onStderr?.(line + '\n')
    }
  }

  let bufOut = ''
  let bufErr = ''
  cp.stdout.setEncoding('utf8')
  cp.stderr.setEncoding('utf8')
  cp.stdout.on('data', (d: string) => {
    bufOut += d
    let idx: number
    while ((idx = bufOut.indexOf('\n')) !== -1) {
      const part = bufOut.slice(0, idx)
      bufOut = bufOut.slice(idx + 1)
      handleLine(part)
    }
  })
  cp.stderr.on('data', (d: string) => {
    bufErr += d
    let idx: number
    while ((idx = bufErr.indexOf('\n')) !== -1) {
      const part = bufErr.slice(0, idx)
      bufErr = bufErr.slice(idx + 1)
      // Go binary should not emit application data to stderr, but surface it
      args.onStderr?.(part + '\n')
    }
  })
  cp.on('close', (code: number | null) => {
    // If we never received a 'done' event, resolve here
    const ok = (code ?? 1) === 0
    resolveFn?.({ ok, exitCode: code ?? 1 })
  })

  const stop = (): void => {
    try { cp.kill() } catch {}
  }

  return { stop, done }
}

function getSpawnCommand(bin: string): { readonly file: string; readonly argv: string[] } {
  const lower = bin.toLowerCase()
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    const nodeExe = process.execPath || 'node'
    return { file: nodeExe, argv: [bin] }
  }
  return { file: bin, argv: [] }
}
