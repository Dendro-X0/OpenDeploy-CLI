export type EnvMap = Record<string, string>

export interface EnvDiff {
  readonly added: string[]
  readonly removed: string[]
  readonly changed: Array<{ key: string; local: string; remote: string }>
}

export function diffKeyValues(local: EnvMap, remote: EnvMap): EnvDiff {
  const keys = Array.from(new Set([...Object.keys(local), ...Object.keys(remote)])).sort()
  const added: string[] = []
  const removed: string[] = []
  const changed: Array<{ key: string; local: string; remote: string }> = []
  for (const k of keys) {
    const l = local[k]
    const r = remote[k]
    if (l === undefined && r !== undefined) removed.push(k)
    else if (l !== undefined && r === undefined) added.push(k)
    else if (l !== undefined && r !== undefined && l !== r) changed.push({ key: k, local: l, remote: r })
  }
  return { added, removed, changed }
}
