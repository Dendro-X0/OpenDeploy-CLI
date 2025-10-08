export const promoteSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "provider", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "promote" },
    provider: { type: "string" },
    target: { type: "string" },
    from: { type: "string" },
    url: { type: "string" },
    alias: { type: "string" },
    siteId: { type: "string" },
    cmdPlan: { type: "array", items: { type: "string" } },
    message: { type: "string" },
    final: { type: "boolean" }
  }
} as const
