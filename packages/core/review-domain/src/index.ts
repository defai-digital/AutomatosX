/**
 * Review Domain
 *
 * AI-powered code review with focused analysis modes.
 */

// Types
export type {
  FileContent,
  ReviewContext,
  ParsedReviewResponse,
  ReviewServiceConfig,
  ReviewPromptExecutor,
  ReviewExecutionOptions,
  DryRunResult,
} from './types.js';

// Re-export contract types for convenience
export type {
  ReviewRequest,
  ReviewResult,
  ReviewComment,
  ReviewFocus,
  ReviewSummary,
  SarifOutput,
} from './types.js';

// Focus Modes
export {
  FOCUS_MODE_PROMPTS,
  getFocusModePrompt,
  RESPONSE_FORMAT_INSTRUCTIONS,
  buildReviewPrompt,
  FOCUS_MODE_CATEGORIES,
  isCategoryValidForFocus,
} from './focus-modes.js';

// Comment Builder
export {
  parseReviewResponse,
  filterCommentsByFocus,
  filterCommentsByConfidence,
  validateActionableSuggestions,
  generateCommentId,
} from './comment-builder.js';

// Markdown Formatter
export { formatReviewAsMarkdown, formatCompactSummary } from './markdown-formatter.js';

// SARIF Formatter
export {
  formatReviewAsSarif,
  formatSarifAsJson,
  createEmptySarifReport,
} from './sarif-formatter.js';

// Review Service
export { ReviewService, ReviewError, createReviewService } from './review-service.js';
