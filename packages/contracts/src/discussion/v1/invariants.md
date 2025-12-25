# Discussion Domain Invariants

## Overview

The Discussion domain enables multi-model discussions where multiple LLM providers (Claude, GLM, Qwen, Gemini, Codex, Grok) collaborate on complex problems. This document defines the behavioral invariants that MUST be enforced.

## Schema Invariants

### INV-DISC-001: Pattern Determines Execution Flow

Each discussion pattern defines a specific execution flow:

- `round-robin`: Sequential responses where each model builds on previous
- `debate`: Opposing positions with designated judge
- `critique`: Propose → critique → refine cycle
- `voting`: Parallel votes with confidence scores
- `synthesis`: Parallel perspectives → final synthesis

**Enforcement**: Schema validation + executor logic

### INV-DISC-002: All Patterns Produce Final Synthesis

Regardless of pattern, every successful discussion MUST produce a `synthesis` field in the result.

**Enforcement**: DiscussionResultSchema requires non-empty `synthesis`

### INV-DISC-003: Moderator Method Requires Synthesizer

When `consensus.method` is `moderator`, the `synthesizer` provider MUST be specified.

**Enforcement**: Zod refine validation in ConsensusConfigSchema

### INV-DISC-004: Confidence Threshold Range

For voting-based consensus, `threshold` MUST be between 0 and 1 (inclusive).

**Enforcement**: Zod schema `z.number().min(0).max(1)`

### INV-DISC-005: Minimum Providers

A discussion MUST have at least 2 providers participating.

**Enforcement**: `providers.min(MIN_PROVIDERS)` where MIN_PROVIDERS=2

### INV-DISC-006: Maximum Providers

A discussion MUST NOT exceed 6 providers.

**Enforcement**: `providers.max(MAX_PROVIDERS)` where MAX_PROVIDERS=6

### INV-DISC-007: Rounds Bounds

Discussion rounds MUST be between 1 and 10 inclusive.

**Enforcement**: `z.number().int().min(1).max(MAX_ROUNDS)`

### INV-DISC-008: Debate Pattern Requires Roles

When `pattern` is `debate`, the `roles` field MUST be provided with at least proponent, opponent, and judge assignments.

**Enforcement**: Zod refine validation in DiscussStepConfigSchema

## Runtime Invariants

### INV-DISC-100: Provider Availability Check

Before starting a discussion, the system MUST verify that all specified providers are available (health check passes).

**Enforcement**: DiscussionExecutor pre-flight checks

### INV-DISC-101: Minimum Participating Providers

When `continueOnProviderFailure` is true, at least `minProviders` MUST successfully participate for the discussion to succeed.

**Enforcement**: Executor validation after each round

### INV-DISC-102: Provider Timeout Enforcement

Individual provider responses MUST timeout after `providerTimeout` milliseconds.

**Enforcement**: Executor uses AbortController with timeout

### INV-DISC-103: Round Isolation

Provider responses in a round MUST NOT affect providers still responding in the same round (for parallel patterns).

**Enforcement**: Promise.allSettled for parallel execution

### INV-DISC-104: Context Propagation

Each round MUST receive the accumulated context from previous rounds according to pattern semantics.

**Enforcement**: Pattern-specific context builders

## Business Invariants

### INV-DISC-200: Synthesis Quality

The final synthesis MUST incorporate key points from all participating providers (not just the synthesizer's perspective).

**Enforcement**: Synthesis prompt templates + manual review

### INV-DISC-201: Dissent Preservation

When `consensus.includeDissent` is true, minority opinions MUST be captured in the result.

**Enforcement**: ConsensusEngine logic

### INV-DISC-202: Voting Transparency

For voting patterns, all individual votes and confidence scores MUST be recorded in `votingResults`.

**Enforcement**: VotingResultsSchema completeness

### INV-DISC-203: Provider Strength Utilization

When possible, the synthesizer/moderator SHOULD be selected based on provider strengths for the task.

**Enforcement**: Advisory (can override via config)

## Cross-Aggregate Invariants

### INV-DISC-300: Session Association

When `sessionId` is provided, the discussion MUST be associated with the session and the session MUST exist.

**Enforcement**: Session validation before discussion start

### INV-DISC-301: Trace Events

Every discussion MUST emit trace events for: `discussion.start`, `discussion.round.start`, `discussion.round.end`, `discussion.end`.

**Enforcement**: TraceWrapper integration in executor

### INV-DISC-302: Provider Affinity Respect

If an agent has `providerAffinity` specified, discussions for that agent SHOULD prioritize those providers.

**Enforcement**: Agent-discussion integration layer

## Error Handling Invariants

### INV-DISC-400: Graceful Degradation

When a provider fails and `continueOnProviderFailure` is true, the discussion MUST continue with remaining providers.

**Enforcement**: Executor catch blocks + failedProviders tracking

### INV-DISC-401: Clear Error Codes

All discussion failures MUST use standardized error codes from `DiscussionErrorCodes`.

**Enforcement**: DiscussionErrorSchema structure

### INV-DISC-402: Retryability Indication

Error results SHOULD indicate whether the error is retryable via `error.retryable` field.

**Enforcement**: Error generation logic

## Performance Invariants

### INV-DISC-500: Parallel Execution

For `synthesis` and `voting` patterns, initial provider calls MUST execute in parallel.

**Enforcement**: Promise.all/Promise.allSettled usage

### INV-DISC-501: Duration Tracking

All rounds and the overall discussion MUST track `durationMs` for performance monitoring.

**Enforcement**: Timestamp capture in executor

## Default Behavior

### Default Providers

When no providers are specified, the system uses: `['claude', 'glm', 'qwen', 'gemini']`

- **Claude**: Synthesis and nuanced reasoning
- **GLM**: Agentic coding and cost efficiency (1/7th cost of Claude)
- **Qwen**: OCR, translation, and multilingual (29 languages)
- **Gemini**: Research and long context

### Default Pattern

When no pattern is specified, `synthesis` is used (most broadly applicable).

### Default Consensus

When no consensus method is specified, `synthesis` with Claude as synthesizer.

### Default Rounds

When rounds not specified, default is 2 (initial perspectives + cross-discussion).

---

## Recursive Discussion Invariants

### Overview

Recursive discussions allow providers to spawn sub-discussions during their response.
This enables hierarchical multi-agent collaboration with depth and budget controls.

### Depth Control Invariants (600-603)

#### INV-DISC-600: Maximum Depth Enforcement

Discussion depth MUST NOT exceed `maxDepth` configuration.

- **Enforcement**: `createChildDiscussionContext()` throws if depth >= maxDepth
- **Default**: maxDepth = 2
- **Maximum**: maxDepth = 4

#### INV-DISC-601: Circular Discussion Prevention

No discussion ID may appear twice in the discussion chain.

- **Enforcement**: `createChildDiscussionContext()` checks chain before adding
- **Error**: `DISCUSSION_CIRCULAR_DISCUSSION`

#### INV-DISC-602: Root Discussion Depth

Root discussions always have depth = 0.

- **Enforcement**: `createRootDiscussionContext()` sets depth to 0

#### INV-DISC-603: Child Depth Increment

Child discussions have depth = parent.depth + 1.

- **Enforcement**: `createChildDiscussionContext()` increments depth

### Timeout Budget Invariants (610-613)

#### INV-DISC-610: Child Timeout Budget

Child discussion timeout MUST NOT exceed parent's remaining budget.

- **Enforcement**: `createChildDiscussionContext()` calculates remaining budget
- **Formula**: child.remainingBudgetMs = parent.remainingBudgetMs - elapsedMs

#### INV-DISC-611: Synthesis Time Reserve

Minimum 10 seconds (configurable) MUST be reserved for synthesis at each level.

- **Enforcement**: `getTimeoutForLevel()` subtracts `minSynthesisMs`
- **Default**: 10000ms

#### INV-DISC-612: Total Timeout Tracking

Total timeout includes all nested discussion time.

- **Enforcement**: Context tracks `startedAt` from root discussion
- **Calculation**: elapsedMs = now - context.startedAt

#### INV-DISC-613: Timeout Strategy Consistency

Timeout strategy (fixed/cascade/budget) MUST be applied consistently across levels.

- **Enforcement**: `getTimeoutForLevel()` applies strategy uniformly

### Cost Control Invariants (620-623)

#### INV-DISC-620: Maximum Total Calls

Total provider calls across all nested discussions MUST NOT exceed `maxTotalCalls`.

- **Enforcement**: `canSpawnSubDiscussion()` checks totalCalls
- **Default**: 20 calls

#### INV-DISC-621: Cost Budget Abort

If optional `budgetUsd` is set, discussion MUST abort when exceeded.

- **Enforcement**: Executor checks cost after each provider response
- **Error**: `DISCUSSION_COST_BUDGET_EXCEEDED`

#### INV-DISC-622: Confidence Threshold Configuration

Early exit confidence threshold MUST be configurable (default 0.9).

- **Enforcement**: `CascadingConfidenceConfigSchema` validates threshold
- **Range**: 0.0 to 1.0

#### INV-DISC-623: Minimum Provider Guarantee

At least `minProviders` MUST be called regardless of early exit.

- **Enforcement**: Executor respects minProviders before early exit
- **Default**: 2 providers

### Memory Invariants (630-632)

#### INV-DISC-630: Discussion Memory Immutability

Past discussion records stored in memory MUST NOT be modified.

- **Enforcement**: Memory domain event sourcing
- **Storage**: Key = `discussion:{topic_hash}`

#### INV-DISC-631: Relevance Ranking

Past discussion queries MUST return most relevant results first.

- **Enforcement**: Memory search with similarity ranking

#### INV-DISC-632: Retention Policy

Discussions MUST be retained according to configured policy.

- **Enforcement**: Background cleanup job
- **Default**: 30 days

### Agent Participation Invariants (640-644)

#### INV-DISC-640: Agent Provider Resolution

Agent participants MUST use their configured `providerAffinity.preferred[0]` for provider selection.

- **Enforcement**: Participant resolution in executor
- **Fallback**: `claude` if no preference set
- **Schema**: `AgentProfile.providerAffinity`

#### INV-DISC-641: Agent Ability Injection

Agent participants MUST have abilities injected with max 10K tokens.

- **Enforcement**: AbilityManager.injectAbilities() call before discussion
- **Limit**: `LIMIT_ABILITY_TOKENS_AGENT = 10000`
- **Location**: Prepended to agent systemPrompt

#### INV-DISC-642: Agent Weight Multiplier

Agent responses MUST be weighted according to `agentWeightMultiplier` (default 1.5x).

- **Enforcement**: Schema validation + consensus weighting
- **Range**: 0.5 to 3.0
- **Default**: 1.5

#### INV-DISC-643: Early Exit After Minimum Providers

Early exit MUST only occur after `minProviders` have responded.

- **Enforcement**: `evaluateEarlyExit()` checks provider count
- **Default**: minProviders = 2
- **Schema**: `CascadingConfidenceConfig.minProviders`

#### INV-DISC-644: Cost Summary Inclusion

Cost summary MUST be included in discussion metadata when tracking is enabled.

- **Enforcement**: Executor populates `metadata.costSummary`
- **Schema**: `CostSummarySchema`
- **Fields**: totalCalls, totalTokens, estimatedCostUsd, byProvider

---

## Timeout Strategy Details

### Fixed Strategy

Each level gets equal timeout: `totalBudget / (maxDepth + 1)`

```
Level 0: 60s
Level 1: 60s
Level 2: 60s
Total possible: 180s
```

### Cascade Strategy (Recommended)

Each level gets half of parent: `totalBudget / 2^depth`

```
Level 0: 90s (180s / 2^0 / 2)
Level 1: 45s (180s / 2^1 / 2)
Level 2: 22.5s (180s / 2^2 / 2)
Total possible: 157.5s
```

### Budget Strategy

Weighted distribution favoring earlier levels:

```
Weights: [1.0, 0.6, 0.36] (60% decay)
Level 0: ~92s
Level 1: ~55s
Level 2: ~33s
Total possible: 180s
```
