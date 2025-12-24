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
