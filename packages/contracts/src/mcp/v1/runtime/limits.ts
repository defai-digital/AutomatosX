import { z } from 'zod';

// ============================================================================
// Request Limits Configuration
// ============================================================================

export const MCPRequestLimitsSchema = z.object({
  /** Maximum array size in requests */
  maxArraySize: z.number().int().positive().default(100),
  /** Maximum string length in requests */
  maxStringLength: z.number().int().positive().default(100_000),
  /** Maximum object depth */
  maxObjectDepth: z.number().int().positive().default(10),
  /** Maximum total request size in bytes */
  maxRequestBytes: z.number().int().positive().default(10_485_760), // 10MB
  /** Per-tool array limits (tool name -> max array size) */
  toolArrayLimits: z
    .record(z.string(), z.number().int().positive())
    .default({
      review_analyze: 100,
      memory_bulk_delete: 1000,
      ability_inject: 20,
    }),
});

export type MCPRequestLimits = z.infer<typeof MCPRequestLimitsSchema>;

// ============================================================================
// Validation Error
// ============================================================================

export const ValidationErrorSchema = z.object({
  /** JSON path to the invalid field */
  path: z.string(),
  /** Error code */
  code: z.enum([
    'ARRAY_TOO_LARGE',
    'STRING_TOO_LONG',
    'OBJECT_TOO_DEEP',
    'REQUEST_TOO_LARGE',
    'INVALID_TYPE',
    'REQUIRED_FIELD',
  ]),
  /** Human-readable message */
  message: z.string(),
  /** The limit that was exceeded */
  limit: z.number().optional(),
  /** The actual value */
  actual: z.number().optional(),
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;

// ============================================================================
// Validation Result
// ============================================================================

export const ValidationResultSchema = z.discriminatedUnion('valid', [
  z.object({
    valid: z.literal(true),
  }),
  z.object({
    valid: z.literal(false),
    errors: z.array(ValidationErrorSchema).min(1),
  }),
]);

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// ============================================================================
// Default Request Limits
// ============================================================================

export const DEFAULT_REQUEST_LIMITS: MCPRequestLimits = {
  maxArraySize: 100,
  maxStringLength: 100_000,
  maxObjectDepth: 10,
  maxRequestBytes: 10_485_760, // 10MB
  toolArrayLimits: {
    review_analyze: 100,
    memory_bulk_delete: 1000,
    ability_inject: 20,
  },
};

// ============================================================================
// Array Field Paths by Tool
// ============================================================================

/**
 * Maps tool names to array field paths that need size validation
 */
export const TOOL_ARRAY_FIELDS: Record<string, string[]> = {
  review_analyze: ['paths', 'excludePatterns'],
  memory_bulk_delete: ['keys'],
  ability_inject: ['coreAbilities', 'tags'],
  guard_check: ['changedPaths'],
};

/**
 * Get the array size limit for a specific tool and field
 */
export function getArrayLimit(
  toolName: string,
  _fieldPath: string,
  limits: MCPRequestLimits
): number {
  // Check tool-specific limit first
  const toolLimit = limits.toolArrayLimits[toolName];
  if (toolLimit !== undefined) {
    return toolLimit;
  }

  // Fall back to global limit
  return limits.maxArraySize;
}
