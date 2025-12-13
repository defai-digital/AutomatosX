/**
 * LLM Triage Filter Type Definitions
 *
 * Types for the optional LLM-based triage layer that reviews detected findings
 * before reporting, filtering out false positives by understanding code context.
 *
 * @module core/bugfix/llm-triage/types
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */

import type { BugFinding } from '../types.js';

/**
 * Provider options for LLM triage
 */
export type LLMTriageProvider = 'claude' | 'gemini' | 'openai';

/**
 * Fallback behavior when LLM is unavailable
 *
 * - bypass: Use AST findings as-is (default, safest)
 * - drop: Remove uncertain findings (may hide real bugs)
 * - ast-only: Tag findings as fallback source
 */
export type LLMTriageFallbackBehavior = 'bypass' | 'drop' | 'ast-only';

/**
 * Source of the final verdict decision
 *
 * - llm: Decision came from LLM triage
 * - ast: Original AST detection (high confidence, skipped LLM)
 * - fallback: LLM unavailable, fell back to AST
 */
export type TriageSource = 'llm' | 'ast' | 'fallback';

/**
 * LLM Triage Filter Configuration
 *
 * Controls the optional LLM verification layer for bugfix detection.
 * All settings have sensible defaults for cost-conscious operation.
 */
export interface LLMTriageConfig {
  /**
   * Enable LLM triage (default: false)
   * When disabled, all findings pass through unchanged.
   */
  enabled: boolean;

  /**
   * Skip LLM verification for findings with confidence >= this threshold
   * High-confidence AST findings are assumed correct.
   * @default 0.9
   */
  minConfidenceToSkip: number;

  /**
   * Always send to LLM for findings with confidence <= this threshold
   * Low-confidence findings always get verified.
   * @default 0.7
   */
  maxConfidenceToForce: number;

  /**
   * Number of findings per LLM batch request
   * Batching reduces API overhead and cost.
   * @default 5
   */
  batchSize: number;

  /**
   * LLM provider to use for triage
   * Uses existing provider infrastructure via Router.
   * @default 'claude'
   */
  provider: LLMTriageProvider;

  /**
   * Maximum LLM requests per run (cost cap)
   * Prevents runaway costs on large codebases.
   * @default 10
   */
  maxRequestsPerRun: number;

  /**
   * Timeout per LLM call in milliseconds
   * @default 15000 (15 seconds)
   */
  timeoutMs: number;

  /**
   * Behavior when LLM is unavailable or errors occur
   * @default 'bypass'
   */
  fallbackBehavior: LLMTriageFallbackBehavior;
}

/**
 * LLM verdict for a single finding
 *
 * Represents the LLM's assessment of whether a detected bug is real.
 */
export interface TriageVerdict {
  /**
   * Original finding ID this verdict is for
   */
  findingId: string;

  /**
   * Whether the LLM accepts this as a real bug
   * - true: Confirmed bug, should be reported
   * - false: False positive, should be filtered out
   */
  accepted: boolean;

  /**
   * LLM's confidence in its verdict (0.0-1.0)
   * Low confidence suggests uncertain classification.
   */
  confidence: number;

  /**
   * Brief explanation of the verdict
   * Helps users understand why a finding was filtered.
   */
  reason?: string;
}

/**
 * Result of triage process for a single finding
 *
 * Combines the original AST finding with the LLM verdict (if any).
 */
export interface TriageResult {
  /**
   * Original AST finding from detection
   */
  original: BugFinding;

  /**
   * LLM verdict (null if skipped due to high confidence or disabled)
   */
  verdict: TriageVerdict | null;

  /**
   * Source of the final decision
   */
  source: TriageSource;
}

/**
 * Metrics for a triage run
 *
 * Tracks statistics for observability and cost monitoring.
 */
export interface TriageMetrics {
  /** Total findings processed */
  findingsTotal: number;

  /** Findings sent to LLM for triage */
  findingsTriaged: number;

  /** Findings accepted by LLM (real bugs) */
  findingsAccepted: number;

  /** Findings rejected by LLM (false positives) */
  findingsRejected: number;

  /** Findings skipped (high confidence, no LLM call) */
  findingsSkipped: number;

  /** Findings that fell back to AST (LLM errors) */
  findingsFallback: number;

  /** Number of LLM requests made */
  llmRequests: number;

  /** Estimated tokens used (if available) */
  llmTokensUsed: number;

  /** Estimated cost in USD (if available) */
  llmCostEstimateUsd: number;

  /** Total triage duration in milliseconds */
  triageDurationMs: number;
}

/**
 * LLM response for a batch of findings
 *
 * Expected JSON structure from the LLM.
 */
export interface LLMTriageBatchResponse {
  /** Array of verdicts for each finding in the batch */
  verdicts: TriageVerdict[];
}

/**
 * Batch of findings to send to LLM
 *
 * Groups findings by file for better context.
 */
export interface TriageBatch {
  /** Unique batch ID */
  batchId: string;

  /** Findings in this batch */
  findings: BugFinding[];

  /** Primary file (for file-grouped batches) */
  file?: string;
}

/**
 * Options for the triage filter
 */
export interface TriageFilterOptions {
  /** Configuration for triage behavior */
  config: LLMTriageConfig;

  /** Optional logger for debug output */
  logger?: {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
}
