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
    try {
      const mod = await import('./providers/vercel-vnext-adapter')
      return new mod.VercelVNextAdapter()
    } catch {
      const legacy = await import('./providers/vercel')
      return new legacy.VercelProvider()
    }
  }
  if (normalized === 'cloudflare' || normalized === 'cloudflare-pages') {
    try {
      const mod = await import('./providers/cloudflare-pages-vnext-adapter')
      return new mod.CloudflarePagesVNextAdapter()
    } catch {
      const legacy = await import('./providers/cloudflare-pages')
      return new legacy.CloudflarePagesProvider()
    }
  }
  if (normalized === 'github' || normalized === 'github-pages') {
    // Use the vNext adapter that wraps @opendeploy/provider-github-pages
    try {
      const mod = await import('./providers/github-pages-vnext-adapter')
      return new mod.GithubPagesVNextAdapter()
    } catch {
      // Fallback to legacy internal provider
      const legacy = await import('./providers/github-pages')
      return new legacy.GithubPagesProvider()
    }
  }
  // Future: dynamic import from @opendeploy/provider-<id>
  try {
    const mod = await import(`@opendeploy/provider-${normalized}`)
    return mod.default as Provider
  } catch {
    throw new Error(`Unknown provider: ${id}`)
  }
}
