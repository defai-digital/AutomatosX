# PRD: Resilience & Safety Features

## Overview

Add production-grade resilience patterns and safety guards to AutomatosX based on best practices analysis. These features protect against API failures, cost overruns, and runaway execution.

## Goals

1. **Resilience**: Graceful handling of provider failures
2. **Cost Control**: Prevent unexpected API cost spikes
3. **Safety**: Guard against dangerous or runaway operations
4. **Observability**: Basic metrics for monitoring

## Non-Goals

- Complex analytics dashboards
- Response caching (dangerous for AI)
- AST-based code analysis (false positives)
- Spec/code generation system

---

## Feature 1: Circuit Breaker

### Purpose
Prevent cascade failures when a provider is unhealthy.

### Behavior
- **Closed**: Normal operation, requests pass through
- **Open**: Provider failed repeatedly, reject requests immediately
- **Half-Open**: After cooldown, allow test request

### Configuration
```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening (default: 5)
  resetTimeoutMs: number;      // Time before half-open (default: 30000)
  halfOpenMaxAttempts: number; // Test requests in half-open (default: 1)
}
```

### Contract
```typescript
interface CircuitBreaker {
  state: 'closed' | 'open' | 'half-open';
  execute<T>(fn: () => Promise<T>): Promise<T>;
  recordSuccess(): void;
  recordFailure(): void;
  getStats(): CircuitBreakerStats;
}
```

---

## Feature 2: Rate Limiter

### Purpose
Prevent exceeding API rate limits and control costs.

### Behavior
- Token bucket algorithm for smooth rate limiting
- Per-provider and global limits
- Queuing with timeout for burst handling

### Configuration
```typescript
interface RateLimiterConfig {
  requestsPerMinute: number;   // Max requests per minute
  tokensPerMinute: number;     // Max tokens per minute (optional)
  maxQueueSize: number;        // Max queued requests (default: 100)
  queueTimeoutMs: number;      // Queue wait timeout (default: 30000)
}
```

### Contract
```typescript
interface RateLimiter {
  acquire(tokens?: number): Promise<void>;
  tryAcquire(tokens?: number): boolean;
  getStats(): RateLimiterStats;
}
```

---

## Feature 3: Loop Guard

### Purpose
Prevent infinite loops or runaway execution that burns resources.

### Behavior
- Track iteration count per execution context
- Warn at threshold, hard stop at limit
- Configurable per-task limits

### Configuration
```typescript
interface LoopGuardConfig {
  maxIterations: number;       // Hard limit (default: 100)
  warnAtIterations: number;    // Warning threshold (default: 50)
  maxDurationMs: number;       // Time limit (default: 300000 = 5min)
}
```

### Contract
```typescript
interface LoopGuard {
  startContext(contextId: string): void;
  checkIteration(contextId: string): LoopGuardResult;
  endContext(contextId: string): void;
}

type LoopGuardResult =
  | { status: 'ok' }
  | { status: 'warning'; iteration: number; message: string }
  | { status: 'blocked'; reason: string };
```

---

## Feature 4: Resource Limits

### Purpose
Enforce limits on tokens, time, and cost per operation.

### Configuration
```typescript
interface ResourceLimits {
  maxTokensPerRequest: number;    // Token limit per request
  maxTokensPerSession: number;    // Token limit per session
  maxDurationMs: number;          // Time limit per operation
  maxCostPerSession: number;      // Cost limit in dollars
  maxConcurrentRequests: number;  // Concurrent request limit
}
```

### Contract
```typescript
interface ResourceEnforcer {
  checkLimits(usage: ResourceUsage): ResourceCheckResult;
  recordUsage(usage: ResourceUsage): void;
  getUsage(sessionId: string): ResourceUsage;
  resetUsage(sessionId: string): void;
}

type ResourceCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string; limit: string; current: number; max: number };
```

---

## Feature 5: Basic Metrics

### Purpose
Simple observability for monitoring system health.

### Metrics Collected
- Request count (success/failure)
- Latency (p50, p95, p99)
- Token usage (input/output)
- Estimated cost
- Error rates by type

### Contract
```typescript
interface MetricsCollector {
  recordRequest(metric: RequestMetric): void;
  recordError(error: ErrorMetric): void;
  getStats(timeRange?: TimeRange): MetricsSnapshot;
  reset(): void;
}

interface MetricsSnapshot {
  requests: { total: number; success: number; failure: number };
  latency: { p50: number; p95: number; p99: number };
  tokens: { input: number; output: number; total: number };
  cost: { estimated: number };
  errors: Record<string, number>;
}
```

---

## Architecture

### Package Structure

```
packages/
├── contracts/src/
│   └── resilience/v1/
│       ├── circuit-breaker.ts
│       ├── rate-limiter.ts
│       ├── loop-guard.ts
│       ├── resource-limits.ts
│       ├── metrics.ts
│       └── index.ts
│
└── core/resilience-domain/
    ├── src/
    │   ├── circuit-breaker.ts
    │   ├── rate-limiter.ts
    │   ├── loop-guard.ts
    │   ├── resource-enforcer.ts
    │   ├── metrics-collector.ts
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

### Integration Points

1. **Provider Adapters**: Wrap provider calls with circuit breaker and rate limiter
2. **Agent Execution**: Use loop guard and resource limits
3. **CLI Commands**: Report metrics on verbose output

---

## Implementation Plan

### Phase 1: Contracts (Est: 1 session)
1. Create resilience contracts with Zod schemas
2. Define all interfaces and types
3. Export from main contracts package

### Phase 2: Core Implementation (Est: 1 session)
1. Implement circuit breaker with state machine
2. Implement token bucket rate limiter
3. Implement loop guard with context tracking
4. Implement resource enforcer
5. Implement metrics collector

### Phase 3: Integration (Est: 1 session)
1. Add resilience wrapper to provider-adapters
2. Integrate loop guard into agent-execution
3. Add metrics to CLI output

### Phase 4: Testing (Est: 1 session)
1. Contract tests for all schemas
2. Unit tests for each component
3. Integration tests for provider wrapping

---

## Success Criteria

- [ ] Circuit breaker prevents calls to failing providers
- [ ] Rate limiter respects configured limits
- [ ] Loop guard stops runaway execution
- [ ] Resource limits prevent cost overruns
- [ ] Metrics capture request/error/latency data
- [ ] All tests pass
- [ ] Build succeeds

---

## Future Considerations

- Persistent metrics storage (SQLite)
- Metrics export (Prometheus format)
- Adaptive rate limiting based on response headers
- Cost alerts and notifications
