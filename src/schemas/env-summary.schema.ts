export const envSummarySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: true,
  required: ["ok", "action", "final"],
  properties: {
    ok: { type: "boolean" },
    action: { const: "env" },
    subcommand: { type: "string" },
    provider: { type: "string" },
    final: { type: "boolean" }
  }
} as const
