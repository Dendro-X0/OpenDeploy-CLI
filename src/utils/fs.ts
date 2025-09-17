import { readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

interface FSX {
  readonly exists: (path: string) => Promise<boolean>
  readonly readJson: <T>(path: string) => Promise<T | null>
  readonly writeJson: (path: string, data: unknown) => Promise<void>
}

async function exists(path: string): Promise<boolean> {
  try { const s = await stat(path); return s.isFile() || s.isDirectory() } catch { return false }
}

async function readJson<T>(path: string): Promise<T | null> {
  try { const buf = await readFile(path, 'utf8'); return JSON.parse(buf) as T } catch { return null }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true })
  } catch { /* ignore */ }
  const s = JSON.stringify(data, null, 2)
  await writeFile(path, s + "\n", 'utf8')
}

export const fsx: FSX = { exists, readJson, writeJson }
