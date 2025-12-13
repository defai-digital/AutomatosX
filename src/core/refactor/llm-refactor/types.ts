/**
 * Type definitions for LLM-based refactoring
 *
 * @module core/refactor/llm-refactor/types
 * @since v12.10.0
 * @see PRD-022: Refactor Tool LLM Enhancement
 */

import type { RefactorFinding, RefactorType } from '../types.js';

/**
 * LLM Refactor configuration
 */
export interface LLMRefactorConfig {
  /** Whether LLM refactoring is enabled */
  enabled: boolean;
  /** Provider to use for refactoring (claude, gemini, openai) */
  provider: 'claude' | 'gemini' | 'openai';
  /** Maximum requests per run (cost control) */
  maxRequestsPerRun: number;
  /** Timeout per request in milliseconds */
  timeoutMs: number;
  /** Batch size for grouping findings by file */
  batchSize: number;
  /** Temperature for LLM (lower = more deterministic) */
  temperature: number;
  /** Maximum tokens for response */
  maxTokens: number;
  /** Whether to require verification before applying */
  requireVerification: boolean;
  /** Fallback behavior when LLM fails */
  fallbackBehavior: 'skip' | 'mark_manual';
}

/**
 * Result of a single refactoring operation
 */
export interface RefactorOperationResult {
  /** Finding ID that was refactored */
  findingId: string;
  /** Whether the refactoring was successful */
  success: boolean;
  /** The refactored code (if successful) */
  refactoredCode?: string;
  /** Original code that was replaced */
  originalCode: string;
  /** Start line in the file */
  lineStart: number;
  /** End line in the file */
  lineEnd: number;
  /** Explanation of the refactoring */
  explanation?: string;
  /** Confidence in the refactoring (0-1) */
  confidence: number;
  /** Error message (if failed) */
  error?: string;
  /** Whether this is safe to auto-apply */
  safeToAutoApply: boolean;
  /** Reason if not safe to auto-apply */
  manualReviewReason?: string;
}

/**
 * Batch of findings to refactor together (same file)
 */
export interface RefactorBatch {
  /** Unique batch identifier */
  batchId: string;
  /** File path for this batch */
  file: string;
  /** Full file content */
  fileContent: string;
  /** Findings to refactor in this file */
  findings: RefactorFinding[];
}

/**
 * Response from LLM for a batch refactoring request
 */
export interface LLMRefactorResponse {
  /** Array of refactoring results */
  refactorings: Array<{
    /** Finding ID */
    id: string;
    /** Success flag */
    success: boolean;
    /** Refactored code block */
    refactoredCode?: string;
    /** Explanation */
    explanation?: string;
    /** Confidence (0-1) */
    confidence: number;
    /** Safe to auto-apply */
    safeToAutoApply: boolean;
    /** Reason for manual review */
    manualReviewReason?: string;
    /** Error if failed */
    error?: string;
  }>;
}

/**
 * Metrics tracked during LLM refactoring
 */
export interface LLMRefactorMetrics {
  /** Total findings processed */
  findingsTotal: number;
  /** Findings successfully refactored */
  findingsRefactored: number;
  /** Findings skipped (not safe to auto-apply) */
  findingsSkipped: number;
  /** Findings failed */
  findingsFailed: number;
  /** Number of LLM requests made */
  llmRequests: number;
  /** Total tokens used */
  llmTokensUsed: number;
  /** Estimated cost in USD */
  llmCostEstimateUsd: number;
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Options for creating the LLM refactor service
 */
export interface LLMRefactorServiceOptions {
  /** Configuration overrides */
  config?: Partial<LLMRefactorConfig>;
  /** Logger instance */
  logger?: {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
}

/**
 * Prompt structure for LLM
 */
export interface RefactorPrompt {
  /** System prompt with instructions */
  system: string;
  /** User prompt with code and findings */
  user: string;
}

/**
 * Parse result from LLM response
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed response (if successful) */
  response?: LLMRefactorResponse;
  /** Error message (if failed) */
  error?: string;
  /** Raw response string */
  rawResponse: string;
}
