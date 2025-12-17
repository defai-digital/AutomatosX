/**
 * Dead Letter Queue Contract V1
 *
 * Provides contracts for capturing and managing failed events.
 * Enables retry, investigation, and resolution of failed operations.
 *
 * Invariants:
 * - INV-DLQ-001: Failed events captured with full context
 * - INV-DLQ-002: Retries respect maxRetries limit
 * - INV-DLQ-003: Exhausted entries marked appropriately
 */

import { z } from 'zod';

/**
 * Dead letter entry status
 */
export const DeadLetterStatusSchema = z.enum([
  'pending',    // Awaiting retry
  'retrying',   // Currently being retried
  'exhausted',  // Max retries reached
  'resolved',   // Successfully processed
  'discarded',  // Manually discarded
]);

export type DeadLetterStatus = z.infer<typeof DeadLetterStatusSchema>;

/**
 * Dead letter error information
 */
export const DeadLetterErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  originalError: z.string().optional(),
});

export type DeadLetterError = z.infer<typeof DeadLetterErrorSchema>;

/**
 * Dead letter entry schema
 */
export const DeadLetterEntrySchema = z.object({
  /** Unique entry identifier */
  entryId: z.string().uuid(),

  /** Original event/request identifier */
  originalEventId: z.string(),

  /** Type of the original event */
  eventType: z.string(),

  /** Original event payload */
  eventPayload: z.unknown(),

  /** Error information */
  error: DeadLetterErrorSchema,

  /** Number of retry attempts */
  retryCount: z.number().int().min(0),

  /** Maximum retries allowed */
  maxRetries: z.number().int().min(0),

  /** Last retry timestamp */
  lastRetryAt: z.string().datetime().optional(),

  /** Next scheduled retry timestamp */
  nextRetryAt: z.string().datetime().optional(),

  /** Current status */
  status: DeadLetterStatusSchema,

  /** Entry creation timestamp */
  createdAt: z.string().datetime(),

  /** Correlation ID for tracing */
  correlationId: z.string().optional(),

  /** Source component that produced the error */
  source: z.string(),

  /** Additional context */
  context: z.record(z.string(), z.unknown()).optional(),

  /** Resolution notes (if resolved/discarded) */
  resolutionNotes: z.string().optional(),

  /** User who resolved/discarded (if applicable) */
  resolvedBy: z.string().optional(),

  /** Resolution timestamp */
  resolvedAt: z.string().datetime().optional(),
});

export type DeadLetterEntry = z.infer<typeof DeadLetterEntrySchema>;

/**
 * DLQ configuration
 */
export const DLQConfigSchema = z.object({
  /** Enable DLQ */
  enabled: z.boolean().default(true),

  /** Maximum retry attempts */
  maxRetries: z.number().int().min(0).max(10).default(3),

  /** Initial retry delay in ms */
  retryDelayMs: z.number().int().min(1000).max(3600000).default(60000),

  /** Backoff multiplier for exponential backoff */
  retryBackoffMultiplier: z.number().min(1).max(5).default(2),

  /** Maximum backoff delay in ms */
  maxRetryDelayMs: z.number().int().min(1000).max(86400000).default(3600000),

  /** Retention period in days */
  retentionDays: z.number().int().min(1).max(90).default(7),

  /** Maximum entries to retain */
  maxEntries: z.number().int().min(100).max(100000).default(10000),

  /** Enable automatic retry processing */
  autoRetry: z.boolean().default(true),

  /** Batch size for retry processing */
  retryBatchSize: z.number().int().min(1).max(100).default(10),
});

export type DLQConfig = z.infer<typeof DLQConfigSchema>;

/**
 * DLQ processing result
 */
export const DLQProcessResultSchema = z.object({
  /** Number of entries processed */
  processed: z.number().int().min(0),

  /** Number of successful retries */
  succeeded: z.number().int().min(0),

  /** Number of failed retries */
  failed: z.number().int().min(0),

  /** Number of entries exhausted */
  exhausted: z.number().int().min(0),

  /** Processing duration in ms */
  durationMs: z.number().int().min(0),

  /** Errors encountered */
  errors: z.array(z.string()),
});

export type DLQProcessResult = z.infer<typeof DLQProcessResultSchema>;

/**
 * DLQ list options
 */
export const DLQListOptionsSchema = z.object({
  status: DeadLetterStatusSchema.optional(),
  source: z.string().optional(),
  eventType: z.string().optional(),
  nextRetryBefore: z.string().datetime().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export type DLQListOptions = z.infer<typeof DLQListOptionsSchema>;

/**
 * DLQ statistics
 */
export const DLQStatsSchema = z.object({
  totalEntries: z.number().int().min(0),
  pendingCount: z.number().int().min(0),
  retryingCount: z.number().int().min(0),
  exhaustedCount: z.number().int().min(0),
  resolvedCount: z.number().int().min(0),
  discardedCount: z.number().int().min(0),
  oldestEntry: z.string().datetime().optional(),
  newestEntry: z.string().datetime().optional(),
});

export type DLQStats = z.infer<typeof DLQStatsSchema>;

/**
 * DLQ error codes
 */
export const DLQErrorCodes = {
  ENTRY_NOT_FOUND: 'DLQ_ENTRY_NOT_FOUND',
  MAX_ENTRIES_EXCEEDED: 'DLQ_MAX_ENTRIES_EXCEEDED',
  RETRY_FAILED: 'DLQ_RETRY_FAILED',
  INVALID_STATUS_TRANSITION: 'DLQ_INVALID_STATUS_TRANSITION',
} as const;

export type DLQErrorCode = (typeof DLQErrorCodes)[keyof typeof DLQErrorCodes];

/**
 * Validates DLQ configuration
 */
export function validateDLQConfig(data: unknown): DLQConfig {
  return DLQConfigSchema.parse(data);
}

/**
 * Validates a dead letter entry
 */
export function validateDeadLetterEntry(data: unknown): DeadLetterEntry {
  return DeadLetterEntrySchema.parse(data);
}

/**
 * Creates default DLQ configuration
 */
export function createDefaultDLQConfig(): DLQConfig {
  return DLQConfigSchema.parse({});
}

/**
 * Calculates next retry delay with exponential backoff
 */
export function calculateRetryDelay(
  retryCount: number,
  config: DLQConfig
): number {
  const delay = config.retryDelayMs * Math.pow(config.retryBackoffMultiplier, retryCount);
  return Math.min(delay, config.maxRetryDelayMs);
}
