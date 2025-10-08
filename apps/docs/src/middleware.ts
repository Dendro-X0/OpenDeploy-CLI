import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Middleware to normalize any stale GitHub Pages subpath links when running on Cloudflare Pages.
 * If a request path starts with "/opendeploy-cli-docs-site", rewrite it to root so
 * CSS and page routes resolve correctly: e.g. "/opendeploy-cli-docs-site/_next/*" -> "/_next/*".
 */
export function middleware(req: NextRequest): NextResponse {
  const url: URL = new URL(req.url)
  const prefix = '/opendeploy-cli-docs-site'
  if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
    const normalized: string = url.pathname.substring(prefix.length) || '/'
    url.pathname = normalized
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/opendeploy-cli-docs-site/:path*'],
}
