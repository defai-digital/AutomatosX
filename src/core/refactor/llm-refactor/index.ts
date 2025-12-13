/**
 * LLM-based Refactoring Module
 *
 * Provides LLM-powered code refactoring capabilities.
 *
 * @module core/refactor/llm-refactor
 * @since v12.10.0
 * @see PRD-022: Refactor Tool LLM Enhancement
 */

// Types
export type {
  LLMRefactorConfig,
  LLMRefactorMetrics,
  LLMRefactorServiceOptions,
  RefactorBatch,
  RefactorOperationResult,
  LLMRefactorResponse,
  RefactorPrompt,
  ParseResult,
} from './types.js';

// Constants
export { DEFAULT_LLM_REFACTOR_CONFIG, COST_ESTIMATES, AUTO_APPLY_SAFETY_RULES } from './constants.js';

// Prompt Builder
export { buildRefactorPrompt, buildSingleFindingPrompt, estimateTokens } from './prompt-builder.js';

// Response Parser
export {
  parseRefactorResponse,
  validateResultCoverage,
  createDefaultResults,
  sanitizeRefactoredCode,
} from './response-parser.js';

// Main Service
export { LLMRefactorService, createRefactorService } from './refactor-service.js';
