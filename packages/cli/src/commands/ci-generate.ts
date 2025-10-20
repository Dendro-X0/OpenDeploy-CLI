/**
 * CI workflow synthesizer (dry run): prints recommended ci.yml job blocks.
 * Profiles: pr | nightly | tag
 * Use --include to filter jobs by name, comma-separated.
 */
import { Command } from 'commander'
import { writeFile } from 'node:fs/promises'

export type CiProfile = 'pr' | 'nightly' | 'tag'

function header(profile: CiProfile): string {
  const name = profile === 'pr' ? 'CI' : (profile === 'nightly' ? 'Nightly CI' : 'Release CI')
  const lines: string[] = [
    `name: ${name}`,
    ''
  ]
  if (profile === 'pr') {
    lines.push('on:')
    lines.push('  push:')
    lines.push('    branches: [ main ]')
    lines.push('  pull_request:')
    lines.push('    branches: [ main ]')
  } else if (profile === 'nightly') {
    lines.push('on:')
    lines.push("  schedule:")
    lines.push("    - cron: '0 9 * * *'")
    lines.push('  workflow_dispatch: {}')
  } else {
    lines.push('on:')
    lines.push('  workflow_dispatch: {}')
    lines.push('  push:')
    lines.push("    tags:")
    lines.push("      - 'v*'")
  }
  lines.push('')
  lines.push('jobs:')
  return lines.join('\n')
}

function blockBuildAndTest(): string {
  const lines: string[] = [
    '  build-and-test:',
    '    runs-on: ubuntu-latest',
    '    concurrency:',
    '      group: ci-' + '${{ github.ref }}',
    '      cancel-in-progress: true',
    '    env:',
    "      CI: '1'",
    "      FORCE_COLOR: '0'",
    "      OPD_SCHEMA_STRICT: '1'",
    "      OPD_TEST_NO_SPAWN: '1'",
    "      OPD_FORCE_CI: '1'",
    "      TZ: 'UTC'",
    "      LC_ALL: 'C'",
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - name: Enable Corepack & setup pnpm',
    '        run: |',
    '          corepack enable',
    '          corepack prepare pnpm@10.13.1 --activate',
    '      - name: Versions',
    '        run: |',
    '          node -v',
    '          pnpm -v',
    '      - name: Approve native build scripts',
    '        run: pnpm approve-builds @tailwindcss/oxide esbuild sharp workerd',
    '      - name: Install deps',
    '        run: pnpm install --no-frozen-lockfile',
    '      - name: Build',
    '        run: pnpm build',
    '      - name: Test (CLI)',
    '        run: |',
    '          mkdir -p ./.artifacts',
    '          OPD_TEST_NO_SPAWN=1 OPD_TEST_FORCE_SAFE_FIXES=1 pnpm -C packages/cli test -- --reporter=dot --reporter=json --outputFile ../../.artifacts/vitest.json --exclude src/__tests__/start-safe-fixes.test.ts --exclude src/__tests__/start-next-config-fixes.test.ts',
    '      - name: Upload artifacts',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: opd-artifacts-ci',
    '          path: |',
    '            ./.artifacts/**/*.json',
    '            ./.artifacts/**/*.ndjson',
    '          if-no-files-found: ignore'
  ]
  return lines.join('\n')
}

function blockSecurityScan(): string {
  const lines: string[] = [
    '  security-scan:',
    '    name: Security - OpenDeploy Scan (strict)',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '20'",
    '      - name: Enable Corepack & setup pnpm',
    '        run: |',
    '          corepack enable',
    '          corepack prepare pnpm@10.13.1 --activate',
    '      - name: Install deps',
    '        run: pnpm install --no-frozen-lockfile',
    '      - name: Build CLI',
    '        run: pnpm -C packages/cli build',
    '      - name: Doctor (strict)',
    '        env:',
    "          OPD_FORCE_CI: '1'",
    '        run: node packages/cli/dist/index.js doctor --json --ci --strict | tee ./.artifacts/doctor.strict.json',
    '      - name: Scan (strict)',
    '        env:',
    "          OPD_FORCE_CI: '1'",
    '        run: node packages/cli/dist/index.js scan --json --strict | tee ./.artifacts/scan.strict.json',
    '      - uses: actions/upload-artifact@v4',
    '        if: always()',
    '        with:',
    '          name: opd-security-scan',
    '          path: ./.artifacts/*.json',
    '          if-no-files-found: ignore'
  ]
  return lines.join('\n')
}

function blockSecurityGitleaks(): string {
  const lines: string[] = [
    '  security-gitleaks:',
    '    name: Security - Gitleaks',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: gitleaks/gitleaks-action@v2',
    '        with:',
    '          args: --redact --config-path .gitleaks.toml --report-path ./.artifacts/gitleaks.sarif --report-format sarif',
    '      - uses: actions/upload-artifact@v4',
    '        if: always()',
    '        with:',
    '          name: gitleaks-report',
    '          path: ./.artifacts/gitleaks.sarif',
    '          if-no-files-found: ignore'
  ]
  return lines.join('\n')
}

function blockSecurityContent(): string {
  const lines: string[] = [
    '  security-content:',
    '    name: Security - Content Guard',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - name: Compute diff range',
    '        id: diff',
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    '          if [[ "' + '${{ github.event_name }}' + '" == "pull_request" ]]; then',
    '            base_ref="' + '${{ github.base_ref }}' + '"',
    '            git fetch origin "$base_ref" --depth=1 || true',
    '            echo "range=origin/$base_ref...HEAD" >> "$GITHUB_OUTPUT"',
    '          elif [[ "' + '${{ github.event_name }}' + '" == "push" && -n "' + '${{ github.event.before }}' + '" ]]; then',
    '            echo "range=' + '${{ github.event.before }}' + '...' + '${{ github.sha }}' + '" >> "$GITHUB_OUTPUT"',
    '          else',
    '            A=$(git rev-parse HEAD^ 2>/dev/null || echo \'\')',
    '            B=$(git rev-parse HEAD 2>/dev/null || echo \'\')',
    '            if [[ -n "$A" && -n "$B" ]]; then echo "range=$A...$B" >> "$GITHUB_OUTPUT"; else echo "range=HEAD" >> "$GITHUB_OUTPUT"; fi',
    '          fi',
    '      - name: List changed files',
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    '          git diff --name-only "' + '${{ steps.diff.outputs.range }}' + '" > changed.txt || true',
    '          echo "Changed files:"; cat changed.txt || true',
    '      - name: Filter to source files',
    '        id: filter',
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    "          grep -Ev '^(apps/)?docs/|^docs/|\\.md$|^\\.github/|^LICENSE$|^CHANGELOG\\.md$' changed.txt > filtered.txt || true",
    '          echo "Filtered files:"; cat filtered.txt || true',
    '      - name: Grep for forbidden tokens',
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    '          if [[ ! -s filtered.txt ]]; then echo "No filtered files to scan"; exit 0; fi',
    "          p1='(^|[^A-Za-z0-9_])netlify\\s+(deploy|link|login|status|api)\\b'",
    "          p2='\\\\.opendeploy/cache\\\\.json'",
    "          p3='OpenDeploy/cache\\\\.json'",
    '          bad=0',
    '          while IFS= read -r f; do',
    '            [[ -f "$f" ]] || continue',
    '            if grep -Eni -e "$p1" -e "$p2" -e "$p3" -- "$f"; then echo "::error file=$f::Forbidden token matched."; bad=1; fi',
    '          done < filtered.txt',
    '          if [[ $bad -ne 0 ]]; then echo "::error::Content guard failed."; exit 1; fi',
    '          echo "Content guard passed."',
    '      - name: Secret/Cache file guard',
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    "          deny_re='(^|/)\\.opendeploy(/|$)|(^|/)OpenDeploy(/|$)'",
    "          deny_files_re='(^|/)\\.opendeploy/cache\\.json$'",
    '          if grep -Ei "$deny_re|$deny_files_re" changed.txt; then',
    '            echo "::error::Blocked: .opendeploy/ or OpenDeploy/ files in changes."; exit 1',
    '          else',
    '            echo "No forbidden cache files."',
    '          fi',
    '      - name: Netlify artifacts guard (paths)',
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    '          FAIL=0',
    '          check_exists() { if [ -e "$1" ]; then echo "Found forbidden path: $1" >&2; FAIL=1; fi }',
    '          check_exists packages/cli/docs/providers/netlify.md || true',
    '          check_exists packages/cli/schemas/examples/start.netlify.json || true',
    '          check_exists packages/cli/schemas/examples/up.netlify.json || true',
    '          check_exists packages/cli/scripts/smoke/netlify-direct.sh || true',
    '          check_exists packages/cli/scripts/smoke/netlify-direct.ps1 || true',
    '          check_exists .netlify || true',
    '          if [ "$FAIL" -ne 0 ]; then echo "Guard failed. Remove Netlify artifacts." >&2; exit 1; fi'
  ]
  return lines.join('\n')
}

function blockDocsLinkCheck(): string {
  const lines: string[] = [
    '  docs-link-check:',
    '    name: Docs Link Check (non-blocking)',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '20'",
    '      - name: Run docs link/anchor checker',
    '        continue-on-error: true',
    '        run: node scripts/docs-link-check.mjs'
  ]
  return lines.join('\n')
}

function blockProviderSmoke(): string {
  const lines: string[] = [
    '  provider-smoke:',
    '    name: Provider Smoke — detect + doctor (virtual)',
    '    runs-on: ubuntu-latest',
    '    env:',
    "      OPD_FORCE_CI: '1'",
    "      OPD_PROVIDER_MODE: 'virtual'",
    "      OPD_NDJSON: '1'",
    '    strategy:',
    '      fail-fast: false',
    '      matrix:',
    '        provider: [ vercel, cloudflare, github ]',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '20'",
    "          cache: 'pnpm'",
    '      - uses: pnpm/action-setup@v4',
    '        with:',
    '          version: 9',
    '      - name: Install deps',
    '        run: pnpm install --no-frozen-lockfile',
    '      - name: Build CLI',
    '        run: pnpm -C packages/cli build',
    '      - name: Create tiny example app',
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    '          ROOT=$(pwd)',
    '          case "' + '${{ matrix.provider }}' + '" in',
    '            vercel) APP="$ROOT/example-vercel"; mkdir -p "$APP"; echo "module.exports = { reactStrictMode: true }" > "$APP/next.config.js";;',
    '            cloudflare) APP="$ROOT/example-cloudflare"; mkdir -p "$APP"; echo "module.exports = { reactStrictMode: true }" > "$APP/next.config.js"; echo -e "name = \"example-next-on-pages\"\ncompatibility_date = \"2024-01-01\"" > "$APP/wrangler.toml";;',
    '            github) APP="$ROOT/example-github"; mkdir -p "$APP"; echo "module.exports = { output: \'export\' }" > "$APP/next.config.js"; mkdir -p "$APP/public"; : > "$APP/public/.nojekyll";;',
    '          esac',
    '          echo "APP_DIR=$APP" >> $GITHUB_ENV',
    '          mkdir -p ./.artifacts',
    '      - name: Detect (JSON)',
    '        run: node packages/cli/dist/index.js detect --json --path "$APP_DIR" | tee ./.artifacts/detect-' + '${{ matrix.provider }}' + '.json',
    '      - name: Doctor (JSON, non-strict)',
    '        run: node packages/cli/dist/index.js doctor --json --path "$APP_DIR" | tee ./.artifacts/doctor-' + '${{ matrix.provider }}' + '.json',
    '      - uses: actions/upload-artifact@v4',
    '        if: always()',
    '        with:',
    '          name: provider-smoke-' + '${{ matrix.provider }}',
    '          path: ./.artifacts/**/*.json',
    '          if-no-files-found: ignore'
  ]
  return lines.join('\n')
}

function jobsForProfile(profile: CiProfile): string[] {
  if (profile === 'pr') return ['build-and-test', 'security-scan', 'security-gitleaks', 'security-content', 'docs-link-check', 'provider-smoke']
  if (profile === 'nightly') return ['build-and-test', 'security-scan', 'security-gitleaks', 'provider-smoke']
  return ['build-and-test', 'security-scan']
}

function synth(profile: CiProfile, include: readonly string[] | null): string {
  const parts: string[] = [header(profile)]
  const selected = include && include.length > 0 ? include : jobsForProfile(profile)
  for (const j of selected) {
    if (j === 'build-and-test') parts.push(blockBuildAndTest())
    else if (j === 'security-scan') parts.push(blockSecurityScan())
    else if (j === 'security-gitleaks') parts.push(blockSecurityGitleaks())
    else if (j === 'security-content') parts.push(blockSecurityContent())
    else if (j === 'docs-link-check') parts.push(blockDocsLinkCheck())
    else if (j === 'provider-smoke') parts.push(blockProviderSmoke())
  }
  return parts.join('\n')
}

export function registerCiGenerateCommand(program: Command): void {
  program
    .command('ci-generate')
    .description('Print recommended ci.yml blocks to stdout (dry-run helper)')
    .option('--profile <name>', 'Profile: pr|nightly|tag', 'pr')
    .option('--include <jobs>', 'Comma-separated job names to include')
    .option('--out <path>', 'Write YAML to a file')
    .action(async (opts: { readonly profile?: string; readonly include?: string; readonly out?: string }): Promise<void> => {
      const profile: CiProfile = (opts.profile === 'nightly' ? 'nightly' : (opts.profile === 'tag' ? 'tag' : 'pr'))
      const include: string[] | null = typeof opts.include === 'string' && opts.include.length > 0
        ? opts.include.split(',').map(s => s.trim()).filter(Boolean)
        : null
      const yaml: string = synth(profile, include)
      if (typeof opts.out === 'string' && opts.out.length > 0) {
        try { await writeFile(opts.out, yaml + '\n', 'utf8') } catch { /* ignore */ }
      } else {
        try { process.stdout.write(yaml + '\n') } catch { /* ignore */ }
      }
    })
}
