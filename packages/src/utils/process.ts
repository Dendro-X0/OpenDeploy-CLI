import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { appendFile, mkdir, readFile } from 'node:fs/promises'

export interface RunArgs { readonly cmd: string; readonly cwd?: string; readonly stdin?: string; readonly env?: Readonly<Record<string, string>> }

// ------- Minimal NDJSON record/replay (Phase 1) -------
const recordFile: string | undefined = process.env.OPD_RECORD_FIXTURES
const replayFile: string | undefined = process.env.OPD_REPLAY_FIXTURES
type ReplayEvent = { readonly t: 'run' | 'stream'; readonly cmd: string; readonly cwd?: string; readonly ok: boolean; readonly exitCode: number; readonly stdout?: string; readonly stderr?: string; readonly chunks?: ReadonlyArray<{ readonly fd: 'out' | 'err'; readonly data: string }> }
let replayEvents: ReplayEvent[] = []
let replayIdx = 0

async function ensureDir(path: string): Promise<void> { try { await mkdir(dirname(path), { recursive: true }) } catch { /* ignore */ } }
async function recordAppend(obj: unknown): Promise<void> { if (!recordFile) return; try { await ensureDir(recordFile); await appendFile(recordFile, JSON.stringify(obj) + '\n', 'utf8') } catch { /* ignore */ } }
async function loadReplay(): Promise<void> {
  if (!replayFile || replayEvents.length > 0) return
  try {
    const buf = await readFile(replayFile, 'utf8')
    const lines = buf.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    replayEvents = lines.map((l) => JSON.parse(l) as ReplayEvent)
  } catch { replayEvents = [] }
}
function nextReplay(type: 'run' | 'stream', fallbackCmd: string): ReplayEvent | undefined {
  if (replayEvents.length === 0 || replayIdx >= replayEvents.length) return undefined
  const ev = replayEvents[replayIdx++]
  if (ev.t !== type) return ev // tolerate minor drift; Phase 1
  return ev
}

function spawnStream(args: RunStreamArgs): StreamController {
  // Replay first
  if (replayFile) {
    void loadReplay()
    const ev = nextReplay('stream', args.cmd)
    const chunks = ev?.chunks ?? []
    let closed = false
    // Emit chunks async to simulate streaming
    setImmediate(() => {
      for (const c of chunks) {
        if (c.fd === 'out') args.onStdout?.(c.data)
        else args.onStderr?.(c.data)
      }
      closed = true
    })
    const done = new Promise<{ readonly ok: boolean; readonly exitCode: number }>((resolve) => {
      setTimeout(() => resolve({ ok: ev?.ok ?? true, exitCode: ev?.exitCode ?? 0 }), 0)
    })
    const stop = (): void => { /* noop in replay */ }
    return { stop, done }
  }
  if (!args.cmd || args.cmd.trim().length === 0) return { stop: () => {}, done: Promise.resolve({ ok: false, exitCode: 1 }) }
  const isWin: boolean = process.platform === 'win32'
  // Inject CI-friendly env to suppress interactive prompts in provider CLIs when requested
  const mergedEnv: NodeJS.ProcessEnv = args.env !== undefined ? { ...process.env, ...args.env } : { ...process.env }
  const wantCI: boolean = process.env.OPD_FORCE_CI === '1' || process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1' || process.env.CI === 'true' || process.env.CI === '1' || process.env.GITHUB_ACTIONS === 'true'
  if (wantCI) {
    mergedEnv.CI = '1'
    if (!mergedEnv.FORCE_COLOR) mergedEnv.FORCE_COLOR = '0'
    if (!mergedEnv.TERM) mergedEnv.TERM = 'dumb'
  }
  const shellFile: string = isWin ? (process.env.ComSpec ?? 'cmd.exe') : (process.env.SHELL ?? '/bin/sh')
  const shellArgs: readonly string[] = isWin ? ['/d', '/s', '/c', args.cmd] : ['-c', args.cmd]
  const cp = spawn(shellFile, [...shellArgs], { cwd: args.cwd, windowsHide: true, env: mergedEnv })
  const t0 = Date.now()
  if (process.env.OPD_DEBUG_PROCESS === '1') {
    const info = `[proc] spawnStream pid=? cmd="${args.cmd}" cwd="${args.cwd ?? ''}" timeoutMs=${Number(args.timeoutMs) || 0}`
    try { process.stderr.write(info + '\n') } catch { /* ignore */ }
  }
  cp.stdout?.setEncoding('utf8')
  cp.stderr?.setEncoding('utf8')
  const recChunks: Array<{ readonly fd: 'out' | 'err'; readonly data: string }> = []
  const onOut = (d: string): void => { recChunks.push({ fd: 'out', data: d }); args.onStdout?.(d) }
  const onErr = (d: string): void => { recChunks.push({ fd: 'err', data: d }); args.onStderr?.(d) }
  cp.stdout?.on('data', onOut)
  cp.stderr?.on('data', onErr)
  let timeout: NodeJS.Timeout | undefined
  const done: Promise<{ readonly ok: boolean; readonly exitCode: number }> = new Promise((resolve) => {
    cp.on('error', () => {
      if (process.env.OPD_DEBUG_PROCESS === '1') {
        try { process.stderr.write(`[proc] spawnStream error after ${Date.now() - t0}ms\n`) } catch { /* ignore */ }
      }
      const res = { ok: false, exitCode: 1 }
      void recordAppend({ t: 'stream', cmd: args.cmd, cwd: args.cwd, ...res, chunks: recChunks })
      resolve(res)
    })
    cp.on('close', (code: number | null) => {
      if (process.env.OPD_DEBUG_PROCESS === '1') {
        const info = `[proc] spawnStream exit code=${code ?? 'null'} after ${Date.now() - t0}ms`
        try { process.stderr.write(info + '\n') } catch { /* ignore */ }
      }
      const res = { ok: (code ?? 1) === 0, exitCode: code ?? 1 }
      void recordAppend({ t: 'stream', cmd: args.cmd, cwd: args.cwd, ...res, chunks: recChunks })
      resolve(res)
    })
  })
  // Optional timeout watchdog
  if (Number.isFinite(Number(args.timeoutMs)) && Number(args.timeoutMs) > 0) {
    timeout = setTimeout(() => {
      try { cp.kill() } catch { /* ignore */ }
      try { if (isWin) spawn('taskkill', ['/T', '/F', '/PID', String(cp.pid)], { stdio: 'ignore', windowsHide: true }) } catch { /* ignore */ }
    }, Number(args.timeoutMs))
    cp.on('close', () => { if (timeout) clearTimeout(timeout) })
    cp.on('error', () => { if (timeout) clearTimeout(timeout) })
  }
  const stop = (): void => {
    try {
      if (process.platform === 'win32') {
        try { cp.kill() } catch { /* ignore */ }
        try { spawn('taskkill', ['/T', '/F', '/PID', String(cp.pid)], { stdio: 'ignore', windowsHide: true }) } catch { /* ignore */ }
      } else {
        try { cp.kill('SIGTERM') } catch { /* ignore */ }
        setTimeout(() => { try { cp.kill('SIGKILL' as any) } catch { /* ignore */ } }, 500)
      }
    } catch { /* ignore */ }
  }
  return { stop, done }
}
export interface RunStreamArgs { readonly cmd: string; readonly cwd?: string; readonly env?: Readonly<Record<string, string>>; readonly onStdout?: (chunk: string) => void; readonly onStderr?: (chunk: string) => void; readonly timeoutMs?: number }
export interface StreamController { readonly stop: () => void; readonly done: Promise<{ readonly ok: boolean; readonly exitCode: number }> }

export interface RunResult { readonly ok: boolean; readonly exitCode: number; readonly stdout: string; readonly stderr: string }

export interface ProcUtil {
  readonly run: (args: RunArgs) => Promise<RunResult>
  readonly runStream: (args: RunStreamArgs) => Promise<{ readonly ok: boolean; readonly exitCode: number }>
  readonly spawnStream: (args: RunStreamArgs) => StreamController
  readonly has: (cmd: string) => Promise<boolean>
}

function splitCmd(cmdline: string): readonly string[] {
  const matches: RegExpMatchArray | null = cmdline.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)
  if (matches === null) return []
  return matches.map((p: string): string => {
    if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) return p.slice(1, -1)
    return p
  })
}

async function run(args: RunArgs): Promise<RunResult> {
  if (replayFile) {
    await loadReplay()
    const ev = nextReplay('run', args.cmd)
    const stdout = ev?.stdout ?? ''
    const stderr = ev?.stderr ?? ''
    const exitCode = ev?.exitCode ?? 0
    return { ok: (ev?.ok ?? true), exitCode, stdout, stderr }
  }
  return await new Promise<RunResult>((resolve) => {
    if (!args.cmd || args.cmd.trim().length === 0) return resolve({ ok: false, exitCode: 1, stdout: '', stderr: 'empty command' })
    const isWin: boolean = process.platform === 'win32'
    const mergedEnv: NodeJS.ProcessEnv = args.env !== undefined ? { ...process.env, ...args.env } : { ...process.env }
    const wantCI: boolean = process.env.OPD_FORCE_CI === '1' || process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1' || process.env.CI === 'true' || process.env.CI === '1' || process.env.GITHUB_ACTIONS === 'true'
    if (wantCI) {
      mergedEnv.CI = '1'
      if (!mergedEnv.FORCE_COLOR) mergedEnv.FORCE_COLOR = '0'
      if (!mergedEnv.TERM) mergedEnv.TERM = 'dumb'
    }
    const shellFile: string = isWin ? (process.env.ComSpec ?? 'cmd.exe') : (process.env.SHELL ?? '/bin/sh')
    const shellArgs: readonly string[] = isWin ? ['/d', '/s', '/c', args.cmd] : ['-c', args.cmd]
    const cp = spawn(shellFile, [...shellArgs], { cwd: args.cwd, windowsHide: true, env: mergedEnv })
    const t0 = Date.now()
    if (process.env.OPD_DEBUG_PROCESS === '1') {
      const info = `[proc] run pid=? cmd="${args.cmd}" cwd="${args.cwd ?? ''}"`
      try { process.stderr.write(info + '\n') } catch { /* ignore */ }
    }
    const outChunks: Buffer[] = []
    const errChunks: Buffer[] = []
    cp.stdout?.on('data', (d: Buffer) => { outChunks.push(Buffer.from(d)) })
    cp.stderr?.on('data', (d: Buffer) => { errChunks.push(Buffer.from(d)) })
    if (typeof args.stdin === 'string' && cp.stdin) {
      cp.stdin.write(args.stdin)
      cp.stdin.end()
    }
    cp.on('error', (_err: Error) => {
      const res = { ok: false, exitCode: 1, stdout: Buffer.concat(outChunks).toString(), stderr: Buffer.concat(errChunks).toString() }
      void recordAppend({ t: 'run', cmd: args.cmd, cwd: args.cwd, ...res })
      resolve(res)
    })
    cp.on('close', (code: number | null) => {
      const exit: number = code === null ? 1 : code
      const res = { ok: exit === 0, exitCode: exit, stdout: Buffer.concat(outChunks).toString(), stderr: Buffer.concat(errChunks).toString() }
      void recordAppend({ t: 'run', cmd: args.cmd, cwd: args.cwd, ...res })
      resolve(res)
    })
  })
}

async function has(cmd: string): Promise<boolean> {
  const res: RunResult = await run({ cmd: `${cmd} --version` })
  return res.ok
}

async function runStream(args: RunStreamArgs): Promise<{ readonly ok: boolean; readonly exitCode: number }> {
  if (replayFile) {
    await loadReplay()
    const ev = nextReplay('stream', args.cmd)
    for (const c of ev?.chunks ?? []) { if (c.fd === 'out') args.onStdout?.(c.data); else args.onStderr?.(c.data) }
    return { ok: ev?.ok ?? true, exitCode: ev?.exitCode ?? 0 }
  }
  return await new Promise((resolve) => {
    if (!args.cmd || args.cmd.trim().length === 0) return resolve({ ok: false, exitCode: 1 })
    const isWin: boolean = process.platform === 'win32'
    const mergedEnv: NodeJS.ProcessEnv = args.env !== undefined ? { ...process.env, ...args.env } : { ...process.env }
    const wantCI: boolean = process.env.OPD_FORCE_CI === '1' || process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1' || process.env.CI === 'true' || process.env.CI === '1' || process.env.GITHUB_ACTIONS === 'true'
    if (wantCI) {
      mergedEnv.CI = '1'
      if (!mergedEnv.FORCE_COLOR) mergedEnv.FORCE_COLOR = '0'
      if (!mergedEnv.TERM) mergedEnv.TERM = 'dumb'
    }
    const shellFile: string = isWin ? (process.env.ComSpec ?? 'cmd.exe') : (process.env.SHELL ?? '/bin/sh')
    const shellArgs: readonly string[] = isWin ? ['/d', '/s', '/c', args.cmd] : ['-c', args.cmd]
    const cp = spawn(shellFile, [...shellArgs], { cwd: args.cwd, windowsHide: true, env: mergedEnv })
    const t0 = Date.now()
    cp.stdout?.setEncoding('utf8')
    cp.stderr?.setEncoding('utf8')
    if (args.onStdout) cp.stdout?.on('data', (d: string) => { args.onStdout?.(d) })
    if (args.onStderr) cp.stderr?.on('data', (d: string) => { args.onStderr?.(d) })
    let timeout: NodeJS.Timeout | undefined
    cp.on('error', () => {
      if (timeout) clearTimeout(timeout)
      if (process.env.OPD_DEBUG_PROCESS === '1') {
        try { process.stderr.write(`[proc] runStream error after ${Date.now() - t0}ms\n`) } catch { /* ignore */ }
      }
      const res = { ok: false, exitCode: 1 }
      void recordAppend({ t: 'stream', cmd: args.cmd, cwd: args.cwd, ...res })
      resolve(res)
    })
    cp.on('close', (code: number | null) => {
      if (timeout) clearTimeout(timeout)
      if (process.env.OPD_DEBUG_PROCESS === '1') {
        const info = `[proc] runStream exit code=${code ?? 'null'} after ${Date.now() - t0}ms`
        try { process.stderr.write(info + '\n') } catch { /* ignore */ }
      }
      resolve({ ok: (code ?? 1) === 0, exitCode: code ?? 1 })
    })
    if (Number.isFinite(Number(args.timeoutMs)) && Number(args.timeoutMs) > 0) {
      timeout = setTimeout(() => {
        try { cp.kill() } catch { /* ignore */ }
        try { if (isWin) spawn('taskkill', ['/T', '/F', '/PID', String(cp.pid)], { stdio: 'ignore', windowsHide: true }) } catch { /* ignore */ }
      }, Number(args.timeoutMs))
    }
  })
}

export const proc: ProcUtil = { run, runStream, spawnStream, has }

// -------- General-purpose helpers (timeouts/retries) --------

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return await promise
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    promise.then((v) => { clearTimeout(timer); resolve(v) }, (e) => { clearTimeout(timer); reject(e) })
  })
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

export async function runWithTimeout(args: RunArgs, timeoutMs = 120_000): Promise<RunResult> {
  return await withTimeout(run(args), timeoutMs)
}

export async function runWithRetry(args: RunArgs, opts?: { readonly retries?: number; readonly baseDelayMs?: number; readonly timeoutMs?: number }): Promise<RunResult> {
  const envRetries = Number.isFinite(Number(process.env.OPD_RETRIES)) ? Number(process.env.OPD_RETRIES) : undefined
  const envBase = Number.isFinite(Number(process.env.OPD_BASE_DELAY_MS)) ? Number(process.env.OPD_BASE_DELAY_MS) : undefined
  const envTimeout = Number.isFinite(Number(process.env.OPD_TIMEOUT_MS)) ? Number(process.env.OPD_TIMEOUT_MS) : undefined
  const retries = Math.max(0, opts?.retries ?? (envRetries ?? 2))
  const base = Math.max(10, opts?.baseDelayMs ?? (envBase ?? 300))
  const to = opts?.timeoutMs ?? (envTimeout ?? 120_000)
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await runWithTimeout(args, to)
      if (res.ok || attempt >= retries) return res
      // fallthrough to retry on non-ok
    } catch (e) {
      if (attempt >= retries) throw e
    }
    const jitter = Math.floor(Math.random() * base)
    const wait = base * Math.pow(2, attempt) + jitter
    await sleep(wait)
    attempt++
  }
}
