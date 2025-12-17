/**
 * Refactor Domain Contracts v1
 *
 * Schemas for automated code refactoring.
 */

import { z } from 'zod';

// ============================================================================
// Refactor Opportunity Schemas
// ============================================================================

/**
 * Refactor type
 */
export const RefactorTypeSchema = z.enum([
  'extract-function',
  'extract-variable',
  'inline-function',
  'rename',
  'move',
  'simplify-conditional',
  'remove-duplication',
  'improve-types',
  'modernize-syntax',
  'optimize-imports',
  'other',
]);
export type RefactorType = z.infer<typeof RefactorTypeSchema>;

/**
 * Refactor impact level
 */
export const RefactorImpactSchema = z.enum(['breaking', 'major', 'minor', 'trivial']);
export type RefactorImpact = z.infer<typeof RefactorImpactSchema>;

/**
 * Detected refactor opportunity
 */
export const RefactorOpportunitySchema = z.object({
  opportunityId: z.string().uuid(),
  type: RefactorTypeSchema,
  impact: RefactorImpactSchema,
  title: z.string().max(200),
  description: z.string().max(2000),
  rationale: z.string().max(1000),
  filePath: z.string(),
  lineStart: z.number().int().min(1),
  lineEnd: z.number().int().min(1),
  codeSnippet: z.string().max(5000).optional(),
  suggestedRefactor: z.string().max(10000).optional(),
  estimatedEffort: z.enum(['trivial', 'small', 'medium', 'large']).optional(),
  confidence: z.number().min(0).max(1),
  detectedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RefactorOpportunity = z.infer<typeof RefactorOpportunitySchema>;

// ============================================================================
// Refactor Scan Schemas
// ============================================================================

/**
 * Refactor scan request
 */
export const RefactorScanRequestSchema = z.object({
  paths: z.array(z.string()).min(1).max(100),
  types: z.array(RefactorTypeSchema).optional(),
  maxImpact: RefactorImpactSchema.optional(),
  excludePatterns: z.array(z.string()).max(50).optional(),
  maxFiles: z.number().int().min(1).max(1000).default(100),
  minConfidence: z.number().min(0).max(1).default(0.7),
});

export type RefactorScanRequest = z.infer<typeof RefactorScanRequestSchema>;

/**
 * Refactor scan result
 */
export const RefactorScanResultSchema = z.object({
  scanId: z.string().uuid(),
  opportunities: z.array(RefactorOpportunitySchema),
  filesScanned: z.number().int().min(0),
  scanDurationMs: z.number().int().min(0),
  completedAt: z.string().datetime(),
  summary: z.object({
    total: z.number().int().min(0),
    byType: z.record(RefactorTypeSchema, z.number().int().min(0)),
    byImpact: z.record(RefactorImpactSchema, z.number().int().min(0)),
  }),
});

export type RefactorScanResult = z.infer<typeof RefactorScanResultSchema>;

// ============================================================================
// Refactor Apply Schemas
// ============================================================================

/**
 * Refactor apply request
 */
export const RefactorApplyRequestSchema = z.object({
  opportunityId: z.string().uuid(),
  autoApply: z.boolean().default(false),
  dryRun: z.boolean().default(true),
  createBackup: z.boolean().default(true),
  runTests: z.boolean().default(false),
});

export type RefactorApplyRequest = z.infer<typeof RefactorApplyRequestSchema>;

/**
 * Refactor apply result
 */
export const RefactorApplyResultSchema = z.object({
  opportunityId: z.string().uuid(),
  applied: z.boolean(),
  diff: z.string().max(20000).optional(),
  backupPath: z.string().optional(),
  testsRun: z.boolean().optional(),
  testsPassed: z.boolean().optional(),
  error: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
});

export type RefactorApplyResult = z.infer<typeof RefactorApplyResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const RefactorErrorCode = {
  SCAN_FAILED: 'SCAN_FAILED',
  OPPORTUNITY_NOT_FOUND: 'OPPORTUNITY_NOT_FOUND',
  APPLY_FAILED: 'APPLY_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PARSE_ERROR: 'PARSE_ERROR',
  TESTS_FAILED: 'TESTS_FAILED',
  BREAKING_CHANGE: 'BREAKING_CHANGE',
} as const;

export type RefactorErrorCode = (typeof RefactorErrorCode)[keyof typeof RefactorErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateRefactorScanRequest(data: unknown): RefactorScanRequest {
  return RefactorScanRequestSchema.parse(data);
}

export function validateRefactorApplyRequest(data: unknown): RefactorApplyRequest {
  return RefactorApplyRequestSchema.parse(data);
}

export function safeValidateRefactorScanRequest(
  data: unknown
): { success: true; data: RefactorScanRequest } | { success: false; error: z.ZodError } {
  const result = RefactorScanRequestSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
