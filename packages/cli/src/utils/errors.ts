export interface ErrorInfo {
  readonly code: string
  readonly message: string
  readonly remedy?: string
}

function normalize(s: string): string {
  return (s || '').toLowerCase()
}

export function mapProviderError(provider: 'vercel' | 'netlify' | string, raw: string): ErrorInfo {
  const txt = normalize(raw)
  // Auth issues
  if (txt.includes('not logged in') || txt.includes('please run: vercel login') || txt.includes('run: netlify login')) {
    const cli = provider === 'netlify' ? 'netlify' : 'vercel'
    return {
      code: `${provider.toUpperCase()}_AUTH_REQUIRED`,
      message: 'You are not logged in to the provider CLI.',
      remedy: `Run: ${cli} login`
    }
  }
  // Vercel: auth expired / unauthorized
  if (provider === 'vercel' && (txt.includes('unauthorized') || txt.includes('token expired') || txt.includes('401') || txt.includes('please run `vercel login`') || txt.includes('please run: vercel login'))) {
    return {
      code: 'VERCEL_AUTH_EXPIRED',
      message: 'Vercel authentication expired or unauthorized.',
      remedy: 'Run: vercel login (or set VERCEL_TOKEN in CI)'
    }
  }
  // Link issues
  if (txt.includes('not linked') || txt.includes("don't appear to be in a folder that is linked") || txt.includes('project not linked')) {
    const cli = provider === 'netlify' ? 'netlify link --id <siteId>' : 'vercel link'
    return {
      code: `${provider.toUpperCase()}_NOT_LINKED`,
      message: 'The current directory is not linked to a provider project.',
      remedy: `Run: ${cli} (or pass --project/--org in CI)`
    }
  }
  // Vercel: invalid project/org/team
  if (provider === 'vercel' && (txt.includes('invalid project id') || txt.includes('project not found') || txt.includes('team not found') || txt.includes('org not found') || txt.includes('scope not found'))) {
    return {
      code: 'VERCEL_INVALID_PROJECT_OR_TEAM',
      message: 'Invalid or unknown Vercel project/org/team.',
      remedy: 'Verify VERCEL_PROJECT_ID / VERCEL_ORG_ID (or pass --project/--org) or run: vercel link'
    }
  }
  // Netlify: runtime/plugin missing manifest
  if (provider === 'netlify' && (txt.includes('the plugin "@netlify/next" is missing a "manifest.yml"') || txt.includes('missing a "manifest.yml"'))) {
    return {
      code: 'NETLIFY_RUNTIME_MISSING',
      message: 'Netlify Next Runtime not found (manifest.yml missing).',
      remedy: 'Install @netlify/next or switch to @netlify/plugin-nextjs. OpenDeploy auto-falls back when the runtime is absent.'
    }
  }
  // Netlify: account/site id issues on env ops
  if (provider === 'netlify' && txt.includes('missing required path variable') && txt.includes('account_id')) {
    return {
      code: 'NETLIFY_ACCOUNT_ID_MISSING',
      message: 'Netlify CLI could not resolve account/site for env operations.',
      remedy: 'Pass --project-id <siteId> (maps to --site) or link the directory: netlify link --id <siteId>.'
    }
  }
  // Netlify: site not found / not linked
  if (provider === 'netlify' && (txt.includes('site not found') || txt.includes('no site id') || txt.includes('not linked'))) {
    return {
      code: 'NETLIFY_SITE_NOT_FOUND',
      message: 'Netlify site could not be resolved for this directory.',
      remedy: 'Run: netlify link --id <siteId> or pass --project-id <siteId>.'
    }
  }
  // Netlify: build.command failed
  if (provider === 'netlify' && (txt.includes('"build.command" failed') || txt.includes('build.command failed'))) {
    return {
      code: 'NETLIFY_BUILD_COMMAND_FAILED',
      message: 'Netlify build.command failed.',
      remedy: 'Use a minimal build.command (e.g., "next build"). Avoid DB migrations during build. OpenDeploy generates a safe netlify.toml.'
    }
  }
  // Netlify: function crashed page
  if (provider === 'netlify' && txt.includes('this function has crashed')) {
    return {
      code: 'NETLIFY_FUNCTION_CRASH',
      message: 'A Netlify serverless/edge function crashed at runtime.',
      remedy: 'Open the function logs in the dashboard. Verify runtime env like AUTH/NEXTAUTH and EMAIL/SMTP/RESEND settings.'
    }
  }
  // Netlify: rate limits
  if (provider === 'netlify' && (txt.includes('rate limit') || txt.includes('too many requests') || txt.includes('status code 429'))) {
    return {
      code: 'NETLIFY_RATE_LIMIT',
      message: 'Netlify API rate limit encountered.',
      remedy: 'Retry with backoff. Reduce polling frequency or use CI artifacts instead of frequent API calls.'
    }
  }
  // Netlify: missing auth token / unauthorized
  if (provider === 'netlify' && (txt.includes('netlify_auth_token') || txt.includes('netlify auth token') || txt.includes('no access token') || txt.includes('unauthorized') || txt.includes('401'))) {
    return {
      code: 'NETLIFY_AUTH_TOKEN_MISSING',
      message: 'Netlify authentication token is missing or invalid.',
      remedy: 'Set NETLIFY_AUTH_TOKEN in your environment or run: netlify login'
    }
  }
  // Netlify: plugin not found
  if (provider === 'netlify' && (txt.includes('cannot find module') && txt.includes('@netlify/plugin-nextjs') || txt.includes('could not resolve "@netlify/plugin-nextjs"'))) {
    return {
      code: 'NETLIFY_PLUGIN_NOT_FOUND',
      message: 'Netlify Next plugin could not be resolved by the build.',
      remedy: 'Ensure the plugin package name is correct in netlify.toml. Netlify installs core plugins automatically in their build environment.'
    }
  }
  // Netlify: invalid site id
  if (provider === 'netlify' && (txt.includes('invalid site id') || txt.includes('site_id is invalid'))) {
    return {
      code: 'NETLIFY_INVALID_SITE_ID',
      message: 'The provided Netlify site ID is invalid.',
      remedy: 'Verify the site ID and pass it via --project-id or link with: netlify link --id <siteId>'
    }
  }
  // Next.js common build/i18n issues
  if (txt.includes('i18n configuration') && txt.includes('app router')) {
    return {
      code: 'NEXT_I18N_UNSUPPORTED_IN_APP_ROUTER',
      message: 'Next.js i18n in next.config.* is unsupported in App Router.',
      remedy: 'Use App Router i18n via route segments. See: https://nextjs.org/docs/app/building-your-applications/routing/internationalization'
    }
  }
  // Vercel/Next.js build failed (generic)
  if (provider === 'vercel' && (txt.includes('build failed') || txt.includes('failed to compile') || txt.includes('command "vercel build"') || txt.includes('error during build'))) {
    return {
      code: 'VERCEL_BUILD_FAILED',
      message: 'Vercel build failed.',
      remedy: 'Open deploy logs; run `next build` locally; check required env with `opendeploy env diff` and `opendeploy env validate`.'
    }
  }
  // Lint/Types failures
  if (txt.includes('eslint') || txt.includes('type error') || txt.includes('typescript error')) {
    return {
      code: 'NEXT_LINT_OR_TYPES_FAILED',
      message: 'Build failed due to ESLint or TypeScript errors.',
      remedy: 'Fix reported lint/type errors; consider disabling lint in prod builds if necessary.'
    }
  }
  // Missing environment variable symptoms
  if (txt.includes('missing environment') || txt.includes('not defined in process.env') || txt.includes('undefined environment variable') || txt.includes('env var') && txt.includes('missing')) {
    return {
      code: 'ENV_MISSING',
      message: 'A required environment variable appears to be missing.',
      remedy: 'Use `opendeploy env diff` to compare local vs provider; then `opendeploy env sync` to apply.'
    }
  }
  if (txt.includes('module_not_found') || txt.includes('cannot find module')) {
    return {
      code: 'NODE_MODULE_NOT_FOUND',
      message: 'A required package/module could not be resolved during build.',
      remedy: 'Reinstall dependencies and ensure Node version compatibility (e.g., pnpm install; use Node 18/20).'
    }
  }
  if (txt.includes('permission denied') || txt.includes('access denied')) {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Permission denied during an operation.',
      remedy: 'Check file permissions and provider access rights.'
    }
  }
  if (txt.includes('network') || txt.includes('etimedout') || txt.includes('econnreset')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'A network error occurred during the operation.',
      remedy: 'Retry the command. If it persists, check connectivity or provider status.'
    }
  }
  // Generic fallback
  return {
    code: `${provider.toUpperCase()}_UNKNOWN_ERROR`,
    message: raw.trim() || 'Unknown provider error.',
  }
}
