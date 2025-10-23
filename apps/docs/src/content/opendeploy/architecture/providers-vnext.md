---
title: Providers vNext Overview
description: Summary of vNext providers, capabilities, and URL/logsUrl outputs with links to the canonical output contract.
---

# Providers vNext Overview

OpenDeploy CLI vNext unifies provider behavior and output formats for a stable developer and CI experience. This page summarizes the providers covered in vNext and highlights the important output fields you can rely on.

- Canonical provider IDs
  - `vercel`
  - `cloudflare-pages`
  - `github-pages`

See also: [vNext Output Contract](/docs/opendeploy/architecture/output-contract) and [NDJSON Consumption](/docs/opendeploy/architecture/ndjson-consumption).

## Capabilities (Plan)

When you run plan-like flows (e.g., `opd plan <provider> --json`), the final JSON summary includes:

- `provider`: canonical provider id
- `capabilities`: a normalized object describing what the provider supports
- `target`: `preview` or `production`
- `cmdPlan`: representative commands that would run (dry-run)

Example (truncated):

```json
{
  "ok": true,
  "action": "plan",
  "provider": "vercel",
  "capabilities": {
    "supportsLocalBuild": true,
    "supportsRemoteBuild": true,
    "supportsStaticDeploy": true,
    "supportsSsr": true,
    "supportsLogsFollow": true
  },
  "target": "preview",
  "cmdPlan": ["vercel deploy --yes"],
  "hints": [],
  "final": true
}
```

## Deploy URL and Logs URL

All vNext providers emit a final JSON summary for deploy-like actions containing:

- `url`: the primary deployment URL (when available)
- `logsUrl`: a provider dashboard link for logs/inspection (when available)
- `target`: `prod` or `preview` (deploy)
- `hints`: always present (empty array when none)
- `final`: always `true`

Example:

```json
{
  "ok": true,
  "action": "deploy",
  "provider": "cloudflare-pages",
  "target": "preview",
  "url": "https://your-site.pages.dev",
  "logsUrl": "https://dash.cloudflare.com/.../pages/project/your-site/deployments/...",
  "hints": [],
  "final": true
}
```

## NDJSON Events

During longer operations, vNext providers may stream NDJSON events (set `OPD_NDJSON=1`) that the VSCode extension and CI logs can consume for progress updates. The stream always ends with the final JSON summary above.

- Use NDJSON for live progress.
- Use the final JSON summary for automation.

For details, see the [NDJSON Consumption](/docs/opendeploy/architecture/ndjson-consumption) guide and the full [vNext Output Contract](/docs/opendeploy/architecture/output-contract).

## Follow Logs

You can follow runtime logs after a deployment directly from the CLI or the VSCode extension.

- CLI (Vercel):

  ```bash
  opd logs vercel --follow
  ```

  - By default, logs stream as human-readable lines.
  - If you enable NDJSON (e.g., `OPD_NDJSON=1`), you will also receive a final JSON summary object at the end.

- Extension:

  - Open the Control Panel and click "Follow Logs", then choose a provider.
  - Logs stream to the Output panel. When JSON view is preferred, the extension enables NDJSON and shows a final JSON summary at the end.
