/**
 * Constants for LLM-based refactoring
 *
 * @module core/refactor/llm-refactor/constants
 * @since v12.10.0
 * @see PRD-022: Refactor Tool LLM Enhancement
 */

import type { LLMRefactorConfig } from './types.js';

/**
 * Default LLM refactor configuration
 */
export const DEFAULT_LLM_REFACTOR_CONFIG: LLMRefactorConfig = {
  enabled: true,
  provider: 'claude',
  maxRequestsPerRun: 20,
  timeoutMs: 60000, // 60 seconds
  batchSize: 3, // Process up to 3 findings per file per request
  temperature: 0.2, // Low temperature for consistent results
  maxTokens: 4000, // Enough for code responses
  requireVerification: true,
  fallbackBehavior: 'mark_manual',
};

/**
 * Cost estimates per 1000 tokens (as of 2024)
 */
export const COST_ESTIMATES = {
  // Claude 3.5 Sonnet
  CLAUDE_INPUT_COST_PER_1K: 0.003,
  CLAUDE_OUTPUT_COST_PER_1K: 0.015,

  // Gemini 1.5 Pro (free tier available)
  GEMINI_INPUT_COST_PER_1K: 0.00125,
  GEMINI_OUTPUT_COST_PER_1K: 0.005,

  // GPT-4 Turbo
  OPENAI_INPUT_COST_PER_1K: 0.01,
  OPENAI_OUTPUT_COST_PER_1K: 0.03,
} as const;

/**
 * Refactor type descriptions for prompts
 */
export const REFACTOR_TYPE_DESCRIPTIONS: Record<string, string> = {
  dead_code: 'Remove unused imports, variables, functions, or unreachable code',
  type_safety: 'Replace `any` types with proper TypeScript types, fix unsafe type assertions',
  conditionals: 'Simplify complex conditionals using guard clauses, reduce nesting',
  hardcoded_values: 'Extract magic numbers and hardcoded strings to named constants',
  naming: 'Improve variable, function, and class names to be more descriptive',
  duplication: 'Extract duplicated code into reusable functions or modules',
  readability: 'Reduce complexity, improve code structure, add clarity',
  performance: 'Optimize N+1 patterns, parallelize sequential awaits, remove unnecessary operations',
};

/**
 * Safety rules for auto-applying refactorings
 */
export const AUTO_APPLY_SAFETY_RULES = {
  // These types are generally safe to auto-apply
  SAFE_TYPES: ['dead_code', 'type_safety', 'hardcoded_values'] as const,

  // Maximum lines that can be changed for auto-apply
  MAX_LINES_CHANGED: 20,

  // Minimum confidence required for auto-apply
  MIN_CONFIDENCE: 0.85,

  // Patterns that require manual review
  MANUAL_REVIEW_PATTERNS: [
    /export\s+(?:default\s+)?(?:function|class|const|let|var)/,  // Public API changes
    /constructor\s*\(/,  // Constructor changes
    /async\s+\*/,  // Generator changes
    /\bthis\.\w+\s*=/,  // Property assignments
  ],
};
