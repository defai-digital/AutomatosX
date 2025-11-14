# Phase 2 Week 2: Provider Implementations - READINESS & PLANNING

**Date**: 2025-11-09
**Phase**: Phase 2 - AI Provider Layer
**Week**: Week 2 - Provider Implementations
**Status**: ✅ **READY TO BEGIN** (Foundation Complete)

---

## Executive Summary

Phase 2 Week 1 foundation is complete, delivering a production-ready state machine, validation layer, and database infrastructure. Week 2 focuses on implementing concrete provider clients (Claude, Gemini, OpenAI) and the ProviderRouter that orchestrates fallback logic and request routing.

**Readiness Status**: ✅ **100% READY**
- Week 1 foundation complete (18 hours ahead of schedule)
- All dependencies in place (ReScript state machine, Zod schemas, database)
- Clear implementation path defined
- No blocking issues

---

## Week 2 Goals

### Primary Goals

1. ✅ **Foundation Ready**: Implement ProviderRouter with fallback logic
2. ⏳ **Claude Integration**: Complete ClaudeProvider with streaming support
3. ⏳ **Gemini Integration**: Complete GeminiProvider implementation
4. ⏳ **OpenAI Integration**: Start OpenAIProvider (partial implementation)

### Success Criteria

**Deliverables**:
- ProviderRouter.ts (~250 lines) - Core routing and fallback
- ClaudeProvider.ts (~150 lines) - Full implementation with streaming
- GeminiProvider.ts (~150 lines) - Full implementation
- OpenAIProvider.ts (~100 lines) - Partial implementation
- 15+ tests passing (cumulative: 47 total tests across Weeks 1-2)

**Quality Targets**:
- All providers support streaming
- Circuit breaker pattern for resilience
- Retry logic with exponential backoff
- Rate limit handling
- Comprehensive error handling
- 85%+ test coverage

---

## Week 2 Schedule (5 Days)

### Day 6 (Monday): ProviderRouter Core

**Time**: 8 hours

**Tasks**:
1. Install Provider SDKs (30 min)
   - @anthropic-ai/sdk@^0.20.0
   - @google/generative-ai@^0.5.0
   - openai@^4.28.0

2. Create ProviderRouter (4 hours)
   - Provider selection logic
   - Fallback orchestration
   - Circuit breaker integration
   - Request routing

3. Create BaseProvider abstract class (2 hours)
   - Common provider interface
   - Shared retry logic
   - Rate limit handling
   - Error normalization

4. Write ProviderRouter tests (1.5 hours)
   - Routing tests
   - Fallback tests
   - Circuit breaker tests

**Deliverables**:
- `src/providers/ProviderRouter.ts` (~250 lines)
- `src/providers/BaseProvider.ts` (~100 lines)
- `src/__tests__/providers/ProviderRouter.test.ts` (~150 lines)

---

### Day 7 (Tuesday): ClaudeProvider Implementation

**Time**: 8 hours

**Tasks**:
1. Implement ClaudeProvider (4 hours)
   - Request formatting
   - Streaming support
   - Token counting
   - Error handling

2. Add Claude-specific features (2 hours)
   - System prompts
   - Tool/function calling support
   - Vision support (if needed)

3. Write ClaudeProvider tests (2 hours)
   - Non-streaming tests
   - Streaming tests
   - Error handling tests

**Deliverables**:
- `src/providers/ClaudeProvider.ts` (~150 lines)
- `src/__tests__/providers/ClaudeProvider.test.ts` (~120 lines)

---

### Day 8 (Wednesday): GeminiProvider Implementation

**Time**: 8 hours

**Tasks**:
1. Implement GeminiProvider (4 hours)
   - Request formatting
   - Streaming support
   - Token counting
   - Error handling

2. Add Gemini-specific features (2 hours)
   - Safety settings
   - Generation config
   - Multi-modal support (if needed)

3. Write GeminiProvider tests (2 hours)
   - Non-streaming tests
   - Streaming tests
   - Error handling tests

**Deliverables**:
- `src/providers/GeminiProvider.ts` (~150 lines)
- `src/__tests__/providers/GeminiProvider.test.ts` (~120 lines)

---

### Day 9 (Thursday): OpenAIProvider & Retry Logic

**Time**: 8 hours

**Tasks**:
1. Implement OpenAIProvider (3 hours)
   - Request formatting
   - Streaming support
   - Token counting
   - Error handling

2. Enhance retry logic (3 hours)
   - Exponential backoff
   - Jitter for distributed systems
   - Per-provider retry configs
   - Retry budget tracking

3. Write OpenAIProvider tests (2 hours)
   - Basic functionality tests
   - Retry tests

**Deliverables**:
- `src/providers/OpenAIProvider.ts` (~100-150 lines)
- `src/utils/RetryUtils.ts` (~80 lines)
- `src/__tests__/providers/OpenAIProvider.test.ts` (~100 lines)

---

### Day 10 (Friday): Integration Testing & Code Review

**Time**: 8 hours

**Tasks**:
1. Integration tests (4 hours)
   - End-to-end provider flow
   - Fallback scenarios
   - Rate limit scenarios
   - Error recovery scenarios

2. Performance testing (2 hours)
   - Latency benchmarks
   - Throughput testing
   - Memory profiling

3. Code review and cleanup (2 hours)
   - Refactoring
   - Documentation
   - Error message improvements

**Deliverables**:
- `src/__tests__/providers/integration.test.ts` (~200 lines)
- `src/__tests__/providers/performance.test.ts` (~100 lines)
- Week 2 completion report

---

## Foundation Assets Available (Week 1)

### ReScript State Machine ✅

**File**: `packages/rescript-core/src/providers/ProviderStateMachine.res` (569 lines)

**Available Modules**:
```rescript
State - 8 lifecycle states
Event - 14 event types
Context - Provider tracking, metrics, retry/stream state
Transition - 25+ state transition rules
```

**Usage in Week 2**:
```typescript
import { State, Event, Context, Transition } from '../../../packages/rescript-core/src/providers/ProviderStateMachine.bs.js';

// Create context
const ctx = Context.create('claude', 'claude-3-sonnet-20240229', requestId);

// Apply events
const result = Transition.transition(ctx, Event.InitiateRequest({ ... }));
```

---

### Zod Validation Schemas ✅

**File**: `src/types/schemas/provider.schema.ts` (327 lines)

**Available Schemas**:
```typescript
ProviderRequestSchema - Validate incoming requests
ProviderResponseSchema - Validate provider responses
ProviderErrorSchema - Standardize error handling
RetryConfigSchema - Retry configuration validation
RateLimitInfoSchema - Rate limit tracking
```

**Usage in Week 2**:
```typescript
import {
  validateProviderRequest,
  validateProviderResponse,
  validateProviderError
} from '../types/schemas/provider.schema.js';

// Validate request
const validated = validateProviderRequest(request);

// Validate response
const response = validateProviderResponse(providerOutput);
```

---

### Database Infrastructure ✅

**File**: `src/migrations/009_create_provider_tables.sql` (216 lines)

**Available Tables**:
```sql
provider_logs - Complete lifecycle logging
provider_metrics - Performance analytics
provider_rate_limits - Rate limit tracking
provider_configs - Provider settings
```

**Usage in Week 2**:
```typescript
// Log request
await db.prepare(`
  INSERT INTO provider_logs (id, request_id, provider, state, request_data, ...)
  VALUES (?, ?, ?, ?, ?, ...)
`).run(...);

// Record metrics
await db.prepare(`
  INSERT INTO provider_metrics (request_id, provider, tokens, duration, ...)
  VALUES (?, ?, ?, ?, ...)
`).run(...);
```

---

## Week 2 Implementation Architecture

### Layer 1: ProviderRouter (Orchestration)

```typescript
ProviderRouter
├── Provider Selection
│   ├── Primary provider (configured)
│   └── Fallback chain (claude → gemini → openai)
├── Circuit Breaker
│   ├── Track provider failures
│   ├── Open circuit on threshold
│   └── Half-open retry after timeout
├── Request Execution
│   ├── ReScript state machine integration
│   ├── Retry with exponential backoff
│   └── Rate limit enforcement
└── Response Handling
    ├── Zod validation
    ├── Error normalization
    └── Metrics recording
```

---

### Layer 2: Provider Implementations

**BaseProvider (Abstract)**:
```typescript
abstract class BaseProvider {
  abstract execute(request: ProviderRequest): Promise<ProviderResponse>;
  abstract executeStream(request: ProviderRequest): AsyncIterator<StreamChunk>;

  // Shared functionality
  protected retry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T>
  protected checkRateLimit(): Promise<void>
  protected normalizeError(error: unknown): ProviderError
  protected recordMetrics(requestId: string, metrics: Metrics): Promise<void>
}
```

**ClaudeProvider** (extends BaseProvider):
```typescript
class ClaudeProvider extends BaseProvider {
  private client: Anthropic;

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    // 1. Format request for Claude API
    const claudeRequest = this.formatRequest(request);

    // 2. Call Claude API
    const response = await this.client.messages.create(claudeRequest);

    // 3. Parse and validate response
    return this.parseResponse(response);
  }

  async* executeStream(request: ProviderRequest): AsyncIterator<StreamChunk> {
    // 1. Format streaming request
    const claudeRequest = this.formatRequest(request, { stream: true });

    // 2. Stream from Claude API
    const stream = await this.client.messages.stream(claudeRequest);

    // 3. Yield chunks
    for await (const chunk of stream) {
      yield this.parseStreamChunk(chunk);
    }
  }
}
```

**GeminiProvider** (extends BaseProvider):
```typescript
class GeminiProvider extends BaseProvider {
  private client: GoogleGenerativeAI;

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    // Similar to Claude but with Gemini API specifics
  }

  async* executeStream(request: ProviderRequest): AsyncIterator<StreamChunk> {
    // Gemini streaming implementation
  }
}
```

**OpenAIProvider** (extends BaseProvider):
```typescript
class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    // Similar to Claude but with OpenAI API specifics
  }

  async* executeStream(request: ProviderRequest): AsyncIterator<StreamChunk> {
    // OpenAI streaming implementation
  }
}
```

---

### Layer 3: Integration Flow

**Complete Request Flow**:
```
1. HTTP Request
   ↓
2. Zod Validation (ProviderRequestSchema)
   ↓
3. ProviderRouter.execute(request)
   ├─→ Create ReScript Context
   │   ├─→ Context.create('claude', 'claude-3-sonnet', requestId)
   │   └─→ Transition to Validating state
   ├─→ Select Primary Provider (ClaudeProvider)
   ├─→ Check Circuit Breaker (open? try fallback)
   ├─→ Check Rate Limits
   ├─→ Execute with Retry
   │   ├─→ ClaudeProvider.execute(request)
   │   │   ├─→ Format for Claude API
   │   │   ├─→ Call Anthropic SDK
   │   │   └─→ Parse response
   │   ├─→ Apply ReScript Event (ReceiveResponse)
   │   └─→ Transition to Completed state
   ├─→ If Failed: Try Fallback
   │   ├─→ Apply Event (FallbackToProvider)
   │   └─→ Retry with GeminiProvider
   ├─→ Log to Database (provider_logs)
   └─→ Record Metrics (provider_metrics)
   ↓
4. Zod Validation (ProviderResponseSchema)
   ↓
5. HTTP Response
```

---

## Dependencies & Setup

### Required npm Packages

```bash
# Provider SDKs (Week 2 Day 6)
npm install @anthropic-ai/sdk@^0.20.0
npm install @google/generative-ai@^0.5.0
npm install openai@^4.28.0

# Utilities
npm install uuid@^9.0.0
npm install zod@^3.22.0  # Already installed

# Development
npm install -D @types/uuid@^9.0.0
```

### Environment Variables

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
OPENAI_API_KEY=sk-...

# Provider Configuration
DEFAULT_PROVIDER=claude
ENABLE_FALLBACK=true
FALLBACK_PROVIDERS=gemini,openai

# Rate Limits
CLAUDE_RPM=50
GEMINI_RPM=60
OPENAI_RPM=50
```

---

## Testing Strategy

### Test Categories

**Unit Tests** (20 tests):
- BaseProvider functionality (5 tests)
- ProviderRouter routing (5 tests)
- ClaudeProvider (5 tests)
- GeminiProvider (3 tests)
- OpenAIProvider (2 tests)

**Integration Tests** (10 tests):
- End-to-end request flow (3 tests)
- Fallback scenarios (3 tests)
- Retry scenarios (2 tests)
- Rate limit scenarios (2 tests)

**Performance Tests** (5 tests):
- Latency benchmarks (2 tests)
- Throughput testing (2 tests)
- Memory profiling (1 test)

**Total Week 2 Tests**: 35 tests (15+ target exceeded)

---

## Risk Assessment

### Technical Risks

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| API key security | Medium | Environment variables, never commit | ✅ Mitigated |
| Rate limit compliance | Medium | Pre-request checks, provider_rate_limits table | ✅ Mitigated |
| Streaming complexity | Medium | Async iterators, proper error handling | ⚠️ Monitor |
| Provider API changes | Low | SDK version pinning, integration tests | ✅ Mitigated |
| Circuit breaker tuning | Low | Configurable thresholds, monitoring | ⚠️ Monitor |

### Schedule Risks

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Week 1 delays | None | Week 1 complete, 18 hours ahead | ✅ No Risk |
| Provider SDK issues | Low | Well-documented SDKs, community support | ✅ Low Risk |
| Integration complexity | Low | Clear architecture, ReScript foundation ready | ✅ Low Risk |
| Testing time | Low | Comprehensive plan, automated tests | ✅ Low Risk |

**Overall Risk**: ✅ **LOW**

---

## Success Metrics

### Code Metrics

| Metric | Target | Status |
|--------|--------|--------|
| ProviderRouter LOC | ~250 | ⏳ Pending |
| ClaudeProvider LOC | ~150 | ⏳ Pending |
| GeminiProvider LOC | ~150 | ⏳ Pending |
| OpenAIProvider LOC | ~100 | ⏳ Pending |
| Total Week 2 LOC | ~650 | ⏳ Pending |
| Cumulative LOC (Weeks 1-2) | ~1,762 | ⏳ Pending |

### Quality Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Test Coverage | 85%+ | ⏳ Pending |
| Tests Passing | 15+ (Week 2) | ⏳ Pending |
| Cumulative Tests | 47 (Weeks 1-2) | ⏳ Pending |
| Build Errors | 0 | ⏳ Pending |
| Streaming Support | All providers | ⏳ Pending |

### Performance Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Response Latency (p95) | <2s | ⏳ Pending |
| First Token Latency | <500ms | ⏳ Pending |
| Fallback Latency | <3s | ⏳ Pending |
| Retry Overhead | <10% | ⏳ Pending |

---

## Week 1 → Week 2 Handoff

### What's Ready ✅

1. **ReScript State Machine**: Complete with 569 lines, 100% type-safe
2. **Zod Schemas**: 20+ validation schemas for cross-boundary safety
3. **Database Infrastructure**: 4 tables, 16 indexes, 3 analytics views
4. **Documentation**: Comprehensive daily summaries and architecture docs

### What Week 2 Builds On

1. **State Machine Integration**: ProviderRouter will use ReScript Context and Transitions
2. **Validation Layer**: All providers will use Zod schemas for request/response validation
3. **Database Logging**: Provider implementations will log to provider_logs and provider_metrics
4. **Error Handling**: Standardized errors via ProviderErrorSchema

### Dependencies Graph

```
Week 2 Dependencies on Week 1:

ProviderRouter
├── Depends on: Context (ReScript)
├── Depends on: Transition (ReScript)
├── Depends on: ProviderRequestSchema (Zod)
└── Depends on: ProviderResponseSchema (Zod)

ClaudeProvider
├── Depends on: ProviderRouter
├── Depends on: BaseProvider (Week 2)
├── Depends on: ProviderErrorSchema (Zod)
└── Depends on: provider_logs table (SQL)

GeminiProvider
├── Depends on: ProviderRouter
├── Depends on: BaseProvider (Week 2)
├── Depends on: ProviderErrorSchema (Zod)
└── Depends on: provider_logs table (SQL)

OpenAIProvider
├── Depends on: ProviderRouter
├── Depends on: BaseProvider (Week 2)
├── Depends on: ProviderErrorSchema (Zod)
└── Depends on: provider_logs table (SQL)
```

---

## Conclusion

Phase 2 Week 2 is **100% ready to begin** with a solid foundation from Week 1. The ReScript state machine, Zod validation layer, and database infrastructure provide a robust base for implementing concrete provider clients.

**Readiness Status**: ✅ **READY**
- Foundation: ✅ Complete
- Dependencies: ✅ Defined
- Architecture: ✅ Designed
- Testing Strategy: ✅ Planned
- Risk Mitigation: ✅ In Place

**Next Actions**:
1. Install provider SDKs (@anthropic-ai/sdk, @google/generative-ai, openai)
2. Implement BaseProvider abstract class
3. Implement ProviderRouter with fallback logic
4. Implement ClaudeProvider with streaming
5. Implement GeminiProvider
6. Implement OpenAIProvider (partial)
7. Write comprehensive test suite (35+ tests)

**Timeline**: 5 days (40 hours) for complete Week 2 implementation

---

**Prepared by**: AutomatosX Team
**Date**: 2025-11-09
**Version**: 1.0
**Status**: Ready for Week 2 Kickoff
