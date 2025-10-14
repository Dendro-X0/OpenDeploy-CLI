import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const withMDX = createMDX({
  extension: /\.(md|mdx)?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [["rehype-prism-plus", { ignoreMissing: true, showLineNumbers: true }]],
  },
});

const isDev = process.env.NODE_ENV !== 'production'
const deployTarget = (process.env.DEPLOY_TARGET || '').toLowerCase()
const repoName: string = (() => {
  const ghRepo: string = process.env.GITHUB_REPOSITORY ?? ''
  const fromGh: string = ghRepo.includes('/') ? ghRepo.split('/')[1] : ''
  const envName: string = process.env.DEPLOY_REPO ?? ''
  return (envName || fromGh || 'OpenDeploy-CLI')
})()
// Use repo subpath only when explicitly targeting GitHub
const basePath = deployTarget === 'github' ? `/${repoName}` : ''
// In development, serve the site at root to avoid 404 on '/'
const effectiveBasePath = isDev ? '' : basePath

// Resolve CLI version for site version display
const repoRoot = resolve(__dirname, "..", "..")
const cliPkgCandidates = [
  join(repoRoot, "packages", "cli", "package.json"),
  join(repoRoot, "package.json"),
]
let derivedVersion = process.env.NEXT_PUBLIC_OPD_VERSION || ""
if (!derivedVersion) {
  for (const p of cliPkgCandidates) {
    try {
      const pkg = JSON.parse(readFileSync(p, "utf8")) as { version?: string }
      if (pkg?.version) { derivedVersion = `v${pkg.version}`; break }
    } catch { /* ignore */ }
  }
}

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Expose basePath to client so components can prefix static assets reliably on GitHub Pages
  env: {
    ...(deployTarget === 'github' ? { NEXT_PUBLIC_BASE_PATH: `/${repoName}` } : { NEXT_PUBLIC_BASE_PATH: '' }),
    ...(derivedVersion ? { NEXT_PUBLIC_OPD_VERSION: derivedVersion } : {}),
  },
  // GitHub Pages vs Cloudflare Pages
  ...(deployTarget === 'github'
    ? {
        output: 'export' as const,
        images: { unoptimized: true },
        trailingSlash: true,
        basePath: `/${repoName}`,
        assetPrefix: `/${repoName}/`,
      }
    : {
        trailingSlash: false,
      }),
  webpack: (config, { isServer }) => {
    // During static export on GitHub Pages, some libraries may reference `self`.
    // Ensure `self` is defined on the server build to avoid "self is not defined".
    if (isServer && deployTarget === 'github') {
      config.plugins = config.plugins || []
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { DefinePlugin } = require('webpack')
      config.plugins.push(new DefinePlugin({ self: 'globalThis' }))
    }
    return config
  },
};

export default withMDX(nextConfig);
