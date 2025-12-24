/**
 * Review Contracts v1
 *
 * AI-powered code review with focused analysis modes.
 */

export {
  // Focus Modes
  ReviewFocusSchema,
  type ReviewFocus,
  // Request/Response
  ReviewRequestSchema,
  ReviewCommentSeveritySchema,
  ReviewCommentSchema,
  ReviewSummarySchema,
  ReviewResultSchema,
  type ReviewRequest,
  type ReviewCommentSeverity,
  type ReviewComment,
  type ReviewSummary,
  type ReviewResult,
  // SARIF Output
  SarifRuleSchema,
  SarifLocationSchema,
  SarifResultSchema,
  SarifOutputSchema,
  type SarifRule,
  type SarifLocation,
  type SarifResult,
  type SarifOutput,
  // Error Codes
  ReviewErrorCode,
  // Validation
  validateReviewRequest,
  safeValidateReviewRequest,
  validateReviewResult,
  safeValidateReviewResult,
  validateReviewComment,
  validateSarifOutput,
  // Health Score (INV-REV-OUT-002)
  calculateHealthScore,
  // Severity Ordering (INV-REV-OUT-001)
  SEVERITY_ORDER,
  compareCommentsBySeverity,
  sortCommentsBySeverity,
  // Factory Functions
  createEmptyReviewSummary,
  createReviewSummary,
} from './schema.js';
