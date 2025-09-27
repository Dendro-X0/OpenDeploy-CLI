#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

/**
 * Simple docs link checker:
 * - Scans README.md and docs/*.md
 * - Validates relative Markdown links [text](path) point to existing files
 * - Validates anchors (#heading) exist in target files by slugifying headings
 * - Ignores external links (http/https/mailto)
 */

const ROOT = resolve(process.cwd())
const DOCS_DIR = join(ROOT, 'docs')
const FILES = [join(ROOT, 'README.md')]

async function collectDocs(dir) {
  const out = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      out.push(join(dir, e.name))
    }
  }
  return out
}

function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[`_*~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function parseHeadings(filePath) {
  const src = await readFile(filePath, 'utf8')
  const lines = src.split(/\r?\n/)
  const anchors = new Set()
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line)
    if (m) {
      anchors.add(slugify(m[2]))
    }
  }
  return anchors
}

async function checkFile(mdPath) {
  const rel = mdPath.startsWith(ROOT) ? mdPath.slice(ROOT.length + 1) : mdPath
  const src = await readFile(mdPath, 'utf8')
  const headingAnchors = await parseHeadings(mdPath)
  const re = /\[[^\]]*\]\(([^)]+)\)/g
  const errors = []
  let m
  while ((m = re.exec(src)) !== null) {
    const raw = m[1].trim()
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('mailto:')) continue
    // Pure anchor in same doc
    if (raw.startsWith('#')) {
      const anchor = raw.slice(1)
      const slug = slugify(anchor)
      if (!headingAnchors.has(slug)) {
        errors.push(`${rel}: missing anchor #${slug}`)
      }
      continue
    }
    // Relative path (may include #anchor)
    const [pathPart, hashPart] = raw.split('#', 2)
    const targetPath = resolve(dirname(mdPath), pathPart)
    let exists = false
    try {
      exists = statSync(targetPath).isFile()
    } catch {
      exists = false
    }
    if (!exists) {
      errors.push(`${rel}: missing file ${pathPart}`)
      continue
    }
    if (hashPart && hashPart.length > 0) {
      const anchors = await parseHeadings(targetPath)
      const slug = slugify(hashPart)
      if (!anchors.has(slug)) {
        const tRel = targetPath.startsWith(ROOT) ? targetPath.slice(ROOT.length + 1) : targetPath
        errors.push(`${rel}: ${pathPart} missing anchor #${slug} (in ${tRel})`)
      }
    }
  }
  return errors
}

async function main() {
  try {
    // Collect files
    const docs = statSync(DOCS_DIR).isDirectory() ? await collectDocs(DOCS_DIR) : []
    const targets = [...FILES, ...docs]
    let allErrors = []
    for (const f of targets) {
      try {
        const errs = await checkFile(f)
        allErrors = allErrors.concat(errs)
      } catch (e) {
        allErrors.push(`Failed to check ${f}: ${(e && e.message) || String(e)}`)
      }
    }
    if (allErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Docs link check found issues:')
      for (const line of allErrors) console.error(`- ${line}`)
      process.exitCode = 1
      return
    }
    // eslint-disable-next-line no-console
    console.log('Docs link check passed')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Docs link check failed: ${(err && err.message) || String(err)}`)
    process.exitCode = 1
  }
}

await main()
