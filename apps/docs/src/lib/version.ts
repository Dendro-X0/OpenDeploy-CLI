/**
 * Centralized site version info.
 * Reads from NEXT_PUBLIC_OPD_VERSION to allow CI/workflows to inject the release tag.
 * Falls back to v1.1.1 when the env var is absent.
 */
export interface VersionInfo {
  readonly version: string
  readonly isBeta: boolean
}

const raw: string = (process.env.NEXT_PUBLIC_OPD_VERSION || 'v1.1.1').trim()
const isBeta: boolean = /beta|alpha/i.test(raw)
const VERSION: VersionInfo = { version: raw, isBeta }

export default VERSION
