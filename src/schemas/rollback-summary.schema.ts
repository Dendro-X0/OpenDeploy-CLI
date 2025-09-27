export const rollbackSummarySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "provider", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "rollback" },
    provider: { type: "string" },
    target: { type: "string" },
    to: { type: "string" },
    candidate: { type: "string" },
    needsAlias: { type: "boolean" },
    deployId: { type: "string" },
    dashboard: { type: "string" },
    cmdPlan: { type: "array", items: { type: "string" } },
    message: { type: "string" },
    final: { type: "boolean" }
  }
} as const
