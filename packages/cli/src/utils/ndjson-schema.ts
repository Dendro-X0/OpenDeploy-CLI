/**
 * Minimal NDJSON schema helpers for OpenDeploy events.
 * Keep these intentionally small and conservative.
 */

export interface NdjsonValidationIssue {
  readonly line: number
  readonly message: string
}

export interface NdjsonValidationResult {
  readonly ok: boolean
  readonly issues: readonly NdjsonValidationIssue[]
  readonly total: number
  readonly valid: number
  readonly invalid: number
  readonly final: true
}

export type NdjsonObject = Readonly<Record<string, unknown>>

/** Validate one NDJSON JSON object against minimal rules. */
export function validateNdjsonObject(obj: NdjsonObject): readonly string[] {
  const msgs: string[] = []
  const action = obj.action
  if (typeof action !== 'string' || action.length === 0) msgs.push("'action' must be a non-empty string")
  if ('event' in obj && typeof obj.event !== 'string') msgs.push("'event' must be a string when present")
  if ('final' in obj && typeof obj.final !== 'boolean') msgs.push("'final' must be a boolean when present")
  // Logs event shape
  if ((obj as any).event === 'logs') {
    const logsUrl = (obj as any).logsUrl
    if (typeof logsUrl !== 'string' || logsUrl.length === 0) msgs.push("logs event requires 'logsUrl' as non-empty string")
  }
  // Done event shape
  if ((obj as any).event === 'done') {
    if (typeof (obj as any).ok !== 'boolean') msgs.push("done event requires 'ok' boolean")
  }
  return msgs
}

/** Validate a list of NDJSON lines (already parsed into objects). */
export function validateNdjsonObjects(objs: readonly NdjsonObject[]): NdjsonValidationResult {
  const issues: NdjsonValidationIssue[] = []
  let valid = 0
  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i]
    const errs = validateNdjsonObject(obj)
    if (errs.length === 0) valid++
    else issues.push({ line: i + 1, message: errs.join('; ') })
  }
  const total = objs.length
  const invalid = total - valid
  return { ok: invalid === 0, issues, total, valid, invalid, final: true }
}
