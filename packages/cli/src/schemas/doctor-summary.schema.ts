export const doctorSummarySchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "doctor" },
    final: { type: "boolean" }
  }
} as const
