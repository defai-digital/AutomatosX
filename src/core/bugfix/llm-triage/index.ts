/**
 * LLM Triage Filter Module
 *
 * Optional LLM-based triage layer for the bugfix tool that reviews detected
 * findings before reporting, filtering out false positives by understanding
 * code context and intent.
 *
 * @module core/bugfix/llm-triage
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 *
 * ## Key Features
 *
 * - **Opt-in by default**: Zero impact on existing users
 * - **Filter only, never add**: LLM can reject findings, not create new ones
 * - **Preserve provenance**: Original AST findings always stored
 * - **Fail-safe**: Falls back to AST results on LLM errors
 * - **Cost-conscious**: Batching, confidence thresholds, budget caps
 *
 * ## Usage
 *
 * ```typescript
 * import { LLMTriageFilter, DEFAULT_LLM_TRIAGE_CONFIG } from './llm-triage/index.js';
 *
 * const filter = new LLMTriageFilter({
 *   config: {
 *     ...DEFAULT_LLM_TRIAGE_CONFIG,
 *     enabled: true,
 *     provider: 'claude',
 *   },
 * });
 *
 * const results = await filter.triage(findings);
 * ```
 *
 * ## Configuration
 *
 * See {@link LLMTriageConfig} for configuration options.
 * See {@link DEFAULT_LLM_TRIAGE_CONFIG} for default values.
 */

// Types
export type {
  LLMTriageConfig,
  LLMTriageProvider,
  LLMTriageFallbackBehavior,
  TriageSource,
  TriageVerdict,
  TriageResult,
  TriageMetrics,
  LLMTriageBatchResponse,
  TriageBatch,
  TriageFilterOptions,
} from './types.js';

// Constants
export {
  DEFAULT_LLM_TRIAGE_CONFIG,
  CONFIDENCE_BOUNDS,
  BATCH_LIMITS,
  REQUEST_LIMITS,
  TIMEOUT_CONFIG,
  COST_ESTIMATES,
} from './constants.js';

// Components (Phase 2)
export { LLMTriageFilter, createTriageFilter } from './filter.js';
export { buildTriagePrompt, estimateTokens, type TriagePrompt } from './prompt-builder.js';
export {
  parseTriageResponse,
  validateVerdictCoverage,
  createDefaultVerdicts,
  type ParseResult,
} from './response-parser.js';
