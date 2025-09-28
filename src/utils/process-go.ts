import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { RunStreamArgs, StreamController } from './process'

export interface GoRunStreamArgs extends RunStreamArgs {
  readonly timeoutSeconds?: number
  readonly idleTimeoutSeconds?: number
}

interface GoEvent {
  readonly action?: string
  readonly event?: 'stdout' | 'stderr' | 'status' | 'error' | 'done'
  readonly data?: string
  readonly ok?: boolean
  readonly exitCode?: number
  readonly final?: boolean
}

function resolveGoBin(): string {
  const override = process.env.OPD_GO_BIN
  if (override && override.length > 0) return override
  const exe = process.platform === 'win32' ? 'opd-go.exe' : 'opd-go'
  const local = join(process.cwd(), '.bin', exe)
  if (existsSync(local)) return local
  return 'opd-go'
}

function buildRequest(args: GoRunStreamArgs): string {
  const req = {
    action: 'run-stream',
    cmd: args.cmd,
    cwd: args.cwd ?? '',
    timeoutSec: args.timeoutSeconds ?? 0,
    idleTimeoutSec: args.idleTimeoutSeconds ?? 0,
    env: args.env ?? {}
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

  let resolveFn: ((v: { readonly ok: boolean; readonly exitCode: number }) => void) | undefined
  const done = new Promise<{ readonly ok: boolean; readonly exitCode: number }>((resolve) => { resolveFn = resolve })

  const handleLine = (line: string): void => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return
    try {
      const js = JSON.parse(trimmed) as GoEvent
      if (js.event === 'stdout' && typeof js.data === 'string') args.onStdout?.(js.data + '\n')
      else if (js.event === 'stderr' && typeof js.data === 'string') args.onStderr?.(js.data + '\n')
      else if (js.event === 'done' && js.final === true) {
        const ok: boolean = js.ok === true
        const exitCode: number = Number.isFinite(js.exitCode) ? (js.exitCode as number) : (ok ? 0 : 1)
        resolveFn?.({ ok, exitCode })
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
