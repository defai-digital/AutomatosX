# Provider Integration Design (New AutomatosX)

## Overview

This document defines the improved provider integration architecture for the new AutomatosX, learning from the old implementation while applying contract-first principles and modern patterns.

---

## Design Principles

### Improvements Over Old Architecture

| Aspect | Old Approach | New Approach | Rationale |
|--------|--------------|--------------|-----------|
| Contracts | Runtime-only validation | JSON Schema + Zod SSOT | Compile-time safety, documentation |
| Dependencies | Providers know about router | Router depends on provider interface | Inversion of control |
| State | Mutable health objects | Immutable events + derived state | Predictable, replayable |
| Configuration | Mixed in code | Separate config contract | Runtime flexibility |
| Testing | Requires mocking | Pure functions + ports/adapters | Easy unit testing |

### Core Principles

1. **Contract-First**: All inputs/outputs defined in `packages/contracts/src/provider/v1/`
2. **Immutable Events**: State changes captured as events, state derived from events
3. **Pure Business Logic**: Core logic has no I/O, adapters handle external calls
4. **Explicit Dependencies**: No singletons, all dependencies injected
5. **Fail-Fast Validation**: Validate at boundaries, trust internally

---

## Contract Definitions

### 1. Provider Contract (`provider.schema.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://automatosx.dev/schemas/provider/v1/provider.schema.json",
  "title": "Provider",
  "type": "object",
  "properties": {
    "providerId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Unique provider identifier (e.g., 'claude', 'openai')"
    },
    "name": {
      "type": "string",
      "description": "Human-readable provider name"
    },
    "type": {
      "type": "string",
      "enum": ["sdk", "cli", "mcp"],
      "description": "Integration type"
    },
    "models": {
      "type": "array",
      "items": { "$ref": "#/$defs/Model" },
      "description": "Available models from this provider"
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["text", "code", "vision", "streaming", "function-calling"]
      }
    },
    "status": {
      "type": "string",
      "enum": ["available", "degraded", "unavailable"],
      "description": "Current provider status"
    }
  },
  "required": ["providerId", "name", "type", "models", "capabilities", "status"],
  "$defs": {
    "Model": {
      "type": "object",
      "properties": {
        "modelId": { "type": "string" },
        "name": { "type": "string" },
        "contextWindow": { "type": "integer", "minimum": 1 },
        "costPer1MInput": { "type": "number", "minimum": 0 },
        "costPer1MOutput": { "type": "number", "minimum": 0 }
      },
      "required": ["modelId", "name", "contextWindow", "costPer1MInput", "costPer1MOutput"]
    }
  }
}
```

### 2. Execution Request Contract

```json
{
  "$id": "https://automatosx.dev/schemas/provider/v1/request.schema.json",
  "title": "ExecutionRequest",
  "type": "object",
  "properties": {
    "requestId": {
      "type": "string",
      "format": "uuid"
    },
    "providerId": {
      "type": "string"
    },
    "modelId": {
      "type": "string"
    },
    "prompt": {
      "type": "string",
      "minLength": 1
    },
    "systemPrompt": {
      "type": "string"
    },
    "options": {
      "$ref": "#/$defs/ExecutionOptions"
    }
  },
  "required": ["requestId", "providerId", "modelId", "prompt"],
  "$defs": {
    "ExecutionOptions": {
      "type": "object",
      "properties": {
        "temperature": { "type": "number", "minimum": 0, "maximum": 2 },
        "maxTokens": { "type": "integer", "minimum": 1 },
        "stream": { "type": "boolean", "default": false },
        "timeout": { "type": "integer", "minimum": 1000, "description": "Timeout in ms" }
      }
    }
  }
}
```

### 3. Execution Response Contract

```json
{
  "$id": "https://automatosx.dev/schemas/provider/v1/response.schema.json",
  "title": "ExecutionResponse",
  "type": "object",
  "properties": {
    "requestId": { "type": "string", "format": "uuid" },
    "providerId": { "type": "string" },
    "modelId": { "type": "string" },
    "content": { "type": "string" },
    "usage": {
      "$ref": "#/$defs/TokenUsage"
    },
    "finishReason": {
      "type": "string",
      "enum": ["stop", "length", "error", "timeout"]
    },
    "latencyMs": { "type": "integer", "minimum": 0 },
    "cached": { "type": "boolean" }
  },
  "required": ["requestId", "providerId", "modelId", "content", "usage", "finishReason", "latencyMs"],
  "$defs": {
    "TokenUsage": {
      "type": "object",
      "properties": {
        "promptTokens": { "type": "integer", "minimum": 0 },
        "completionTokens": { "type": "integer", "minimum": 0 },
        "totalTokens": { "type": "integer", "minimum": 0 }
      },
      "required": ["promptTokens", "completionTokens", "totalTokens"]
    }
  }
}
```

---

## Circuit Breaker Design

### Improvements Over Old

| Old | New | Why |
|-----|-----|-----|
| Mutable state object | Event-sourced state | Auditable, replayable |
| Time-based window array | Sliding window counter | Memory efficient |
| Manual slot tracking | Automatic concurrency | Less error-prone |
| Callbacks for state change | Event emission | Decoupled observers |

### State Machine

```
States: CLOSED | OPEN | HALF_OPEN

Transitions:
  CLOSED → OPEN:      failures >= threshold within window
  OPEN → HALF_OPEN:   cooldown elapsed
  HALF_OPEN → CLOSED: probe succeeded
  HALF_OPEN → OPEN:   probe failed
```

### Circuit Breaker Contract

```typescript
// Input: Circuit breaker configuration
interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures to trigger open (default: 5)
  failureWindowMs: number;       // Window for counting failures (default: 60000)
  cooldownMs: number;            // Time in open state (default: 30000)
  probeSuccessThreshold: number; // Successes to close (default: 1)
}

// Input: Event to record
type CircuitBreakerEvent =
  | { type: 'success'; timestamp: number }
  | { type: 'failure'; timestamp: number; error: string }
  | { type: 'probe_start'; timestamp: number }
  | { type: 'probe_success'; timestamp: number }
  | { type: 'probe_failure'; timestamp: number; error: string }
  | { type: 'force_open'; timestamp: number; reason: string }
  | { type: 'force_close'; timestamp: number; reason: string };

// Output: Derived state
interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailure: number | null;
  openedAt: number | null;
  canAttempt: boolean;
  timeUntilRetry: number | null;
}

// Pure function: events → state
function deriveCircuitState(
  events: CircuitBreakerEvent[],
  config: CircuitBreakerConfig,
  now: number
): CircuitBreakerState;
```

### Behavioral Invariants

1. **Failure counting**: Only failures within `failureWindowMs` count toward threshold
2. **Transition atomicity**: State derived from events, never mutated directly
3. **Probe isolation**: Only one probe attempt allowed in HALF_OPEN
4. **Cooldown guarantee**: OPEN state lasts at least `cooldownMs`
5. **Force operations**: Manual overrides recorded as events for audit

---

## Rate Limiter Design

### Token Bucket with Sliding Window

```typescript
// Configuration
interface RateLimitConfig {
  requestsPerMinute: number;   // Max requests per minute
  tokensPerMinute: number;     // Max tokens per minute
  maxConcurrent: number;       // Max parallel requests
  burstMultiplier: number;     // Allow burst up to N * per-minute (default: 1.5)
}

// Input: Limit check request
interface LimitCheckRequest {
  clientId: string;
  estimatedTokens: number;
  timestamp: number;
}

// Output: Limit check result
interface LimitCheckResult {
  allowed: boolean;
  reason: 'ok' | 'requests_exhausted' | 'tokens_exhausted' | 'concurrent_limit';
  retryAfterMs: number | null;
  remaining: {
    requests: number;
    tokens: number;
    concurrent: number;
  };
}
```

### Improvements

1. **Token estimation**: Pre-check token limits before execution
2. **Composite limits**: Requests + tokens + concurrency checked together
3. **Burst handling**: Allow temporary burst with burstMultiplier
4. **Predictive blocking**: Warn before hitting limits

---

## Router Design

### Multi-Factor Scoring (Improved)

```typescript
// Routing strategies with weights
interface RoutingStrategy {
  name: 'fast' | 'cheap' | 'balanced' | 'quality' | 'custom';
  weights: {
    latency: number;    // 0-1, sum ≤ 1
    cost: number;       // 0-1
    quality: number;    // 0-1
    availability: number; // 0-1
  };
}

// Provider score calculation
interface ProviderScore {
  providerId: string;
  modelId: string;
  totalScore: number;           // Weighted composite score
  components: {
    latencyScore: number;       // Lower latency = higher score
    costScore: number;          // Lower cost = higher score
    qualityScore: number;       // Higher success rate = higher score
    availabilityScore: number;  // Higher uptime = higher score
  };
  eligible: boolean;            // Passes all hard constraints
  disqualifyReason: string | null;
}
```

### Routing Decision Contract

```typescript
// Input: Routing request
interface RoutingRequest {
  taskType: 'code' | 'text' | 'analysis' | 'general';
  budget: 'minimal' | 'standard' | 'premium';
  riskLevel: 'low' | 'medium' | 'high';
  requiredCapabilities: string[];
  preferredProvider: string | null;
  excludeProviders: string[];
}

// Output: Routing decision (matches existing routing/v1 contract)
interface RoutingDecision {
  selectedProvider: string;
  selectedModel: string;
  reasoning: string;
  alternatives: Array<{
    providerId: string;
    modelId: string;
    score: number;
  }>;
  constraints: {
    budgetApplied: boolean;
    riskApplied: boolean;
    capabilityFiltered: boolean;
  };
}
```

### Hard Constraints (Pass/Fail)

These eliminate providers before scoring:

1. **Capability match**: Provider must have required capabilities
2. **Budget constraint**: Cost must be within budget tier
3. **Risk constraint**: High-risk tasks exclude experimental models
4. **Circuit breaker**: Open circuits disqualify provider
5. **Rate limit**: Exhausted limits disqualify provider
6. **Exclusion list**: Explicitly excluded providers

### Soft Factors (Scoring)

Applied after hard constraints pass:

1. **Latency** (p95 from recent requests)
2. **Cost** (per 1M tokens)
3. **Quality** (success rate, proper stop rate)
4. **Availability** (uptime percentage)

---

## Health Check Design

### Health Status Contract

```typescript
// Health check result
interface HealthCheckResult {
  providerId: string;
  timestamp: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  details: {
    apiReachable: boolean;
    authValid: boolean;
    quotaAvailable: boolean;
    rateLimit: {
      remaining: number;
      resetsAt: number;
    } | null;
  };
}

// Derived health state (from check history)
interface ProviderHealth {
  providerId: string;
  currentStatus: 'healthy' | 'degraded' | 'unhealthy';
  availability: number;           // 0-1, based on recent checks
  avgLatencyMs: number;           // Rolling average
  consecutiveFailures: number;
  lastSuccess: number | null;
  lastFailure: number | null;
}
```

### Health Check Strategy

```typescript
interface HealthCheckConfig {
  intervalMs: number;             // Check frequency (default: 60000)
  timeoutMs: number;              // Check timeout (default: 5000)
  degradedThreshold: number;      // Failures for degraded (default: 2)
  unhealthyThreshold: number;     // Failures for unhealthy (default: 5)
  recoveryThreshold: number;      // Successes to recover (default: 3)
}
```

### Improvements

1. **Separate from execution**: Health checks don't count as usage
2. **Quota awareness**: Check available quota in health
3. **Rate limit awareness**: Include rate limit info in health
4. **Graduated status**: healthy → degraded → unhealthy (not binary)

---

## Error Classification

### Error Categories

```typescript
type ErrorCategory =
  | 'authentication'    // API key invalid, unauthorized
  | 'quota'             // Quota exhausted, billing limit
  | 'rate_limit'        // Rate limit exceeded
  | 'validation'        // Invalid request format
  | 'network'           // Connection failed, timeout
  | 'server'            // Provider 5xx errors
  | 'model'             // Model not found, not available
  | 'content'           // Content policy violation
  | 'unknown';          // Unclassified errors

interface ClassifiedError {
  category: ErrorCategory;
  shouldRetry: boolean;
  retryAfterMs: number | null;
  shouldFallback: boolean;
  message: string;
  originalError: unknown;
}
```

### Classification Rules

| Category | Retry | Fallback | Action |
|----------|-------|----------|--------|
| authentication | No | No | Propagate, log |
| quota | No | Yes | Switch provider |
| rate_limit | Yes | Maybe | Wait, then retry or fallback |
| validation | No | No | Propagate, fix request |
| network | Yes | Maybe | Retry with backoff |
| server | Yes | Yes | Retry, then fallback |
| model | No | Yes | Try different model |
| content | No | No | Propagate to user |
| unknown | No | No | Propagate, log |

---

## Provider Adapter Interface

### Port Definition (Core)

```typescript
// Port interface - defined in core, implemented in adapters
interface ProviderPort {
  execute(request: ExecutionRequest): Promise<ExecutionResponse>;
  checkHealth(): Promise<HealthCheckResult>;
  getModels(): Promise<Model[]>;
  estimateTokens(text: string): number;
}

// Provider registry port
interface ProviderRegistryPort {
  getProvider(providerId: string): ProviderPort | undefined;
  listProviders(): Provider[];
  registerProvider(provider: Provider, adapter: ProviderPort): void;
}
```

### Adapter Implementation Pattern

```typescript
// Adapter factory (in adapters package)
interface ProviderAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

// Each provider has its own adapter
// Claude adapter example structure:
// - Implements ProviderPort interface
// - Handles SDK/CLI communication
// - Translates to/from provider-specific formats
// - Manages connection lifecycle
```

---

## Package Structure

```
packages/
├── contracts/
│   └── src/
│       └── provider/
│           └── v1/
│               ├── provider.schema.json
│               ├── provider.schema.ts      # Zod schema
│               ├── request.schema.json
│               ├── request.schema.ts
│               ├── response.schema.json
│               ├── response.schema.ts
│               └── invariants.md
│
├── core/
│   └── provider-domain/
│       └── src/
│           ├── circuit-breaker.ts          # Pure state machine
│           ├── rate-limiter.ts             # Token bucket logic
│           ├── router.ts                   # Routing decisions
│           ├── health.ts                   # Health state derivation
│           ├── error-classifier.ts         # Error categorization
│           ├── ports.ts                    # Port interfaces
│           └── index.ts
│
├── adapters/
│   ├── provider-claude/
│   │   └── src/
│   │       ├── adapter.ts                  # Claude SDK adapter
│   │       └── index.ts
│   ├── provider-openai/
│   │   └── src/
│   │       ├── adapter.ts                  # OpenAI SDK adapter
│   │       └── index.ts
│   └── provider-registry/
│       └── src/
│           ├── registry.ts                 # Provider registry impl
│           └── index.ts
```

---

## Behavioral Invariants

### Circuit Breaker Invariants

1. **INV-CB-001**: A closed circuit allows all requests
2. **INV-CB-002**: An open circuit blocks all requests
3. **INV-CB-003**: State transitions only occur via events
4. **INV-CB-004**: Failure count resets when circuit opens
5. **INV-CB-005**: Half-open allows exactly one probe

### Rate Limiter Invariants

1. **INV-RL-001**: Requests cannot exceed `requestsPerMinute`
2. **INV-RL-002**: Tokens cannot exceed `tokensPerMinute`
3. **INV-RL-003**: Concurrent requests cannot exceed `maxConcurrent`
4. **INV-RL-004**: Denied requests include accurate `retryAfterMs`

### Router Invariants

1. **INV-RT-001**: Same inputs produce same routing decision (deterministic)
2. **INV-RT-002**: Budget 'minimal' never selects premium models
3. **INV-RT-003**: Risk 'high' never selects experimental models
4. **INV-RT-004**: Open circuits are never selected
5. **INV-RT-005**: Exhausted rate limits are never selected

### Health Check Invariants

1. **INV-HC-001**: Health status derived from check history only
2. **INV-HC-002**: Degraded requires >= degradedThreshold failures
3. **INV-HC-003**: Recovery requires >= recoveryThreshold successes

---

## Implementation Phases

### Phase A: Provider Contracts (Foundation)
- Add provider/v1 schemas to contracts package
- Define Zod schemas with validation
- Document behavioral invariants
- Add contract tests

### Phase B: Provider Domain (Core Logic)
- Implement circuit breaker (pure functions)
- Implement rate limiter (pure functions)
- Implement router (integrates with existing routing-engine)
- Implement health state derivation
- Implement error classifier

### Phase C: Provider Adapters (First Provider)
- Implement Claude adapter (SDK-based)
- Implement provider registry
- Integration tests with mock provider

### Phase D: Wire to Application Layer
- Connect CLI to real providers
- Connect MCP server to real providers
- End-to-end tests

---

## Testing Strategy

### Unit Tests (Pure Functions)

```typescript
// Circuit breaker tests
describe('CircuitBreaker', () => {
  it('stays closed under threshold', () => {
    const events = generateFailures(4);
    const state = deriveCircuitState(events, config, now);
    expect(state.status).toBe('closed');
  });

  it('opens at threshold', () => {
    const events = generateFailures(5);
    const state = deriveCircuitState(events, config, now);
    expect(state.status).toBe('open');
  });

  // ... invariant tests
});
```

### Integration Tests (With Adapters)

```typescript
describe('ProviderAdapter', () => {
  it('executes request and returns response', async () => {
    const adapter = createClaudeAdapter({ apiKey: 'test' });
    const response = await adapter.execute(request);
    expect(ExecutionResponseSchema.safeParse(response).success).toBe(true);
  });
});
```

### Contract Tests (Schema Compliance)

```typescript
describe('Provider Contract', () => {
  it('validates provider schema', () => {
    const provider = createTestProvider();
    expect(ProviderSchema.safeParse(provider).success).toBe(true);
  });
});
```

---

## Migration Path

### From Old to New

1. **Contracts first**: Define schemas before implementing
2. **Core logic**: Implement pure functions with full test coverage
3. **One provider**: Start with Claude, prove the pattern
4. **Gradual adoption**: Add providers incrementally
5. **Wire last**: Connect to CLI/MCP only when stable

### Compatibility Notes

- Old config format not supported (intentional clean break)
- New contracts are stricter (validation may reject old data)
- Provider adapters are new implementations (not ports of old code)
