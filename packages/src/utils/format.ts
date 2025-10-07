import { colors } from './colors'

export interface ChangedEntry { readonly key: string; readonly local: string; readonly remote: string }

function mask(value: string): string {
  if (value.length <= 4) return '***'
  const head: string = value.slice(0, 3)
  const tail: string = value.slice(-2)
  return `${head}***${tail}`
}

function section(title: string, lines: readonly string[]): string[] {
  if (lines.length === 0) return []
  const out: string[] = []
  out.push(colors.bold(title))
  for (const ln of lines) out.push(`  • ${ln}`)
  return out
}

export function formatDiffHuman(args: { readonly added: readonly string[]; readonly removed: readonly string[]; readonly changed: readonly ChangedEntry[] }): string {
  const addedLines: string[] = args.added.map((k) => colors.green(k))
  const removedLines: string[] = args.removed.map((k) => colors.yellow(k))
  const changedLines: string[] = args.changed.map((c) => `${colors.cyan(c.key)} ${colors.dim('(local:')} ${mask(c.local)}${colors.dim(', remote:')} ${mask(c.remote)}${colors.dim(')')}`)
  const parts: string[] = []
  parts.push(...section(`Added only locally (${args.added.length})`, addedLines))
  parts.push(...section(`Missing locally (${args.removed.length})`, removedLines))
  parts.push(...section(`Changed (${args.changed.length})`, changedLines))
  return parts.join('\n')
}
