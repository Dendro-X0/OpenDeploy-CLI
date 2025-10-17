import * as child from 'node:child_process'
import * as vscode from 'vscode'
import { Settings } from './config'
import { getOutput, printJsonSummary } from './output'
import { postSummary } from './summary'

export interface RunArgs {
  readonly args: readonly string[]
  readonly settings: Settings
  readonly cwd: string
  readonly onJson?: (obj: unknown) => void
  readonly onAuthRequired?: (provider: 'vercel' | 'cloudflare') => void
}

export interface RunnerResult {
  readonly ok: boolean
  readonly logsUrl?: string
}

export async function runOpenDeploy(opts: RunArgs): Promise<RunnerResult> {
  const output = getOutput()
  const cmd: string = buildCommand(opts)
  output.appendLine(`$ ${cmd}`)
  return await new Promise<RunnerResult>((resolve) => {
    const childProc = child.spawn(cmd, {
      cwd: opts.cwd,
      shell: true,
      env: {
        ...process.env,
        // Enable NDJSON streaming when JSON view is preferred
        OPD_NDJSON: opts.settings.preferJson ? '1' : undefined
      }
    })
    let buf = ''
    let logsUrl: string | undefined
    const urlCandidates: Set<string> = new Set()
    let sawLoginHint: 'vercel' | 'cloudflare' | undefined
    const onChunk = (s: string): void => {
      output.append(s)
      buf += s
      let idx: number
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        // JSON summary line
        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const obj = JSON.parse(line) as { logsUrl?: string; final?: boolean; provider?: string; phase?: string; ok?: boolean; app?: string; project?: string; message?: string; error?: string; action?: string; results?: Array<{ name?: string; ok?: boolean; message?: string }>; suggestions?: string[] }
            if (obj.logsUrl) urlCandidates.add(obj.logsUrl)
            printJsonSummary(obj)
            if (opts.onJson) opts.onJson(obj)
            // Send compact summary to the webview
            const checks = Array.isArray((obj as any).results) ? (obj as any).results : undefined
            const suggestions = Array.isArray((obj as any).suggestions) ? (obj as any).suggestions : undefined
            postSummary({
              ok: obj.ok !== false,
              provider: obj.provider,
              phase: obj.phase,
              app: obj.app ?? obj.project,
              url: (obj as any).url,
              logsUrl: obj.logsUrl,
              message: obj.message ?? obj.error,
              action: (obj as any).action,
              checks,
              suggestions
            })
          } catch { /* ignore */ }
        }
        // Detect login hints
        const lower = line.toLowerCase()
        const before = sawLoginHint
        if (lower.includes('vercel login')) sawLoginHint = 'vercel'
        if (lower.includes('wrangler login') || lower.includes('cloudflare login')) sawLoginHint = 'cloudflare'
        if (lower.includes('vercel login required')) sawLoginHint = 'vercel'
        if (lower.includes('cloudflare login required')) sawLoginHint = 'cloudflare'
        if (sawLoginHint && sawLoginHint !== before && opts.onAuthRequired) opts.onAuthRequired(sawLoginHint)
        // Capture logs url if printed as plain text
        const m = /https?:\/\/\S+/.exec(line)
        if (m && /vercel\.com|cloudflare|github\.com\/.*\/actions|pages\.dev|wrangler/.test(m[0])) urlCandidates.add(m[0])
      }
    }
    childProc.stdout.on('data', (d: Buffer) => onChunk(d.toString()))
    childProc.stderr.on('data', (d: Buffer) => onChunk(d.toString()))
    childProc.on('close', async (code: number | null) => {
      // Choose the best logs URL, prefer provider dashboards over CI
      logsUrl = chooseBestLogUrl(Array.from(urlCandidates))
      if (sawLoginHint) {
        if (opts.onAuthRequired) opts.onAuthRequired(sawLoginHint)
        const title = sawLoginHint === 'vercel' ? 'Vercel login required' : 'Cloudflare login required'
        const cmd = sawLoginHint === 'vercel' ? 'vercel login' : 'wrangler login'
        const choice = await vscode.window.showInformationMessage(`OpenDeploy: ${title}`, 'Open Login')
        if (choice === 'Open Login') {
          const term = vscode.window.createTerminal({ name: 'OpenDeploy Auth' })
          term.show(true)
          term.sendText(cmd)
        }
      }
      resolve({ ok: code === 0, logsUrl })
    })
  })
}

function chooseBestLogUrl(urls: readonly string[]): string | undefined {
  if (!urls.length) return undefined
  const score = (u: string): number => {
    const s = u.toLowerCase()
    if (s.includes('vercel.com') && s.includes('/deployments')) return 100
    if (s.includes('vercel.com') && s.includes('/inspections')) return 95
    if (s.includes('vercel.com')) return 90
    if (s.includes('cloudflare') && (s.includes('pages') || s.includes('workers'))) return 80
    if (s.includes('pages.dev')) return 70
    if (s.includes('github.com') && s.includes('/actions')) return 60
    return 10
  }
  return [...urls].sort((a, b) => score(b) - score(a))[0]
}

function buildCommand(opts: RunArgs): string {
  const { settings, args, cwd } = opts
  if (settings.runner === 'docker') {
    const img: string = settings.dockerImage
    const vol: string = `"${cwd}":/work`
    const joined: string = args.map(a => shellQuote(a)).join(' ')
    return `docker run --rm -it -v ${vol} -w /work ${img} ${joined}`
  }
  // npm runner (npx opendeploy@latest by default)
  const joined: string = args.map(a => shellQuote(a)).join(' ')
  return `${settings.npmBinary} ${joined}`
}

function shellQuote(s: string): string {
  if (/^[A-Za-z0-9_@.:/=-]+$/.test(s)) return s
  return `"${s.replace(/"/g, '\\"')}"`
}
