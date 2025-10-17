import * as vscode from 'vscode'
import { getSettings, Settings, togglePreferJson } from './config'
import { pickTargetPath } from './detect'
import { getOutput } from './output'
import { runOpenDeploy } from './run'
import { createStatusBar, setRunning, updateJsonToggle } from './status'
import { openSummaryPanel } from './summary'
import { openOnboarding, type OnboardingMessage } from './onboarding'
import { checkVercelAuth, checkCloudflareAuth } from './auth'
import { generateGhPagesWorkflow } from './generate'
import { openControlPanel, postPanelState, PanelMessage } from './panel'
import { setExtensionContext, setWs } from './storage'
import { openProviderDashboard } from './open'

/**
 * Entry point for the OpenDeploy VSCode extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  setExtensionContext(context)
  const output = getOutput()
  const status = createStatusBar()
  // Clicking the status bar opens the summary panel
  status.command = 'opendeploy.summary'
  // Initialize JSON toggle indicator
  updateJsonToggle(getSettings().preferJson)

  const register = (cmd: string, handler: (...args: unknown[]) => Promise<void>): void => {
    const d = vscode.commands.registerCommand(cmd, async (...args: unknown[]) => {
      try { await handler(...args) } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        output.appendLine(`[error] ${msg}`)
        void vscode.window.showErrorMessage(`OpenDeploy: ${msg}`)
      }
    })

  // Onboarding Wizard (in-panel webview)
  register('opendeploy.onboarding', async () => {
    const dispose = await openOnboarding(async (msg: OnboardingMessage) => {
      if (msg.type === 'toggle-json') {
        const next = await togglePreferJson(); updateJsonToggle(next); return
      }
      if (msg.type === 'select-app') { await setWs('opendeploy.lastApp', msg.cwd); return }
      if (msg.type === 'auth') {
        if (msg.provider === 'vercel') await checkVercelAuth(); else await checkCloudflareAuth(); return
      }
      if (msg.type === 'follow-logs') { await vscode.commands.executeCommand('opendeploy.followLogs', msg.provider); return }
      if (msg.type === 'open-dash') {
        if (msg.provider === 'cloudflare') await openProviderDashboard('cloudflare'); else await openProviderDashboard('vercel');
        return
      }
      if ((msg as any).type === 'doctor') {
        await vscode.commands.executeCommand('opendeploy.doctor', (msg as any).fix === true ? 'fix' : undefined)
        return
      }
      if ((msg as any).type === 'open-summary') { await openSummaryPanel(); return }
      if (msg.type === 'run') {
        const nowCfg: Settings = getSettings()
        const args: string[] = msg.action === 'deploy' ? ['start', '--deploy'] : ['start', '--dry-run']
        if (nowCfg.preferJson) args.push('--json')
        const output = getOutput(); output.show(true)
        updateJsonToggle(nowCfg.preferJson)
        output.appendLine('[OpenDeploy] JSON view: ' + (nowCfg.preferJson ? 'On' : 'Off'))
        output.appendLine(`> Running: ${nowCfg.runner} ${args.join(' ')} in ${msg.cwd}`)
        setRunning(true)
        const res = await runOpenDeploy({ args, settings: nowCfg, cwd: msg.cwd })
        setRunning(false)
        output.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
        if (res.logsUrl) {
          output.appendLine(`logs: ${res.logsUrl}`)
          void vscode.window.showInformationMessage('OpenDeploy: Open logs?', 'Open').then(choice => { if (choice === 'Open') void vscode.env.openExternal(vscode.Uri.parse(res.logsUrl!)) })
        }
        if (!res.ok && msg.action !== 'plan') void vscode.window.showErrorMessage('OpenDeploy: Action failed')
        return
      }
    })
    ;(context.subscriptions).push({ dispose })
  })

  // Vercel — Set Alias
  register('opendeploy.vercelSetAlias', async (initialDeployment?: unknown) => {
    const cfg: Settings = getSettings()
    const cwd: string = await pickTargetPath(cfg)
    const alias = await vscode.window.showInputBox({ prompt: 'Alias domain (e.g., mysite.com)', placeHolder: 'mysite.com', validateInput: (v) => (v && v.trim().length > 0) ? undefined : 'Alias is required' })
    if (!alias) return
    const deployment = await vscode.window.showInputBox({ prompt: 'Deployment URL or id to alias', placeHolder: 'https://your-deployment.vercel.app or deployment id', value: typeof initialDeployment === 'string' ? initialDeployment : undefined, validateInput: (v) => (v && v.trim().length > 0) ? undefined : 'Deployment is required' })
    if (!deployment) return
    const args: string[] = ['alias', 'vercel', '--set', alias.trim(), '--deployment', deployment.trim()]
    if (cfg.preferJson) args.push('--json')
    const out = getOutput(); out.show(true)
    updateJsonToggle(cfg.preferJson)
    out.appendLine('[OpenDeploy] JSON view: ' + (cfg.preferJson ? 'On' : 'Off'))
    out.appendLine(`> Running: ${cfg.runner} ${args.join(' ')} in ${cwd}`)
    setRunning(true)
    const res = await runOpenDeploy({ args, settings: cfg, cwd })
    setRunning(false)
    out.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
    if (!res.ok) void vscode.window.showErrorMessage('OpenDeploy: Failed to set alias')
    else void vscode.window.showInformationMessage(`OpenDeploy: Alias set to ${alias}`)
  })

  // Vercel — Rollback
  register('opendeploy.vercelRollback', async () => {
    const cfg: Settings = getSettings()
    const cwd: string = await pickTargetPath(cfg)
    const alias = await vscode.window.showInputBox({ prompt: 'Production alias/domain to repoint (Vercel)', placeHolder: 'mysite.com', validateInput: (v) => (v && v.trim().length > 0) ? undefined : 'Alias is required' })
    if (!alias) return
    const to = await vscode.window.showInputBox({ prompt: 'Optional: Deployment URL or sha to rollback to (leave empty to auto-select previous production)', placeHolder: 'https://your-deployment.vercel.app or <sha>', validateInput: () => undefined })
    const args: string[] = ['rollback', 'vercel', '--alias', alias.trim()]
    if (to && to.trim().length > 0) { args.push('--to', to.trim()) }
    if (cfg.preferJson) args.push('--json')
    const out = getOutput(); out.show(true)
    updateJsonToggle(cfg.preferJson)
    out.appendLine('[OpenDeploy] JSON view: ' + (cfg.preferJson ? 'On' : 'Off'))
    out.appendLine(`> Running: ${cfg.runner} ${args.join(' ')} in ${cwd}`)
    setRunning(true)
    const res = await runOpenDeploy({ args, settings: cfg, cwd })
    setRunning(false)
    out.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
    if (!res.ok) void vscode.window.showErrorMessage('OpenDeploy: Rollback failed')
    else void vscode.window.showInformationMessage('OpenDeploy: Rollback completed')
  })
    context.subscriptions.push(d)
  }

  // Open provider dashboards (registered via helper)
  register('opendeploy.openVercel', async () => { await openProviderDashboard('vercel') })
  register('opendeploy.openCloudflare', async () => { await openProviderDashboard('cloudflare') })
  register('opendeploy.openGithub', async () => { await openProviderDashboard('github') })
  // Follow Logs via Command Palette
  register('opendeploy.followLogs', async (providerArg?: unknown) => {
    const cfg: Settings = getSettings()
    const cwd: string = await pickTargetPath(cfg)
    let provider: 'vercel' | 'cloudflare'
    if (typeof providerArg === 'string' && (providerArg === 'vercel' || providerArg === 'cloudflare')) provider = providerArg
    else {
      const pick = await vscode.window.showQuickPick([
        { label: 'Vercel', id: 'vercel' },
        { label: 'Cloudflare Pages', id: 'cloudflare' }
      ], { title: 'Follow Logs — Select Provider' })
      provider = (pick?.id === 'cloudflare' ? 'cloudflare' : 'vercel')
    }
    const args: string[] = ['logs', provider, '--follow']
    const out = getOutput(); out.show(true)
    updateJsonToggle(cfg.preferJson)
    out.appendLine('[OpenDeploy] JSON view: ' + (cfg.preferJson ? 'On' : 'Off'))
    out.appendLine(`> Running: ${cfg.runner} ${args.join(' ')} in ${cwd}`)
    setRunning(true)
    const res = await runOpenDeploy({ args, settings: cfg, cwd })
    setRunning(false)
    out.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
    if (!res.ok) void vscode.window.showErrorMessage('OpenDeploy: Follow logs ended with errors')
  })

  register('opendeploy.plan', async () => {
    const cfg: Settings = getSettings()
    const cwd: string = await pickTargetPath(cfg)
    const args: string[] = ['start', '--dry-run']
    if (cfg.preferJson) args.push('--json')
    output.show(true)
    updateJsonToggle(cfg.preferJson)
    output.appendLine('[OpenDeploy] JSON view: ' + (cfg.preferJson ? 'On' : 'Off') + ' — use Command Palette: "OpenDeploy: Toggle JSON View" or the status bar toggle (JSON: On/Off).')
    output.appendLine(`> Running: ${cfg.runner} ${args.join(' ')} in ${cwd}`)
    setRunning(true)
    const res = await runOpenDeploy({ args, settings: cfg, cwd })
    setRunning(false)
    output.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
    if (res.logsUrl) {
      output.appendLine(`logs: ${res.logsUrl}`)
      void vscode.window.showInformationMessage('OpenDeploy: Open logs?', 'Open').then(choice => {
        if (choice === 'Open') void vscode.env.openExternal(vscode.Uri.parse(res.logsUrl!))
      })
    }
    if (!res.ok) void vscode.window.showErrorMessage('OpenDeploy plan failed')
  })

  register('opendeploy.deploy', async () => {
    const cfg: Settings = getSettings()
    const cwd: string = await pickTargetPath(cfg)
    const args: string[] = ['start', '--deploy']
    output.show(true)
    updateJsonToggle(cfg.preferJson)
    output.appendLine('[OpenDeploy] JSON view: ' + (cfg.preferJson ? 'On' : 'Off') + ' — use Command Palette: "OpenDeploy: Toggle JSON View" or the status bar toggle (JSON: On/Off).')
    output.appendLine(`> Running: ${cfg.runner} ${args.join(' ')} in ${cwd}`)
    setRunning(true)
    const res = await runOpenDeploy({ args, settings: cfg, cwd })
    setRunning(false)
    output.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
    if (res.logsUrl) {
      output.appendLine(`logs: ${res.logsUrl}`)
      void vscode.window.showInformationMessage('OpenDeploy: Open logs?', 'Open').then(choice => {
        if (choice === 'Open') void vscode.env.openExternal(vscode.Uri.parse(res.logsUrl!))
      })
    }
    if (!res.ok) void vscode.window.showErrorMessage('OpenDeploy deploy failed')
  })

  register('opendeploy.detect', async () => {
    const cfg: Settings = getSettings()
    const cwd: string = await pickTargetPath(cfg)
    const args: string[] = ['detect']
    output.show(true)
    updateJsonToggle(cfg.preferJson)
    output.appendLine('[OpenDeploy] JSON view: ' + (cfg.preferJson ? 'On' : 'Off') + ' — use Command Palette: "OpenDeploy: Toggle JSON View" or the status bar toggle (JSON: On/Off).')
    output.appendLine(`> Running: ${cfg.runner} ${args.join(' ')} in ${cwd}`)
    setRunning(true)
    const res = await runOpenDeploy({ args, settings: cfg, cwd })
    setRunning(false)
    output.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
    if (res.logsUrl) {
      output.appendLine(`logs: ${res.logsUrl}`)
      void vscode.window.showInformationMessage('OpenDeploy: Open logs?', 'Open').then(choice => {
        if (choice === 'Open') void vscode.env.openExternal(vscode.Uri.parse(res.logsUrl!))
      })
    }
    if (!res.ok) void vscode.window.showErrorMessage('OpenDeploy detect failed')
  })

  register('opendeploy.summary', async () => {
    await openSummaryPanel()
  })

  register('opendeploy.panel', async () => {
    const cfg: Settings = getSettings()
    const dispose = await openControlPanel(async (msg: PanelMessage) => {
      // simple messages first
      if (msg.type === 'toggle-json') { const next = await togglePreferJson(); updateJsonToggle(next); return }
      if (msg.type === 'open-url') { void vscode.env.openExternal(vscode.Uri.parse(msg.url)); return }
      if (msg.type === 'auth') { if (msg.provider === 'vercel') await checkVercelAuth(); else await checkCloudflareAuth(); return }
      if (msg.type === 'select-app') { await setWs('opendeploy.lastApp', msg.cwd); return }
      if (msg.type === 'open-summary') { await openSummaryPanel(); return }
      if (msg.type === 'generate-gh') {
        await generateGhPagesWorkflow({ appPathFs: msg.cwd, template: msg.template ?? 'reusable' });
        void vscode.window.showInformationMessage('OpenDeploy: Generated GitHub Pages workflow (deploy-gh-pages.yml)');
        return
      }
      if (msg.type === 'run') {
        const nowCfg: Settings = getSettings()
        let args: string[]
        if (msg.action === 'deploy') args = ['start', '--deploy']
        else if (msg.action === 'plan') args = ['start', '--dry-run']
        else if (msg.action === 'doctor') args = ['doctor']
        else if (msg.action === 'logs') {
          // Ask for provider (default Vercel)
          const pick = await vscode.window.showQuickPick([
            { label: 'Vercel', id: 'vercel' },
            { label: 'Cloudflare Pages', id: 'cloudflare' }
          ], { title: 'Follow Logs — Select Provider' })
          const provider = (pick?.id === 'cloudflare' ? 'cloudflare' : 'vercel')
          args = ['logs', provider, '--follow']
        } else args = ['detect']
        // Only non-logs actions add --json (we stream NDJSON for logs)
        if (msg.action !== 'logs' && nowCfg.preferJson && !args.includes('--json')) args.push('--json')
        const output = getOutput(); output.show(true)
        updateJsonToggle(nowCfg.preferJson)
        output.appendLine('[OpenDeploy] JSON view: ' + (nowCfg.preferJson ? 'On' : 'Off'))
        output.appendLine(`> Running: ${nowCfg.runner} ${args.join(' ')} in ${msg.cwd}`)
        const hints: string[] = []
        setRunning(true)
        const res = await runOpenDeploy({ args, settings: nowCfg, cwd: msg.cwd, onJson: (obj: any) => {
          if (obj && Array.isArray(obj.hints)) {
            for (const h of obj.hints) {
              const text = typeof h === 'string' ? h : (h?.message ?? '')
              if (text && hints.length < 5) hints.push(text)
            }
          }
        }, onAuthRequired: (provider) => {
          postPanelState({ kind: 'hints', hints: [`${provider === 'vercel' ? 'Vercel' : 'Cloudflare'} login required`] })
        } })
        setRunning(false)
        output.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
        if (res.logsUrl) {
          output.appendLine(`logs: ${res.logsUrl}`)
          void vscode.window.showInformationMessage('OpenDeploy: Open logs?', 'Open').then(choice => {
            if (choice === 'Open') void vscode.env.openExternal(vscode.Uri.parse(res.logsUrl!))
          })
        }
        if (hints.length) postPanelState({ kind: 'hints', hints })
        postPanelState({ kind: 'result', ok: res.ok, logsUrl: res.logsUrl })
        if (!res.ok && msg.action !== 'plan') void vscode.window.showErrorMessage(`OpenDeploy ${msg.action} failed`)
        return
      }
    })
    context.subscriptions.push({ dispose })
  })

  register('opendeploy.toggleJson', async () => {
    const next = await togglePreferJson()
    updateJsonToggle(next)
    void vscode.window.showInformationMessage(`OpenDeploy: JSON view ${next ? 'enabled' : 'disabled'}`)
  })

  register('opendeploy.checkVercelAuth', async () => {
    await checkVercelAuth()
  })
  register('opendeploy.checkCloudflareAuth', async () => {
    await checkCloudflareAuth()
  })

  register('opendeploy.generateGhPagesWorkflow', async () => {
    const cfg: Settings = getSettings()
    const cwd: string = await pickTargetPath(cfg)
    await generateGhPagesWorkflow({ appPathFs: cwd })
    void vscode.window.showInformationMessage('OpenDeploy: Generated GitHub Pages workflow (deploy-gh-pages.yml)')
  })

  register('opendeploy.doctor', async (fixArg?: unknown) => {
    const cfg: Settings = getSettings()
    const cwd: string = await pickTargetPath(cfg)
    const args: string[] = ['doctor']
    const wantFix: boolean = Boolean(fixArg === true || fixArg === 'fix')
    if (wantFix) args.push('--fix')
    if (cfg.preferJson) args.push('--json')
    const output = getOutput()
    output.show(true)
    updateJsonToggle(cfg.preferJson)
    output.appendLine('[OpenDeploy] JSON view: ' + (cfg.preferJson ? 'On' : 'Off'))
    output.appendLine(`> Running: ${cfg.runner} ${args.join(' ')} in ${cwd}`)
    setRunning(true)
    const res = await runOpenDeploy({ args, settings: cfg, cwd })
    setRunning(false)
    output.appendLine(`[result] ${res.ok ? 'success' : 'failed'}`)
    if (res.logsUrl) {
      output.appendLine(`logs: ${res.logsUrl}`)
      void vscode.window.showInformationMessage('OpenDeploy: Open logs?', 'Open').then(choice => {
        if (choice === 'Open') void vscode.env.openExternal(vscode.Uri.parse(res.logsUrl!))
      })
    }
    if (!res.ok) void vscode.window.showErrorMessage('OpenDeploy doctor found issues')
  })
}

export function deactivate(): void { /* no-op */ }
