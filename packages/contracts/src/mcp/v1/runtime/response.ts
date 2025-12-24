import { z } from 'zod';

// ============================================================================
// MCP Error Codes
// ============================================================================

export const MCPErrorCodeSchema = z.enum([
  // Validation errors
  'INVALID_INPUT',
  'MISSING_REQUIRED_FIELD',
  'INVALID_FORMAT',
  'ARRAY_TOO_LARGE',
  'STRING_TOO_LONG',
  'REQUEST_TOO_LARGE',

  // Resource errors
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'CONFLICT',

  // Operation errors
  'OPERATION_FAILED',
  'TOOL_TIMEOUT',
  'RATE_LIMITED',
  'MEMORY_PRESSURE',

  // System errors
  'INTERNAL_ERROR',
  'NOT_IMPLEMENTED',
  'SERVICE_UNAVAILABLE',
]);

export type MCPErrorCode = z.infer<typeof MCPErrorCodeSchema>;

// ============================================================================
// Error Retryability Mapping
// ============================================================================

export const RETRYABLE_ERRORS = new Set<MCPErrorCode>([
  'TOOL_TIMEOUT',
  'RATE_LIMITED',
  'MEMORY_PRESSURE',
  'SERVICE_UNAVAILABLE',
]);

export function isRetryableError(code: MCPErrorCode): boolean {
  return RETRYABLE_ERRORS.has(code);
}

// ============================================================================
// Structured Error
// ============================================================================

export const MCPStructuredErrorSchema = z.object({
  /** Error code for programmatic handling */
  code: MCPErrorCodeSchema,
  /** Human-readable message */
  message: z.string().min(1).max(1000),
  /** Additional context */
  context: z.record(z.unknown()).optional(),
  /** Whether the operation can be retried */
  retryable: z.boolean().default(false),
  /** Suggested retry delay in ms (if retryable) */
  retryAfterMs: z.number().int().positive().optional(),
});

export type MCPStructuredError = z.infer<typeof MCPStructuredErrorSchema>;

// ============================================================================
// Response Metadata
// ============================================================================

export const MCPResponseMetadataSchema = z.object({
  /** Operation duration in milliseconds */
  durationMs: z.number().int().nonnegative(),
  /** Whether result was served from cache */
  cached: z.boolean().default(false),
  /** Whether result was truncated due to size limits */
  truncated: z.boolean().default(false),
  /** Original size before truncation (if truncated) */
  originalSizeBytes: z.number().int().positive().optional(),
  /** Request ID for tracing */
  requestId: z.string().uuid().optional(),
});

export type MCPResponseMetadata = z.infer<typeof MCPResponseMetadataSchema>;

// ============================================================================
// Standard Response Envelope
// ============================================================================

export const MCPSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    metadata: MCPResponseMetadataSchema.optional(),
  });

export const MCPErrorResponseSchema = z.object({
  success: z.literal(false),
  error: MCPStructuredErrorSchema,
  metadata: MCPResponseMetadataSchema.optional(),
});

// Generic response envelope factory
export function createResponseEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion('success', [
    MCPSuccessResponseSchema(dataSchema),
    MCPErrorResponseSchema,
  ]);
}

// ============================================================================
// List Response (for paginated results)
// ============================================================================

export const MCPPaginationSchema = z.object({
  /** Total count of all items */
  total: z.number().int().nonnegative(),
  /** Number of items requested */
  limit: z.number().int().positive(),
  /** Offset from start */
  offset: z.number().int().nonnegative(),
  /** Whether more items exist */
  hasMore: z.boolean(),
});

export type MCPPagination = z.infer<typeof MCPPaginationSchema>;

export function createListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: MCPPaginationSchema,
  });
}

// ============================================================================
// Response Size Limits
// ============================================================================

export const MCPResponseLimitsSchema = z.object({
  /** Maximum response size in bytes */
  maxResponseBytes: z.number().int().positive().default(1_048_576), // 1MB
  /** Maximum items in list responses */
  maxListItems: z.number().int().positive().default(100),
  /** Maximum string field length */
  maxStringLength: z.number().int().positive().default(10_000),
  /** Truncation indicator suffix */
  truncationSuffix: z.string().default('... [truncated]'),
});

export type MCPResponseLimits = z.infer<typeof MCPResponseLimitsSchema>;

// ============================================================================
// Default Response Limits
// ============================================================================

export const DEFAULT_RESPONSE_LIMITS: MCPResponseLimits = {
  maxResponseBytes: 1_048_576, // 1MB
  maxListItems: 100,
  maxStringLength: 10_000,
  truncationSuffix: '... [truncated]',
};
