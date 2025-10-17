import type { Hint, ProviderId } from "../contracts/provider.js"
import type { OpdEvent, OpdSummary } from "./types.js"

export function evt(args: {
  readonly action: OpdEvent["action"]
  readonly provider?: ProviderId
  readonly phase?: string
  readonly ok?: boolean
  readonly message?: string
  readonly url?: string
  readonly logsUrl?: string
  readonly hint?: Hint
  readonly timestamp?: string
}): OpdEvent {
  return { ...args }
}

export function summary(args: {
  readonly ok: boolean
  readonly action: OpdSummary["action"]
  readonly provider?: ProviderId
  readonly framework?: string
  readonly publishDir?: string
  readonly url?: string
  readonly logsUrl?: string
  readonly hints?: readonly Hint[]
}): OpdSummary {
  return { ...args, final: true }
}
