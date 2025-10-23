import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

interface ProviderEnvState { readonly projectId?: string }
interface ProviderState { readonly prod?: ProviderEnvState; readonly preview?: ProviderEnvState }
interface RootState { readonly vercel?: ProviderState; readonly cloudflare?: ProviderState; readonly github?: ProviderState }

function getConfigDir(): string {
  const override: string | undefined = process.env.OPD_CONFIG_DIR
  if (override && override.length > 0) return override
  const plat: NodeJS.Platform = process.platform
  if (plat === 'win32') {
    const base: string = process.env.LOCALAPPDATA || process.env.APPDATA || join(homedir(), 'AppData', 'Local')
    return join(base, 'OpenDeploy', 'Config')
  }
  if (plat === 'darwin') return join(homedir(), 'Library', 'Application Support', 'OpenDeploy')
  const xdg: string | undefined = process.env.XDG_CONFIG_HOME
  return join(xdg || join(homedir(), '.config'), 'opendeploy')
}

/**
 * Manages persisted state in OS config dir (legacy read from .opendeploy/state.json).
 */
export class StateStore {
  private readonly dir: string
  private readonly file: string
  private readonly legacyFile: string
  public constructor(args: { readonly cwd: string }) {
    const forceProject: boolean = process.env.OPD_STATE_IN_PROJECT === '1'
    if (forceProject) {
      this.dir = join(args.cwd, '.opendeploy')
      this.file = join(this.dir, 'state.json')
      this.legacyFile = this.file
    } else {
      this.dir = getConfigDir()
      this.file = join(this.dir, 'state.json')
      this.legacyFile = join(args.cwd, '.opendeploy', 'state.json')
    }
  }
  public async read(): Promise<RootState> {
    try { const buf = await readFile(this.file, 'utf8'); return JSON.parse(buf) as RootState } catch {
      try { const legacy = await readFile(this.legacyFile, 'utf8'); return JSON.parse(legacy) as RootState } catch { return {} }
    }
  }
  public async write(state: RootState): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    const data: string = JSON.stringify(state, null, 2)
    await writeFile(this.file, `${data}\n`, 'utf8')
  }
}
