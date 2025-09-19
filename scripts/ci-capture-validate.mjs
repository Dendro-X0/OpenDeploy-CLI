import { spawnSync } from 'node:child_process'
import { readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import Ajv from 'ajv'

const root = process.cwd()
const artifacts = join(root, '.artifacts')
await mkdir(artifacts, { recursive: true })

function run(cmd, args, label) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false })
  const code = res.status ?? 1
  if (code !== 0) {
    console.error(`[ci:capture] ${label} failed with exit ${code}`)
    process.exit(1)
  }
}

// Capture real outputs using dry-run to avoid external auth/side effects
const vercelUpNd = join(artifacts, 'up-vercel.ndjson')
const netlifyUpNd = join(artifacts, 'up-netlify.ndjson')
const vercelPromoteNd = join(artifacts, 'promote-vercel.ndjson')
const netlifyPromoteNd = join(artifacts, 'promote-netlify.ndjson')
const vercelRollbackNd = join(artifacts, 'rollback-vercel.ndjson')
const netlifyRollbackNd = join(artifacts, 'rollback-netlify.ndjson')

// Deploy (dry-run)
// Note: Deploy capture is skipped in CI root (requires real app context)

// Up (dry-run)
run('node', ['dist/index.js', 'up', 'vercel', '--env', 'preview', '--dry-run', '--ndjson', '--ndjson-file', vercelUpNd], 'up vercel dry-run')
run('node', ['dist/index.js', 'up', 'netlify', '--env', 'prod', '--dry-run', '--ndjson', '--ndjson-file', netlifyUpNd], 'up netlify dry-run')

// Promote (dry-run)
run('node', ['dist/index.js', 'promote', 'vercel', '--alias', 'example.com', '--dry-run', '--json', '--ndjson', '--ndjson-file', vercelPromoteNd], 'promote vercel dry-run')
run('node', ['dist/index.js', 'promote', 'netlify', '--dry-run', '--json', '--ndjson', '--ndjson-file', netlifyPromoteNd], 'promote netlify dry-run')

// Rollback (dry-run)
run('node', ['dist/index.js', 'rollback', 'vercel', '--dry-run', '--json', '--ndjson', '--ndjson-file', vercelRollbackNd], 'rollback vercel dry-run')
run('node', ['dist/index.js', 'rollback', 'netlify', '--dry-run', '--json', '--ndjson', '--ndjson-file', netlifyRollbackNd], 'rollback netlify dry-run')

function lastJsonLine(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  const last = lines[lines.length - 1] ?? ''
  return JSON.parse(last)
}

const ajv = new Ajv({ allErrors: true, strict: false })

async function validateFile(path, schemaPath) {
  const [content, schemaText] = await Promise.all([
    readFile(path, 'utf8'),
    readFile(schemaPath, 'utf8')
  ])
  const data = lastJsonLine(content)
  const schema = JSON.parse(schemaText)
  const validate = ajv.compile(schema)
  const ok = validate(data)
  if (!ok) {
    console.error(`[ci:capture] Schema validation failed for ${path}`)
    console.error(validate.errors)
    process.exit(1)
  } else {
    console.log(`[ci:capture] OK: ${path} ✓`)
  }
}

await validateFile(vercelUpNd, join(root, 'schemas', 'up.schema.json'))
await validateFile(netlifyUpNd, join(root, 'schemas', 'up.schema.json'))
await validateFile(vercelPromoteNd, join(root, 'schemas', 'promote.schema.json'))
await validateFile(netlifyPromoteNd, join(root, 'schemas', 'promote.schema.json'))
await validateFile(vercelRollbackNd, join(root, 'schemas', 'rollback.schema.json'))
await validateFile(netlifyRollbackNd, join(root, 'schemas', 'rollback.schema.json'))

console.log('[ci:capture] All real-output schema validations passed')
