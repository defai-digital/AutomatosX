/**
 * Review Domain Contracts v1
 *
 * Schemas for AI-powered code review with focused analysis modes.
 *
 * Invariants:
 * - INV-REV-001: Focus Mode Isolation
 * - INV-REV-002: Confidence Filtering
 * - INV-REV-003: Explanation Required
 * - INV-REV-004: Actionable Suggestions
 * - INV-REV-OPS-001: Timeout Handling
 * - INV-REV-OPS-002: Provider Fallback
 * - INV-REV-OUT-001: Severity Ordering
 * - INV-REV-OUT-002: Health Score Calculation
 * - INV-REV-OUT-003: SARIF Compliance
 */

import { z } from 'zod';

// ============================================================================
// Focus Modes
// ============================================================================

/**
 * Review focus modes - each mode provides specialized analysis
 * INV-REV-001: Each focus mode MUST only report issues relevant to that focus
 */
export const ReviewFocusSchema = z.enum([
  'security', // OWASP Top 10, injection, auth issues
  'architecture', // SRP, coupling, dependency issues
  'performance', // N+1 queries, memory leaks, complexity
  'maintainability', // Code smells, duplication, naming
  'correctness', // Logic errors, edge cases, null handling
  'all', // Comprehensive review (default)
]);
export type ReviewFocus = z.infer<typeof ReviewFocusSchema>;

// ============================================================================
// Review Request
// ============================================================================

/**
 * Review request schema
 */
export const ReviewRequestSchema = z.object({
  /** Unique request ID (auto-generated if not provided) */
  requestId: z.string().uuid().optional(),

  /** Paths to review (files or directories) */
  paths: z.array(z.string()).min(1).max(50),

  /** Focus mode for specialized review */
  focus: ReviewFocusSchema.default('all'),

  /** Additional context for the reviewer */
  context: z.string().max(2000).optional(),

  /** Minimum confidence threshold (0-1) - INV-REV-002 */
  minConfidence: z.number().min(0).max(1).default(0.7),

  /** Maximum files to analyze */
  maxFiles: z.number().int().min(1).max(100).default(20),

  /** Maximum lines per file */
  maxLinesPerFile: z.number().int().min(1).max(1000).default(500),

  /** Provider to use (optional, uses default routing) */
  providerId: z.string().optional(),

  /** Timeout in milliseconds - INV-REV-OPS-001 */
  timeoutMs: z.number().int().min(5000).max(300000).default(120000),

  /** Output format */
  outputFormat: z.enum(['markdown', 'json', 'sarif']).default('markdown'),

  /** Dry run - only show what would be analyzed */
  dryRun: z.boolean().default(false),
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

// ============================================================================
// Review Comment (Individual Finding)
// ============================================================================

/**
 * Review comment severity levels
 * INV-REV-OUT-001: Comments MUST be ordered by severity (critical first)
 */
export const ReviewCommentSeveritySchema = z.enum([
  'critical', // Must fix - security vulnerability, data loss risk
  'warning', // Should fix - potential bug, bad practice
  'suggestion', // Could improve - enhancement opportunity
  'note', // Informational - observation, documentation
]);
export type ReviewCommentSeverity = z.infer<typeof ReviewCommentSeveritySchema>;

/**
 * Review comment schema
 * INV-REV-003: Every comment MUST include rationale (body field)
 * INV-REV-004: Comments with severity >= warning MUST include suggestion
 */
export const ReviewCommentSchema = z.object({
  /** Unique comment ID */
  commentId: z.string().uuid(),

  /** File path */
  file: z.string(),

  /** Starting line number */
  line: z.number().int().positive(),

  /** Ending line number (for multi-line comments) */
  lineEnd: z.number().int().positive().optional(),

  /** Comment severity */
  severity: ReviewCommentSeveritySchema,

  /** Short title (max 100 chars) */
  title: z.string().max(100),

  /** Detailed explanation (markdown supported) - Required per INV-REV-003 */
  body: z.string().max(2000),

  /** Why this matters */
  rationale: z.string().max(500).optional(),

  /** Suggested fix or improvement - Required for critical/warning per INV-REV-004 */
  suggestion: z.string().max(1000).optional(),

  /** Code snippet showing the fix */
  suggestedCode: z.string().max(2000).optional(),

  /** Review focus that triggered this */
  focus: ReviewFocusSchema,

  /** Confidence score (0-1) - INV-REV-002 */
  confidence: z.number().min(0).max(1),

  /** Category tag */
  category: z.string().max(50),
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

// ============================================================================
// Review Summary
// ============================================================================

/**
 * Review summary statistics
 * INV-REV-OUT-002: Health score MUST reflect weighted severity counts
 */
export const ReviewSummarySchema = z.object({
  /** Total comments by severity */
  bySeverity: z.object({
    critical: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    suggestion: z.number().int().nonnegative(),
    note: z.number().int().nonnegative(),
  }),

  /** Total comments by focus */
  byFocus: z.record(z.string(), z.number().int().nonnegative()),

  /** Files with most issues */
  hotspots: z
    .array(
      z.object({
        file: z.string(),
        commentCount: z.number().int().nonnegative(),
      })
    )
    .max(5),

  /** Overall health score (0-100) - Calculated per INV-REV-OUT-002 */
  healthScore: z.number().int().min(0).max(100),

  /** One-line verdict */
  verdict: z.string().max(200),
});
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;

// ============================================================================
// Review Result
// ============================================================================

/**
 * Review result schema
 */
export const ReviewResultSchema = z.object({
  /** Unique result ID */
  resultId: z.string().uuid(),

  /** Original request ID */
  requestId: z.string().uuid(),

  /** Review comments - ordered by severity per INV-REV-OUT-001 */
  comments: z.array(ReviewCommentSchema),

  /** Summary statistics */
  summary: ReviewSummarySchema,

  /** Files that were reviewed */
  filesReviewed: z.array(z.string()),

  /** Total lines analyzed */
  linesAnalyzed: z.number().int().nonnegative(),

  /** Provider used */
  providerId: z.string(),

  /** Model used */
  modelId: z.string(),

  /** Duration in milliseconds */
  durationMs: z.number().int().nonnegative(),

  /** Completion timestamp */
  completedAt: z.string().datetime(),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// ============================================================================
// SARIF Output (INV-REV-OUT-003)
// ============================================================================

/**
 * SARIF 2.1.0 compliant rule schema
 */
export const SarifRuleSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  shortDescription: z
    .object({
      text: z.string(),
    })
    .optional(),
  fullDescription: z
    .object({
      text: z.string(),
    })
    .optional(),
  defaultConfiguration: z
    .object({
      level: z.enum(['error', 'warning', 'note', 'none']).optional(),
    })
    .optional(),
});
export type SarifRule = z.infer<typeof SarifRuleSchema>;

/**
 * SARIF 2.1.0 compliant result location schema
 */
export const SarifLocationSchema = z.object({
  physicalLocation: z.object({
    artifactLocation: z.object({
      uri: z.string(),
    }),
    region: z
      .object({
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive().optional(),
        startColumn: z.number().int().positive().optional(),
        endColumn: z.number().int().positive().optional(),
      })
      .optional(),
  }),
});
export type SarifLocation = z.infer<typeof SarifLocationSchema>;

/**
 * SARIF 2.1.0 compliant result schema
 */
export const SarifResultSchema = z.object({
  ruleId: z.string(),
  level: z.enum(['error', 'warning', 'note', 'none']),
  message: z.object({
    text: z.string(),
  }),
  locations: z.array(SarifLocationSchema).optional(),
  fixes: z
    .array(
      z.object({
        description: z.object({
          text: z.string(),
        }),
        artifactChanges: z.array(z.unknown()).optional(),
      })
    )
    .optional(),
});
export type SarifResult = z.infer<typeof SarifResultSchema>;

/**
 * SARIF 2.1.0 compliant output schema
 * INV-REV-OUT-003: MUST comply with SARIF 2.1.0 schema
 */
export const SarifOutputSchema = z.object({
  $schema: z.literal('https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json'),
  version: z.literal('2.1.0'),
  runs: z.array(
    z.object({
      tool: z.object({
        driver: z.object({
          name: z.string(),
          version: z.string(),
          informationUri: z.string().url().optional(),
          rules: z.array(SarifRuleSchema).optional(),
        }),
      }),
      results: z.array(SarifResultSchema),
    })
  ),
});
export type SarifOutput = z.infer<typeof SarifOutputSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const ReviewErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  REVIEW_FAILED: 'REVIEW_FAILED',
  TIMEOUT: 'TIMEOUT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PARSE_ERROR: 'PARSE_ERROR',
  INVALID_PATH: 'INVALID_PATH',
  NO_FILES_FOUND: 'NO_FILES_FOUND',
} as const;

export type ReviewErrorCode = (typeof ReviewErrorCode)[keyof typeof ReviewErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a review request
 */
export function validateReviewRequest(data: unknown): ReviewRequest {
  return ReviewRequestSchema.parse(data);
}

/**
 * Safe validation for review request
 */
export function safeValidateReviewRequest(
  data: unknown
): { success: true; data: ReviewRequest } | { success: false; error: z.ZodError } {
  const result = ReviewRequestSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/**
 * Validates a review result
 */
export function validateReviewResult(data: unknown): ReviewResult {
  return ReviewResultSchema.parse(data);
}

/**
 * Safe validation for review result
 */
export function safeValidateReviewResult(
  data: unknown
): { success: true; data: ReviewResult } | { success: false; error: z.ZodError } {
  const result = ReviewResultSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/**
 * Validates a review comment
 */
export function validateReviewComment(data: unknown): ReviewComment {
  return ReviewCommentSchema.parse(data);
}

/**
 * Validates SARIF output
 */
export function validateSarifOutput(data: unknown): SarifOutput {
  return SarifOutputSchema.parse(data);
}

// ============================================================================
// Health Score Calculation (INV-REV-OUT-002)
// ============================================================================

/**
 * Calculate health score from severity counts
 * Formula: 100 - (critical*25 + warning*10 + suggestion*2)
 * Clamped to 0-100 range
 * INV-REV-OUT-002: Health score MUST reflect weighted severity counts
 */
export function calculateHealthScore(
  critical: number,
  warning: number,
  suggestion: number
): number {
  const score = 100 - (critical * 25 + warning * 10 + suggestion * 2);
  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Severity Ordering (INV-REV-OUT-001)
// ============================================================================

/**
 * Severity ordering for sorting comments
 * INV-REV-OUT-001: Comments MUST be ordered by severity (critical first)
 */
export const SEVERITY_ORDER: Record<ReviewCommentSeverity, number> = {
  critical: 0,
  warning: 1,
  suggestion: 2,
  note: 3,
};

/**
 * Compare function for sorting comments by severity
 * Primary: severity (critical first)
 * Secondary: confidence (descending)
 * Tertiary: file path (alphabetical)
 */
export function compareCommentsBySeverity(
  a: ReviewComment,
  b: ReviewComment
): number {
  // Primary: severity
  const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (severityDiff !== 0) return severityDiff;

  // Secondary: confidence (descending)
  const confidenceDiff = b.confidence - a.confidence;
  if (confidenceDiff !== 0) return confidenceDiff;

  // Tertiary: file path (alphabetical)
  return a.file.localeCompare(b.file);
}

/**
 * Sort comments according to INV-REV-OUT-001
 */
export function sortCommentsBySeverity(comments: ReviewComment[]): ReviewComment[] {
  return [...comments].sort(compareCommentsBySeverity);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates an empty review summary
 */
export function createEmptyReviewSummary(): ReviewSummary {
  return {
    bySeverity: {
      critical: 0,
      warning: 0,
      suggestion: 0,
      note: 0,
    },
    byFocus: {},
    hotspots: [],
    healthScore: 100,
    verdict: 'No issues found.',
  };
}

/**
 * Creates a review summary from comments
 */
export function createReviewSummary(comments: ReviewComment[]): ReviewSummary {
  const bySeverity = {
    critical: 0,
    warning: 0,
    suggestion: 0,
    note: 0,
  };

  const byFocus: Record<string, number> = {};
  const fileCommentCounts: Record<string, number> = {};

  for (const comment of comments) {
    bySeverity[comment.severity]++;
    byFocus[comment.focus] = (byFocus[comment.focus] ?? 0) + 1;
    fileCommentCounts[comment.file] = (fileCommentCounts[comment.file] ?? 0) + 1;
  }

  // Get top 5 hotspots
  const hotspots = Object.entries(fileCommentCounts)
    .map(([file, commentCount]) => ({ file, commentCount }))
    .sort((a, b) => b.commentCount - a.commentCount)
    .slice(0, 5);

  const healthScore = calculateHealthScore(
    bySeverity.critical,
    bySeverity.warning,
    bySeverity.suggestion
  );

  // Generate verdict
  let verdict: string;
  if (bySeverity.critical > 0) {
    verdict = `${bySeverity.critical} critical issue(s) require immediate attention.`;
  } else if (bySeverity.warning > 0) {
    verdict = `${bySeverity.warning} warning(s) should be addressed.`;
  } else if (bySeverity.suggestion > 0) {
    verdict = `${bySeverity.suggestion} suggestion(s) for improvement.`;
  } else if (bySeverity.note > 0) {
    verdict = `${bySeverity.note} note(s) for reference.`;
  } else {
    verdict = 'No issues found.';
  }

  return {
    bySeverity,
    byFocus,
    hotspots,
    healthScore,
    verdict,
  };
}
