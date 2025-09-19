import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import Ajv from 'ajv'

const root = process.cwd()
const schemasDir = join(root, 'schemas')
const examplesDir = join(schemasDir, 'examples')

const plans = [
  {
    schema: 'start.schema.json',
    examples: [
      { file: 'start.netlify.json', require: ['provider', 'action', 'target', 'mode', 'final'] },
      { file: 'start.vercel.json', require: ['provider', 'action', 'target', 'mode', 'final'] }
    ]
  },
  {
    schema: 'up.schema.json',
    examples: [
      { file: 'up.vercel.json', require: ['provider', 'target', 'final'] },
      { file: 'up.netlify.json', require: ['provider', 'target', 'final'] }
    ]
  },
  {
    schema: 'deploy.schema.json',
    examples: [
      { file: 'deploy.vercel.json', require: ['provider', 'target', 'final', 'aliasUrl'] },
      { file: 'deploy.netlify.json', require: ['provider', 'target', 'final', 'logsUrl'] }
    ]
  },
  {
    schema: 'promote.schema.json',
    examples: [
      { file: 'promote.vercel.json', require: ['provider', 'action', 'target', 'final', 'alias'], forbid: ['logsUrl'] },
      { file: 'promote.netlify.json', require: ['provider', 'action', 'target', 'final', 'logsUrl'], forbid: ['alias'] }
    ]
  },
  {
    schema: 'rollback.schema.json',
    examples: [
      { file: 'rollback.vercel.success.json', require: ['provider', 'action', 'target', 'final', 'to', 'url', 'alias'] },
      { file: 'rollback.vercel.candidate.json', require: ['provider', 'action', 'target', 'final', 'candidate', 'needsAlias'], forbid: ['alias'] },
      { file: 'rollback.netlify.failure.json', require: ['provider', 'action', 'target', 'final', 'message', 'dashboard'] }
    ]
  }
]

const ajv = new Ajv({ allErrors: true, strict: false })

function fail(msg) {
  console.error(`[ci:schemas] ${msg}`)
  process.exit(1)
}

try {
  for (const plan of plans) {
    const schemaPath = join(schemasDir, plan.schema)
    const schemaJson = JSON.parse(await readFile(schemaPath, 'utf8'))
    const validate = ajv.compile(schemaJson)
    for (const ex of plan.examples) {
      const exPath = join(examplesDir, typeof ex === 'string' ? ex : ex.file)
      const data = JSON.parse(await readFile(exPath, 'utf8'))
      const ok = validate(data)
      if (!ok) {
        console.error(`[ci:schemas] Validation failed for ${typeof ex === 'string' ? ex : ex.file} against ${plan.schema}`)
        console.error(validate.errors)
        process.exit(1)
      } else {
        // Field presence/absence assertions
        if (typeof ex !== 'string') {
          if (Array.isArray(ex.require)) {
            for (const k of ex.require) {
              if (!(k in data)) {
                console.error(`[ci:schemas] Missing required field ${k} in ${exPath}`)
                process.exit(1)
              }
            }
          }
          if (Array.isArray(ex.forbid)) {
            for (const k of ex.forbid) {
              if (k in data) {
                console.error(`[ci:schemas] Forbidden field ${k} present in ${exPath}`)
                process.exit(1)
              }
            }
          }
        }
        console.log(`[ci:schemas] OK: ${typeof ex === 'string' ? ex : ex.file} ✓`)
      }
    }
  }
  console.log('[ci:schemas] All schema validations passed')
} catch (err) {
  fail(String(err))
}
