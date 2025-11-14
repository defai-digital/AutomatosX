# Iterate Mode Strategy Reference

**AutomatosX v8.0.0 - Retry Strategy Catalog**

---

## Table of Contents

1. [Overview](#overview)
2. [Built-in Strategies](#built-in-strategies)
3. [Strategy Selection Logic](#strategy-selection-logic)
4. [Strategy Comparison](#strategy-comparison)
5. [Advanced Topics](#advanced-topics)

---

## Overview

Iterate Mode uses **adaptive retry strategies** to handle workflow failures intelligently. Each strategy is designed for specific failure types and automatically adjusts workflow execution parameters.

### Key Concepts

**Strategy**: A configuration template that modifies how workflows execute
**Priority**: Numeric score (1-10) determining selection order
**Applicable Errors**: Error types that trigger this strategy
**Success History**: Tracks which strategies have worked in the past

### How Strategies Work

```
┌─────────────────────────────────────────────────┐
│  Workflow fails with specific error type        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  FailureAnalyzer classifies error               │
│  (timeout, rate_limit, network, etc.)           │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  StrategySelector matches error to strategy     │
│  - Checks applicableErrors array                │
│  - Considers success history                    │
│  - Applies priority weighting                   │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Workflow retries with new strategy config      │
└─────────────────────────────────────────────────┘
```

---

## Built-in Strategies

AutomatosX v8.0.0 includes **5 built-in strategies** designed to handle common failure scenarios.

---

### 1. Default Strategy

**Name**: `default`
**Priority**: 10 (highest)
**Applicable Errors**: None (always used first)

#### Description

Standard execution strategy with exponential backoff retries. This is the **baseline strategy** used for the first iteration of every workflow.

#### Configuration

```typescript
{
  timeout: 300000,           // 5 minutes
  retryBackoff: 'exponential',
  parallelism: 5,
  useCache: true
}
```

#### When Used

- **First iteration** of any workflow (always)
- Fallback when no specific error match found
- General-purpose retry with reasonable defaults

#### Behavior

- Executes all workflow steps with standard timeout
- Runs up to 5 parallel operations
- Enables result caching for efficiency
- Retries with exponential backoff (1s, 2s, 4s, 8s, ...)

#### Best For

- Well-behaved workflows with occasional transient errors
- Initial attempts before specialized strategies
- Workflows with good cache hit rates

---

### 2. Aggressive Timeout

**Name**: `aggressive-timeout`
**Priority**: 8
**Applicable Errors**: `timeout`, `ETIMEDOUT`, `ECONNRESET`

#### Description

Increases timeout limits for operations that are failing due to slow response times or network delays.

#### Configuration

```typescript
{
  timeout: 600000,           // 10 minutes (2x default)
  retryBackoff: 'exponential',
  parallelism: 5,
  useCache: true
}
```

#### When Used

Automatically selected when errors contain:
- "timeout"
- "ETIMEDOUT"
- "ECONNRESET"
- "timed out"

#### Behavior

- **Doubles** the timeout from 5 to 10 minutes
- Maintains parallelism for throughput
- Keeps exponential backoff pattern
- Retains cache for repeated operations

#### Best For

- Long-running AI model inference
- Slow API responses
- Network connections with high latency
- Large file processing

#### Example Scenario

```bash
# Workflow times out at 5 minutes
Iteration 1: default strategy → timeout error

# System detects "timeout" error, switches to aggressive-timeout
Iteration 2: aggressive-timeout → completes in 7 minutes ✓
```

---

### 3. Fallback Providers

**Name**: `fallback-providers`
**Priority**: 6
**Applicable Errors**: `rate_limit`, `429`, `quota exceeded`

#### Description

Switches to alternative AI providers when hitting rate limits or quota exhaustion on the primary provider.

#### Configuration

```typescript
{
  fallbackProviders: true,   // Enable provider switching
  useCache: false,           // Disable cache to force fresh requests
  retryBackoff: 'exponential'
}
```

#### When Used

Automatically selected when errors contain:
- "rate limit"
- "429"
- "too many requests"
- "quota exceeded"
- "rate_limit_exceeded"

#### Behavior

- Tries alternative providers in order: Claude → Gemini → OpenAI
- Disables cache to avoid repeating failed requests
- Uses exponential backoff between provider switches
- Preserves original prompt and parameters

#### Best For

- High-volume workflows exceeding provider limits
- Multi-provider deployments
- Production systems needing high availability
- Workflows with unpredictable load

#### Example Scenario

```bash
# Claude API returns 429 rate limit
Iteration 1: default → Claude → 429 error

# System switches to fallback providers
Iteration 2: fallback-providers → Gemini → success ✓
```

#### Provider Switching Order

1. **Primary**: Claude (claude-3-5-sonnet)
2. **Fallback 1**: Gemini (gemini-1.5-pro)
3. **Fallback 2**: OpenAI (gpt-4-turbo)

---

### 4. Reduced Parallelism

**Name**: `reduced-parallelism`
**Priority**: 4
**Applicable Errors**: `resource_exhausted`, `EMFILE`, `out of memory`

#### Description

Executes workflow steps **sequentially** instead of in parallel to reduce resource contention.

#### Configuration

```typescript
{
  parallelism: 1,            // Sequential execution
  retryBackoff: 'exponential',
  timeout: 300000
}
```

#### When Used

Automatically selected when errors contain:
- "resource exhausted"
- "out of memory"
- "EMFILE" (too many open files)
- "resource_exhausted"
- "OOM"

#### Behavior

- Reduces parallelism from 5 to **1** (fully sequential)
- Prevents simultaneous resource allocation
- Uses exponential backoff
- Maintains standard timeout

#### Best For

- Memory-intensive operations
- Systems with limited file descriptors
- Workflows causing resource contention
- High-concurrency failures

#### Example Scenario

```bash
# Workflow tries to open 50 files simultaneously
Iteration 1: default (parallelism=5) → EMFILE error

# System reduces parallelism
Iteration 2: reduced-parallelism (parallelism=1) → success ✓
```

#### Performance Impact

- **Trade-off**: Reduced throughput for increased reliability
- Sequential execution takes longer but uses fewer resources
- Recommended for resource-constrained environments

---

### 5. Skip Optional

**Name**: `skip-optional`
**Priority**: 2 (lowest)
**Applicable Errors**: `partial_failure`

#### Description

Skips non-critical steps and continues execution when partial failures occur.

#### Configuration

```typescript
{
  skipOptionalSteps: true,   // Skip steps marked as optional
  continueOnError: true,     // Don't fail entire workflow on single step failure
  retryBackoff: 'exponential'
}
```

#### When Used

Automatically selected when errors contain:
- "partial_failure"
- "partial failure"
- "some steps failed"

#### Behavior

- Identifies steps marked as `optional: true`
- Skips failed optional steps
- Continues executing required steps
- Reports partial completion

#### Best For

- Workflows with non-critical enhancement steps
- Best-effort operations (e.g., telemetry, logging)
- Pipelines where partial success is acceptable
- Graceful degradation scenarios

#### Example Scenario

```bash
# Workflow has 5 steps: 3 required, 2 optional
# Step 4 (optional telemetry upload) fails

Iteration 1: default → step 4 fails → entire workflow fails

# System switches to skip-optional
Iteration 2: skip-optional → skips step 4 → completes with 4/5 steps ✓
```

#### Workflow Requirements

Steps must be explicitly marked as optional in workflow definition:

```yaml
steps:
  - name: process-data
    required: true
  - name: upload-telemetry
    required: false  # Optional step
  - name: send-notification
    required: false  # Optional step
```

---

## Strategy Selection Logic

### Selection Process

The StrategySelector uses a **multi-factor decision process**:

1. **First Iteration**: Always uses `default` strategy
2. **Subsequent Iterations**: Matches error type to applicable strategies
3. **Priority Weighting**: Prefers higher-priority strategies
4. **Success History**: Boosts strategies that have worked before
5. **Mode Override**: Can force conservative or aggressive selection

### Selection Modes

**Auto Mode** (default):
- Matches error types to strategies
- Uses priority and success history
- Adaptive and balanced

**Conservative Mode**:
- Prefers higher-priority strategies
- Avoids aggressive changes
- Good for production

**Aggressive Mode**:
- Tries lower-priority strategies faster
- More experimental
- Good for development/testing

### Code Example

```typescript
import { StrategySelector } from './services/StrategySelector.js';

const selector = new StrategySelector('auto');

// First iteration - always default
const initial = await selector.selectInitial();
console.log(initial.name); // "default"

// After timeout error
const analysis = {
  errorType: 'timeout',
  transient: true,
  severity: 'medium'
};

const next = await selector.selectNext(analysis, []);
console.log(next.name); // "aggressive-timeout"
```

### Priority Resolution

When multiple strategies match an error:

1. **Exact Match**: Strategy with error type in applicableErrors
2. **Success Bonus**: +2 priority if strategy has succeeded before
3. **Highest Priority Wins**: Strategy with highest total priority selected

Example:
```
Error: "rate_limit_exceeded"

Matching strategies:
- fallback-providers: priority 6
- skip-optional: priority 2

Selected: fallback-providers (higher priority)
```

---

## Strategy Comparison

### Quick Reference Table

| Strategy | Priority | Timeout | Parallelism | Cache | Use Case |
|----------|----------|---------|-------------|-------|----------|
| **default** | 10 | 5 min | 5 | Yes | Standard execution |
| **aggressive-timeout** | 8 | 10 min | 5 | Yes | Slow operations |
| **fallback-providers** | 6 | 5 min | 5 | No | Rate limits |
| **reduced-parallelism** | 4 | 5 min | 1 | Yes | Resource limits |
| **skip-optional** | 2 | 5 min | 5 | Yes | Partial failures |

### Error Type Mapping

| Error Type | Best Strategy | Alternative |
|------------|---------------|-------------|
| Timeout | aggressive-timeout | default |
| Rate limit | fallback-providers | default |
| Network error | default | aggressive-timeout |
| Resource exhausted | reduced-parallelism | default |
| Partial failure | skip-optional | default |
| Authentication | default | (fix credentials) |
| Validation | default | (fix workflow) |

### Performance Characteristics

**Throughput** (operations/second):
1. default: ★★★★☆ (baseline)
2. aggressive-timeout: ★★★☆☆ (slower timeouts)
3. fallback-providers: ★★★★☆ (similar to default)
4. reduced-parallelism: ★★☆☆☆ (sequential execution)
5. skip-optional: ★★★★★ (faster - skips steps)

**Resource Usage** (memory/CPU):
1. default: ★★★☆☆ (moderate)
2. aggressive-timeout: ★★★☆☆ (similar to default)
3. fallback-providers: ★★★☆☆ (similar to default)
4. reduced-parallelism: ★★☆☆☆ (low - sequential)
5. skip-optional: ★★☆☆☆ (low - fewer steps)

**Reliability** (success rate):
1. default: ★★★☆☆ (baseline)
2. aggressive-timeout: ★★★★☆ (handles slow ops)
3. fallback-providers: ★★★★★ (high availability)
4. reduced-parallelism: ★★★★☆ (reduces contention)
5. skip-optional: ★★★☆☆ (partial completion)

---

## Advanced Topics

### Custom Strategy Selection

Override automatic selection with explicit strategy choice:

```bash
# Force specific strategy (not yet implemented)
ax workflow run workflow.yaml --strategy aggressive-timeout
```

### Success History Tracking

The StrategySelector learns from successful iterations:

```typescript
// After successful iteration
selector.recordSuccess(strategy);

// Future selections prefer this strategy
// Priority boost: +2 for strategies with success history
```

### Strategy Chaining

Strategies can cascade across iterations:

```
Iteration 1: default → timeout
Iteration 2: aggressive-timeout → rate_limit
Iteration 3: fallback-providers → resource_exhausted
Iteration 4: reduced-parallelism → success ✓
```

### Creating Custom Strategies (Future)

Custom strategies will be supported in future releases:

```typescript
// Future API (not yet implemented)
const customStrategy: Strategy = {
  name: 'ultra-conservative',
  description: 'Minimal resource usage',
  config: {
    timeout: 900000,
    parallelism: 1,
    retryBackoff: 'linear',
    useCache: true
  },
  priority: 7,
  applicableErrors: ['any']
};

selector.registerStrategy(customStrategy);
```

### Strategy Metrics

Monitor strategy effectiveness:

```bash
# View strategy performance (future feature)
ax workflow stats --strategy-breakdown

# Example output:
# Strategy               Attempts  Success Rate  Avg Duration
# default                100       65%           2.3s
# aggressive-timeout     25        88%           8.1s
# fallback-providers     15        93%           3.2s
# reduced-parallelism    10        80%           12.5s
# skip-optional          5         100%          1.8s
```

### Error Type Detection

Understanding how errors are classified helps predict strategy selection:

**Timeout Detection**:
- Error message contains: "timeout", "ETIMEDOUT", "ECONNRESET", "timed out"
- Stack trace shows timeout-related functions
- Duration exceeds configured timeout

**Rate Limit Detection**:
- HTTP status: 429
- Error message contains: "rate limit", "too many requests", "quota exceeded"
- Response headers: `Retry-After`, `X-RateLimit-Remaining: 0`

**Resource Exhaustion Detection**:
- Error codes: EMFILE, ENOMEM
- Error message contains: "out of memory", "resource exhausted", "too many open files"
- System resource metrics exceed thresholds

### Best Practices

**1. Let the System Adapt**
- Don't force strategies manually unless necessary
- Automatic selection is usually optimal
- Review logs to understand strategy choices

**2. Monitor Strategy Patterns**
- If same strategy fails repeatedly, investigate root cause
- Permanent errors (auth, validation) need workflow fixes, not retries
- Escalate to manual intervention after 3-5 failed iterations

**3. Tune Safety Levels**
- Start with `paranoid` for new workflows
- Increase to `normal` after validation
- Use `permissive` only for critical production workflows

**4. Optimize Workflow Design**
- Mark truly optional steps as `optional: true`
- Set reasonable timeouts per step
- Design for idempotency (safe to retry)
- Handle partial failures gracefully

**5. Review Iterate Mode Output**
- Check which strategies were used
- Identify frequently failing steps
- Optimize based on observed patterns

---

## Next Steps

- **User Guide**: See [Iterate Mode User Guide](./iterate-mode-guide.md)
- **API Reference**: See [API Documentation](./iterate-api.md)
- **Architecture**: See [Architecture Documentation](./iterate-architecture.md)

---

**Need Help?** Report issues at https://github.com/automatosx/automatosx/issues
