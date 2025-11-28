// src/common.ts
import { z } from "zod";
var AgentId = z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/, "Agent ID must be lowercase alphanumeric with hyphens").brand();
var SessionId = z.string().uuid().brand();
var MemoryId = z.number().int().positive().brand();
var CheckpointId = z.string().uuid().brand();
var ProviderType = z.enum(["claude", "gemini", "ax-cli", "openai"]);
var IntegrationMode = z.enum(["mcp", "sdk", "bash"]);
var TaskStatus = z.enum(["pending", "running", "completed", "failed", "cancelled"]);
var MemoryType = z.enum(["conversation", "code", "document", "task", "decision"]);
var LogLevel = z.enum(["debug", "info", "warn", "error", "fatal"]);
var ISODateString = z.string().datetime();
var DurationMs = z.number().int().nonnegative();
var Percentage = z.number().min(0).max(100);
var NormalizedScore = z.number().min(0).max(1);
var NonEmptyStringArray = z.array(z.string()).min(1);
var Metadata = z.record(z.string(), z.unknown());
var TokenUsage = z.object({
  input: z.number().int().nonnegative().optional(),
  output: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional()
});
var ErrorInfo = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  stack: z.string().optional(),
  cause: z.string().optional()
});
var Result = (dataSchema) => z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: dataSchema
  }),
  z.object({
    success: z.literal(false),
    error: ErrorInfo
  })
]);
var ValidationError = class extends Error {
  constructor(message, zodError) {
    super(message);
    this.zodError = zodError;
    this.name = "ValidationError";
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      issues: this.zodError.issues
    };
  }
};
function safeParse(schema, data) {
  return schema.safeParse(data);
}
function parseOrThrow(schema, data, errorMessage) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(errorMessage, result.error);
  }
  return result.data;
}
export {
  AgentId,
  CheckpointId,
  DurationMs,
  ErrorInfo,
  ISODateString,
  IntegrationMode,
  LogLevel,
  MemoryId,
  MemoryType,
  Metadata,
  NonEmptyStringArray,
  NormalizedScore,
  Percentage,
  ProviderType,
  Result,
  SessionId,
  TaskStatus,
  TokenUsage,
  ValidationError,
  parseOrThrow,
  safeParse
};
//# sourceMappingURL=common.js.map