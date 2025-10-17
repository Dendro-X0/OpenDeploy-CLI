import { spawn, SpawnOptions as NodeSpawnOptions } from 'node:child_process'
import { EOL } from 'node:os'

export interface ExecResult {
  readonly ok: boolean
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

export interface SpawnCtl {
  readonly done: Promise<ExecResult>
  cancel(reason?: string): void
}

export interface ExecOptions {
  readonly cwd?: string
  readonly env?: NodeJS.ProcessEnv
  readonly timeoutMs?: number
  readonly idleTimeoutMs?: number
  readonly redactors?: readonly RegExp[]
}

export interface SpawnOptions extends ExecOptions {
  readonly onStdout?: (chunk: string) => void
  readonly onStderr?: (chunk: string) => void
}

export interface ProcessRunner {
  exec(bin: string, args: readonly string[], opts?: ExecOptions): Promise<ExecResult>
  spawn(bin: string, args: readonly string[], opts?: SpawnOptions): SpawnCtl
  resolve(bin: string, opts?: { cwd?: string }): Promise<string | undefined>
}

function redact(s: string, patterns?: readonly RegExp[]): string {
  if (!patterns || patterns.length === 0) return s
  let out = s
  for (const re of patterns) out = out.replace(re, '***')
  return out
}

function withTimeout<T>(p: Promise<T>, ms?: number, onTimeout?: () => void): Promise<T> {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return p
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => { try { onTimeout?.() } catch {} reject(new Error('process timeout')) }, ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

export class NodeProcessRunner implements ProcessRunner {
  async exec(bin: string, args: readonly string[], opts?: ExecOptions): Promise<ExecResult> {
    const chunksOut: string[] = []
    const chunksErr: string[] = []
    const ctl = this.spawn(bin, args, {
      cwd: opts?.cwd,
      env: opts?.env,
      timeoutMs: opts?.timeoutMs,
      idleTimeoutMs: opts?.idleTimeoutMs,
      redactors: opts?.redactors,
      onStdout: (c) => chunksOut.push(c),
      onStderr: (c) => chunksErr.push(c)
    })
    const res = await ctl.done
    return { ...res, stdout: chunksOut.join(''), stderr: chunksErr.join('') }
  }

  spawn(bin: string, args: readonly string[], opts?: SpawnOptions): SpawnCtl {
    const nodeOpts: NodeSpawnOptions = { cwd: opts?.cwd, env: opts?.env, shell: false }
    const child = spawn(bin, [...args], nodeOpts)
    let stdout = ''
    let stderr = ''
    let lastActivity = Date.now()
    const apply = (s: string): string => redact(s, opts?.redactors)
    const onOut = (b: Buffer): void => { const s = b.toString(); lastActivity = Date.now(); stdout += s; opts?.onStdout?.(apply(s)) }
    const onErr = (b: Buffer): void => { const s = b.toString(); lastActivity = Date.now(); stderr += s; opts?.onStderr?.(apply(s)) }
    child.stdout?.on('data', onOut)
    child.stderr?.on('data', onErr)

    let idleTimer: NodeJS.Timeout | undefined
    let timeoutTimer: NodeJS.Timeout | undefined

    const done = new Promise<ExecResult>((resolve) => {
      child.on('close', (code: number | null) => {
        if (idleTimer) clearInterval(idleTimer)
        if (timeoutTimer) clearTimeout(timeoutTimer)
        resolve({ ok: code === 0, code, stdout, stderr })
      })
    })

    if (opts?.idleTimeoutMs && opts.idleTimeoutMs > 0) {
      idleTimer = setInterval(() => {
        const idle = Date.now() - lastActivity
        if (idle > (opts.idleTimeoutMs ?? 0)) {
          try { child.kill('SIGTERM') } catch {}
        }
      }, Math.max(250, Math.min(2000, opts.idleTimeoutMs)))
    }

    if (opts?.timeoutMs && opts.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => { try { child.kill('SIGTERM') } catch {} }, opts.timeoutMs)
    }

    return {
      done,
      cancel: (reason?: string) => { try { child.kill('SIGTERM') } catch {} if (reason) { stderr += `${EOL}cancelled: ${reason}${EOL}` } }
    }
  }

  async resolve(bin: string): Promise<string | undefined> {
    // Minimal: let OS resolution handle it. Advanced resolution (where/which) can be added later.
    return bin
  }
}
