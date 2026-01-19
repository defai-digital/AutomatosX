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
} from '@defai.digital/contracts';

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

/**
 * File batch for smart batching by focus mode (Tier 2)
 */
export interface FileBatch {
  /** Batch identifier */
  batchId: string;
  /** Files in this batch */
  files: FileContent[];
  /** Priority level (higher = more important for focus mode) */
  priority: number;
  /** File category for this batch */
  category: 'security' | 'architecture' | 'performance' | 'data' | 'test' | 'general';
}

/**
 * Provider timeout configuration (Tier 2)
 */
export interface ProviderTimeoutConfig {
  /** Provider ID */
  providerId: string;
  /** Base timeout in milliseconds */
  baseTimeoutMs: number;
  /** Timeout per file in milliseconds */
  perFileTimeoutMs: number;
  /** Maximum total timeout */
  maxTimeoutMs: number;
}

/**
 * Dependency graph node (Tier 3)
 */
export interface DependencyNode {
  /** File path */
  path: string;
  /** Files this file imports from */
  imports: string[];
  /** Files that import this file */
  importedBy: string[];
  /** Depth in dependency tree (0 = no dependencies) */
  depth: number;
}

/**
 * Partial review result for recovery (Tier 3)
 */
export interface PartialReviewResult {
  /** Request ID */
  requestId: string;
  /** Completed batches */
  completedBatches: string[];
  /** Failed batches */
  failedBatches: string[];
  /** Partial comments collected so far */
  partialComments: ReviewComment[];
  /** Files reviewed so far */
  filesReviewed: string[];
  /** Timestamp of last successful batch */
  lastSuccessAt: string;
  /** Error message if failed */
  error?: string;
}
