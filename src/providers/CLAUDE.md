# Provider System - Developer Guide

This file provides guidance for working with AutomatosX providers: architecture, integration patterns, and multi-provider routing.

---

## Provider Architecture

### Base Provider (`base-provider.ts`)

All providers extend `BaseProvider` which provides:

- **Rate Limiting:** Token bucket algorithm
- **Retry Logic:** Exponential backoff with jitter
- **Circuit Breaker:** Configurable failure thresholds
- **Health Checks:** Availability caching (60s TTL)
- **Version Detection:** CLI version caching (5min TTL)
- **Usage Tracking:** Token/cost statistics

### Provider Whitelist

**CRITICAL:** Provider names MUST be whitelisted to prevent command injection.

```typescript
static readonly ALLOWED_PROVIDER_NAMES = [
  'claude', 'claude-code',
  'gemini', 'gemini-cli',
  'openai', 'codex',
  'glm', 'ax-glm',        // v12.0.0: Zhipu AI
  'grok', 'ax-grok',      // v12.4.0: xAI
  'qwen', 'qwen-code'     // v12.7.0: Alibaba Cloud
];
```

**When adding a provider:**
1. Add name to whitelist FIRST
2. Then implement provider class
3. Validate name in constructor:
   ```typescript
   if (!BaseProvider.ALLOWED_PROVIDER_NAMES.includes(name)) {
     throw new ProviderError(`Invalid provider name: ${name}`);
   }
   ```

---

## Provider Implementations

### Claude Provider (`claude-provider.ts`)

**Architecture:** CLI-based integration with Anthropic Claude

```typescript
class ClaudeProvider extends BaseProvider {
  async execute(task: string): Promise<ProviderResponse> {
    // 1. Build command
    const cmd = ['claude', task];

    // 2. Execute with timeout
    const result = await this.execWithTimeout(cmd, this.timeout);

    // 3. Parse response
    const response = this.parseResponse(result.stdout);

    // 4. Track usage
    this.trackUsage(response.usage);

    return response;
  }
}
```

**Features:**
- Streaming support
- Multi-turn conversations
- Vision capabilities
- 200K context window

**Configuration:**
```json
{
  "claude": {
    "enabled": true,
    "priority": 1,
    "timeout": 120000,
    "maxRetries": 3
  }
}
```

### Gemini Provider (`gemini-provider.ts`)

**Architecture:** CLI-based integration with Google Gemini

```typescript
class GeminiProvider extends BaseProvider {
  async execute(task: string): Promise<ProviderResponse> {
    // Gemini-specific implementation
    // Similar to Claude but with Gemini CLI
  }
}
```

**Features:**
- Free tier: 1,500 requests/day
- Competitive performance
- Cost-effective for high volume

**Free Tier Tracking:**
```typescript
freeTierUsage: {
  daily: 0,
  limit: 1500,
  resetTime: Date.now() + 86400000  // 24 hours
}
```

### OpenAI Provider (`openai-provider.ts`)

**Architecture:** CLI + SDK modes (controlled by `AX_CLI_ONLY` env var)

```typescript
class OpenAIProvider extends BaseProvider {
  private mode: 'cli' | 'sdk';

  constructor() {
    this.mode = process.env.AX_CLI_ONLY === 'true' ? 'cli' : 'sdk';
  }

  async execute(task: string): Promise<ProviderResponse> {
    return this.mode === 'cli'
      ? this.executeCLI(task)
      : this.executeSDK(task);
  }
}
```

**Features:**
- Dual mode (CLI/SDK)
- GPT-4 Turbo support
- Function calling

---

## Provider Metadata Registry

Centralized pricing, latency, and free-tier limits.

```typescript
// provider-metadata-registry.ts
export const PROVIDER_METADATA = {
  'gemini-cli': {
    cost: {
      input: 0.000375,   // per 1K tokens
      output: 0.0015
    },
    latency: {
      p50: 2000,  // ms
      p95: 5000
    },
    freeTier: {
      enabled: true,
      dailyLimit: 1500
    },
    capabilities: ['streaming', 'vision']
  },
  // ...
};
```

**Used by:**
- PolicyEvaluator for constraint filtering
- Router for cost estimation
- Free-tier quota management

---

## Rate Limiting

### Token Bucket Algorithm

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  async acquire(cost: number = 1): Promise<void> {
    // Refill tokens based on time elapsed
    this.refill();

    // Wait if insufficient tokens
    if (this.tokens < cost) {
      const wait = this.calculateWaitTime(cost);
      await sleep(wait);
      this.refill();
    }

    // Consume tokens
    this.tokens -= cost;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

**Configuration:**
```json
{
  "rateLimit": {
    "capacity": 100,      // Max tokens
    "refillRate": 10,     // Tokens per second
    "enabled": true
  }
}
```

---

## Circuit Breaker

### State Machine

```
Closed → (failures >= threshold) → Open
Open → (resetTimeout elapsed) → Half-Open
Half-Open → (success) → Closed
Half-Open → (failure) → Open
```

### Implementation

```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures: number = 0;
  private lastFailureTime: number = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new ProviderError('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();

      // Success - reset circuit
      if (this.state === 'half-open') {
        this.state = 'closed';
      }
      this.failures = 0;

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      // Trip circuit if threshold exceeded
      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
      }

      throw error;
    }
  }
}
```

**Configuration:**
```json
{
  "circuitBreaker": {
    "failureThreshold": 3,
    "resetTimeout": 60000,     // 1 minute
    "halfOpenRetries": 1
  }
}
```

---

## Retry Logic

### Exponential Backoff with Jitter

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry if last attempt or non-retryable error
      if (attempt === maxRetries || !shouldRetryError(error)) {
        throw error;
      }

      // Calculate backoff with jitter
      const baseDelay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s, 8s
      const jitter = Math.random() * 1000;            // 0-1s
      const delay = baseDelay + jitter;

      await sleep(delay);
    }
  }
}
```

### Retryable Errors

```typescript
// providers/retry-errors.ts
export function shouldRetryError(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return [
      'RATE_LIMIT_EXCEEDED',
      'TIMEOUT',
      'NETWORK_ERROR',
      'SERVICE_UNAVAILABLE'
    ].includes(error.code);
  }
  return false;
}
```

---

## Health Checks

### Availability Caching

```typescript
class BaseProvider {
  private availabilityCache: {
    available: boolean;
    timestamp: number;
  } | null = null;

  private readonly CACHE_TTL = 60000;  // 60 seconds

  async isAvailable(): Promise<boolean> {
    // Check cache first
    if (this.availabilityCache) {
      const age = Date.now() - this.availabilityCache.timestamp;
      if (age < this.CACHE_TTL) {
        return this.availabilityCache.available;
      }
    }

    // Perform health check
    const available = await this.checkHealth();

    // Update cache
    this.availabilityCache = {
      available,
      timestamp: Date.now()
    };

    return available;
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const result = await this.exec(['--version'], { timeout: 5000 });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }
}
```

---

## Provider Selection

### Policy-Based Routing

```typescript
// Router selects provider based on policy
const provider = await router.selectProvider({
  task: 'Implement authentication',
  constraints: {
    maxLatency: 5000,      // Max 5s latency
    maxCost: 0.10,         // Max $0.10 per request
    privacy: 'private',    // Private providers only
    capabilities: ['streaming']
  }
});
```

### Selection Flow

```
1. PolicyEvaluator.filter(providers, constraints)
   → Returns providers meeting all constraints

2. PolicyEvaluator.score(providers)
   → Scores based on latency, cost, reliability

3. Router.select(scoredProviders)
   → Picks highest scoring available provider

4. Router.execute(provider, task)
   → Executes with circuit breaker + retry
```

### Scoring Formula

```typescript
function scoreProvider(provider: Provider): number {
  const latencyScore = 1 - (provider.latency.p95 / 10000);  // 0-1
  const costScore = 1 - (provider.cost.total / 1.0);        // 0-1
  const reliabilityScore = provider.successRate;             // 0-1

  return (
    0.5 * latencyScore +
    0.3 * costScore +
    0.2 * reliabilityScore
  );
}
```

---

## Adding a New Provider

### Step-by-Step Guide

1. **Add to Whitelist**
   ```typescript
   // base-provider.ts
   static readonly ALLOWED_PROVIDER_NAMES = [
     ...existing,
     'my-provider'  // Add here FIRST
   ];
   ```

2. **Create Provider Class**
   ```typescript
   // src/providers/my-provider.ts
   export class MyProvider extends BaseProvider {
     constructor() {
       super('my-provider');
     }

     async execute(task: string): Promise<ProviderResponse> {
       // Implementation
     }
   }
   ```

3. **Add Metadata**
   ```typescript
   // provider-metadata-registry.ts
   'my-provider': {
     cost: { input: 0.001, output: 0.002 },
     latency: { p50: 1000, p95: 3000 },
     freeTier: { enabled: false },
     capabilities: ['streaming']
   }
   ```

4. **Register in Config**
   ```json
   {
     "providers": {
       "my-provider": {
         "enabled": true,
         "priority": 3,
         "timeout": 120000
       }
     }
   }
   ```

5. **Create Tests**
   ```typescript
   describe('MyProvider', () => {
     it('should execute tasks', async () => {
       const provider = new MyProvider();
       const result = await provider.execute('test');
       expect(result.content).toBeDefined();
     });
   });
   ```

6. **Create Integration Bridge** (if needed)
   ```typescript
   // src/integrations/my-provider/
   // - command-translator.ts
   // - config-manager.ts
   // - file-reader.ts
   ```

---

## Testing Providers

### Unit Tests

```typescript
describe('ClaudeProvider', () => {
  beforeEach(() => {
    vi.mock('child_process');  // Mock CLI execution
  });

  it('should execute task', async () => {
    const provider = new ClaudeProvider();
    const result = await provider.execute('Hello');

    expect(result.content).toBe('Hello, world!');
    expect(result.model).toBe('claude-3');
  });

  it('should handle rate limiting', async () => {
    const provider = new ClaudeProvider();

    // Fill rate limit bucket
    for (let i = 0; i < 100; i++) {
      await provider.execute('task');
    }

    // Next call should be rate limited
    const start = Date.now();
    await provider.execute('task');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThan(100);  // Had to wait
  });
});
```

### Integration Tests

```typescript
describe('Provider Integration', () => {
  it('should fallback to secondary provider', async () => {
    // Primary provider fails
    vi.spyOn(claudeProvider, 'execute').mockRejectedValue(
      new ProviderError('Service unavailable')
    );

    // Should fallback to Gemini
    const result = await router.execute({ task: 'test' });
    expect(result.provider).toBe('gemini-cli');
  });
});
```

---

## Performance Optimization

1. **Cache Health Checks:** 60s TTL
2. **Cache Version Detection:** 5min TTL
3. **Reuse Connections:** HTTP keep-alive for SDK mode
4. **Parallel Execution:** Execute multiple providers concurrently
5. **Free-Tier Prioritization:** Route to free providers when available

---

## Common Issues

### Issue: Provider Not Available

**Error:** `Provider 'claude' is not available`

**Solutions:**
1. Check CLI installation: `claude --version`
2. Verify PATH: `which claude`
3. Check health: `ax doctor claude`

### Issue: Rate Limit Exceeded

**Error:** `Rate limit exceeded`

**Solutions:**
1. Increase rate limit in config
2. Use multiple providers for load balancing
3. Implement request queuing

### Issue: Circuit Breaker Open

**Error:** `Circuit breaker is open`

**Solutions:**
1. Wait for reset timeout (default 1 minute)
2. Check provider health: `ax doctor <provider>`
3. Manually reset: `ax providers reset <provider>`

### Issue: Invalid Provider Name

**Error:** `Invalid provider name: xyz`

**Solutions:**
1. Check whitelist in `base-provider.ts`
2. Add provider to whitelist if valid
3. Use correct provider name from `ax providers list`

---

## Best Practices Summary

1. ✅ **Always whitelist provider names** - Security requirement
2. ✅ **Cache expensive operations** - Health checks, version detection
3. ✅ **Use circuit breakers** - Prevent cascading failures
4. ✅ **Implement retry logic** - Handle transient errors
5. ✅ **Rate limit requests** - Prevent quota exhaustion
6. ✅ **Track usage** - Monitor costs and token consumption
7. ✅ **Test providers** - Unit + integration tests
8. ✅ **Document integration** - Clear setup instructions

---

For more information:
- Main CLAUDE.md (project root)
- Provider commands: `ax providers --help`
- GitHub Issues: https://github.com/defai-digital/automatosx/issues
