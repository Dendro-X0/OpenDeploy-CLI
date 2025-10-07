import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { ProviderWorkflow, PrepareInput, PrepareResult, EnvSyncInput, DeployInput, DeployResult } from '../../core/workflow'
import type { DetectionResult } from '../../types/detection-result'
import { goNetlifyDeployDir } from '../../utils/process-go'
import { envSync as envSyncCmd } from '../../commands/env'
import { fsx } from '../../utils/fs'
import { proc } from '../../utils/process'

function inferPublishDir(framework: DetectionResult['framework']): string {
  if (framework === 'nuxt') return '.output/public'
  if (framework === 'remix') return 'build/client'
  if (framework === 'astro') return 'dist'
  if (framework === 'sveltekit') return 'build'
  if (framework === 'next') return '.next'
  return 'dist'
}

async function readNetlifySiteId(cwd: string): Promise<string | undefined> {
  try {
    const raw = await readFile(join(cwd, '.netlify', 'state.json'), 'utf8')
    const js = JSON.parse(raw) as { siteId?: string }
    const v = typeof js?.siteId === 'string' ? js.siteId : undefined
    return v && v !== 'undefined' && v !== 'null' ? v : undefined
  } catch {
    return undefined
  }
}

export const workflow: ProviderWorkflow = {
  async prepare(input: PrepareInput): Promise<PrepareResult> {
    // Lightweight detection: prefer existing helpers by reading package.json fields
    let detection: DetectionResult
    try {
      const auto = await import('../../core/detectors/auto')
      detection = await auto.detectApp({ cwd: input.cwd }) as DetectionResult
    } catch {
      detection = {
        framework: 'astro',
        rootDir: input.cwd,
        appDir: input.cwd,
        hasAppRouter: false,
        packageManager: 'npm',
        monorepo: 'none',
        buildCommand: 'npm run build',
        outputDir: 'dist',
        publishDir: 'dist',
        renderMode: 'static',
        confidence: 0.5,
        environmentFiles: []
      }
    }
    const publishDir = detection.publishDir || inferPublishDir(detection.framework)
    const siteId = input.projectId || await readNetlifySiteId(input.cwd)
    return { detection, publishDir, siteId }
  },

  async envSync(input: EnvSyncInput): Promise<void> {
    await envSyncCmd({
      provider: 'netlify',
      cwd: input.cwd,
      file: input.file,
      env: input.envTarget,
      yes: input.yes,
      dryRun: input.dryRun,
      json: input.json,
      ci: input.ci,
      projectId: input.projectId,
      ignore: input.ignore,
      only: input.only,
      optimizeWrites: input.optimizeWrites,
      mapFile: input.mapFile
    })
  },

  async deploy(input: DeployInput): Promise<DeployResult> {
    const full = join(input.cwd, input.publishDir)
    const exists = await fsx.exists(full)
    if (!exists) return { ok: false }

    const site = input.projectId || await readNetlifySiteId(input.cwd)

    // Direct API path (preferred when flagged and token present)
    const wantDirect = process.env.OPD_NETLIFY_DIRECT === '1' && Boolean(process.env.NETLIFY_AUTH_TOKEN)
    if (wantDirect) {
      if (!site) return { ok: false }
      const res = await goNetlifyDeployDir({ src: full, site, prod: input.envTarget === 'prod', cwd: input.cwd })
      return { ok: res.ok, url: res.url, logsUrl: res.logsUrl }
    }

    // CLI path
    const siteFlag = site ? ` --site ${site}` : ''
    const prodFlag = input.envTarget === 'prod' ? ' --prod' : ''
    const cmd = `netlify deploy --no-build --dir ${JSON.stringify(full)}${siteFlag}${prodFlag}`
    const out = await proc.run({ cmd, cwd: input.cwd })
    if (!out.ok) return { ok: false }
    // Best-effort URL extraction
    let url: string | undefined
    const m = out.stdout.match(/https?:\/\/[^\s]+netlify\.app\S*/i)
    if (m && m[0]) url = m[0]
    let logsUrl: string | undefined
    const m2 = out.stdout.match(/https?:\/\/app\.netlify\.com\S*/i)
    if (m2 && m2[0]) logsUrl = m2[0]
    return { ok: true, url, logsUrl }
  }
}
