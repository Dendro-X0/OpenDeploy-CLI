import { cp, mkdir, access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { constants as fsConstants } from 'node:fs'

const root = resolve(process.cwd())
// When running inside monorepo at apps/docs, go up two levels to reach packages/cli/docs
const monorepoCliDocs = resolve(root, '..', '..', 'packages', 'cli', 'docs')
// Legacy path fallback: when CLI docs lived at monorepo root before move
const legacyCliDocs = resolve(root, '..', '..', 'docs')
const envCliDocs = process.env.CLI_DOCS_DIR ? resolve(process.env.CLI_DOCS_DIR) : null
const outDir = join(root, 'src', 'content', 'opendeploy')

async function pathExists(p) {
  try { await access(p, fsConstants.F_OK); return true } catch { return false }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const files = ['overview.md', 'commands.md', 'recipes.md', 'troubleshooting.md', 'providers.md']
  // Resolve source directory preference: env > monorepo > legacy sibling
  const candidates = [envCliDocs, monorepoCliDocs, legacyCliDocs].filter(Boolean)
  let cliDocs = candidates[0]
  for (const c of candidates) { if (await pathExists(c)) { cliDocs = c; break } }
  if (!(await pathExists(cliDocs))) {
    console.log(`Skipping external docs sync. Source not found (tried): ${candidates.join(' | ')}`)
    return
  }
  console.log(`Syncing CLI docs from: ${cliDocs}`)
  for (const f of files) {
    const src = join(cliDocs, f)
    const dst = join(outDir, f)
    await mkdir(dirname(dst), { recursive: true })
    if (!(await pathExists(src))) {
      console.log(`Warn: source file missing, skipping: ${src}`)
      continue
    }
    await cp(src, dst)
    console.log(`Synced ${src} -> ${dst}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
