/**
 * Progress heartbeat utility.
 * Emits periodic informational logs with elapsed time to indicate the tool is still working.
 *
 * Behavior:
 * - Disabled automatically when JSON/NDJSON or quiet mode is enabled.
 * - Uses logger.info for human-friendly lines; timestamps are prepended if --timestamps is on via logger.
 */
import { colors } from './colors'
import { logger } from './logger'

export interface HeartbeatOptions {
  /** Short label for the activity, e.g. "vercel deploy" */
  readonly label: string
  /** Optional hint for the user, e.g. "use: opendeploy open vercel" */
  readonly hint?: string
  /** Interval in milliseconds between heartbeats (default: 10000) */
  readonly intervalMs?: number
}

export type Stopper = () => void

/**
 * Start a periodic heartbeat. Returns a function to stop it.
 */
export function startHeartbeat(opts: HeartbeatOptions): Stopper {
  // Respect global output modes
  const isNdjson: boolean = process.env.OPD_NDJSON === '1'
  const isJsonOnly: boolean = process.env.OPD_JSON === '1'
  const isQuiet: boolean = process.env.OPD_QUIET === '1'
  const isTty: boolean = Boolean(process.stdout && process.stdout.isTTY)
  const intervalMs: number = opts.intervalMs ?? (isNdjson ? 5000 : 10000)
  if (isQuiet) return (): void => {}
  if (isTty) return (): void => {}
  if (isJsonOnly && !isNdjson) return (): void => {}
  const t0: number = Date.now()
  if (isNdjson) {
    const tick = (): void => {
      const elapsed: number = Date.now() - t0
      logger.json({ event: 'heartbeat', label: opts.label, elapsedMs: elapsed, hint: opts.hint })
    }
    const timer: NodeJS.Timeout = setInterval(tick, intervalMs)
    return (): void => { clearInterval(timer) }
  }
  const tick = (): void => {
    const elapsed: number = Date.now() - t0
    const mins: number = Math.floor(elapsed / 60000)
    const secs: number = Math.floor((elapsed % 60000) / 1000)
    process.stdout.write(`\n${colors.dim('…')} ${opts.label} still running (${mins}m ${secs}s). ${opts.hint ?? ''}\n`)
  }
  const timer: NodeJS.Timeout = setInterval(tick, intervalMs)
  return (): void => { clearInterval(timer) }
}
