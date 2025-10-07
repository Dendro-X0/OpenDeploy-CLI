import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface ProviderEnvState { readonly projectId?: string }
interface ProviderState { readonly prod?: ProviderEnvState; readonly preview?: ProviderEnvState }
interface RootState { readonly vercel?: ProviderState; readonly netlify?: ProviderState }

/**
 * Manages persisted state in .opendeploy/state.json
 */
export class StateStore {
  private readonly dir: string
  private readonly file: string
  public constructor(args: { readonly cwd: string }) {
    this.dir = join(args.cwd, '.opendeploy')
    this.file = join(this.dir, 'state.json')
  }
  public async read(): Promise<RootState> {
    try { const buf = await readFile(this.file, 'utf8'); return JSON.parse(buf) as RootState } catch { return {} }
  }
  public async write(state: RootState): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    const data: string = JSON.stringify(state, null, 2)
    await writeFile(this.file, `${data}\n`, 'utf8')
  }
}
