import { proc } from './process'

/** Open a URL using the platform-specific handler. */
export async function platformOpen(url: string): Promise<{ ok: boolean }>{
  const isWin: boolean = process.platform === 'win32'
  const isMac: boolean = process.platform === 'darwin'
  if (isWin) {
    // Prefer PowerShell for cross-shell reliability (Git Bash, PowerShell, CMD)
    const ps = await proc.run({ cmd: `powershell -NoProfile -Command Start-Process "${url}"` })
    if (ps.ok) return { ok: true }
    const cmd = await proc.run({ cmd: `cmd /c start "" "${url}"` })
    return { ok: cmd.ok }
  }
  const cmd: string = isMac ? `open "${url}"` : `xdg-open "${url}"`
  const res = await proc.run({ cmd })
  return { ok: res.ok }
}
