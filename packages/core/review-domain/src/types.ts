/**
 * Review Domain Internal Types
 *
 * Types used internally by the review domain.
 */

import type {
  ReviewRequest,
  ReviewResult,
  ReviewComment,
  ReviewFocus,
  ReviewSummary,
  SarifOutput,
} from '@automatosx/contracts';

// Re-export contract types for convenience
export type {
  ReviewRequest,
  ReviewResult,
  ReviewComment,
  ReviewFocus,
  ReviewSummary,
  SarifOutput,
};

/**
 * File content for review
 */
export interface FileContent {
  path: string;
  content: string;
  lineCount: number;
}

/**
 * Review context provided to the LLM
 */
export interface ReviewContext {
  /** Focus mode for this review */
  focus: ReviewFocus;
  /** Additional user-provided context */
  userContext?: string;
  /** Files to review */
  files: FileContent[];
  /** Minimum confidence threshold */
  minConfidence: number;
}

/**
 * Parsed LLM response containing review comments
 */
export interface ParsedReviewResponse {
  /** Extracted comments */
  comments: ReviewComment[];
  /** Whether parsing was successful */
  success: boolean;
  /** Any parsing errors */
  errors?: string[];
}

/**
 * Review service configuration
 */
export interface ReviewServiceConfig {
  /** Default provider to use */
  defaultProvider?: string;
  /** Default timeout in milliseconds */
  defaultTimeoutMs?: number;
  /** Provider fallback order */
  providerFallbackOrder?: string[];
}

/**
 * Provider interface for executing review prompts
 */
export interface ReviewPromptExecutor {
  /**
   * Execute a review prompt and return the response
   */
  execute(
    prompt: string,
    options?: {
      providerId?: string;
      timeoutMs?: number;
    }
  ): Promise<{ content: string; providerId: string; modelId: string }>;
}

/**
 * Review execution options
 */
export interface ReviewExecutionOptions {
  /** Provider to use */
  providerId?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Dry run - only analyze what would be reviewed */
  dryRun?: boolean;
}

/**
 * Dry run result
 */
export interface DryRunResult {
  /** Files that would be reviewed */
  files: string[];
  /** Total lines that would be analyzed */
  totalLines: number;
  /** Focus mode */
  focus: ReviewFocus;
  /** Estimated duration (rough) */
  estimatedDurationMs: number;
}
