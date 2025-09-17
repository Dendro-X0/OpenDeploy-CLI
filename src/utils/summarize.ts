import { colors } from './colors'
import { logger } from './logger'
import { appendFile } from 'node:fs/promises'

export interface DeploySummaryArgs {
  readonly provider: 'vercel' | 'netlify'
  readonly target: 'prod' | 'preview'
  readonly url?: string
  readonly projectId?: string
  readonly durationMs?: number
  readonly logsUrl?: string
}

function fmtMs(ms?: number): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

export function printDeploySummary(args: DeploySummaryArgs): void {
  // Only for human mode (logger.jsonOnly would suppress)
  const lines: string[] = []
  lines.push(colors.bold('Summary'))
  lines.push(`  • Provider: ${args.provider}`)
  lines.push(`  • Target:   ${args.target}`)
  if (args.url) lines.push(`  • URL:      ${colors.cyan(args.url)}`)
  if (args.projectId) lines.push(`  • Project:  ${args.projectId}`)
  if (args.durationMs !== undefined) lines.push(`  • Duration: ${fmtMs(args.durationMs)}`)
  if (args.logsUrl) lines.push(`  • Inspect:  ${args.logsUrl}`)
  logger.info('\n' + lines.join('\n'))
  // GitHub Job Summary (Markdown)
  const gh: string | undefined = process.env.GITHUB_STEP_SUMMARY
  if (gh) {
    const md: string = [
      '## OpenDeploy — Deploy Summary',
      '',
      `- Provider: ${args.provider}`,
      `- Target: ${args.target}`,
      args.url ? `- URL: ${args.url}` : '',
      args.projectId ? `- Project: ${args.projectId}` : '',
      args.durationMs !== undefined ? `- Duration: ${fmtMs(args.durationMs)}` : '',
      args.logsUrl ? `- Inspect: ${args.logsUrl}` : '',
      ''
    ].filter(Boolean).join('\n')
    void appendFile(gh, md + '\n', 'utf8').catch(() => { /* ignore */ })
  }
}

export interface EnvPullSummaryArgs {
  readonly provider: 'vercel' | 'netlify'
  readonly env?: 'prod' | 'preview' | 'development'
  readonly out: string
  readonly count?: number
}

export function printEnvPullSummary(args: EnvPullSummaryArgs): void {
  const lines: string[] = []
  lines.push(colors.bold('Summary'))
  lines.push(`  • Provider: ${args.provider}`)
  if (args.env) lines.push(`  • Environment: ${args.env}`)
  lines.push(`  • Output:   ${args.out}`)
  if (typeof args.count === 'number') lines.push(`  • Variables: ${args.count}`)
  logger.info('\n' + lines.join('\n'))
}

export interface EnvSyncSummaryArgs {
  readonly provider: 'vercel' | 'netlify'
  readonly file: string
  readonly setCount: number
  readonly skippedCount: number
  readonly failedCount: number
}

export function printEnvSyncSummary(args: EnvSyncSummaryArgs): void {
  const lines: string[] = []
  lines.push(colors.bold('Summary'))
  lines.push(`  • Provider: ${args.provider}`)
  lines.push(`  • File:     ${args.file}`)
  lines.push(`  • Set:      ${args.setCount}`)
  lines.push(`  • Skipped:  ${args.skippedCount}`)
  if (args.failedCount > 0) lines.push(`  • Failed:   ${args.failedCount}`)
  logger.info('\n' + lines.join('\n'))
}

export interface EnvDiffSummaryArgs {
  readonly provider: 'vercel' | 'netlify'
  readonly env?: 'prod' | 'preview' | 'development'
  readonly added: number
  readonly removed: number
  readonly changed: number
  readonly ok: boolean
  readonly addedKeys?: readonly string[]
  readonly removedKeys?: readonly string[]
  readonly changedKeys?: readonly string[]
}

export function printEnvDiffSummary(args: EnvDiffSummaryArgs): void {
  const lines: string[] = []
  lines.push(colors.bold('Summary'))
  lines.push(`  • Provider: ${args.provider}`)
  if (args.env) lines.push(`  • Environment: ${args.env}`)
  lines.push(`  • Added:    ${args.added}`)
  lines.push(`  • Removed:  ${args.removed}`)
  lines.push(`  • Changed:  ${args.changed}`)
  lines.push(`  • Status:   ${args.ok ? colors.green('OK') : colors.yellow('DIFFS')}`)
  logger.info('\n' + lines.join('\n'))
  const gh: string | undefined = process.env.GITHUB_STEP_SUMMARY
  if (gh) {
    const total: number = args.added + args.removed + args.changed
    const mdParts: string[] = [
      '## OpenDeploy — Env Diff Summary',
      '',
      `- Provider: ${args.provider}`,
      args.env ? `- Environment: ${args.env}` : '',
      `- Added: ${args.added}`,
      `- Removed: ${args.removed}`,
      `- Changed: ${args.changed}`,
      `- Status: ${args.ok ? 'OK' : 'DIFFS'}`,
      ''
    ].filter(Boolean)
    if (total > 0 && total <= 10) {
      mdParts.push('| Type | Key |')
      mdParts.push('|---|---|')
      for (const k of (args.addedKeys ?? [])) mdParts.push(`| added | ${k} |`)
      for (const k of (args.removedKeys ?? [])) mdParts.push(`| removed | ${k} |`)
      for (const k of (args.changedKeys ?? [])) mdParts.push(`| changed | ${k} |`)
      mdParts.push('')
    }
    const md: string = mdParts.join('\n')
    void appendFile(gh, md + '\n', 'utf8').catch(() => { /* ignore */ })
  }
}

export interface DoctorSummaryArgs {
  readonly total: number
  readonly okCount: number
  readonly failCount: number
  readonly failSamples?: readonly { readonly name: string; readonly message: string }[]
}

export function printDoctorSummary(args: DoctorSummaryArgs): void {
  const lines: string[] = []
  lines.push(colors.bold('Summary'))
  lines.push(`  • Checks:   ${args.total}`)
  lines.push(`  • Passed:   ${args.okCount}`)
  lines.push(`  • Issues:   ${args.failCount}`)
  logger.info('\n' + lines.join('\n'))
  const gh: string | undefined = process.env.GITHUB_STEP_SUMMARY
  if (gh) {
    const mdParts: string[] = [
      '## OpenDeploy — Doctor Summary',
      '',
      `- Checks: ${args.total}`,
      `- Passed: ${args.okCount}`,
      `- Issues: ${args.failCount}`,
      ''
    ]
    if ((args.failSamples?.length ?? 0) > 0) {
      mdParts.push('| Check | Issue |')
      mdParts.push('|---|---|')
      for (const it of args.failSamples!.slice(0, 5)) {
        mdParts.push(`| ${it.name} | ${it.message} |`)
      }
      mdParts.push('')
    }
    const md: string = mdParts.join('\n')
    void appendFile(gh, md + '\n', 'utf8').catch(() => { /* ignore */ })
  }
}
