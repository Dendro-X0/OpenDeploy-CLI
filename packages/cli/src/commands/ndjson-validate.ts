/**
 * NDJSON Validator command.
 * Validates OpenDeploy NDJSON event streams against a minimal schema.
 */
import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { stdin as nodeStdin } from 'node:process'
import { logger, isJsonMode } from '../utils/logger'
import { validateNdjsonObjects, type NdjsonObject, type NdjsonValidationResult } from '../utils/ndjson-schema'

async function readFromFile(path: string): Promise<string[]> {
  const buf: string = await readFile(path, 'utf8')
  return buf.split(/\r?\n/).map((l: string): string => l.trim()).filter((l: string): boolean => l.length > 0)
}

async function readFromStdin(): Promise<string[]> {
  const rl = createInterface({ input: nodeStdin })
  const lines: string[] = []
  for await (const line of rl) { const t = String(line).trim(); if (t.length > 0) lines.push(t) }
  return lines
}

function parseLines(lines: readonly string[]): readonly NdjsonObject[] {
  const out: NdjsonObject[] = []
  for (const l of lines) {
    try { out.push(JSON.parse(l) as NdjsonObject) } catch { out.push({}) }
  }
  return out
}

export function registerNdjsonValidateCommand(program: Command): void {
  program
    .command('ndjson-validate')
    .description('Validate NDJSON lines from a file or stdin for OpenDeploy event shape')
    .option('--file <path>', 'Path to NDJSON file, omit to read from stdin')
    .option('--json', 'Output JSON summary')
    .action(async (opts: { readonly file?: string; readonly json?: boolean }): Promise<void> => {
      const lines: string[] = typeof opts.file === 'string' && opts.file.length > 0
        ? await readFromFile(opts.file)
        : await readFromStdin()
      const objs: readonly NdjsonObject[] = parseLines(lines)
      const res: NdjsonValidationResult = validateNdjsonObjects(objs)
      if (isJsonMode(opts.json)) { logger.json({ action: 'ndjson-validate', ...res }); return }
      logger.section('NDJSON Validation Summary')
      logger.info(`Total: ${res.total}`)
      logger.info(`Valid: ${res.valid}`)
      logger.info(`Invalid: ${res.invalid}`)
      if (res.issues.length > 0) {
        logger.section('Issues')
        for (const i of res.issues) logger.info(`#${i.line}: ${i.message}`)
      }
      logger.json({ action: 'ndjson-validate', ok: res.ok, final: true })
    })
}
