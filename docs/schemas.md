# Schemas & Validation

OpenDeploy emits a final JSON summary for each command. Summaries are validated at runtime with Ajv 2020 (JSON Schema draft 2020-12) and annotated with `schemaOk` and `schemaErrors`.

- Annotated output: every final summary includes:
  - `ok: boolean`
  - `action: string`
  - `final: true`
  - `schemaOk: boolean`
  - `schemaErrors: string[]` (empty when `schemaOk === true`)
- Strict guardrail: when `OPD_SCHEMA_STRICT=1`, any schema errors set `process.exitCode = 1` while still printing the final JSON for diagnosis.

## Command summaries

- up
  - Validated with `up-summary.schema.ts`
  - Additional provider contract annotations:
    - `buildSchemaOk`, `buildSchemaErrors`
    - `deploySchemaOk`, `deploySchemaErrors`
- env (pull/sync/diff)
  - Validated with `env-summary.schema.ts`
- run
  - Validated with `run-summary.schema.ts`
- doctor
  - Validated with `doctor-summary.schema.ts`
- promote
  - Validated with `promote-summary.schema.ts`
- rollback
  - Validated with `rollback-summary.schema.ts`
- detect
  - Validated with `detect-summary.schema.ts`

## Examples

Final objects are compact in CI but shown with spacing here for readability.

up (preview):
```json
{
  "ok": true,
  "action": "up",
  "provider": "vercel",
  "target": "preview",
  "url": "https://app.vercel.app",
  "logsUrl": "https://vercel.com/acme/app/inspections/dep_123",
  "buildSchemaOk": true,
  "buildSchemaErrors": [],
  "deploySchemaOk": true,
  "deploySchemaErrors": [],
  "final": true,
  "schemaOk": true,
  "schemaErrors": []
}
```

env diff:
```json
{
  "ok": false,
  "action": "env",
  "subcommand": "diff",
  "provider": "vercel",
  "added": [{"key": "NEW", "value": "x"}],
  "removed": [],
  "changed": [],
  "final": true,
  "schemaOk": true,
  "schemaErrors": []
}
```

run:
```json
{
  "ok": true,
  "action": "run",
  "results": [
    { "name": "web", "env": {"ok": true}, "seed": {"ok": true} }
  ],
  "final": true,
  "schemaOk": true,
  "schemaErrors": []
}
```

## Notes

- Ajv 2020 is imported from `ajv/dist/2020`.
- `$schema` in the TypeScript schema modules is `https://json-schema.org/draft/2020-12/schema`.
- Schema modules are in `src/schemas/*.schema.ts`.
- Final summaries that do not conform will set `schemaOk = false` and list `schemaErrors`. With `OPD_SCHEMA_STRICT=1`, the command exits non-zero in CI/local.
