import { z } from 'zod';

/**
 * Standardized error code definition
 */
export const ErrorCodeSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  description: z.string().max(256),
  retryable: z.boolean().default(false),
});

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Tool execution error
 */
export const ToolErrorSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  message: z.string().max(512),
  details: z.record(z.unknown()).optional(),
});

export type ToolError = z.infer<typeof ToolErrorSchema>;

/**
 * Tool execution result
 */
export const ToolResultSchema = z.discriminatedUnion('success', [
  z
    .object({
      success: z.literal(true),
      data: z.unknown(),
    })
    .strict(),
  z
    .object({
      success: z.literal(false),
      error: ToolErrorSchema,
    })
    .strict(),
]);

export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * MCP Tool definition
 */
export const McpToolSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().min(1).max(1024),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  errorCodes: z.array(ErrorCodeSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type McpTool = z.infer<typeof McpToolSchema>;

/**
 * Tool invocation request
 */
export const ToolInvocationSchema = z.object({
  toolName: z.string().min(1),
  input: z.unknown(),
  requestId: z.string().uuid().optional(),
});

export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

/**
 * Validates an MCP tool definition
 */
export function validateMcpTool(data: unknown): McpTool {
  return McpToolSchema.parse(data);
}

/**
 * Safely validates an MCP tool definition
 */
export function safeValidateMcpTool(
  data: unknown
): z.SafeParseReturnType<unknown, McpTool> {
  return McpToolSchema.safeParse(data);
}

/**
 * Creates a success result
 */
export function createSuccessResult(data: unknown): ToolResult {
  return { success: true, data };
}

/**
 * Creates an error result
 */
export function createErrorResult(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ToolResult {
  return {
    success: false,
    error: { code, message, details },
  };
}

/**
 * Standard error codes that all tools should use
 */
export const StandardErrorCodes = {
  INVALID_INPUT: 'INVALID_INPUT',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT: 'TIMEOUT',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type StandardErrorCode =
  (typeof StandardErrorCodes)[keyof typeof StandardErrorCodes];
