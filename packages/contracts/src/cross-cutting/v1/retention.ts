/**
 * Data Retention Contract V1
 *
 * Provides contracts for automatic data cleanup based on configurable policies.
 * Enables compliant data management and storage optimization.
 *
 * Invariants:
 * - INV-RT-001: Retention policies applied per data type
 * - INV-RT-002: Archive before delete when configured
 * - INV-RT-003: Conditions respected during cleanup
 */

import { z } from 'zod';

/**
 * Data types subject to retention policies
 */
export const RetentionDataTypeSchema = z.enum([
  'traces',       // Execution traces
  'sessions',     // Session records
  'memory',       // Memory entries
  'checkpoints',  // Agent checkpoints
  'dlq',          // Dead letter queue entries
  'audit',        // Audit logs
  'metrics',      // Metrics data
]);

export type RetentionDataType = z.infer<typeof RetentionDataTypeSchema>;

/**
 * Retention conditions
 */
export const RetentionConditionsSchema = z.object({
  /** Only delete entries with these statuses */
  status: z.array(z.string()).optional(),

  /** Don't delete entries with these tags */
  excludeTags: z.array(z.string()).optional(),

  /** Only delete entries with these tags */
  includeTags: z.array(z.string()).optional(),

  /** Minimum age before eligible for deletion (hours) */
  minAgeHours: z.number().int().min(0).optional(),

  /** Don't delete if accessed within N hours */
  keepIfAccessedWithinHours: z.number().int().min(0).optional(),
});

export type RetentionConditions = z.infer<typeof RetentionConditionsSchema>;

/**
 * Retention policy schema
 */
export const RetentionPolicySchema = z.object({
  /** Policy identifier */
  policyId: z.string(),

  /** Data type this policy applies to (INV-RT-001) */
  dataType: RetentionDataTypeSchema,

  /** Retention period in days */
  retentionDays: z.number().int().min(1).max(365),

  /** Archive before delete (INV-RT-002) */
  archiveBeforeDelete: z.boolean().default(false),

  /** Archive path (required if archiving) */
  archivePath: z.string().optional(),

  /** Archive format */
  archiveFormat: z.enum(['json', 'csv', 'parquet']).default('json'),

  /** Conditions for retention (INV-RT-003) */
  conditions: RetentionConditionsSchema.optional(),

  /** Cron schedule for policy execution */
  schedule: z.string().default('0 3 * * *'),

  /** Policy enabled flag */
  enabled: z.boolean().default(true),

  /** Policy priority (higher runs first) */
  priority: z.number().int().min(0).max(100).default(50),

  /** Description */
  description: z.string().optional(),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

/**
 * Retention run result
 */
export const RetentionRunResultSchema = z.object({
  /** Unique run identifier */
  runId: z.string().uuid(),

  /** Policy that was executed */
  policyId: z.string(),

  /** Run start time */
  startedAt: z.string().datetime(),

  /** Run end time */
  completedAt: z.string().datetime(),

  /** Entries evaluated */
  entriesProcessed: z.number().int().min(0),

  /** Entries deleted */
  entriesDeleted: z.number().int().min(0),

  /** Entries archived */
  entriesArchived: z.number().int().min(0),

  /** Entries skipped (didn't match conditions) */
  entriesSkipped: z.number().int().min(0),

  /** Errors encountered */
  errors: z.array(z.string()),

  /** Whether run was successful */
  success: z.boolean(),

  /** Storage reclaimed in bytes */
  storageReclaimedBytes: z.number().int().min(0).optional(),
});

export type RetentionRunResult = z.infer<typeof RetentionRunResultSchema>;

/**
 * Retention summary across all policies
 */
export const RetentionSummarySchema = z.object({
  /** Total policies */
  totalPolicies: z.number().int().min(0),

  /** Enabled policies */
  enabledPolicies: z.number().int().min(0),

  /** Last run results by policy */
  lastRuns: z.record(z.string(), RetentionRunResultSchema),

  /** Next scheduled run time */
  nextRunAt: z.string().datetime().optional(),

  /** Total storage reclaimed */
  totalStorageReclaimedBytes: z.number().int().min(0),

  /** Total entries deleted */
  totalEntriesDeleted: z.number().int().min(0),
});

export type RetentionSummary = z.infer<typeof RetentionSummarySchema>;

/**
 * Archive entry metadata
 */
export const ArchiveEntrySchema = z.object({
  /** Original entry ID */
  originalId: z.string(),

  /** Data type */
  dataType: RetentionDataTypeSchema,

  /** Archive timestamp */
  archivedAt: z.string().datetime(),

  /** Policy that archived this entry */
  policyId: z.string(),

  /** Archive file path */
  archivePath: z.string(),

  /** Entry size in bytes */
  sizeBytes: z.number().int().min(0),
});

export type ArchiveEntry = z.infer<typeof ArchiveEntrySchema>;

/**
 * Retention error codes
 */
export const RetentionErrorCodes = {
  POLICY_NOT_FOUND: 'RETENTION_POLICY_NOT_FOUND',
  ARCHIVE_FAILED: 'RETENTION_ARCHIVE_FAILED',
  DELETE_FAILED: 'RETENTION_DELETE_FAILED',
  INVALID_SCHEDULE: 'RETENTION_INVALID_SCHEDULE',
  ARCHIVE_PATH_REQUIRED: 'RETENTION_ARCHIVE_PATH_REQUIRED',
} as const;

export type RetentionErrorCode =
  (typeof RetentionErrorCodes)[keyof typeof RetentionErrorCodes];

/**
 * Validates retention policy
 */
export function validateRetentionPolicy(data: unknown): RetentionPolicy {
  const policy = RetentionPolicySchema.parse(data);

  // Validate archive path if archiving enabled
  if (policy.archiveBeforeDelete && !policy.archivePath) {
    throw new Error('archivePath required when archiveBeforeDelete is true');
  }

  return policy;
}

/**
 * Validates retention run result
 */
export function validateRetentionRunResult(data: unknown): RetentionRunResult {
  return RetentionRunResultSchema.parse(data);
}

/**
 * Creates default retention policy
 */
export function createDefaultRetentionPolicy(
  policyId: string,
  dataType: RetentionDataType
): RetentionPolicy {
  return {
    policyId,
    dataType,
    retentionDays: 30,
    archiveBeforeDelete: false,
    archiveFormat: 'json',
    schedule: '0 3 * * *',
    enabled: true,
    priority: 50,
  };
}

/**
 * Calculates cutoff date for retention
 */
export function calculateRetentionCutoff(retentionDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}
