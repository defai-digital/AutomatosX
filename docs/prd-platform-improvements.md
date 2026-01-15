# PRD: AutomatosX Platform Improvements
## Debugging Confidence, Code Quality, and Performance Optimization

**Version**: 1.0
**Date**: 2025-12-25
**Status**: Draft for Review
**Author**: Multi-Model Synthesis (Claude, Gemini, Grok)

---

## Executive Summary

This PRD addresses three critical areas identified through comprehensive codebase analysis and multi-model discussion:

1. **Debugging Confidence & Observability**: Improve agent execution visibility and debugging capabilities
2. **Code Quality**: Reduce hardcoding, improve configurability, follow best practices
3. **Performance & Parallelization**: Reduce bottlenecks and improve parallel execution

The recommendations are prioritized by impact and effort, with a phased implementation plan.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current State Analysis](#2-current-state-analysis)
3. [Recommendations](#3-recommendations)
4. [Implementation Phases](#4-implementation-phases)
5. [Technical Specifications](#5-technical-specifications)
6. [Success Metrics](#6-success-metrics)
7. [Appendix: Hardcoded Values Inventory](#appendix-hardcoded-values-inventory)

---

## 1. Problem Statement

### 1.1 Debugging Confidence
- Template variable substitution is silent—developers cannot trace what values were resolved
- Ability injection failures are swallowed silently, causing subtle behavioral drift
- No structured logging framework for step-level execution context
- Trace events lack sufficient metadata for root cause analysis

### 1.2 Code Quality
- 50+ hardcoded confidence scores scattered across files (0.9, 0.6, 0.3, 0.85, 0.75, etc.)
- 20+ hardcoded temperature values (0.7, 0.5, 0.3)
- Scoring weights duplicated in `selector.ts` and `selection-service.ts`
- Global rate limit (60 RPM) doesn't account for provider-specific quotas
- Magic numbers in text filtering (word length > 2, > 4) without documentation

### 1.3 Performance Bottlenecks
- Workflow engine executes steps sequentially (INV-WF-001) even when parallelizable
- Global rate limiter constrains all providers to 60 RPM
- No content-addressable caching for deterministic operations
- Process manager spawns new process per provider call (no pooling)

---

## 2. Current State Analysis

### 2.1 Architecture Health Score: 44/100

| Component | Score | Issues |
|-----------|-------|--------|
| `agent-domain/executor.ts` | 35 | 4 warnings (silent failures, missing traces) |
| `resilience-domain/rate-limiter.ts` | 50 | 3 warnings (global limits, no provider isolation) |
| `workflow-engine/runner.ts` | 55 | 2 warnings (sequential execution, no DAG) |
| `discussion-domain/confidence-extractor.ts` | 45 | 2 warnings (hardcoded thresholds) |

### 2.2 Parallelization Patterns

| Component | Pattern | Parallel? | Bottleneck |
|-----------|---------|-----------|------------|
| Discussion Patterns | Promise.all | ✅ Yes | Global rate limiter (60 RPM) |
| Workflow Steps | Sequential loop | ❌ No | INV-WF-001 constraint |
| Agent Parallel Steps | DAG + Promise.race | ✅ Yes (5 concurrent) | Config limit |
| Provider Calls | Single process | ❌ No | CLI spawn overhead |
| Rate Limiting | Token bucket | Queue-based | Queue size (100) |

### 2.3 Hardcoded Values Summary

| Category | Count | Files Affected | Severity |
|----------|-------|----------------|----------|
| Confidence scores | 25+ | 5 files | High |
| Temperature values | 12+ | 8 files | Medium |
| Scoring weights | 15+ | 2 files | High |
| Timeout values | 20+ | 6 files | Low (mostly in constants) |
| Text filtering | 8+ | 3 files | Low |

---

## 3. Recommendations

### 3.1 Debugging Confidence & Observability

#### R1: Trace Contract Schema Enhancement (P0)
**Impact**: High | **Effort**: Low

Define rigorous Zod schemas for trace events that capture execution context:

```typescript
// packages/contracts/src/trace/v1/events.ts
export const TemplateResolutionEventSchema = z.object({
  type: z.literal('template.variable.resolved'),
  stepId: z.string(),
  variableKey: z.string(),
  resolvedValue: z.unknown(),
  source: z.enum(['context', 'input', 'default', 'fallback']),
  timestamp: z.string().datetime(),
});

export const AbilityInjectionEventSchema = z.object({
  type: z.literal('ability.injection.result'),
  agentId: z.string(),
  task: z.string(),
  requestedAbilities: z.array(z.string()),
  resolvedAbilities: z.array(z.string()),
  missingAbilities: z.array(z.string()),
  status: z.enum(['success', 'partial', 'failed']),
});
```

#### R2: Structured Template Substitution Logging (P0)
**Impact**: High | **Effort**: Low

Add trace events for every variable resolution in `executor.ts`:

```typescript
// packages/core/agent-domain/src/executor.ts
private resolveTemplate(template: string, context: ExecutionContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = context.variables[key] ?? context.input[key] ?? '';
    const source = context.variables[key] ? 'context'
      : context.input[key] ? 'input' : 'fallback';

    this.trace.emit('template.variable.resolved', {
      stepId: context.currentStepId,
      variableKey: key,
      resolvedValue: value,
      source,
    });

    return String(value);
  });
}
```

#### R3: Pre-Execution Ability Validation (P1)
**Impact**: High | **Effort**: Low

Validate required abilities before workflow starts:

```typescript
// packages/core/agent-domain/src/executor.ts
async validateAbilities(agentId: string, requiredAbilities: string[]): Promise<ValidationResult> {
  const resolved = await this.abilityInjector.resolve(agentId);
  const missing = requiredAbilities.filter(a => !resolved.includes(a));

  if (missing.length > 0) {
    throw new AgentError({
      code: 'ABILITY_MISSING',
      message: `Missing required abilities: ${missing.join(', ')}`,
      retryable: false,
    });
  }

  return { resolved, missing: [] };
}
```

#### R4: Time-Travel Debugging CLI (P3)
**Impact**: Medium | **Effort**: High

Implement `ax debug replay` command:

```bash
# Replay execution from a specific step
ax debug replay <traceId> --step <stepId>

# Show context snapshot at failure point
ax debug context <traceId> --at-failure
```

---

### 3.2 Code Quality & Configuration

#### R5: Externalize Confidence Thresholds (P0)
**Impact**: High | **Effort**: Low

Create centralized confidence configuration:

```typescript
// packages/contracts/src/confidence/v1/schema.ts
export const ConfidenceThresholdsSchema = z.object({
  markers: z.object({
    high: z.number().min(0).max(1).default(0.9),
    medium: z.number().min(0).max(1).default(0.6),
    low: z.number().min(0).max(1).default(0.3),
  }),
  heuristics: z.object({
    strongPositive: z.number().default(0.85),  // 2+ high-confidence phrases
    positive: z.number().default(0.75),         // 1 high-confidence phrase
    neutral: z.number().default(0.6),
    negative: z.number().default(0.45),         // 1 low-confidence phrase
    strongNegative: z.number().default(0.3),    // 2+ low-confidence phrases
  }),
  responseLength: z.object({
    wordThreshold: z.number().default(200),
    detailedScore: z.number().default(0.7),
  }),
});

export const DEFAULT_CONFIDENCE_THRESHOLDS = ConfidenceThresholdsSchema.parse({});
```

#### R6: Centralize Agent Scoring Weights (P1)
**Impact**: High | **Effort**: Medium

Consolidate scattered scoring weights:

```typescript
// packages/contracts/src/agent/v1/scoring.ts
export const AgentScoringWeightsSchema = z.object({
  // Positive signals
  exactExampleMatch: z.number().default(0.6),
  substringExampleMatch: z.number().default(0.4),
  primaryIntentMatch: z.number().default(0.3),
  requiredCapabilityFullMatch: z.number().default(0.25),
  expertiseMatch: z.number().default(0.15),
  keywordMatch: z.number().default(0.15),
  roleMatch: z.number().default(0.1),
  partialCapabilityMatch: z.number().default(0.1),
  teamBonus: z.number().default(0.1),
  descriptionWordMatch: z.number().default(0.05),
  descriptionWordMax: z.number().int().default(5),

  // Negative signals
  notForTaskPenalty: z.number().default(-0.5),
  redirectPenalty: z.number().default(-0.5),
  negativeIntentPenalty: z.number().default(-0.3),
  antiKeywordPenalty: z.number().default(-0.2),

  // Thresholds
  minConfidence: z.number().default(0.1),
  fallbackConfidence: z.number().default(0.5),
});
```

#### R7: Provider-Specific Rate Limiting (P0)
**Impact**: High | **Effort**: Medium

Move rate limits to provider configuration:

```typescript
// packages/contracts/src/provider/v1/schema.ts
export const ProviderRateLimitSchema = z.object({
  requestsPerMinute: z.number().default(60),
  tokensPerMinute: z.number().optional(),
  burstMultiplier: z.number().min(1).max(5).default(1.5),
  maxConcurrent: z.number().default(5),
  backoffStrategy: z.enum(['linear', 'exponential', 'fibonacci']).default('exponential'),
});

// In bootstrap.ts PROVIDER_CONFIGS
const PROVIDER_CONFIGS = {
  claude: {
    rateLimit: { requestsPerMinute: 60, maxConcurrent: 3 },
  },
  gemini: {
    rateLimit: { requestsPerMinute: 300, maxConcurrent: 10 },
  },
  // ...
};
```

#### R8: Temperature Configuration by Pattern (P2)
**Impact**: Medium | **Effort**: Low

Centralize temperature defaults:

```typescript
// packages/contracts/src/discussion/v1/temperatures.ts
export const DiscussionTemperaturesSchema = z.object({
  synthesis: z.number().min(0).max(2).default(0.7),
  voting: z.number().min(0).max(2).default(0.5),
  moderator: z.number().min(0).max(2).default(0.5),
  codeReview: z.number().min(0).max(2).default(0.3),
  creative: z.number().min(0).max(2).default(0.9),
});
```

---

### 3.3 Performance & Parallelization

#### R9: Workflow DAG Execution (P1)
**Impact**: High | **Effort**: High

Implement opt-in parallel workflow execution:

```typescript
// packages/contracts/src/workflow/v1/schema.ts
export const WorkflowStepSchema = z.object({
  stepId: z.string(),
  name: z.string(),
  type: z.enum(['prompt', 'tool', 'conditional', 'loop', 'parallel', 'delegate']),
  dependsOn: z.array(z.string()).optional(), // Explicit dependencies
  parallelizable: z.boolean().default(false), // Opt-in parallel
  // ...
});

// packages/core/workflow-engine/src/dag-runner.ts
export class DAGWorkflowRunner {
  async execute(workflow: Workflow, context: ExecutionContext): Promise<WorkflowResult> {
    const graph = this.buildDependencyGraph(workflow.steps);
    const layers = this.topologicalSort(graph);

    for (const layer of layers) {
      if (layer.every(s => s.parallelizable)) {
        await Promise.all(layer.map(step => this.executeStep(step, context)));
      } else {
        for (const step of layer) {
          await this.executeStep(step, context);
        }
      }
    }
  }
}
```

#### R10: Content-Addressable Caching (P1)
**Impact**: High | **Effort**: Medium

Cache deterministic LLM operations:

```typescript
// packages/core/memory-domain/src/llm-cache.ts
export class LLMCache {
  private computeKey(input: LLMRequest): string {
    return createHash('sha256')
      .update(JSON.stringify({
        prompt: input.prompt,
        model: input.model,
        temperature: input.temperature,
        // Exclude non-deterministic fields
      }))
      .digest('hex');
  }

  async getOrCompute(
    input: LLMRequest,
    compute: () => Promise<LLMResponse>
  ): Promise<LLMResponse> {
    const key = this.computeKey(input);
    const cached = await this.store.get(key);

    if (cached && input.temperature === 0) { // Only cache deterministic calls
      return cached;
    }

    const result = await compute();
    await this.store.set(key, result, { ttl: this.config.cacheTtlMs });
    return result;
  }
}
```

#### R11: BudgetPolicy Contract (P1)
**Impact**: Medium | **Effort**: Medium

Add cost governance before parallel fan-out:

```typescript
// packages/contracts/src/governance/v1/budget.ts
export const BudgetPolicySchema = z.object({
  maxTokensPerExecution: z.number().optional(),
  maxCostPerExecution: z.number().optional(), // In dollars
  maxParallelCalls: z.number().default(5),
  warnThreshold: z.number().min(0).max(1).default(0.8),
  enforceStrict: z.boolean().default(false),
});

// packages/core/workflow-engine/src/budget-checker.ts
export class BudgetChecker {
  async checkBeforeFanOut(
    steps: WorkflowStep[],
    policy: BudgetPolicy
  ): Promise<BudgetCheckResult> {
    const estimatedTokens = steps.reduce((sum, s) => sum + this.estimateTokens(s), 0);

    if (policy.maxTokensPerExecution && estimatedTokens > policy.maxTokensPerExecution) {
      return { allowed: false, reason: 'EXCEEDS_TOKEN_LIMIT', estimated: estimatedTokens };
    }

    return { allowed: true };
  }
}
```

#### R12: Rate Limiter Architectural Refactor (P2)
**Impact**: High | **Effort**: Medium

Move rate limiting to cross-cutting concern:

```typescript
// packages/core/cross-cutting/src/rate-limiter-registry.ts
export class RateLimiterRegistry {
  private limiters: Map<string, TokenBucketRateLimiter> = new Map();

  getLimiter(providerId: string, config: ProviderRateLimit): TokenBucketRateLimiter {
    if (!this.limiters.has(providerId)) {
      this.limiters.set(providerId, new TokenBucketRateLimiter({
        refillRate: config.requestsPerMinute / 60,
        maxTokens: config.requestsPerMinute * config.burstMultiplier,
        tokensPerRequest: 1,
      }));
    }
    return this.limiters.get(providerId)!;
  }

  // Session-level quotas
  async acquireWithSession(
    providerId: string,
    sessionId: string
  ): Promise<RateLimitResult> {
    const providerLimiter = this.getLimiter(providerId);
    const sessionLimiter = this.getSessionLimiter(sessionId);

    const [providerResult, sessionResult] = await Promise.all([
      providerLimiter.acquire(),
      sessionLimiter.acquire(),
    ]);

    return this.mergeResults(providerResult, sessionResult);
  }
}
```

---

## 4. Implementation Phases

### Phase 1: "Glass Box" Foundation (P0 items)
**Timeline**: Sprint 1-2
**Goal**: Establish observability and configuration foundation

| Task | Package | Owner | Est. Hours |
|------|---------|-------|-----------|
| Trace Contract Schema (R1) | contracts | TBD | 4 |
| Template Substitution Logging (R2) | agent-domain | TBD | 8 |
| Externalize Confidence (R5) | contracts + discussion-domain | TBD | 6 |
| Provider-Specific Rate Limits (R7) | contracts + resilience-domain | TBD | 12 |

**Deliverables**:
- New `packages/contracts/src/trace/v1/events.ts`
- New `packages/contracts/src/confidence/v1/schema.ts`
- Updated `packages/core/agent-domain/src/executor.ts`
- Updated `packages/core/resilience-domain/src/rate-limiter.ts`

### Phase 2: "Speed & Safety" Engine (P1 items)
**Timeline**: Sprint 3-5
**Goal**: Performance optimization and resilience

| Task | Package | Owner | Est. Hours |
|------|---------|-------|-----------|
| Pre-Execution Ability Validation (R3) | agent-domain | TBD | 6 |
| Centralize Scoring Weights (R6) | contracts + agent-domain | TBD | 8 |
| Workflow DAG Execution (R9) | workflow-engine | TBD | 24 |
| Content-Addressable Caching (R10) | memory-domain | TBD | 16 |
| BudgetPolicy Contract (R11) | contracts + guard | TBD | 12 |

**Deliverables**:
- New `packages/contracts/src/agent/v1/scoring.ts`
- New `packages/core/workflow-engine/src/dag-runner.ts`
- New `packages/core/memory-domain/src/llm-cache.ts`
- New `packages/contracts/src/governance/v1/budget.ts`

### Phase 3: Reproducibility & Resilience (P2-P3 items)
**Timeline**: Sprint 6-8
**Goal**: Long-term maintainability

| Task | Package | Owner | Est. Hours |
|------|---------|-------|-----------|
| Temperature Configuration (R8) | contracts + discussion-domain | TBD | 4 |
| Rate Limiter Refactor (R12) | cross-cutting | TBD | 16 |
| Time-Travel Debugging CLI (R4) | cli | TBD | 20 |

---

## 5. Technical Specifications

### 5.1 New Contract Files

```
packages/contracts/src/
├── confidence/
│   └── v1/
│       ├── schema.ts          # Confidence thresholds
│       └── invariants.md      # INV-CONF-001 through INV-CONF-010
├── trace/
│   └── v1/
│       └── events.ts          # Trace event schemas
├── governance/
│   └── v1/
│       └── budget.ts          # Budget policy schemas
└── agent/
    └── v1/
        └── scoring.ts         # Agent scoring weights
```

### 5.2 Invariant Additions

```markdown
# INV-CONF-001: Confidence scores MUST be in range [0, 1]
# INV-CONF-002: Provider confidence scores MUST preserve original source metadata
# INV-CONF-003: Cascading confidence threshold MUST be configurable per discussion

# INV-TRACE-010: Template resolution events MUST capture variable source
# INV-TRACE-011: Ability injection events MUST capture all missing abilities

# INV-RATE-001: Rate limiters MUST be scoped per provider
# INV-RATE-002: Session-level quotas MUST not exceed provider limits

# INV-WF-010: Parallelizable steps MUST NOT have implicit dependencies
# INV-WF-011: DAG execution MUST respect explicit dependsOn declarations
```

### 5.3 Migration Strategy

1. **Backwards Compatibility**: All new config fields have sensible defaults
2. **Gradual Rollout**: DAG execution is opt-in via `parallelizable: true`
3. **Feature Flags**: Use environment variables for new features:
   ```bash
   AX_ENABLE_DAG_EXECUTION=true
   AX_ENABLE_LLM_CACHE=true
   AX_DEBUG_TRACE_VERBOSE=true
   ```

---

## 6. Success Metrics

### 6.1 Debugging Confidence
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Mean time to debug agent failure | Unknown | < 5 min | User survey |
| Template resolution visibility | 0% | 100% | Trace event coverage |
| Silent ability failures | Unknown | 0 | Error log analysis |

### 6.2 Code Quality
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Hardcoded confidence values | 25+ | 0 | Static analysis |
| Hardcoded temperature values | 12+ | 0 | Static analysis |
| Duplicated scoring weights | 2 files | 1 file | Code review |
| Architecture health score | 44/100 | 75/100 | ax_review_analyze |

### 6.3 Performance
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Multi-step workflow latency | Sequential | -40% | Benchmark |
| Provider rate limit utilization | 60 RPM global | Per-provider | Config audit |
| Cache hit rate (deterministic ops) | 0% | > 50% | Metrics |
| Discussion round latency | Sequential | Parallel | Benchmark |

---

## Appendix: Hardcoded Values Inventory

### A.1 Confidence Scores (25+ occurrences)

| File | Line | Value | Purpose | Action |
|------|------|-------|---------|--------|
| confidence-extractor.ts | 117 | 0.9 | HIGH marker | → ConfidenceThresholdsSchema |
| confidence-extractor.ts | 124 | 0.6 | MEDIUM marker | → ConfidenceThresholdsSchema |
| confidence-extractor.ts | 131 | 0.3 | LOW marker | → ConfidenceThresholdsSchema |
| confidence-extractor.ts | 174 | 0.85 | Strong positive heuristic | → ConfidenceThresholdsSchema |
| confidence-extractor.ts | 176 | 0.75 | Positive heuristic | → ConfidenceThresholdsSchema |
| confidence-extractor.ts | 178 | 0.6 | Neutral heuristic | → ConfidenceThresholdsSchema |
| confidence-extractor.ts | 180 | 0.45 | Negative heuristic | → ConfidenceThresholdsSchema |
| confidence-extractor.ts | 182 | 0.3 | Strong negative heuristic | → ConfidenceThresholdsSchema |
| selector.ts | 130 | 0.6 | Exact example match | → AgentScoringWeightsSchema |
| selector.ts | 135 | 0.4 | Substring example match | → AgentScoringWeightsSchema |
| selector.ts | 146 | -0.5 | Not-for-task penalty | → AgentScoringWeightsSchema |
| selection-service.ts | 36 | 0.1 | MIN_CONFIDENCE_THRESHOLD | → AgentScoringWeightsSchema |
| selection-service.ts | 38 | 0.5 | FALLBACK_CONFIDENCE | → AgentScoringWeightsSchema |

### A.2 Temperature Values (12+ occurrences)

| File | Line | Value | Context | Action |
|------|------|-------|---------|--------|
| executor.ts | 78 | 0.7 | Synthesis default | → DiscussionTemperaturesSchema |
| executor.ts | 294 | 0.7 | Round-robin default | → DiscussionTemperaturesSchema |
| executor.ts | 329 | 0.5 | Voting pattern | → DiscussionTemperaturesSchema |
| synthesis.ts | 53 | 0.7 | Synthesis consensus | → DiscussionTemperaturesSchema |
| voting.ts | 187 | 0.5 | Voting consensus | → DiscussionTemperaturesSchema |
| moderator.ts | 55 | 0.5 | Moderator | → DiscussionTemperaturesSchema |
| review.ts | 216 | 0.3 | Code review | → DiscussionTemperaturesSchema |

### A.3 Rate Limiting Values

| File | Line | Value | Purpose | Action |
|------|------|-------|---------|--------|
| constants.ts | 321 | 60 | RATE_LIMIT_RPM_DEFAULT | → ProviderRateLimitSchema (per-provider) |
| constants.ts | 327 | 100000 | RATE_LIMIT_TPM_DEFAULT | → ProviderRateLimitSchema |
| rate-limiter.ts | 87 | burstMultiplier | 1.5 | → ProviderRateLimitSchema |
| constants.ts | 250 | 5 | LIMIT_PARALLEL_CONCURRENT | → ProviderRateLimitSchema |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-25 | Multi-Model Synthesis | Initial draft |

---

## Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Tech Lead | | | |
| Architecture | | | |
