import * as child from 'node:child_process'
import * as vscode from 'vscode'

async function run(cmd: string, args: readonly string[]): Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null }>{
  return await new Promise((resolve) => {
    const p = child.spawn(cmd, args, { shell: true })
    let out = ''
    let err = ''
    p.stdout.on('data', (d: Buffer) => { out += d.toString() })
    p.stderr.on('data', (d: Buffer) => { err += d.toString() })
    p.on('close', (code: number | null) => resolve({ ok: code === 0, stdout: out.trim(), stderr: err.trim(), code }))
  })
}

export async function checkVercelAuth(): Promise<void> {
  const res = await run('vercel', ['whoami'])
  if (res.ok && res.stdout) {
    void vscode.window.showInformationMessage(`Vercel: signed in as ${res.stdout}`)
    return
  }
  const choice = await vscode.window.showInformationMessage('Vercel: not logged in', 'Open Login')
  if (choice === 'Open Login') {
    const term = vscode.window.createTerminal({ name: 'Vercel Login' })
    term.show(true)
    term.sendText('vercel login')
  }
}

export async function checkCloudflareAuth(): Promise<void> {
  const res = await run('wrangler', ['whoami'])
  if (res.ok && /You are logged in|account/i.test(res.stdout + res.stderr)) {
    const line = res.stdout.split(/\r?\n/).find(Boolean) ?? 'Cloudflare: logged in'
    void vscode.window.showInformationMessage(line)
    return
  }
  const choice = await vscode.window.showInformationMessage('Cloudflare: not logged in', 'Open Login')
  if (choice === 'Open Login') {
    const term = vscode.window.createTerminal({ name: 'Cloudflare Login' })
    term.show(true)
    term.sendText('wrangler login')
  }
}
