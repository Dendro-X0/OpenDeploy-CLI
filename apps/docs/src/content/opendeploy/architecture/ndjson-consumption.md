---
title: NDJSON Consumption
description: How to consume NDJSON event streams from OpenDeploy CLI
---

# NDJSON Consumption

OpenDeploy CLI can emit an event stream as newline-delimited JSON (NDJSON) when `OPD_NDJSON=1`. This enables rich, incremental UIs in CI and the VSCode extension.

## When to use NDJSON

- **Interactive UIs** that show progress (phases, sub-steps) as they occur.
- **CI logs** that need machine-readable cues for log folding or annotations.
- **IDE integrations** that surface streaming feedback and a final summary card.

For automation, prefer the final summary JSON object (printed in both NDJSON and `--json` modes). NDJSON events are considered ephemeral.

## Enabling NDJSON

```bash
# Stream events and end with the final summary
OPD_NDJSON=1 opd deploy github

# Windows PowerShell
$env:OPD_NDJSON = '1'; opd deploy github; Remove-Item Env:\OPD_NDJSON
```

## Event shape (OpdEvent)

Minimal guaranteed fields:

```ts
export interface OpdEvent {
  readonly action: 'plan' | 'deploy' | 'generate' | 'doctor' | string
  readonly provider?: 'vercel' | 'cloudflare-pages' | 'github-pages' | 'turbo'
  readonly phase?: string
  readonly message?: string
  readonly path?: string
  readonly candidates?: readonly string[]
  readonly redacted?: boolean
}
```

Notes:
- Providers and commands can add additional fields per phase.
- Sensitive data may be redacted; check `redacted` when present.

## Parsing NDJSON safely

```ts
import * as readline from 'node:readline'

function parseNdjson(stream: NodeJS.ReadableStream, onEvent: (e: unknown) => void, onFinal: (summary: unknown) => void) {
  const rl = readline.createInterface({ input: stream })
  rl.on('line', (line) => {
    const t = line.trim()
    if (!t) return
    try {
      const obj = JSON.parse(t)
      // Final summary objects always contain final: true
      if (obj && typeof obj === 'object' && (obj as any).final === true) onFinal(obj)
      else onEvent(obj)
    } catch {
      // ignore non-JSON lines
    }
  })
}
```

## Final summary

Even with NDJSON enabled, the CLI prints exactly one final summary with `final: true`. See the **Output Contract** page for detailed schema:

- `/docs/opendeploy/architecture/output-contract`

## Examples

- **Plan** (stream phases, then final plan summary)
- **Deploy** (stream provider output, then final deploy summary with `url` or `logsUrl`)
- **Doctor** (stream checks, then final results/suggestions)

## Tips

- Use `--json` for one-shot automation that only needs the final object.
- Use NDJSON in the extension/CI to provide responsive feedback, while still relying on the final summary for decisions.
- Avoid strict coupling to event fields; treat events as best-effort hints and progress markers.
