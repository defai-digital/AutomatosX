/**
 * Common schemas and branded types used across AutomatosX
 * @module @ax/schemas/common
 */

import { z } from 'zod';

// =============================================================================
// Branded Types for Type Safety
// =============================================================================

/**
 * Branded type for Agent IDs
 * Ensures type-safe agent identification across the system
 */
export const AgentId = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z][a-z0-9-]*$/, 'Agent ID must be lowercase alphanumeric with hyphens')
  .brand<'AgentId'>();
export type AgentId = z.infer<typeof AgentId>;

/**
 * Branded type for Session IDs
 */
export const SessionId = z
  .string()
  .uuid()
  .brand<'SessionId'>();
export type SessionId = z.infer<typeof SessionId>;

/**
 * Branded type for Memory Entry IDs
 */
export const MemoryId = z
  .number()
  .int()
  .positive()
  .brand<'MemoryId'>();
export type MemoryId = z.infer<typeof MemoryId>;

/**
 * Branded type for Checkpoint IDs
 */
export const CheckpointId = z
  .string()
  .uuid()
  .brand<'CheckpointId'>();
export type CheckpointId = z.infer<typeof CheckpointId>;

// =============================================================================
// Common Enums
// =============================================================================

/**
 * Supported AI providers
 */
export const ProviderType = z.enum(['claude', 'gemini', 'ax-cli', 'openai']);
export type ProviderType = z.infer<typeof ProviderType>;

/**
 * Provider integration modes
 */
export const IntegrationMode = z.enum(['mcp', 'sdk', 'bash']);
export type IntegrationMode = z.infer<typeof IntegrationMode>;

/**
 * Task status for tracking execution
 */
export const TaskStatus = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatus>;

/**
 * Memory entry types for categorization
 */
export const MemoryType = z.enum(['conversation', 'code', 'document', 'task', 'decision']);
export type MemoryType = z.infer<typeof MemoryType>;

/**
 * Log levels for structured logging
 */
export const LogLevel = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevel = z.infer<typeof LogLevel>;

// =============================================================================
// Common Utility Schemas
// =============================================================================

/**
 * ISO 8601 date string schema
 */
export const ISODateString = z.string().datetime();
export type ISODateString = z.infer<typeof ISODateString>;

/**
 * Positive duration in milliseconds
 */
export const DurationMs = z.number().int().nonnegative();
export type DurationMs = z.infer<typeof DurationMs>;

/**
 * Percentage value (0-100)
 */
export const Percentage = z.number().min(0).max(100);
export type Percentage = z.infer<typeof Percentage>;

/**
 * Normalized score (0-1)
 */
export const NormalizedScore = z.number().min(0).max(1);
export type NormalizedScore = z.infer<typeof NormalizedScore>;

/**
 * Non-empty string array
 */
export const NonEmptyStringArray = z.array(z.string()).min(1);
export type NonEmptyStringArray = z.infer<typeof NonEmptyStringArray>;

/**
 * Generic metadata object
 */
export const Metadata = z.record(z.string(), z.unknown());
export type Metadata = z.infer<typeof Metadata>;

/**
 * Token usage tracking (shared by agent and provider responses)
 */
export const TokenUsage = z.object({
  input: z.number().int().nonnegative().optional(),
  output: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional(),
});
export type TokenUsage = z.infer<typeof TokenUsage>;

// =============================================================================
// Error Schemas
// =============================================================================

/**
 * Structured error information
 */
export const ErrorInfo = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  stack: z.string().optional(),
  cause: z.string().optional(),
});
export type ErrorInfo = z.infer<typeof ErrorInfo>;

/**
 * Result type for operations that can fail
 */
export const Result = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      error: ErrorInfo,
    }),
  ]);

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: z.ZodError,
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      issues: this.zodError.issues,
    };
  }
}

/**
 * Safe parse helper that returns a typed result
 */
export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): z.SafeParseReturnType<z.input<T>, z.output<T>> {
  return schema.safeParse(data);
}

/**
 * Parse with custom error message
 */
export function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  errorMessage: string,
): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(errorMessage, result.error);
  }
  return result.data;
}
