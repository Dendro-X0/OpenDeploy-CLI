import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.(md|mdx)?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [["rehype-prism-plus", { ignoreMissing: true, showLineNumbers: true }]],
  },
});

const isDev = process.env.NODE_ENV !== 'production'
const deployTarget = (process.env.DEPLOY_TARGET || '').toLowerCase()
const repoName = 'opendeploy-cli-docs-site'
// Use repo subpath only when explicitly targeting GitHub
const basePath = deployTarget === 'github' ? `/${repoName}` : ''
// In development, serve the site at root to avoid 404 on '/'
const effectiveBasePath = isDev ? '' : basePath

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Expose basePath to client so components can prefix static assets reliably on GitHub Pages
  env: {
    NEXT_PUBLIC_BASE_PATH: effectiveBasePath,
  },
  // Static export and GitHub-only behaviours
  ...(deployTarget === 'github' ? { output: 'export' as const } : {}),
  ...(deployTarget === 'github' ? { images: { unoptimized: true } } : {}),
  ...(deployTarget === 'github' ? { trailingSlash: true } : { trailingSlash: false }),
  // Base path (only applied when non-empty); for GitHub we also set assetPrefix
  ...(effectiveBasePath
    ? {
        basePath: effectiveBasePath,
        ...(deployTarget === 'github' ? { assetPrefix: `${effectiveBasePath}/` } : {}),
      }
    : {}),
};

export default withMDX(nextConfig);
