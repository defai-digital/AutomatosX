/**
 * Bugfix Domain Contracts v1
 *
 * Schemas for automated bug detection and fixing.
 */

import { z } from 'zod';

// ============================================================================
// Bug Detection Schemas
// ============================================================================

/**
 * Bug severity levels
 */
export const BugSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type BugSeverity = z.infer<typeof BugSeveritySchema>;

/**
 * Bug category
 */
export const BugCategorySchema = z.enum([
  'resource-leak',
  'memory-leak',
  'timer-leak',
  'null-reference',
  'type-error',
  'logic-error',
  'concurrency',
  'security',
  'performance',
  'other',
]);
export type BugCategory = z.infer<typeof BugCategorySchema>;

/**
 * Detected bug schema
 */
export const DetectedBugSchema = z.object({
  bugId: z.string().uuid(),
  category: BugCategorySchema,
  severity: BugSeveritySchema,
  title: z.string().max(200),
  description: z.string().max(2000),
  filePath: z.string(),
  lineNumber: z.number().int().min(1).optional(),
  columnNumber: z.number().int().min(1).optional(),
  codeSnippet: z.string().max(5000).optional(),
  suggestedFix: z.string().max(5000).optional(),
  confidence: z.number().min(0).max(1),
  detectedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type DetectedBug = z.infer<typeof DetectedBugSchema>;

// ============================================================================
// Bug Scan Schemas
// ============================================================================

/**
 * Bug scan request
 */
export const BugScanRequestSchema = z.object({
  paths: z.array(z.string()).min(1).max(100),
  categories: z.array(BugCategorySchema).optional(),
  minSeverity: BugSeveritySchema.optional(),
  excludePatterns: z.array(z.string()).max(50).optional(),
  maxFiles: z.number().int().min(1).max(1000).default(100),
  useAst: z.boolean().default(true),
});

export type BugScanRequest = z.infer<typeof BugScanRequestSchema>;

/**
 * Bug scan result
 */
export const BugScanResultSchema = z.object({
  scanId: z.string().uuid(),
  bugs: z.array(DetectedBugSchema),
  filesScanned: z.number().int().min(0),
  scanDurationMs: z.number().int().min(0),
  completedAt: z.string().datetime(),
  summary: z.object({
    total: z.number().int().min(0),
    bySeverity: z.record(BugSeveritySchema, z.number().int().min(0)),
    byCategory: z.record(BugCategorySchema, z.number().int().min(0)),
  }),
});

export type BugScanResult = z.infer<typeof BugScanResultSchema>;

// ============================================================================
// Bug Fix Schemas
// ============================================================================

/**
 * Bug fix request
 */
export const BugFixRequestSchema = z.object({
  bugId: z.string().uuid(),
  autoApply: z.boolean().default(false),
  dryRun: z.boolean().default(true),
  createBackup: z.boolean().default(true),
});

export type BugFixRequest = z.infer<typeof BugFixRequestSchema>;

/**
 * Bug fix result
 */
export const BugFixResultSchema = z.object({
  bugId: z.string().uuid(),
  fixed: z.boolean(),
  applied: z.boolean(),
  diff: z.string().max(10000).optional(),
  backupPath: z.string().optional(),
  error: z.string().optional(),
  fixedAt: z.string().datetime().optional(),
});

export type BugFixResult = z.infer<typeof BugFixResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const BugfixErrorCode = {
  SCAN_FAILED: 'SCAN_FAILED',
  BUG_NOT_FOUND: 'BUG_NOT_FOUND',
  FIX_FAILED: 'FIX_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PARSE_ERROR: 'PARSE_ERROR',
  INVALID_PATH: 'INVALID_PATH',
} as const;

export type BugfixErrorCode = (typeof BugfixErrorCode)[keyof typeof BugfixErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateBugScanRequest(data: unknown): BugScanRequest {
  return BugScanRequestSchema.parse(data);
}

export function validateBugFixRequest(data: unknown): BugFixRequest {
  return BugFixRequestSchema.parse(data);
}

export function safeValidateBugScanRequest(
  data: unknown
): { success: true; data: BugScanRequest } | { success: false; error: z.ZodError } {
  const result = BugScanRequestSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
