# PRD: P0/P1 Implementation Specification
## High-Impact Platform Improvements - Detailed Implementation Guide

**Version**: 1.0
**Date**: 2025-12-25
**Status**: Ready for Implementation
**Scope**: P0 (Immediate) + P1 (Next Sprint)

---

## Table of Contents

1. [Overview](#1-overview)
2. [P0: Immediate Implementation](#2-p0-immediate-implementation)
3. [P1: Next Sprint Implementation](#3-p1-next-sprint-implementation)
4. [File Creation Summary](#4-file-creation-summary)
5. [Migration Checklist](#5-migration-checklist)
6. [Testing Requirements](#6-testing-requirements)

---

## 1. Overview

### 1.1 Scope

| Priority | Items | Focus |
|----------|-------|-------|
| **P0** | R1, R2, R5, R7 | Trace schemas, template logging, confidence externalization, provider rate limits |
| **P1** | R3, R6, R9, R10 | Ability validation, scoring weights, DAG execution, caching |

**Note**: Budget/cost-related features (R11) excluded per design principle - cost calculations change frequently.

### 1.2 Dependencies

```
P0 Items (No dependencies, can be parallel):
├── R1: Trace Contract Schema ─────────────────┐
├── R2: Template Substitution Logging ─────────┼── Depends on R1
├── R5: Externalize Confidence Thresholds ─────┤
└── R7: Provider-Specific Rate Limiting ───────┘

P1 Items:
├── R3: Pre-Execution Ability Validation ────── Depends on R1, R2
├── R6: Centralize Agent Scoring Weights ────── Independent
├── R9: Workflow DAG Execution ──────────────── Independent
└── R10: Content-Addressable Caching ────────── Independent
```

---

## 2. P0: Immediate Implementation

### 2.1 R1: Trace Contract Schema Enhancement

**Goal**: Define rigorous Zod schemas for trace events that capture execution context.

#### New File: `packages/contracts/src/trace/v1/events.ts`

```typescript
/**
 * Trace Event Contracts v1
 *
 * Extended trace event schemas for debugging and observability.
 * These events provide granular visibility into agent execution.
 *
 * @module @defai.digital/contracts/trace/v1/events
 */

import { z } from 'zod';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Variable resolution sources */
export const VARIABLE_SOURCES = ['context', 'input', 'default', 'fallback', 'environment'] as const;

/** Ability injection status values */
export const ABILITY_INJECTION_STATUS = ['success', 'partial', 'failed', 'skipped'] as const;

/** Step timing categories */
export const TIMING_CATEGORIES = ['fast', 'normal', 'slow', 'timeout'] as const;

// Thresholds for timing categories (in ms)
export const TIMING_THRESHOLDS = {
  fast: 1000,      // < 1s
  normal: 5000,    // 1-5s
  slow: 30000,     // 5-30s
  // > 30s = timeout category
} as const;

// =============================================================================
// TEMPLATE RESOLUTION EVENTS
// =============================================================================

/**
 * Event emitted when a template variable is resolved
 * INV-TRACE-010: Template resolution events MUST capture variable source
 */
export const TemplateVariableResolvedEventSchema = z.object({
  type: z.literal('template.variable.resolved'),
  timestamp: z.string().datetime(),
  stepId: z.string().min(1),
  executionId: z.string().uuid(),
  variableKey: z.string().min(1),
  resolvedValue: z.unknown(),
  source: z.enum(VARIABLE_SOURCES),
  templateFragment: z.string().max(200).optional(), // Context around the variable
  fallbackUsed: z.boolean().default(false),
});

export type TemplateVariableResolvedEvent = z.infer<typeof TemplateVariableResolvedEventSchema>;

/**
 * Event emitted when template resolution starts
 */
export const TemplateResolutionStartEventSchema = z.object({
  type: z.literal('template.resolution.start'),
  timestamp: z.string().datetime(),
  stepId: z.string().min(1),
  executionId: z.string().uuid(),
  templateLength: z.number().int().nonnegative(),
  variableCount: z.number().int().nonnegative(),
  availableContextKeys: z.array(z.string()),
});

export type TemplateResolutionStartEvent = z.infer<typeof TemplateResolutionStartEventSchema>;

/**
 * Event emitted when template resolution completes
 */
export const TemplateResolutionCompleteEventSchema = z.object({
  type: z.literal('template.resolution.complete'),
  timestamp: z.string().datetime(),
  stepId: z.string().min(1),
  executionId: z.string().uuid(),
  resolvedLength: z.number().int().nonnegative(),
  variablesResolved: z.number().int().nonnegative(),
  variablesFailed: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
});

export type TemplateResolutionCompleteEvent = z.infer<typeof TemplateResolutionCompleteEventSchema>;

// =============================================================================
// ABILITY INJECTION EVENTS
// =============================================================================

/**
 * Event emitted when ability injection completes
 * INV-TRACE-011: Ability injection events MUST capture all missing abilities
 */
export const AbilityInjectionResultEventSchema = z.object({
  type: z.literal('ability.injection.result'),
  timestamp: z.string().datetime(),
  executionId: z.string().uuid(),
  agentId: z.string().min(1),
  task: z.string().max(2000),
  requestedAbilities: z.array(z.string()),
  resolvedAbilities: z.array(z.string()),
  missingAbilities: z.array(z.string()),
  status: z.enum(ABILITY_INJECTION_STATUS),
  totalTokens: z.number().int().nonnegative().optional(),
  durationMs: z.number().nonnegative(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

export type AbilityInjectionResultEvent = z.infer<typeof AbilityInjectionResultEventSchema>;

// =============================================================================
// STEP TIMING EVENTS
// =============================================================================

/**
 * Enhanced step timing event with resource metrics
 */
export const StepTimingEventSchema = z.object({
  type: z.literal('step.timing'),
  timestamp: z.string().datetime(),
  executionId: z.string().uuid(),
  stepId: z.string().min(1),
  stepType: z.string(),
  durationMs: z.number().nonnegative(),
  category: z.enum(TIMING_CATEGORIES),
  tokenUsage: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }).optional(),
  providerLatency: z.object({
    providerId: z.string(),
    latencyMs: z.number().nonnegative(),
    queueTimeMs: z.number().nonnegative().optional(),
  }).optional(),
  retryCount: z.number().int().nonnegative().default(0),
});

export type StepTimingEvent = z.infer<typeof StepTimingEventSchema>;

// =============================================================================
// CONFIDENCE EXTRACTION EVENTS
// =============================================================================

/**
 * Event emitted when confidence is extracted from a response
 */
export const ConfidenceExtractionEventSchema = z.object({
  type: z.literal('confidence.extraction'),
  timestamp: z.string().datetime(),
  executionId: z.string().uuid(),
  providerId: z.string(),
  extractedScore: z.number().min(0).max(1),
  method: z.enum(['marker', 'percentage', 'heuristic', 'default']),
  details: z.object({
    highPhraseCount: z.number().int().nonnegative().optional(),
    lowPhraseCount: z.number().int().nonnegative().optional(),
    wordCount: z.number().int().nonnegative().optional(),
    matchedPattern: z.string().optional(),
  }).optional(),
});

export type ConfidenceExtractionEvent = z.infer<typeof ConfidenceExtractionEventSchema>;

// =============================================================================
// RATE LIMITING EVENTS
// =============================================================================

/**
 * Event emitted when rate limiting affects execution
 */
export const RateLimitEventSchema = z.object({
  type: z.literal('rate.limit'),
  timestamp: z.string().datetime(),
  executionId: z.string().uuid().optional(),
  providerId: z.string(),
  action: z.enum(['acquired', 'queued', 'rejected', 'timeout']),
  queuePosition: z.number().int().nonnegative().optional(),
  waitTimeMs: z.number().nonnegative().optional(),
  tokensRemaining: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
});

export type RateLimitEvent = z.infer<typeof RateLimitEventSchema>;

// =============================================================================
// UNION TYPE FOR ALL EXTENDED EVENTS
// =============================================================================

export const ExtendedTraceEventSchema = z.discriminatedUnion('type', [
  TemplateVariableResolvedEventSchema,
  TemplateResolutionStartEventSchema,
  TemplateResolutionCompleteEventSchema,
  AbilityInjectionResultEventSchema,
  StepTimingEventSchema,
  ConfidenceExtractionEventSchema,
  RateLimitEventSchema,
]);

export type ExtendedTraceEvent = z.infer<typeof ExtendedTraceEventSchema>;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export function validateExtendedTraceEvent(data: unknown): ExtendedTraceEvent {
  return ExtendedTraceEventSchema.parse(data);
}

export function safeValidateExtendedTraceEvent(data: unknown): {
  success: boolean;
  data?: ExtendedTraceEvent;
  error?: z.ZodError;
} {
  const result = ExtendedTraceEventSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

export function createTemplateVariableEvent(
  params: Omit<TemplateVariableResolvedEvent, 'type' | 'timestamp'>
): TemplateVariableResolvedEvent {
  return {
    type: 'template.variable.resolved',
    timestamp: new Date().toISOString(),
    ...params,
  };
}

export function createAbilityInjectionEvent(
  params: Omit<AbilityInjectionResultEvent, 'type' | 'timestamp'>
): AbilityInjectionResultEvent {
  return {
    type: 'ability.injection.result',
    timestamp: new Date().toISOString(),
    ...params,
  };
}

export function categorizeStepTiming(durationMs: number): typeof TIMING_CATEGORIES[number] {
  if (durationMs < TIMING_THRESHOLDS.fast) return 'fast';
  if (durationMs < TIMING_THRESHOLDS.normal) return 'normal';
  if (durationMs < TIMING_THRESHOLDS.slow) return 'slow';
  return 'timeout';
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const TraceEventErrorCodes = {
  INVALID_EVENT_TYPE: 'TRACE_INVALID_EVENT_TYPE',
  MISSING_EXECUTION_ID: 'TRACE_MISSING_EXECUTION_ID',
  INVALID_TIMESTAMP: 'TRACE_INVALID_TIMESTAMP',
  VARIABLE_RESOLUTION_FAILED: 'TRACE_VARIABLE_RESOLUTION_FAILED',
  ABILITY_INJECTION_FAILED: 'TRACE_ABILITY_INJECTION_FAILED',
} as const;
```

#### Update: `packages/contracts/src/trace/v1/index.ts`

Add exports for new events:

```typescript
// Add to existing exports
export {
  // Event schemas
  TemplateVariableResolvedEventSchema,
  TemplateResolutionStartEventSchema,
  TemplateResolutionCompleteEventSchema,
  AbilityInjectionResultEventSchema,
  StepTimingEventSchema,
  ConfidenceExtractionEventSchema,
  RateLimitEventSchema,
  ExtendedTraceEventSchema,

  // Types
  type TemplateVariableResolvedEvent,
  type TemplateResolutionStartEvent,
  type TemplateResolutionCompleteEvent,
  type AbilityInjectionResultEvent,
  type StepTimingEvent,
  type ConfidenceExtractionEvent,
  type RateLimitEvent,
  type ExtendedTraceEvent,

  // Constants
  VARIABLE_SOURCES,
  ABILITY_INJECTION_STATUS,
  TIMING_CATEGORIES,
  TIMING_THRESHOLDS,

  // Validation
  validateExtendedTraceEvent,
  safeValidateExtendedTraceEvent,

  // Factory functions
  createTemplateVariableEvent,
  createAbilityInjectionEvent,
  categorizeStepTiming,

  // Error codes
  TraceEventErrorCodes,
} from './events.js';
```

---

### 2.2 R2: Structured Template Substitution Logging

**Goal**: Add trace events for every variable resolution in executor.ts.

#### Update: `packages/core/agent-domain/src/executor.ts`

```typescript
// Add imports at top
import {
  createTemplateVariableEvent,
  createAbilityInjectionEvent,
  ABILITY_INJECTION_STATUS,
  categorizeStepTiming,
  type TemplateVariableResolvedEvent,
  type AbilityInjectionResultEvent,
} from '@defai.digital/contracts/trace/v1/events';

// Add to DefaultAgentExecutor class:

/**
 * Resolve template variables with full tracing
 */
private resolveTemplateWithTracing(
  template: string,
  context: ExecutionContext,
  stepId: string
): string {
  const executionId = context.executionId;
  const variablePattern = /\{\{(\w+)\}\}/g;
  const matches = template.match(variablePattern) || [];

  // Emit resolution start event
  this.trace?.emit('template.resolution.start', {
    stepId,
    executionId,
    templateLength: template.length,
    variableCount: matches.length,
    availableContextKeys: Object.keys(context.variables ?? {}),
  });

  const startTime = Date.now();
  let variablesResolved = 0;
  let variablesFailed = 0;

  const resolved = template.replace(variablePattern, (match, key) => {
    // Determine source and value
    let value: unknown;
    let source: 'context' | 'input' | 'default' | 'fallback' | 'environment';
    let fallbackUsed = false;

    if (context.variables?.[key] !== undefined) {
      value = context.variables[key];
      source = 'context';
    } else if (context.input?.[key] !== undefined) {
      value = context.input[key];
      source = 'input';
    } else if (process.env[key] !== undefined) {
      value = process.env[key];
      source = 'environment';
    } else {
      value = '';
      source = 'fallback';
      fallbackUsed = true;
      variablesFailed++;
    }

    if (!fallbackUsed) {
      variablesResolved++;
    }

    // Emit variable resolution event
    const event = createTemplateVariableEvent({
      stepId,
      executionId,
      variableKey: key,
      resolvedValue: typeof value === 'string' ? value.slice(0, 100) : value, // Truncate for logging
      source,
      fallbackUsed,
      templateFragment: match,
    });
    this.trace?.emit(event.type, event);

    return String(value ?? '');
  });

  // Emit resolution complete event
  this.trace?.emit('template.resolution.complete', {
    stepId,
    executionId,
    resolvedLength: resolved.length,
    variablesResolved,
    variablesFailed,
    durationMs: Date.now() - startTime,
  });

  return resolved;
}

/**
 * Inject abilities with full tracing
 */
private async injectAbilitiesWithTracing(
  agentId: string,
  task: string,
  executionId: string
): Promise<{ content: string; abilities: string[] }> {
  const startTime = Date.now();

  try {
    const result = await this.abilityInjector.inject({
      agentId,
      task,
      maxAbilities: this.config.maxAbilities ?? 10,
      maxTokens: this.config.maxAbilityTokens ?? 50000,
    });

    const event = createAbilityInjectionEvent({
      executionId,
      agentId,
      task: task.slice(0, 2000),
      requestedAbilities: [], // Would need to track requested vs resolved
      resolvedAbilities: result.abilities,
      missingAbilities: [],
      status: result.abilities.length > 0 ? 'success' : 'skipped',
      totalTokens: result.tokenCount,
      durationMs: Date.now() - startTime,
    });
    this.trace?.emit(event.type, event);

    return { content: result.content, abilities: result.abilities };
  } catch (error) {
    const event = createAbilityInjectionEvent({
      executionId,
      agentId,
      task: task.slice(0, 2000),
      requestedAbilities: [],
      resolvedAbilities: [],
      missingAbilities: [],
      status: 'failed',
      durationMs: Date.now() - startTime,
      error: {
        code: 'ABILITY_INJECTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    this.trace?.emit(event.type, event);

    // Don't throw - ability injection failure should not block execution
    console.warn(`[AgentExecutor] Ability injection failed for ${agentId}: ${event.error?.message}`);
    return { content: '', abilities: [] };
  }
}
```

---

### 2.3 R5: Externalize Confidence Thresholds

**Goal**: Create centralized confidence configuration in contracts.

#### New File: `packages/contracts/src/confidence/v1/schema.ts`

```typescript
/**
 * Confidence Scoring Contracts v1
 *
 * Centralized configuration for confidence thresholds and scoring.
 * Replaces hardcoded values scattered across discussion-domain.
 *
 * @module @defai.digital/contracts/confidence/v1
 */

import { z } from 'zod';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default confidence marker scores */
export const DEFAULT_MARKER_SCORES = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
} as const;

/** Default heuristic confidence scores */
export const DEFAULT_HEURISTIC_SCORES = {
  strongPositive: 0.85,  // 2+ high-confidence phrases
  positive: 0.75,        // 1 high-confidence phrase
  neutral: 0.6,          // No strong signals
  negative: 0.45,        // 1 low-confidence phrase
  strongNegative: 0.3,   // 2+ low-confidence phrases
} as const;

/** Default response analysis thresholds */
export const DEFAULT_RESPONSE_THRESHOLDS = {
  wordCountForDetailedResponse: 200,
  detailedResponseScore: 0.7,
  minWordLengthForAgreement: 4,
} as const;

/** Default agreement score parameters */
export const DEFAULT_AGREEMENT_PARAMS = {
  baseScore: 0.3,
  maxBonus: 0.7,
  singleResponseScore: 1.0,
} as const;

/** Cascading confidence defaults */
export const DEFAULT_CASCADING_CONFIDENCE = {
  enabled: true,
  threshold: 0.9,
  minProviders: 2,
} as const;

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Confidence marker scores for explicit markers like [HIGH CONFIDENCE]
 */
export const ConfidenceMarkerScoresSchema = z.object({
  high: z.number().min(0).max(1).default(DEFAULT_MARKER_SCORES.high),
  medium: z.number().min(0).max(1).default(DEFAULT_MARKER_SCORES.medium),
  low: z.number().min(0).max(1).default(DEFAULT_MARKER_SCORES.low),
}).strict();

export type ConfidenceMarkerScores = z.infer<typeof ConfidenceMarkerScoresSchema>;

/**
 * Heuristic confidence scores based on phrase analysis
 */
export const ConfidenceHeuristicScoresSchema = z.object({
  strongPositive: z.number().min(0).max(1).default(DEFAULT_HEURISTIC_SCORES.strongPositive),
  positive: z.number().min(0).max(1).default(DEFAULT_HEURISTIC_SCORES.positive),
  neutral: z.number().min(0).max(1).default(DEFAULT_HEURISTIC_SCORES.neutral),
  negative: z.number().min(0).max(1).default(DEFAULT_HEURISTIC_SCORES.negative),
  strongNegative: z.number().min(0).max(1).default(DEFAULT_HEURISTIC_SCORES.strongNegative),
}).strict();

export type ConfidenceHeuristicScores = z.infer<typeof ConfidenceHeuristicScoresSchema>;

/**
 * Response analysis thresholds
 */
export const ResponseAnalysisThresholdsSchema = z.object({
  wordCountForDetailedResponse: z.number().int().positive().default(DEFAULT_RESPONSE_THRESHOLDS.wordCountForDetailedResponse),
  detailedResponseScore: z.number().min(0).max(1).default(DEFAULT_RESPONSE_THRESHOLDS.detailedResponseScore),
  minWordLengthForAgreement: z.number().int().positive().default(DEFAULT_RESPONSE_THRESHOLDS.minWordLengthForAgreement),
}).strict();

export type ResponseAnalysisThresholds = z.infer<typeof ResponseAnalysisThresholdsSchema>;

/**
 * Agreement score calculation parameters
 */
export const AgreementScoreParamsSchema = z.object({
  baseScore: z.number().min(0).max(1).default(DEFAULT_AGREEMENT_PARAMS.baseScore),
  maxBonus: z.number().min(0).max(1).default(DEFAULT_AGREEMENT_PARAMS.maxBonus),
  singleResponseScore: z.number().min(0).max(1).default(DEFAULT_AGREEMENT_PARAMS.singleResponseScore),
}).strict();

export type AgreementScoreParams = z.infer<typeof AgreementScoreParamsSchema>;

/**
 * Cascading confidence configuration for early exit
 */
export const CascadingConfidenceConfigSchema = z.object({
  enabled: z.boolean().default(DEFAULT_CASCADING_CONFIDENCE.enabled),
  threshold: z.number().min(0).max(1).default(DEFAULT_CASCADING_CONFIDENCE.threshold),
  minProviders: z.number().int().min(1).max(10).default(DEFAULT_CASCADING_CONFIDENCE.minProviders),
}).strict();

export type CascadingConfidenceConfig = z.infer<typeof CascadingConfidenceConfigSchema>;

/**
 * High-confidence phrases that increase confidence score
 */
export const HighConfidencePhrasesSchema = z.array(z.string()).default([
  'definitely',
  'certainly',
  'absolutely',
  'clearly',
  'undoubtedly',
  'without doubt',
  'confident',
  'sure',
  'certain',
  'positive',
  'guaranteed',
  'unquestionably',
]);

/**
 * Low-confidence phrases that decrease confidence score
 */
export const LowConfidencePhrasesSchema = z.array(z.string()).default([
  'maybe',
  'perhaps',
  'possibly',
  'might',
  'could be',
  'not sure',
  'uncertain',
  'unclear',
  'unsure',
  'i think',
  'i believe',
  'seems like',
  'appears to',
  'might be',
  'could possibly',
]);

/**
 * Complete confidence configuration
 * INV-CONF-001: Confidence scores MUST be in range [0, 1]
 * INV-CONF-002: Provider confidence scores MUST preserve original source metadata
 * INV-CONF-003: Cascading confidence threshold MUST be configurable per discussion
 */
export const ConfidenceConfigSchema = z.object({
  markers: ConfidenceMarkerScoresSchema.default({}),
  heuristics: ConfidenceHeuristicScoresSchema.default({}),
  responseAnalysis: ResponseAnalysisThresholdsSchema.default({}),
  agreement: AgreementScoreParamsSchema.default({}),
  cascading: CascadingConfidenceConfigSchema.default({}),
  highConfidencePhrases: HighConfidencePhrasesSchema,
  lowConfidencePhrases: LowConfidencePhrasesSchema,
}).strict();

export type ConfidenceConfig = z.infer<typeof ConfidenceConfigSchema>;

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = ConfidenceConfigSchema.parse({});

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export function validateConfidenceConfig(data: unknown): ConfidenceConfig {
  return ConfidenceConfigSchema.parse(data);
}

export function safeValidateConfidenceConfig(data: unknown): {
  success: boolean;
  data?: ConfidenceConfig;
  error?: z.ZodError;
} {
  const result = ConfidenceConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get confidence score from heuristic phrase count
 */
export function getHeuristicScore(
  highPhraseCount: number,
  lowPhraseCount: number,
  config: ConfidenceHeuristicScores = DEFAULT_HEURISTIC_SCORES
): number {
  const netConfidence = highPhraseCount - lowPhraseCount;

  if (netConfidence >= 2) return config.strongPositive;
  if (netConfidence === 1) return config.positive;
  if (netConfidence === 0) return config.neutral;
  if (netConfidence === -1) return config.negative;
  return config.strongNegative;
}

/**
 * Calculate agreement score between responses
 */
export function calculateAgreementScore(
  sharedWords: number,
  totalWords: number,
  responseCount: number,
  config: AgreementScoreParams = DEFAULT_AGREEMENT_PARAMS
): number {
  if (responseCount <= 1) return config.singleResponseScore;
  if (totalWords === 0) return config.baseScore;

  const ratio = sharedWords / totalWords;
  return config.baseScore + ratio * config.maxBonus;
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const ConfidenceErrorCodes = {
  INVALID_SCORE_RANGE: 'CONF_INVALID_SCORE_RANGE',
  MISSING_CONFIG: 'CONF_MISSING_CONFIG',
  THRESHOLD_EXCEEDED: 'CONF_THRESHOLD_EXCEEDED',
} as const;
```

#### New File: `packages/contracts/src/confidence/v1/index.ts`

```typescript
/**
 * Confidence Scoring Contracts v1
 *
 * @packageDocumentation
 */

export {
  // Constants
  DEFAULT_MARKER_SCORES,
  DEFAULT_HEURISTIC_SCORES,
  DEFAULT_RESPONSE_THRESHOLDS,
  DEFAULT_AGREEMENT_PARAMS,
  DEFAULT_CASCADING_CONFIDENCE,
  DEFAULT_CONFIDENCE_CONFIG,

  // Schemas
  ConfidenceMarkerScoresSchema,
  ConfidenceHeuristicScoresSchema,
  ResponseAnalysisThresholdsSchema,
  AgreementScoreParamsSchema,
  CascadingConfidenceConfigSchema,
  HighConfidencePhrasesSchema,
  LowConfidencePhrasesSchema,
  ConfidenceConfigSchema,

  // Types
  type ConfidenceMarkerScores,
  type ConfidenceHeuristicScores,
  type ResponseAnalysisThresholds,
  type AgreementScoreParams,
  type CascadingConfidenceConfig,
  type ConfidenceConfig,

  // Validation
  validateConfidenceConfig,
  safeValidateConfidenceConfig,

  // Helpers
  getHeuristicScore,
  calculateAgreementScore,

  // Error codes
  ConfidenceErrorCodes,
} from './schema.js';
```

---

### 2.4 R7: Provider-Specific Rate Limiting

**Goal**: Move rate limits to provider configuration.

#### New File: `packages/contracts/src/provider/v1/rate-config.ts`

```typescript
/**
 * Provider Rate Limit Configuration Contracts v1
 *
 * Per-provider rate limiting configuration.
 * Replaces global 60 RPM limit with provider-specific settings.
 *
 * @module @defai.digital/contracts/provider/v1/rate-config
 */

import { z } from 'zod';
import { PROVIDER_IDS, RATE_LIMIT_RPM_DEFAULT, RATE_LIMIT_TPM_DEFAULT } from '../../constants.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Backoff strategies for rate limiting */
export const BACKOFF_STRATEGIES = ['linear', 'exponential', 'fibonacci'] as const;

/** Default rate limit configurations per provider */
export const DEFAULT_PROVIDER_RATE_LIMITS: Record<string, ProviderRateLimitConfig> = {
  claude: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    burstMultiplier: 1.5,
    maxConcurrent: 3,
    backoffStrategy: 'exponential',
  },
  gemini: {
    requestsPerMinute: 300,
    tokensPerMinute: 1000000,
    burstMultiplier: 2.0,
    maxConcurrent: 10,
    backoffStrategy: 'exponential',
  },
  codex: {
    requestsPerMinute: 60,
    tokensPerMinute: 150000,
    burstMultiplier: 1.5,
    maxConcurrent: 5,
    backoffStrategy: 'exponential',
  },
  qwen: {
    requestsPerMinute: 120,
    tokensPerMinute: 200000,
    burstMultiplier: 1.5,
    maxConcurrent: 5,
    backoffStrategy: 'exponential',
  },
  glm: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    burstMultiplier: 1.5,
    maxConcurrent: 3,
    backoffStrategy: 'linear',
  },
  grok: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    burstMultiplier: 1.5,
    maxConcurrent: 3,
    backoffStrategy: 'exponential',
  },
} as const;

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Rate limit configuration for a single provider
 * INV-RATE-001: Rate limiters MUST be scoped per provider
 */
export const ProviderRateLimitConfigSchema = z.object({
  /** Maximum requests per minute */
  requestsPerMinute: z.number().int().min(1).max(1000).default(RATE_LIMIT_RPM_DEFAULT),

  /** Maximum tokens per minute (optional) */
  tokensPerMinute: z.number().int().min(1000).optional().default(RATE_LIMIT_TPM_DEFAULT),

  /** Burst multiplier (1.0 = no burst allowed) */
  burstMultiplier: z.number().min(1).max(5).default(1.5),

  /** Maximum concurrent requests */
  maxConcurrent: z.number().int().min(1).max(50).default(5),

  /** Backoff strategy when rate limited */
  backoffStrategy: z.enum(BACKOFF_STRATEGIES).default('exponential'),

  /** Initial backoff delay in ms */
  initialBackoffMs: z.number().int().min(100).max(10000).default(1000),

  /** Maximum backoff delay in ms */
  maxBackoffMs: z.number().int().min(1000).max(60000).default(30000),

  /** Queue size for pending requests */
  queueSize: z.number().int().min(10).max(1000).default(100),

  /** Queue timeout in ms */
  queueTimeoutMs: z.number().int().min(1000).max(120000).default(30000),
}).strict();

export type ProviderRateLimitConfig = z.infer<typeof ProviderRateLimitConfigSchema>;

/**
 * Session-level quota configuration
 * INV-RATE-002: Session-level quotas MUST not exceed provider limits
 */
export const SessionQuotaConfigSchema = z.object({
  /** Maximum requests per session */
  maxRequestsPerSession: z.number().int().min(1).optional(),

  /** Maximum tokens per session */
  maxTokensPerSession: z.number().int().min(100).optional(),

  /** Session timeout in ms */
  sessionTimeoutMs: z.number().int().min(60000).default(3600000),

  /** Warn at this percentage of quota */
  warnThreshold: z.number().min(0).max(1).default(0.8),
}).strict();

export type SessionQuotaConfig = z.infer<typeof SessionQuotaConfigSchema>;

/**
 * Complete rate limiting registry configuration
 */
export const RateLimitRegistryConfigSchema = z.object({
  /** Per-provider configurations */
  providers: z.record(z.string(), ProviderRateLimitConfigSchema).default({}),

  /** Session quota (optional) */
  sessionQuota: SessionQuotaConfigSchema.optional(),

  /** Global fallback configuration */
  globalFallback: ProviderRateLimitConfigSchema.default({}),

  /** Enable per-provider isolation */
  enableProviderIsolation: z.boolean().default(true),

  /** Enable session-level tracking */
  enableSessionTracking: z.boolean().default(false),
}).strict();

export type RateLimitRegistryConfig = z.infer<typeof RateLimitRegistryConfigSchema>;

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Get rate limit config for a provider with fallback
 */
export function getProviderRateLimit(
  providerId: string,
  registry?: RateLimitRegistryConfig
): ProviderRateLimitConfig {
  // Check custom config first
  if (registry?.providers[providerId]) {
    return registry.providers[providerId];
  }

  // Check built-in defaults
  if (DEFAULT_PROVIDER_RATE_LIMITS[providerId]) {
    return DEFAULT_PROVIDER_RATE_LIMITS[providerId] as ProviderRateLimitConfig;
  }

  // Use global fallback
  return registry?.globalFallback ?? ProviderRateLimitConfigSchema.parse({});
}

/**
 * Create default registry with all known providers
 */
export function createDefaultRateLimitRegistry(): RateLimitRegistryConfig {
  return {
    providers: { ...DEFAULT_PROVIDER_RATE_LIMITS } as Record<string, ProviderRateLimitConfig>,
    globalFallback: ProviderRateLimitConfigSchema.parse({}),
    enableProviderIsolation: true,
    enableSessionTracking: false,
  };
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export function validateProviderRateLimitConfig(data: unknown): ProviderRateLimitConfig {
  return ProviderRateLimitConfigSchema.parse(data);
}

export function safeValidateProviderRateLimitConfig(data: unknown): {
  success: boolean;
  data?: ProviderRateLimitConfig;
  error?: z.ZodError;
} {
  const result = ProviderRateLimitConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const ProviderRateLimitErrorCodes = {
  RATE_LIMIT_EXCEEDED: 'PROV_RATE_LIMIT_EXCEEDED',
  QUEUE_FULL: 'PROV_QUEUE_FULL',
  QUEUE_TIMEOUT: 'PROV_QUEUE_TIMEOUT',
  SESSION_QUOTA_EXCEEDED: 'PROV_SESSION_QUOTA_EXCEEDED',
  PROVIDER_NOT_CONFIGURED: 'PROV_NOT_CONFIGURED',
} as const;
```

---

## 3. P1: Next Sprint Implementation

### 3.1 R3: Pre-Execution Ability Validation

**File**: `packages/core/agent-domain/src/executor.ts`

Add before workflow execution:

```typescript
/**
 * Validate that required abilities are available before execution
 */
async validateRequiredAbilities(
  agentId: string,
  requiredAbilities: string[],
  executionId: string
): Promise<{ valid: boolean; missing: string[] }> {
  if (!requiredAbilities || requiredAbilities.length === 0) {
    return { valid: true, missing: [] };
  }

  const availableAbilities = await this.abilityInjector.listAbilities(agentId);
  const availableIds = availableAbilities.map(a => a.id);
  const missing = requiredAbilities.filter(id => !availableIds.includes(id));

  if (missing.length > 0) {
    // Emit failure event
    const event = createAbilityInjectionEvent({
      executionId,
      agentId,
      task: 'pre-execution validation',
      requestedAbilities: requiredAbilities,
      resolvedAbilities: availableIds.filter(id => requiredAbilities.includes(id)),
      missingAbilities: missing,
      status: 'failed',
      durationMs: 0,
      error: {
        code: 'ABILITY_VALIDATION_FAILED',
        message: `Missing required abilities: ${missing.join(', ')}`,
      },
    });
    this.trace?.emit(event.type, event);

    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}
```

### 3.2 R6: Centralize Agent Scoring Weights

#### New File: `packages/contracts/src/agent/v1/scoring.ts`

```typescript
/**
 * Agent Selection Scoring Contracts v1
 *
 * Centralized scoring weights for agent selection algorithm.
 * Consolidates values from selector.ts and selection-service.ts.
 *
 * @module @defai.digital/contracts/agent/v1/scoring
 */

import { z } from 'zod';

// =============================================================================
// DEFAULT WEIGHTS
// =============================================================================

export const DEFAULT_SCORING_WEIGHTS = {
  // Positive signals
  exactExampleMatch: 0.6,
  substringExampleMatch: 0.4,
  primaryIntentMatch: 0.3,
  requiredCapabilityFullMatch: 0.25,
  expertiseMatch: 0.15,
  keywordMatch: 0.15,
  roleMatch: 0.1,
  partialCapabilityWeight: 0.1,
  teamBonus: 0.1,
  descriptionWordMatch: 0.05,

  // Negative signals
  notForTaskPenalty: -0.5,
  redirectPenalty: -0.5,
  negativeIntentPenalty: -0.3,
  antiKeywordPenalty: -0.2,

  // Limits
  descriptionWordMax: 5,
  minConfidence: 0.1,
  fallbackConfidence: 0.5,
} as const;

// =============================================================================
// SCHEMA
// =============================================================================

export const AgentScoringWeightsSchema = z.object({
  // Positive signals
  exactExampleMatch: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.exactExampleMatch),
  substringExampleMatch: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.substringExampleMatch),
  primaryIntentMatch: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.primaryIntentMatch),
  requiredCapabilityFullMatch: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.requiredCapabilityFullMatch),
  expertiseMatch: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.expertiseMatch),
  keywordMatch: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.keywordMatch),
  roleMatch: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.roleMatch),
  partialCapabilityWeight: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.partialCapabilityWeight),
  teamBonus: z.number().min(0).max(2).default(DEFAULT_SCORING_WEIGHTS.teamBonus),
  descriptionWordMatch: z.number().min(0).max(1).default(DEFAULT_SCORING_WEIGHTS.descriptionWordMatch),

  // Negative signals
  notForTaskPenalty: z.number().min(-2).max(0).default(DEFAULT_SCORING_WEIGHTS.notForTaskPenalty),
  redirectPenalty: z.number().min(-2).max(0).default(DEFAULT_SCORING_WEIGHTS.redirectPenalty),
  negativeIntentPenalty: z.number().min(-2).max(0).default(DEFAULT_SCORING_WEIGHTS.negativeIntentPenalty),
  antiKeywordPenalty: z.number().min(-2).max(0).default(DEFAULT_SCORING_WEIGHTS.antiKeywordPenalty),

  // Limits
  descriptionWordMax: z.number().int().min(1).max(20).default(DEFAULT_SCORING_WEIGHTS.descriptionWordMax),
  minConfidence: z.number().min(0).max(1).default(DEFAULT_SCORING_WEIGHTS.minConfidence),
  fallbackConfidence: z.number().min(0).max(1).default(DEFAULT_SCORING_WEIGHTS.fallbackConfidence),
}).strict();

export type AgentScoringWeights = z.infer<typeof AgentScoringWeightsSchema>;

export const DEFAULT_AGENT_SCORING_WEIGHTS: AgentScoringWeights = AgentScoringWeightsSchema.parse({});
```

### 3.3 R9: Workflow DAG Execution

#### New File: `packages/contracts/src/workflow/v1/dag.ts`

```typescript
/**
 * Workflow DAG Execution Contracts v1
 *
 * Dependency graph schemas for parallel workflow execution.
 *
 * @module @defai.digital/contracts/workflow/v1/dag
 */

import { z } from 'zod';

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Step dependency declaration
 * INV-WF-010: Parallelizable steps MUST NOT have implicit dependencies
 */
export const StepDependencySchema = z.object({
  stepId: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  parallelizable: z.boolean().default(false),
  timeout: z.number().int().min(1000).optional(),
});

export type StepDependency = z.infer<typeof StepDependencySchema>;

/**
 * DAG execution configuration
 * INV-WF-011: DAG execution MUST respect explicit dependsOn declarations
 */
export const DAGExecutionConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxParallelSteps: z.number().int().min(1).max(20).default(5),
  failFast: z.boolean().default(true),
  continueOnError: z.boolean().default(false),
  respectInvariants: z.boolean().default(true),
});

export type DAGExecutionConfig = z.infer<typeof DAGExecutionConfigSchema>;

export const DEFAULT_DAG_CONFIG: DAGExecutionConfig = DAGExecutionConfigSchema.parse({});
```

### 3.4 R10: Content-Addressable Caching

#### New File: `packages/contracts/src/cache/v1/schema.ts`

```typescript
/**
 * LLM Cache Contracts v1
 *
 * Content-addressable caching for deterministic LLM operations.
 *
 * @module @defai.digital/contracts/cache/v1
 */

import { z } from 'zod';

export const LLMCacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxEntries: z.number().int().min(100).max(100000).default(10000),
  ttlMs: z.number().int().min(60000).default(3600000), // 1 hour default
  onlyDeterministic: z.boolean().default(true), // Only cache temperature=0
  hashAlgorithm: z.enum(['sha256', 'sha512', 'md5']).default('sha256'),
});

export type LLMCacheConfig = z.infer<typeof LLMCacheConfigSchema>;

export const LLMCacheEntrySchema = z.object({
  key: z.string(),
  promptHash: z.string(),
  modelId: z.string(),
  temperature: z.number(),
  response: z.unknown(),
  tokenUsage: z.object({
    input: z.number(),
    output: z.number(),
  }).optional(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  hitCount: z.number().int().default(0),
});

export type LLMCacheEntry = z.infer<typeof LLMCacheEntrySchema>;
```

---

## 4. File Creation Summary

### New Files to Create

| File | Priority | Package |
|------|----------|---------|
| `packages/contracts/src/trace/v1/events.ts` | P0 | contracts |
| `packages/contracts/src/confidence/v1/schema.ts` | P0 | contracts |
| `packages/contracts/src/confidence/v1/index.ts` | P0 | contracts |
| `packages/contracts/src/provider/v1/rate-config.ts` | P0 | contracts |
| `packages/contracts/src/agent/v1/scoring.ts` | P1 | contracts |
| `packages/contracts/src/workflow/v1/dag.ts` | P1 | contracts |
| `packages/contracts/src/cache/v1/schema.ts` | P1 | contracts |

### Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `packages/contracts/src/trace/v1/index.ts` | Add event exports | P0 |
| `packages/core/agent-domain/src/executor.ts` | Add tracing methods | P0 |
| `packages/core/discussion-domain/src/confidence-extractor.ts` | Use config | P0 |
| `packages/core/resilience-domain/src/rate-limiter.ts` | Use provider config | P0 |
| `packages/core/agent-domain/src/selector.ts` | Use scoring weights | P1 |
| `packages/core/workflow-engine/src/runner.ts` | Add DAG option | P1 |

---

## 5. Migration Checklist

### P0 Completion Criteria

- [ ] All new contract files created and exported
- [ ] Executor emits template resolution events
- [ ] Ability injection failures are traced
- [ ] Confidence extractor uses config from contracts
- [ ] Rate limiter uses per-provider config
- [ ] All tests pass
- [ ] `pnpm typecheck` passes
- [ ] `pnpm deps:check` passes

### P1 Completion Criteria

- [ ] Pre-execution ability validation implemented
- [ ] Scoring weights centralized and configurable
- [ ] DAG execution opt-in available
- [ ] LLM cache implemented for temperature=0 calls
- [ ] Integration tests for new features
- [ ] Performance benchmarks documented

---

## 6. Testing Requirements

### Contract Tests

```typescript
// tests/contract/confidence-config.test.ts
describe('ConfidenceConfigSchema', () => {
  it('should accept valid config', () => {
    const config = validateConfidenceConfig({
      markers: { high: 0.95, medium: 0.5, low: 0.2 },
    });
    expect(config.markers.high).toBe(0.95);
  });

  it('should use defaults for missing fields', () => {
    const config = validateConfidenceConfig({});
    expect(config.markers.high).toBe(0.9);
  });

  it('should reject scores outside [0, 1]', () => {
    expect(() => validateConfidenceConfig({
      markers: { high: 1.5 },
    })).toThrow();
  });
});
```

### Integration Tests

```typescript
// tests/integration/template-tracing.test.ts
describe('Template Resolution Tracing', () => {
  it('should emit events for each variable', async () => {
    const events: ExtendedTraceEvent[] = [];
    const executor = createAgentExecutor({
      onTraceEvent: (e) => events.push(e),
    });

    await executor.execute({
      prompt: 'Hello {{name}}, your task is {{task}}',
      context: { name: 'Alice', task: 'review' },
    });

    const varEvents = events.filter(e => e.type === 'template.variable.resolved');
    expect(varEvents).toHaveLength(2);
    expect(varEvents[0].variableKey).toBe('name');
    expect(varEvents[1].variableKey).toBe('task');
  });
});
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-25 | Claude | Initial implementation spec |
