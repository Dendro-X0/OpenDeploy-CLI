export interface ErrorInfo {
  readonly code: string
  readonly message: string
  readonly remedy?: string
}

function normalize(s: string): string {
  return (s || '').toLowerCase()
}

export function mapProviderError(provider: 'vercel' | string, raw: string): ErrorInfo {
  const txt = normalize(raw)
  // Auth issues
  if (txt.includes('not logged in') || txt.includes('please run: vercel login')) {
    const cli = 'vercel'
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
    const cli = 'vercel link'
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
  // Netlify-specific mappings removed (provider unsupported).
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
