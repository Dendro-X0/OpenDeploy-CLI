#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

async function exists(p){ try { await fs.access(p); return true } catch { return false } }
async function rimraf(p){ if (!(await exists(p))) return; const stat = await fs.lstat(p); if (stat.isDirectory()) { const entries = await fs.readdir(p); await Promise.all(entries.map(e => rimraf(path.join(p, e)))); await fs.rmdir(p); } else { await fs.unlink(p); } }
async function mkdirp(p){ await fs.mkdir(p, { recursive: true }) }
async function copyDir(src, dst){ if (!(await exists(src))) return; await mkdirp(dst); const entries = await fs.readdir(src, { withFileTypes: true }); for (const e of entries) { const s = path.join(src, e.name); const d = path.join(dst, e.name); if (e.isDirectory()) await copyDir(s, d); else await fs.copyFile(s, d); } }

async function main(){
  const root = path.resolve(path.join(import.meta.url.replace('file:///', '/'), '..', '..')).replace(/\\+/g, '/')
  const extRoot = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname), '..')).replace(/\\+/g, '/')
  const stage = path.join(extRoot, '.stage')
  await rimraf(stage)
  await mkdirp(stage)
  // Copy files
  await copyDir(path.join(extRoot, 'dist'), path.join(stage, 'dist'))
  if (await exists(path.join(extRoot, 'images'))) await copyDir(path.join(extRoot, 'images'), path.join(stage, 'images'))
  for (const f of ['package.json', 'README.md', 'LICENSE']) {
    if (await exists(path.join(extRoot, f))) await fs.copyFile(path.join(extRoot, f), path.join(stage, f))
  }
  // Run vsce from stage using pnpm dlx to avoid monorepo git scan
  await new Promise((resolve, reject) => {
    const p = spawn('pnpm', ['dlx', 'vsce', 'package', '--out', 'opendeploy-vscode.vsix'], { cwd: stage, shell: true, stdio: 'inherit' })
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error('vsce failed: '+code)))
  })
  console.log(`\nVSIX ready: ${path.join(stage, 'opendeploy-vscode.vsix')}`)
}

main().catch(err => { console.error(err); process.exit(1) })
