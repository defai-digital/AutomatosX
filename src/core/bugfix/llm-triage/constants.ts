/**
 * LLM Triage Filter Constants
 *
 * Default configuration values and constants for the LLM triage system.
 *
 * @module core/bugfix/llm-triage/constants
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */

import type { LLMTriageConfig } from './types.js';

/**
 * Default LLM Triage Configuration
 *
 * Conservative defaults optimized for:
 * - Cost efficiency (batching, confidence filtering)
 * - Safety (disabled by default, fallback to AST)
 * - Reliability (reasonable timeouts and request caps)
 */
export const DEFAULT_LLM_TRIAGE_CONFIG: LLMTriageConfig = {
  // Disabled by default - must be explicitly enabled
  enabled: false,

  // Confidence thresholds
  // Findings >= 0.9 confidence skip LLM (trusted AST result)
  minConfidenceToSkip: 0.9,

  // Findings <= 0.7 confidence always go to LLM
  maxConfidenceToForce: 0.7,

  // Batching for cost efficiency
  // 5 findings per batch balances context and API calls
  batchSize: 5,

  // Default provider (Claude has good code understanding)
  provider: 'claude',

  // Cost cap: max 10 requests per run
  // At ~$0.01/request, this caps at ~$0.10/run
  maxRequestsPerRun: 10,

  // 15 second timeout per LLM call
  // Allows for complex reasoning without hanging
  timeoutMs: 15000,

  // Safe default: use AST findings if LLM fails
  // Never silently drop potential bugs
  fallbackBehavior: 'bypass',
};

/**
 * Confidence threshold boundaries
 */
export const CONFIDENCE_BOUNDS = {
  /** Minimum valid confidence value */
  MIN: 0.0,

  /** Maximum valid confidence value */
  MAX: 1.0,

  /** Default threshold for high confidence (skip LLM) */
  HIGH_CONFIDENCE: 0.9,

  /** Default threshold for low confidence (force LLM) */
  LOW_CONFIDENCE: 0.7,
} as const;

/**
 * Batch size limits
 */
export const BATCH_LIMITS = {
  /** Minimum findings per batch */
  MIN_BATCH_SIZE: 1,

  /** Maximum findings per batch (to fit in context window) */
  MAX_BATCH_SIZE: 10,

  /** Default batch size */
  DEFAULT_BATCH_SIZE: 5,
} as const;

/**
 * Request limits
 */
export const REQUEST_LIMITS = {
  /** Minimum requests per run */
  MIN_REQUESTS: 1,

  /** Maximum requests per run (cost safety) */
  MAX_REQUESTS: 50,

  /** Default requests per run */
  DEFAULT_REQUESTS: 10,
} as const;

/**
 * Timeout configuration
 */
export const TIMEOUT_CONFIG = {
  /** Minimum timeout in ms */
  MIN_TIMEOUT_MS: 5000,

  /** Maximum timeout in ms */
  MAX_TIMEOUT_MS: 60000,

  /** Default timeout in ms */
  DEFAULT_TIMEOUT_MS: 15000,
} as const;

/**
 * Cost estimation constants (approximate)
 *
 * Based on typical LLM pricing for code analysis tasks.
 * Actual costs depend on provider and token usage.
 */
export const COST_ESTIMATES = {
  /** Estimated tokens per finding in prompt */
  TOKENS_PER_FINDING: 200,

  /** Estimated tokens per response verdict */
  TOKENS_PER_VERDICT: 50,

  /** Claude Sonnet input cost per 1K tokens (USD) */
  CLAUDE_INPUT_COST_PER_1K: 0.003,

  /** Claude Sonnet output cost per 1K tokens (USD) */
  CLAUDE_OUTPUT_COST_PER_1K: 0.015,

  /** Gemini Pro input cost per 1K tokens (USD) */
  GEMINI_INPUT_COST_PER_1K: 0.00025,

  /** Gemini Pro output cost per 1K tokens (USD) */
  GEMINI_OUTPUT_COST_PER_1K: 0.0005,

  /** OpenAI GPT-4o mini input cost per 1K tokens (USD) */
  OPENAI_INPUT_COST_PER_1K: 0.00015,

  /** OpenAI GPT-4o mini output cost per 1K tokens (USD) */
  OPENAI_OUTPUT_COST_PER_1K: 0.0006,
} as const;
