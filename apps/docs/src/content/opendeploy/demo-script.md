---
title: Demo Script
description: A concise flow to demo OpenDeploy across providers and a monorepo, with both human and JSON/NDJSON modes.
---

# Demo Script

This script showcases OpenDeploy’s value proposition: simple, deterministic deploys for non‑experts, with CI‑friendly JSON/NDJSON outputs.

## Prerequisites

- Installed `opd` (OpenDeploy CLI)
- Access to Vercel, Cloudflare Pages, GitHub (with a test repo)
- A few small sample apps in your workspace (e.g., `astro-mini`, `sveltekit-mini`, `next-authjs-starterkit`) and one monorepo

## Segment 1 — Quick Win (Vercel, JSON mode)

```bash
cd path/to/next-authjs-starterkit
opd up vercel --json
```

Highlight the final JSON summary with `{ "final": true }` and the `url`/`logsUrl` fields.

## Segment 2 — GitHub Pages (Preflight then Deploy)

1) Preflight only to reveal actionable hints:

```bash
cd path/to/next-authjs-starterkit
opd up github --preflight-only --json
```

2) Apply safe fix then re‑check or deploy:

```bash
opd up github --fix-preflight --preflight-only --json
# or deploy directly
opd up github --json
```

## Segment 3 — Cloudflare Pages (NDJSON progress)

```bash
cd path/to/sveltekit-mini
OPD_NDJSON=1 opd up cloudflare
# or
opd up cloudflare --ndjson
```

Point out progress events and the final `{ "final": true }` line.

## Segment 4 — Monorepo

```bash
cd path/to/your-monorepo
opd up vercel --path apps/web --json
```

Demonstrate monorepo ergonomics and deterministic summaries.

## Expected Final JSON Summary (Example)

```json
{
  "ok": true,
  "action": "up",
  "provider": "vercel",
  "target": "preview",
  "url": "https://example.vercel.app",
  "logsUrl": "https://vercel.com/...",
  "final": true
}
```

## Talking Points

- Deterministic JSON/NDJSON; `{ "final": true }` for easy parsing
- Preflight hints prevent wasted runs
- Logs URL surfaced on success and failure (human and JSON)
- Works great in monorepos (`--path`)
- Extensible provider plugin architecture
