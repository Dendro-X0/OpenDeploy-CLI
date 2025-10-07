/**
 * Minimal TTY spinner with safe fallbacks.
 * Auto-disables under JSON/NDJSON/quiet or when stdout is not a TTY.
 */
export interface Spinner {
  readonly succeed: (msg?: string) => void
  readonly fail: (msg?: string) => void
  readonly stop: (msg?: string) => void
  readonly update: (msg: string) => void
}

function canSpin(): boolean {
  if (process.env.OPD_JSON === '1' || process.env.OPD_NDJSON === '1' || process.env.OPD_QUIET === '1') return false
  return Boolean(process.stdout && process.stdout.isTTY)
}

const FRAMES: readonly string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function spinner(label: string): Spinner {
  if (!canSpin()) {
    // No-op spinner for non-TTY / JSON modes
    return {
      succeed: (_msg?: string): void => {},
      fail: (_msg?: string): void => {},
      stop: (_msg?: string): void => {},
      update: (_msg: string): void => {},
    }
  }
  let i = 0
  let text: string = label
  const tick = (): void => {
    const frame = FRAMES[i = (i + 1) % FRAMES.length]
    const line = `${frame} ${text}`
    process.stdout.write(`\r${line}`)
  }
  const timer: NodeJS.Timeout = setInterval(tick, 120)
  tick()
  const clear = (): void => {
    clearInterval(timer)
    process.stdout.write('\r')
  }
  const writeLine = (line: string): void => {
    process.stdout.write(`${line}\n`)
  }
  return {
    succeed: (msg?: string): void => { clear(); writeLine(msg ?? `${label} done`) },
    fail: (msg?: string): void => { clear(); writeLine(msg ?? `${label} failed`) },
    stop: (msg?: string): void => { clear(); if (msg) writeLine(msg) },
    update: (msg: string): void => { text = msg },
  }
}
