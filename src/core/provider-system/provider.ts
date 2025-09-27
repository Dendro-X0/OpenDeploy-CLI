import type { Provider } from './provider-interface'

/**
 * Simple dynamic loader for providers. In future we can support a registry file,
 * user-installed packages, and workspace-local providers.
 */
export async function loadProvider(id: string): Promise<Provider> {
  const normalized = id.toLowerCase()
  // Virtual mode: force provider to 'virtual' for hermetic tests
  if ((process.env.OPD_PROVIDER_MODE ?? '').toLowerCase() === 'virtual') {
    const mod = await import('./providers/virtual')
    return new mod.VirtualProvider(normalized)
  }
  // Built-in providers
  if (normalized === 'vercel') {
    const mod = await import('./providers/vercel')
    return new mod.VercelProvider()
  }
  if (normalized === 'netlify') {
    const mod = await import('./providers/netlify')
    return new mod.NetlifyProvider()
  }
  if (normalized === 'cloudflare' || normalized === 'cloudflare-pages') {
    const mod = await import('./providers/cloudflare-pages')
    return new mod.CloudflarePagesProvider()
  }
  if (normalized === 'github' || normalized === 'github-pages') {
    const mod = await import('./providers/github-pages')
    return new mod.GithubPagesProvider()
  }
  // Future: dynamic import from @opendeploy/provider-<id>
  try {
    const mod = await import(`@opendeploy/provider-${normalized}`)
    return mod.default as Provider
  } catch {
    throw new Error(`Unknown provider: ${id}`)
  }
}
