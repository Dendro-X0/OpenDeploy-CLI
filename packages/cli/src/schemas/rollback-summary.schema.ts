export const rollbackSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
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
