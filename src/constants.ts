import type { ProviderName } from './types/provider-name'

export const constants = {
  STATE_DIR: '.opendeploy',
  STATE_FILE: 'state.json',
  DEFAULT_PROVIDER: 'vercel' as ProviderName,
  TELEMETRY_ENABLED: false as const
} as const
