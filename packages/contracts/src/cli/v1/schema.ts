/**
 * CLI Domain Contracts v1
 *
 * Contract schemas for CLI commands including resume, history, status,
 * cleanup, and dangerous operation guards.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Resume Command Contracts
// ============================================================================

/**
 * Options for the resume command
 */
export const ResumeOptionsSchema = z.object({
  /** Checkpoint ID to resume from (optional - defaults to latest) */
  checkpointId: z.string().uuid().optional(),

  /** Agent ID (required if no checkpoint ID) */
  agentId: z.string().optional(),

  /** Session ID to filter checkpoints */
  sessionId: z.string().uuid().optional(),

  /** Skip confirmation prompt */
  force: z.boolean().default(false),

  /** Output format */
  format: z.enum(['text', 'json']).default('text'),
});

export type ResumeOptions = z.infer<typeof ResumeOptionsSchema>;

/**
 * Checkpoint information for display
 */
export const CheckpointInfoSchema = z.object({
  checkpointId: z.string().uuid(),
  agentId: z.string(),
  sessionId: z.string().uuid().optional(),
  stepIndex: z.number().int(),
  completedStepId: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  /** Human-readable age */
  age: z.string(),
});

export type CheckpointInfo = z.infer<typeof CheckpointInfoSchema>;

/**
 * Resume command result
 */
export const ResumeResultSchema = z.object({
  checkpointId: z.string().uuid(),
  agentId: z.string(),
  startFromStep: z.number().int(),
  previousStepsCompleted: z.number().int(),
});

export type ResumeResult = z.infer<typeof ResumeResultSchema>;

// ============================================================================
// History Command Contracts
// ============================================================================

/**
 * Run status enum
 */
export const RunStatusSchema = z.enum([
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;

/**
 * Run record for history display
 */
export const RunRecordSchema = z.object({
  runId: z.string().uuid(),
  agentId: z.string(),
  sessionId: z.string().uuid(),

  /** Task/prompt that initiated the run */
  task: z.string().max(500),

  /** Run outcome */
  status: RunStatusSchema,

  /** Error message if failed */
  error: z.string().optional(),

  /** Timing */
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().optional(),

  /** Metrics */
  stepsCompleted: z.number().int().min(0),
  tokensUsed: z.number().int().min(0).optional(),

  /** Provider used */
  providerId: z.string().optional(),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;

/**
 * Options for the history command
 */
export const HistoryOptionsSchema = z.object({
  /** Filter by agent */
  agent: z.string().optional(),

  /** Filter by status */
  status: RunStatusSchema.optional(),

  /** Number of records to show */
  limit: z.number().int().min(1).max(100).default(10),

  /** Show all details */
  verbose: z.boolean().default(false),

  /** Output format */
  format: z.enum(['text', 'json']).default('text'),
});

export type HistoryOptions = z.infer<typeof HistoryOptionsSchema>;

/**
 * History query for session domain
 */
export const HistoryQuerySchema = z.object({
  agentId: z.string().optional(),
  status: RunStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(10),
  since: z.string().datetime().optional(),
});

export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;

// ============================================================================
// Status Command Contracts
// ============================================================================

/**
 * System health level
 */
export const SystemHealthLevelSchema = z.enum(['healthy', 'degraded', 'unhealthy']);

export type SystemHealthLevel = z.infer<typeof SystemHealthLevelSchema>;

/**
 * Provider status information
 */
export const ProviderStatusSchema = z.object({
  providerId: z.string(),
  available: z.boolean(),
  latencyMs: z.number().optional(),
  errorRate: z.number().min(0).max(1).optional(),
  circuitState: z.enum(['closed', 'open', 'halfOpen']).optional(),
  error: z.string().optional(),
});

export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

/**
 * System status information
 */
export const SystemStatusSchema = z.object({
  /** Overall status */
  status: SystemHealthLevelSchema,

  /** Provider health */
  providers: z.array(ProviderStatusSchema),

  /** Active sessions */
  activeSessions: z.number().int(),

  /** Pending checkpoints */
  pendingCheckpoints: z.number().int(),

  /** System info */
  uptime: z.string(),
  version: z.string(),

  /** Timestamp */
  checkedAt: z.string().datetime(),
});

export type SystemStatus = z.infer<typeof SystemStatusSchema>;

/**
 * Options for the status command
 */
export const StatusOptionsSchema = z.object({
  /** Show detailed status */
  verbose: z.boolean().default(false),

  /** Output format */
  format: z.enum(['text', 'json']).default('text'),
});

export type StatusOptions = z.infer<typeof StatusOptionsSchema>;

// ============================================================================
// Cleanup Command Contracts
// ============================================================================

/**
 * Data types that can be cleaned
 */
export const CleanupDataTypeSchema = z.enum([
  'checkpoints',
  'sessions',
  'traces',
  'dlq',
]);

export type CleanupDataType = z.infer<typeof CleanupDataTypeSchema>;

/**
 * Options for the cleanup command
 */
export const CleanupOptionsSchema = z.object({
  /** Dry run - show what would be cleaned */
  dryRun: z.boolean().default(true),

  /** Data types to clean */
  types: z.array(CleanupDataTypeSchema).default(['checkpoints', 'sessions']),

  /** Override retention period (days) */
  olderThan: z.number().int().min(1).optional(),

  /** Force cleanup without confirmation */
  force: z.boolean().default(false),

  /** Output format */
  format: z.enum(['text', 'json']).default('text'),
});

export type CleanupOptions = z.infer<typeof CleanupOptionsSchema>;

/**
 * Cleanup result for a single data type
 */
export const CleanupTypeResultSchema = z.object({
  type: CleanupDataTypeSchema,
  count: z.number().int(),
  freedBytes: z.number().int().optional(),
});

export type CleanupTypeResult = z.infer<typeof CleanupTypeResultSchema>;

/**
 * Cleanup command result
 */
export const CleanupResultSchema = z.object({
  cleaned: z.array(CleanupTypeResultSchema),
  totalCount: z.number().int(),
  totalFreedBytes: z.number().int().optional(),
  dryRun: z.boolean(),
});

export type CleanupResult = z.infer<typeof CleanupResultSchema>;

// ============================================================================
// Dangerous Operation Guards
// ============================================================================

/**
 * Impact level for dangerous operations
 */
export const ImpactLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export type ImpactLevel = z.infer<typeof ImpactLevelSchema>;

/**
 * Dangerous operation definition
 */
export const DangerousOperationSchema = z.object({
  operation: z.string(),
  description: z.string(),
  impact: ImpactLevelSchema,
  requiresConfirmation: z.boolean(),
  confirmationPhrase: z.string().optional(),
});

export type DangerousOperation = z.infer<typeof DangerousOperationSchema>;

/**
 * Result of checking a dangerous operation
 */
export const DangerousOpCheckResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  operation: z.string().optional(),
  impact: ImpactLevelSchema.optional(),
});

export type DangerousOpCheckResult = z.infer<typeof DangerousOpCheckResultSchema>;

/**
 * Registry of dangerous operations
 */
export const DANGEROUS_OPERATIONS: Record<string, DangerousOperation> = {
  'cleanup.force': {
    operation: 'cleanup.force',
    description: 'Permanently delete old data',
    impact: 'medium',
    requiresConfirmation: true,
  },
  'checkpoint.delete-all': {
    operation: 'checkpoint.delete-all',
    description: 'Delete all checkpoints for an agent',
    impact: 'high',
    requiresConfirmation: true,
  },
  'session.terminate-all': {
    operation: 'session.terminate-all',
    description: 'Terminate all active sessions',
    impact: 'high',
    requiresConfirmation: true,
  },
  'provider.force-reset': {
    operation: 'provider.force-reset',
    description: 'Force reset provider state (circuit breaker, rate limiter)',
    impact: 'medium',
    requiresConfirmation: true,
  },
  'guard.bypass': {
    operation: 'guard.bypass',
    description: 'Bypass governance check',
    impact: 'critical',
    requiresConfirmation: true,
    confirmationPhrase: 'I understand the risks',
  },
};

// ============================================================================
// Error Codes
// ============================================================================

export const CLIErrorCodes = {
  // Resume errors
  CHECKPOINT_NOT_FOUND: 'CLI_CHECKPOINT_NOT_FOUND',
  CHECKPOINT_EXPIRED: 'CLI_CHECKPOINT_EXPIRED',
  RESUME_FAILED: 'CLI_RESUME_FAILED',

  // History errors
  HISTORY_QUERY_FAILED: 'CLI_HISTORY_QUERY_FAILED',

  // Status errors
  STATUS_CHECK_FAILED: 'CLI_STATUS_CHECK_FAILED',

  // Cleanup errors
  CLEANUP_FAILED: 'CLI_CLEANUP_FAILED',

  // Dangerous op errors
  OPERATION_CANCELLED: 'CLI_OPERATION_CANCELLED',
  CONFIRMATION_REQUIRED: 'CLI_CONFIRMATION_REQUIRED',
  INVALID_CONFIRMATION: 'CLI_INVALID_CONFIRMATION',
} as const;

export type CLIErrorCode = (typeof CLIErrorCodes)[keyof typeof CLIErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateResumeOptions(data: unknown): ResumeOptions {
  return ResumeOptionsSchema.parse(data);
}

export function safeValidateResumeOptions(
  data: unknown
): { success: true; data: ResumeOptions } | { success: false; error: z.ZodError } {
  const result = ResumeOptionsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function validateHistoryOptions(data: unknown): HistoryOptions {
  return HistoryOptionsSchema.parse(data);
}

export function safeValidateHistoryOptions(
  data: unknown
): { success: true; data: HistoryOptions } | { success: false; error: z.ZodError } {
  const result = HistoryOptionsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function validateCleanupOptions(data: unknown): CleanupOptions {
  return CleanupOptionsSchema.parse(data);
}

export function safeValidateCleanupOptions(
  data: unknown
): { success: true; data: CleanupOptions } | { success: false; error: z.ZodError } {
  const result = CleanupOptionsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function validateStatusOptions(data: unknown): StatusOptions {
  return StatusOptionsSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultResumeOptions(): ResumeOptions {
  return ResumeOptionsSchema.parse({});
}

export function createDefaultHistoryOptions(): HistoryOptions {
  return HistoryOptionsSchema.parse({});
}

export function createDefaultCleanupOptions(): CleanupOptions {
  return CleanupOptionsSchema.parse({});
}

export function createDefaultStatusOptions(): StatusOptions {
  return StatusOptionsSchema.parse({});
}

/**
 * Get dangerous operation definition by ID
 */
export function getDangerousOperation(
  operationId: string
): DangerousOperation | undefined {
  return DANGEROUS_OPERATIONS[operationId];
}

/**
 * Check if an operation is dangerous
 */
export function isDangerousOperation(operationId: string): boolean {
  return operationId in DANGEROUS_OPERATIONS;
}
