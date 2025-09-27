export const detectSummarySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "detect" },
    detection: { type: "object" },
    message: { type: "string" },
    final: { type: "boolean" }
  }
} as const
