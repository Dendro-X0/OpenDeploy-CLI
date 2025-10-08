/**
 * JSON Schema for the final JSON object emitted by `up` command.
 * Keep broad to avoid breaking changes; rely on contract tests for stricter checks.
 */
export const upSummarySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "provider", "target", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "up" },
    provider: { type: "string", minLength: 1 },
    target: { enum: ["prod", "preview"] },
    final: { type: "boolean" },
    url: { type: "string" },
    logsUrl: { type: "string" },
    durationMs: { type: "integer", minimum: 0 },
    mode: { type: "string" },
    cmdPlan: { type: "array", items: { type: "string" } },
    schemaOk: { type: "boolean" },
    schemaErrors: { type: "array", items: { type: "string" } }
  }
} as const
