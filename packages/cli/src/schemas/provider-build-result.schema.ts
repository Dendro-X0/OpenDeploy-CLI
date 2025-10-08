export const providerBuildResultSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true,
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
    artifactDir: { type: "string" },
    logsUrl: { type: "string" },
    message: { type: "string" }
  }
} as const
