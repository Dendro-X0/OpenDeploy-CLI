type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface Logger {
  readonly info: (msg: string) => void
  readonly warn: (msg: string) => void
  readonly error: (msg: string) => void
  readonly success: (msg: string) => void
  readonly note: (msg: string) => void
  readonly section: (title: string) => void
  readonly highlight: (msg: string, color: 'red' | 'green' | 'blue' | 'cyan' | 'yellow' | 'dim' | 'bold') => string
  readonly json: (val: unknown) => void
  readonly setLevel: (lvl: LogLevel) => void
  readonly setJsonOnly: (on: boolean) => void
  readonly setNoEmoji: (on: boolean) => void
  readonly setJsonCompact: (on: boolean) => void
  readonly setNdjson: (on: boolean) => void
  readonly setTimestamps: (on: boolean) => void
  readonly setSummaryOnly: (on: boolean) => void
  readonly setJsonFile: (path: string) => void
  readonly setNdjsonFile: (path: string) => void
  readonly setRedactors: (patterns: readonly (string | RegExp)[]) => void
}

let level: LogLevel = 'info'
let jsonOnly = false
let noEmoji = false
let jsonCompact = false
let ndjson = false
let timestampsOn = false
let summaryOnly = false
let jsonFilePath: string | undefined
let ndjsonFilePath: string | undefined
let redactors: RegExp[] = []
import { dirname } from 'node:path'
import { mkdir, appendFile } from 'node:fs/promises'
import { colorize } from './colors'

async function safeAppend(path: string, line: string): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true })
    await appendFile(path, line, 'utf8')
  } catch { /* ignore file sink errors */ }
}

function applyRedaction(msg: string): string {
  if (redactors.length === 0) return msg
  let out = msg
  for (const r of redactors) {
    try { out = out.replace(r, '******') } catch { /* ignore */ }
  }
  return out
}

function write(kind: LogLevel, msg: string): void {
  if (jsonOnly) return
  const prefix: string = noEmoji
    ? (kind === 'error' ? '[error]' : kind === 'warn' ? '[warn]' : kind === 'info' ? '[info]' : '[debug]')
    : (kind === 'error' ? '✖' : kind === 'warn' ? '⚠' : kind === 'info' ? 'ℹ' : '•')
  const ts: string = timestampsOn ? `${new Date().toISOString()} ` : ''
  // Redact secrets in human logs only
  const redacted: string = applyRedaction(msg)
  // Colorize message content by level for readability, unless msg is already colored
  const hasAnsi: boolean = redacted.includes('\u001b[')
  const colored: string = hasAnsi ? redacted : (kind === 'error'
    ? colorize('red', redacted)
    : kind === 'warn'
      ? colorize('yellow', redacted)
      : kind === 'info'
        ? colorize('cyan', redacted)
        : redacted)
  // eslint-disable-next-line no-console
  console[kind === 'error' ? 'error' : 'log'](`${ts}${prefix} ${colored}`)
}

function enrichJson(val: unknown): unknown {
  if (!timestampsOn && !ndjson) return val
  if (val !== null && typeof val === 'object') {
    // Shallow clone and add ts when missing
    const obj = { ...(val as Record<string, unknown>) }
    if (timestampsOn && obj.ts === undefined) obj.ts = new Date().toISOString()
    return obj
  }
  return val
}

export const logger: Logger = {
  info: (msg: string): void => { if (jsonOnly) return; if (level === 'info' || level === 'debug') write('info', msg) },
  warn: (msg: string): void => { if (jsonOnly) return; write('warn', msg) },
  error: (msg: string): void => { if (jsonOnly) return; write('error', msg) },
  success: (msg: string): void => { if (jsonOnly) return; const text = `${noEmoji ? '[ok]' : '✓'} ${msg}`; const colored = colorize('green', text); write('info', colored) },
  note: (msg: string): void => { if (jsonOnly) return; const text = `${noEmoji ? '[note]' : '✱'} ${msg}`; const colored = colorize('blue', text); write('info', colored) },
  section: (title: string): void => {
    if (jsonOnly) return
    const bar = '─'.repeat(Math.max(12, Math.min(60, title.length + 10)))
    const head = `${colorize('cyan', bar)}\n${colorize('bold', title)}\n${colorize('cyan', bar)}`
    // eslint-disable-next-line no-console
    console.log(head)
  },
  highlight: (msg: string, color: 'red' | 'green' | 'blue' | 'cyan' | 'yellow' | 'dim' | 'bold'): string => colorize(color, msg),
  json: (val: unknown): void => { // eslint-disable-next-line no-console
    const v = enrichJson(val)
    if (summaryOnly) {
      // Only print summary objects marked explicitly
      const isSummary: boolean = typeof v === 'object' && v !== null && (v as Record<string, unknown>).final === true
      if (!isSummary) return
    }
    const line: string = ndjson || jsonCompact ? JSON.stringify(v) : JSON.stringify(v, null, 2)
    // console output
    // eslint-disable-next-line no-console
    console.log(line)
    // file sinks
    if (ndjsonFilePath) void safeAppend(ndjsonFilePath, line + "\n")
    if (jsonFilePath) {
      // For json-file, write pretty when not ndjson/compact
      const jl: string = ndjson ? JSON.stringify(v) : (jsonCompact ? JSON.stringify(v) : JSON.stringify(v, null, 2))
      void safeAppend(jsonFilePath, jl + "\n")
    }
  },
  setLevel: (lvl: LogLevel): void => { level = lvl },
  setJsonOnly: (on: boolean): void => { jsonOnly = on },
  setNoEmoji: (on: boolean): void => { noEmoji = on },
  setJsonCompact: (on: boolean): void => { jsonCompact = on },
  setNdjson: (on: boolean): void => { ndjson = on; if (on) { jsonOnly = true; jsonCompact = true } },
  setTimestamps: (on: boolean): void => { timestampsOn = on },
  setSummaryOnly: (on: boolean): void => { summaryOnly = on },
  setJsonFile: (path: string): void => { jsonFilePath = path },
  setNdjsonFile: (path: string): void => { ndjsonFilePath = path }
  ,
  setRedactors: (patterns: readonly (string | RegExp)[]): void => {
    redactors = patterns.map((p) => p instanceof RegExp ? p : new RegExp(escapeRegExp(p), 'g'))
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
