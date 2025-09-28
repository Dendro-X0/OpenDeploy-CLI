import type { RunStreamArgs, StreamController } from './process'
import { proc } from './process'
import { goSpawnStream, type GoRunStreamArgs } from './process-go'
import { spawn } from 'node:child_process'

/**
 * Prefer the Go sidecar runner when available (and not disabled),
 * otherwise fall back to the built-in Node runner.
 */
export function spawnStreamPreferred(args: RunStreamArgs & { readonly timeoutSeconds?: number; readonly idleTimeoutSeconds?: number }): StreamController {
  const useGo = process.env.OPD_GO_DISABLE !== '1' && hasGoSidecar()
  if (useGo) {
    const goArgs: GoRunStreamArgs = {
      ...args,
      timeoutSeconds: args.timeoutSeconds,
      idleTimeoutSeconds: args.idleTimeoutSeconds
    }
    return goSpawnStream(goArgs)
  }
  return proc.spawnStream(args)
}

let goAvailableCached: boolean | undefined
function hasGoSidecar(): boolean {
  if (typeof goAvailableCached === 'boolean') return goAvailableCached
  try {
    const cp = spawn('opd-go', ['-v'], { stdio: 'ignore', windowsHide: true })
    let decided = false
    cp.once('error', (err) => {
      if (!decided) { decided = true; goAvailableCached = (err as any)?.code !== 'ENOENT' }
    })
    cp.once('close', () => {
      if (!decided) { decided = true; goAvailableCached = true }
    })
  } catch {
    goAvailableCached = false
  }
  // Best effort: assume available; if not, spawn will fail and fallback will engage on next call
  return goAvailableCached ?? false
}
