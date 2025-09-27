export const providerDeployResultSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: true,
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
    url: { type: "string" },
    logsUrl: { type: "string" },
    message: { type: "string" }
  }
} as const
