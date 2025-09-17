import { spawn } from 'node:child_process'

interface RunArgs { readonly cmd: string; readonly cwd?: string; readonly stdin?: string; readonly env?: Readonly<Record<string, string>> }

function spawnStream(args: RunStreamArgs): StreamController {
  const parts: readonly string[] = splitCmd(args.cmd)
  const file: string = parts[0] ?? ''
  const fileArgs: readonly string[] = parts.slice(1)
  if (file.length === 0) return { stop: () => {}, done: Promise.resolve({ ok: false, exitCode: 1 }) }
  const shellPath: string = process.env.SHELL ?? (process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh')
  const mergedEnv: NodeJS.ProcessEnv = args.env !== undefined ? { ...process.env, ...args.env } : process.env
  const cp = spawn(file, [...fileArgs], { cwd: args.cwd, shell: shellPath, windowsHide: true, env: mergedEnv })
  cp.stdout?.setEncoding('utf8')
  cp.stderr?.setEncoding('utf8')
  if (args.onStdout) cp.stdout?.on('data', (d: string) => { args.onStdout?.(d) })
  if (args.onStderr) cp.stderr?.on('data', (d: string) => { args.onStderr?.(d) })
  const done: Promise<{ readonly ok: boolean; readonly exitCode: number }> = new Promise((resolve) => {
    cp.on('error', () => resolve({ ok: false, exitCode: 1 }))
    cp.on('close', (code: number | null) => resolve({ ok: (code ?? 1) === 0, exitCode: code ?? 1 }))
  })
  const stop = (): void => { try { cp.kill('SIGTERM') } catch { /* ignore */ } }
  return { stop, done }
}
interface RunStreamArgs { readonly cmd: string; readonly cwd?: string; readonly env?: Readonly<Record<string, string>>; readonly onStdout?: (chunk: string) => void; readonly onStderr?: (chunk: string) => void }
interface StreamController { readonly stop: () => void; readonly done: Promise<{ readonly ok: boolean; readonly exitCode: number }> }

interface RunResult { readonly ok: boolean; readonly exitCode: number; readonly stdout: string; readonly stderr: string }

interface ProcUtil {
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
  const parts: readonly string[] = splitCmd(args.cmd)
  const file: string = parts[0] ?? ''
  const fileArgs: readonly string[] = parts.slice(1)
  return await new Promise<RunResult>((resolve) => {
    if (file.length === 0) return resolve({ ok: false, exitCode: 1, stdout: '', stderr: 'empty command' })
    const shellPath: string = process.env.SHELL ?? (process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh')
    const mergedEnv: NodeJS.ProcessEnv = args.env !== undefined ? { ...process.env, ...args.env } : process.env
    const cp = spawn(file, [...fileArgs], { cwd: args.cwd, shell: shellPath, windowsHide: true, env: mergedEnv })
    const outChunks: Buffer[] = []
    const errChunks: Buffer[] = []
    cp.stdout?.on('data', (d: Buffer) => { outChunks.push(Buffer.from(d)) })
    cp.stderr?.on('data', (d: Buffer) => { errChunks.push(Buffer.from(d)) })
    if (typeof args.stdin === 'string' && cp.stdin) {
      cp.stdin.write(args.stdin)
      cp.stdin.end()
    }
    cp.on('error', (_err: Error) => { resolve({ ok: false, exitCode: 1, stdout: Buffer.concat(outChunks).toString(), stderr: Buffer.concat(errChunks).toString() }) })
    cp.on('close', (code: number | null) => {
      const exit: number = code === null ? 1 : code
      resolve({ ok: exit === 0, exitCode: exit, stdout: Buffer.concat(outChunks).toString(), stderr: Buffer.concat(errChunks).toString() })
    })
  })
}

async function has(cmd: string): Promise<boolean> {
  const res: RunResult = await run({ cmd: `${cmd} --version` })
  return res.ok
}

async function runStream(args: RunStreamArgs): Promise<{ readonly ok: boolean; readonly exitCode: number }> {
  const parts: readonly string[] = splitCmd(args.cmd)
  const file: string = parts[0] ?? ''
  const fileArgs: readonly string[] = parts.slice(1)
  return await new Promise((resolve) => {
    if (file.length === 0) return resolve({ ok: false, exitCode: 1 })
    const shellPath: string = process.env.SHELL ?? (process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh')
    const mergedEnv: NodeJS.ProcessEnv = args.env !== undefined ? { ...process.env, ...args.env } : process.env
    const cp = spawn(file, [...fileArgs], { cwd: args.cwd, shell: shellPath, windowsHide: true, env: mergedEnv })
    cp.stdout?.setEncoding('utf8')
    cp.stderr?.setEncoding('utf8')
    if (args.onStdout) cp.stdout?.on('data', (d: string) => { args.onStdout?.(d) })
    if (args.onStderr) cp.stderr?.on('data', (d: string) => { args.onStderr?.(d) })
    cp.on('error', () => resolve({ ok: false, exitCode: 1 }))
    cp.on('close', (code: number | null) => resolve({ ok: (code ?? 1) === 0, exitCode: code ?? 1 }))
  })
}

export const proc: ProcUtil = { run, runStream, spawnStream, has }
