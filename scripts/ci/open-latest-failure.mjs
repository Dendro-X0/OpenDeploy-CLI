#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import { join, basename } from 'node:path'
import { spawnSync } from 'node:child_process'

const workflow = process.argv[2] || 'ci.yml'
const outRoot = '.artifacts/ci-logs'
const wfBase = basename(workflow).replace(/\.yml$/i, '')

function log(msg) { console.log(`[open-failure] ${msg}`) }

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

function tryOpenWithCode(targetPath) {
  const res = spawnSync('code', [targetPath], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (res.error) {
    log(`VSCode CLI not found, path: ${targetPath}`)
  }
}

async function main() {
  const root = process.cwd()
  const baseDir = join(root, outRoot, wfBase)
  await ensureDir(baseDir)
  // Sync once to ensure latest logs exist
  try {
    const syncRes = spawnSync('node', ['packages/cli/dist/index.js', 'ci', 'sync', '--workflow', workflow, '--out', outRoot], { stdio: 'inherit' })
    if (syncRes.status !== 0) log('ci sync returned non-zero (continuing)')
  } catch (e) { log(`sync error: ${e?.message ?? e}`) }

  // Pick latest run directory (numeric id)
  const entries = await fs.readdir(baseDir, { withFileTypes: true })
  const ids = entries.filter(e => e.isDirectory()).map(e => e.name).filter(n => /^\d+$/.test(n)).map(n => Number(n)).sort((a, b) => b - a)
  const latest = ids[0]
  if (!latest) {
    log('No synced runs found. Run ci sync first.')
    process.exit(1)
    return
  }
  const runDir = join(baseDir, String(latest))
  const summaryPath = join(runDir, 'summary.json')
  let summary
  try { summary = JSON.parse(await fs.readFile(summaryPath, 'utf8')) } catch { /* ignore */ }

  function openFolder() { tryOpenWithCode(runDir) }

  if (summary && Array.isArray(summary.jobs)) {
    const jobs = summary.jobs
    const pick = (wanted) => jobs.find(j => typeof (j.conclusion || j.status) === 'string' && (j.conclusion || j.status).toLowerCase() === wanted)
    const failing = pick('failure')
    const cancelled = pick('cancelled')
    const target = failing || cancelled || jobs[0]
    if (target) {
      const id = target.databaseId || target.id
      const prefix = `job-${id}-`
      const files = await fs.readdir(runDir)
      const logFile = files.find(f => f.startsWith(prefix) && f.endsWith('.log'))
      if (logFile) { tryOpenWithCode(join(runDir, logFile)); return }
    }
  }
  // Fallback
  openFolder()
}

main().catch(err => { console.error(err); process.exit(1) })
