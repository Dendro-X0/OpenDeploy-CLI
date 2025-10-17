# Logs URL Emission and Selection (Phase 1)

This document explains where logs URLs originate in the CLI and how the extension selects a single best link to show to users.

## Sources (CLI)

- NDJSON/JSON events may contain `logsUrl`:
  - `packages/cli/src/commands/up.ts`: emits `{ logsUrl }` during `phase: 'logsUrl'` and in final summary for Vercel.
  - `packages/cli/src/commands/start.ts`: wizard mode may emit `{ logsUrl }` for Cloudflare.
- Provider results may include `logsUrl` in schemas:
  - `src/schemas/provider-*-result.schema.ts` include `logsUrl: string`.
- Human logs may include bare URLs; the extension scrapes them as a fallback.

## Selection (Extension)

- Implementation: `apps/extension/src/run.ts` → `chooseBestLogUrl(urls: string[])`.
- Strategy:
  1. Prefer Vercel dashboard deployments (`vercel.com` with `/deployments`) → score 100.
  2. Next best: any `vercel.com` URL → 90.
  3. Cloudflare dashboard (`cloudflare` with `pages` or `workers`) → 80.
  4. `pages.dev` preview URLs → 70.
  5. GitHub Actions run URLs → 60.
  6. Otherwise → 10 (lowest priority).
- The extension aggregates candidates from:
  - JSON objects containing `logsUrl`.
  - Regex match of `https?://\S+` in stdout/stderr lines, filtered to known domains.

## vNext contract

- Always emit a single authoritative `logsUrl` in the final summary if available.
- Keep NDJSON events consistent with the `OpdEvent` shape (see `core-contract.md`).
- The extension should not need to scrape human logs when running against vNext; scraping remains as a fallback only for older versions.
