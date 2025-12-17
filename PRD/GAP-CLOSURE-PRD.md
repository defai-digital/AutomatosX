# AutomatosX Gap Closure PRD

**Version**: 1.0.0
**Date**: 2025-12-15
**Status**: Draft

---

## Executive Summary

This PRD defines the implementation plan to close all remaining gaps between the current AutomatosX implementation and the target architecture defined in Agentic-PRD v2.1. The scope excludes telemetry/observability features per stakeholder direction.

### Scope

| Category | Items | Priority |
|----------|-------|----------|
| Provider Resilience | Circuit breaker, rate limiting, health monitoring | P0 |
| Agent Execution | Checkpoints, parallel execution, delegation tracking | P1 |
| Content | 6 agent profiles, 29+ ability templates | P1 |
| Cross-Cutting | Dead letter queue, saga pattern, data retention, idempotency | P2 |
| Agent Governance | Behavior policies, resource limits, capability control | P2 |

### Out of Scope

- OpenTelemetry integration
- Structured logging
- Metrics collection
- Dashboard integration

---

## Phase 1: Provider Resilience (P0)

### 1.1 Circuit Breaker

**Purpose**: Prevent cascading failures when providers become unhealthy.

#### Contract Schema

```typescript
// packages/contracts/src/provider/v1/circuit-breaker.ts

import { z } from 'zod';

export const CircuitStateSchema = z.enum(['closed', 'open', 'halfOpen']);
export type CircuitState = z.infer<typeof CircuitStateSchema>;

export const CircuitBreakerConfigSchema = z.object({
  /** Failures before opening circuit */
  failureThreshold: z.number().int().min(1).max(100).default(5),
  /** Time before attempting half-open (ms) */
  resetTimeoutMs: z.number().int().min(1000).max(300000).default(30000),
  /** Requests to test in half-open state */
  halfOpenRequests: z.number().int().min(1).max(10).default(3),
  /** Interval for passive health checks (ms) */
  monitorIntervalMs: z.number().int().min(1000).max(60000).default(10000),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

export const CircuitBreakerStateSchema = z.object({
  state: CircuitStateSchema,
  failureCount: z.number().int().min(0),
  successCount: z.number().int().min(0),
  lastFailureTime: z.string().datetime().optional(),
  lastSuccessTime: z.string().datetime().optional(),
  nextAttemptTime: z.string().datetime().optional(),
});

export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;
```

#### Implementation

```typescript
// packages/adapters/providers/src/circuit-breaker.ts

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  constructor(
    private readonly providerId: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  /**
   * Check if request should be allowed
   * INV-CB-001: Closed state allows all requests
   * INV-CB-002: Open state rejects until resetTimeout
   * INV-CB-003: Half-open allows limited test requests
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        if (Date.now() >= (this.nextAttemptTime?.getTime() ?? 0)) {
          this.transitionTo('halfOpen');
          return true;
        }
        return false;
      case 'halfOpen':
        return this.successCount < this.config.halfOpenRequests;
    }
  }

  /**
   * Record successful execution
   */
  recordSuccess(): void {
    this.successCount++;
    if (this.state === 'halfOpen' &&
        this.successCount >= this.config.halfOpenRequests) {
      this.transitionTo('closed');
    }
    if (this.state === 'closed') {
      this.failureCount = 0;
    }
  }

  /**
   * Record failed execution
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'halfOpen') {
      this.transitionTo('open');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    if (newState === 'open') {
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeoutMs);
    } else if (newState === 'halfOpen') {
      this.successCount = 0;
    } else if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime?.toISOString(),
      lastSuccessTime: undefined,
      nextAttemptTime: this.nextAttemptTime?.toISOString(),
    };
  }
}
```

#### Invariants

| ID | Invariant | Test |
|----|-----------|------|
| INV-CB-001 | Closed allows all | `canExecute()` returns true when closed |
| INV-CB-002 | Open rejects until timeout | Rejects until `resetTimeoutMs` elapsed |
| INV-CB-003 | Half-open limited requests | Only `halfOpenRequests` allowed |
| INV-CB-004 | Threshold triggers open | Opens after `failureThreshold` failures |
| INV-CB-005 | Success in half-open closes | Closes after successful test requests |

---

### 1.2 Rate Limiting

**Purpose**: Prevent overwhelming providers with too many requests.

#### Contract Schema

```typescript
// packages/contracts/src/provider/v1/rate-limit.ts

import { z } from 'zod';

export const RateLimitConfigSchema = z.object({
  /** Requests per minute per provider */
  requestsPerMinute: z.number().int().min(1).max(10000).default(60),
  /** Tokens per minute per provider */
  tokensPerMinute: z.number().int().min(1000).max(10000000).default(100000),
  /** Burst allowance (multiplier) */
  burstMultiplier: z.number().min(1).max(5).default(1.5),
  /** Strategy when limit reached */
  strategy: z.enum(['reject', 'queue', 'backoff']).default('backoff'),
  /** Max queue size if strategy is 'queue' */
  maxQueueSize: z.number().int().min(0).max(1000).default(100),
  /** Backoff base delay (ms) */
  backoffBaseMs: z.number().int().min(100).max(10000).default(1000),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

export const RateLimitStateSchema = z.object({
  requestCount: z.number().int().min(0),
  tokenCount: z.number().int().min(0),
  windowStart: z.string().datetime(),
  queueSize: z.number().int().min(0),
  nextAllowedTime: z.string().datetime().optional(),
});

export type RateLimitState = z.infer<typeof RateLimitStateSchema>;
```

#### Implementation

```typescript
// packages/adapters/providers/src/rate-limiter.ts

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly providerId: string,
    private readonly config: RateLimitConfig
  ) {
    this.tokens = config.requestsPerMinute * config.burstMultiplier;
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to acquire a token for a request
   * INV-RL-001: Never exceed burst capacity
   * INV-RL-002: Refill at configured rate
   */
  async acquire(estimatedTokens = 1): Promise<RateLimitResult> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, waitMs: 0 };
    }

    switch (this.config.strategy) {
      case 'reject':
        return {
          allowed: false,
          waitMs: 0,
          error: 'RATE_LIMIT_EXCEEDED'
        };

      case 'backoff': {
        const waitMs = this.calculateBackoff();
        await this.delay(waitMs);
        return this.acquire(estimatedTokens);
      }

      case 'queue':
        return this.enqueue(estimatedTokens);
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 60000) * this.config.requestsPerMinute;

    this.tokens = Math.min(
      this.tokens + tokensToAdd,
      this.config.requestsPerMinute * this.config.burstMultiplier
    );
    this.lastRefill = now;
  }

  private calculateBackoff(): number {
    const base = this.config.backoffBaseMs;
    const jitter = Math.random() * base * 0.1;
    return base + jitter;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async enqueue(tokens: number): Promise<RateLimitResult> {
    // Queue implementation
    return { allowed: true, waitMs: 0, queued: true };
  }
}

interface RateLimitResult {
  allowed: boolean;
  waitMs: number;
  queued?: boolean;
  error?: string;
}
```

#### Invariants

| ID | Invariant | Test |
|----|-----------|------|
| INV-RL-001 | Burst capacity respected | Tokens never exceed `requestsPerMinute * burstMultiplier` |
| INV-RL-002 | Refill rate accurate | Tokens refill at `requestsPerMinute / 60000` per ms |
| INV-RL-003 | Strategy honored | Reject/queue/backoff behavior matches config |
| INV-RL-004 | Queue bounded | Queue never exceeds `maxQueueSize` |

---

### 1.3 Health Monitoring

**Purpose**: Track provider health for intelligent routing decisions.

#### Contract Schema

```typescript
// packages/contracts/src/provider/v1/health.ts

import { z } from 'zod';

export const HealthStatusSchema = z.object({
  providerId: z.string(),
  available: z.boolean(),
  latencyMs: z.number().min(0),
  errorRate: z.number().min(0).max(1),
  consecutiveFailures: z.number().int().min(0),
  consecutiveSuccesses: z.number().int().min(0),
  lastCheckTime: z.string().datetime(),
  lastSuccessTime: z.string().datetime().optional(),
  lastErrorTime: z.string().datetime().optional(),
  lastError: z.string().optional(),
  circuitState: z.enum(['closed', 'open', 'halfOpen']),
  rateLimitState: z.enum(['normal', 'throttled', 'blocked']),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const HealthCheckConfigSchema = z.object({
  /** Interval between health checks (ms) */
  intervalMs: z.number().int().min(5000).max(300000).default(30000),
  /** Timeout for health check (ms) */
  timeoutMs: z.number().int().min(1000).max(30000).default(5000),
  /** Number of samples for latency average */
  latencySampleSize: z.number().int().min(1).max(100).default(10),
  /** Threshold for unhealthy error rate */
  unhealthyErrorRate: z.number().min(0).max(1).default(0.5),
});

export type HealthCheckConfig = z.infer<typeof HealthCheckConfigSchema>;
```

#### Implementation

```typescript
// packages/adapters/providers/src/health-monitor.ts

export class ProviderHealthMonitor {
  private latencySamples: number[] = [];
  private errorCount = 0;
  private successCount = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastError?: string;
  private lastErrorTime?: Date;
  private lastSuccessTime?: Date;

  constructor(
    private readonly providerId: string,
    private readonly config: HealthCheckConfig,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly rateLimiter: TokenBucketRateLimiter
  ) {}

  /**
   * Record a request result
   */
  recordResult(success: boolean, latencyMs: number, error?: string): void {
    // Update latency samples
    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > this.config.latencySampleSize) {
      this.latencySamples.shift();
    }

    if (success) {
      this.successCount++;
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
      this.lastSuccessTime = new Date();
      this.circuitBreaker.recordSuccess();
    } else {
      this.errorCount++;
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
      this.lastError = error;
      this.lastErrorTime = new Date();
      this.circuitBreaker.recordFailure();
    }
  }

  /**
   * Get current health status
   */
  getStatus(): HealthStatus {
    const total = this.successCount + this.errorCount;
    const errorRate = total > 0 ? this.errorCount / total : 0;
    const avgLatency = this.latencySamples.length > 0
      ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
      : 0;

    const cbState = this.circuitBreaker.getState();

    return {
      providerId: this.providerId,
      available: cbState.state !== 'open' && errorRate < this.config.unhealthyErrorRate,
      latencyMs: avgLatency,
      errorRate,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastCheckTime: new Date().toISOString(),
      lastSuccessTime: this.lastSuccessTime?.toISOString(),
      lastErrorTime: this.lastErrorTime?.toISOString(),
      lastError: this.lastError,
      circuitState: cbState.state,
      rateLimitState: 'normal', // From rate limiter
    };
  }

  /**
   * Check if provider is healthy enough for routing
   */
  isHealthy(): boolean {
    const status = this.getStatus();
    return status.available && status.errorRate < this.config.unhealthyErrorRate;
  }
}
```

---

### 1.4 Integration with Provider Adapter

```typescript
// packages/adapters/providers/src/resilient-adapter.ts

export class ResilientProviderAdapter implements LLMProvider {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly healthMonitor: ProviderHealthMonitor;

  constructor(
    private readonly baseAdapter: LLMProvider,
    config: {
      circuitBreaker: CircuitBreakerConfig;
      rateLimit: RateLimitConfig;
      healthCheck: HealthCheckConfig;
    }
  ) {
    this.circuitBreaker = new CircuitBreaker(baseAdapter.providerId, config.circuitBreaker);
    this.rateLimiter = new TokenBucketRateLimiter(baseAdapter.providerId, config.rateLimit);
    this.healthMonitor = new ProviderHealthMonitor(
      baseAdapter.providerId,
      config.healthCheck,
      this.circuitBreaker,
      this.rateLimiter
    );
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        requestId: request.requestId,
        latencyMs: 0,
        error: {
          code: 'PROVIDER_CIRCUIT_OPEN',
          message: `Circuit breaker open for ${this.baseAdapter.providerId}`,
          retryable: true,
          retryAfterMs: this.getRetryAfterMs(),
        },
      };
    }

    // Check rate limit
    const rateLimitResult = await this.rateLimiter.acquire();
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        requestId: request.requestId,
        latencyMs: rateLimitResult.waitMs,
        error: {
          code: 'PROVIDER_RATE_LIMITED',
          message: `Rate limit exceeded for ${this.baseAdapter.providerId}`,
          retryable: true,
          retryAfterMs: rateLimitResult.waitMs,
        },
      };
    }

    // Execute request
    const startTime = Date.now();
    try {
      const result = await this.baseAdapter.complete(request);
      const latencyMs = Date.now() - startTime;

      this.healthMonitor.recordResult(result.success, latencyMs,
        result.error?.message);

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.healthMonitor.recordResult(false, latencyMs,
        error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  getHealthStatus(): HealthStatus {
    return this.healthMonitor.getStatus();
  }

  private getRetryAfterMs(): number {
    const state = this.circuitBreaker.getState();
    if (state.nextAttemptTime) {
      return Math.max(0, new Date(state.nextAttemptTime).getTime() - Date.now());
    }
    return 30000; // Default 30s
  }
}
```

---

## Phase 2: Agent Execution Features (P1)

### 2.1 Checkpoint Recovery

**Purpose**: Allow agent workflows to resume from last successful step after failure.

#### Contract Schema

```typescript
// packages/contracts/src/agent/v1/checkpoint.ts

import { z } from 'zod';

export const CheckpointSchema = z.object({
  checkpointId: z.string().uuid(),
  agentId: z.string(),
  sessionId: z.string().uuid().optional(),
  workflowId: z.string().optional(),

  /** Current step index */
  stepIndex: z.number().int().min(0),
  /** ID of the completed step */
  completedStepId: z.string(),

  /** Accumulated outputs from completed steps */
  stepOutputs: z.record(z.string(), z.unknown()),

  /** Execution context at checkpoint */
  context: z.record(z.string(), z.unknown()),

  /** Memory state snapshot */
  memorySnapshot: z.array(z.object({
    key: z.string(),
    value: z.unknown(),
  })).optional(),

  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const CheckpointConfigSchema = z.object({
  /** Enable checkpointing */
  enabled: z.boolean().default(true),
  /** Checkpoint after every N steps (0 = every step) */
  intervalSteps: z.number().int().min(0).max(100).default(1),
  /** Checkpoint retention period (hours) */
  retentionHours: z.number().int().min(1).max(720).default(24),
  /** Include memory snapshot */
  includeMemory: z.boolean().default(false),
  /** Max checkpoints per agent */
  maxCheckpoints: z.number().int().min(1).max(100).default(10),
});

export type CheckpointConfig = z.infer<typeof CheckpointConfigSchema>;
```

#### Implementation

```typescript
// packages/core/agent-domain/src/checkpoint-manager.ts

export interface CheckpointStore {
  save(checkpoint: Checkpoint): Promise<void>;
  load(agentId: string, sessionId?: string): Promise<Checkpoint | null>;
  loadByWorkflow(workflowId: string): Promise<Checkpoint | null>;
  delete(checkpointId: string): Promise<void>;
  deleteExpired(): Promise<number>;
  listByAgent(agentId: string): Promise<Checkpoint[]>;
}

export class CheckpointManager {
  constructor(
    private readonly store: CheckpointStore,
    private readonly config: CheckpointConfig
  ) {}

  /**
   * Create checkpoint after step completion
   * INV-CP-001: Checkpoint contains all data needed to resume
   */
  async createCheckpoint(
    agentId: string,
    stepIndex: number,
    completedStepId: string,
    stepOutputs: Record<string, unknown>,
    context: Record<string, unknown>,
    options?: { sessionId?: string; workflowId?: string; memorySnapshot?: Array<{key: string; value: unknown}> }
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      checkpointId: crypto.randomUUID(),
      agentId,
      sessionId: options?.sessionId,
      workflowId: options?.workflowId,
      stepIndex,
      completedStepId,
      stepOutputs,
      context,
      memorySnapshot: this.config.includeMemory ? options?.memorySnapshot : undefined,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.retentionHours * 3600000).toISOString(),
    };

    await this.store.save(checkpoint);
    await this.enforceMaxCheckpoints(agentId);

    return checkpoint;
  }

  /**
   * Resume execution from checkpoint
   * INV-CP-002: Resumed execution starts from step after checkpoint
   */
  async resumeFromCheckpoint(
    checkpointId: string
  ): Promise<ResumeContext> {
    const checkpoint = await this.store.load(checkpointId);
    if (!checkpoint) {
      throw new CheckpointError('CHECKPOINT_NOT_FOUND',
        `Checkpoint ${checkpointId} not found`);
    }

    if (checkpoint.expiresAt && new Date(checkpoint.expiresAt) < new Date()) {
      throw new CheckpointError('CHECKPOINT_EXPIRED',
        `Checkpoint ${checkpointId} has expired`);
    }

    return {
      startFromStep: checkpoint.stepIndex + 1,
      previousOutputs: checkpoint.stepOutputs,
      context: checkpoint.context,
      memorySnapshot: checkpoint.memorySnapshot,
    };
  }

  /**
   * Check if step should create checkpoint
   */
  shouldCheckpoint(stepIndex: number, isExplicitCheckpoint: boolean): boolean {
    if (!this.config.enabled) return false;
    if (isExplicitCheckpoint) return true;
    if (this.config.intervalSteps === 0) return true;
    return stepIndex % this.config.intervalSteps === 0;
  }

  private async enforceMaxCheckpoints(agentId: string): Promise<void> {
    const checkpoints = await this.store.listByAgent(agentId);
    if (checkpoints.length > this.config.maxCheckpoints) {
      // Delete oldest checkpoints
      const toDelete = checkpoints
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, checkpoints.length - this.config.maxCheckpoints);

      for (const cp of toDelete) {
        await this.store.delete(cp.checkpointId);
      }
    }
  }
}

interface ResumeContext {
  startFromStep: number;
  previousOutputs: Record<string, unknown>;
  context: Record<string, unknown>;
  memorySnapshot?: Array<{key: string; value: unknown}>;
}

class CheckpointError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'CheckpointError';
  }
}
```

#### SQLite Store Implementation

```typescript
// packages/adapters/sqlite/src/checkpoint-store.ts

export class SqliteCheckpointStore implements CheckpointStore {
  constructor(private readonly db: Database.Database) {
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        checkpoint_id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        session_id TEXT,
        workflow_id TEXT,
        step_index INTEGER NOT NULL,
        completed_step_id TEXT NOT NULL,
        step_outputs TEXT NOT NULL,
        context TEXT NOT NULL,
        memory_snapshot TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_checkpoints_agent
        ON checkpoints(agent_id);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_session
        ON checkpoints(session_id);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_expires
        ON checkpoints(expires_at);
    `);
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO checkpoints
      (checkpoint_id, agent_id, session_id, workflow_id, step_index,
       completed_step_id, step_outputs, context, memory_snapshot,
       created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      checkpoint.checkpointId,
      checkpoint.agentId,
      checkpoint.sessionId ?? null,
      checkpoint.workflowId ?? null,
      checkpoint.stepIndex,
      checkpoint.completedStepId,
      JSON.stringify(checkpoint.stepOutputs),
      JSON.stringify(checkpoint.context),
      checkpoint.memorySnapshot ? JSON.stringify(checkpoint.memorySnapshot) : null,
      checkpoint.createdAt,
      checkpoint.expiresAt ?? null
    );
  }

  async load(agentId: string, sessionId?: string): Promise<Checkpoint | null> {
    let sql = `SELECT * FROM checkpoints WHERE agent_id = ?`;
    const params: (string | undefined)[] = [agentId];

    if (sessionId) {
      sql += ` AND session_id = ?`;
      params.push(sessionId);
    }

    sql += ` ORDER BY created_at DESC LIMIT 1`;

    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params) as CheckpointRow | undefined;

    return row ? this.rowToCheckpoint(row) : null;
  }

  async deleteExpired(): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM checkpoints
      WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
    `);
    const result = stmt.run();
    return result.changes;
  }

  private rowToCheckpoint(row: CheckpointRow): Checkpoint {
    return {
      checkpointId: row.checkpoint_id,
      agentId: row.agent_id,
      sessionId: row.session_id ?? undefined,
      workflowId: row.workflow_id ?? undefined,
      stepIndex: row.step_index,
      completedStepId: row.completed_step_id,
      stepOutputs: JSON.parse(row.step_outputs),
      context: JSON.parse(row.context),
      memorySnapshot: row.memory_snapshot
        ? JSON.parse(row.memory_snapshot)
        : undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? undefined,
    };
  }
}
```

---

### 2.2 Parallel Step Execution

**Purpose**: Execute independent workflow steps concurrently for better performance.

#### Contract Schema

```typescript
// packages/contracts/src/workflow/v1/parallel.ts

import { z } from 'zod';

export const ParallelExecutionConfigSchema = z.object({
  /** Enable parallel execution */
  enabled: z.boolean().default(true),
  /** Maximum concurrent steps */
  maxConcurrency: z.number().int().min(1).max(10).default(5),
  /** Strategy when one parallel step fails */
  failureStrategy: z.enum([
    'failFast',      // Cancel remaining, fail immediately
    'failSafe',      // Wait for all, collect errors
    'continueOnError' // Continue, log errors
  ]).default('failFast'),
  /** Timeout for entire parallel group (ms) */
  groupTimeoutMs: z.number().int().min(1000).max(600000).optional(),
});

export type ParallelExecutionConfig = z.infer<typeof ParallelExecutionConfigSchema>;

export const ParallelGroupResultSchema = z.object({
  groupId: z.string(),
  stepResults: z.array(z.object({
    stepId: z.string(),
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
    durationMs: z.number(),
  })),
  totalDurationMs: z.number(),
  allSucceeded: z.boolean(),
  failedSteps: z.array(z.string()),
});

export type ParallelGroupResult = z.infer<typeof ParallelGroupResultSchema>;
```

#### Implementation

```typescript
// packages/core/workflow-engine/src/parallel-executor.ts

export class ParallelStepExecutor {
  constructor(
    private readonly config: ParallelExecutionConfig,
    private readonly stepExecutor: StepExecutor
  ) {}

  /**
   * Execute steps in parallel respecting dependencies
   * INV-PE-001: Independent steps execute concurrently
   * INV-PE-002: Dependencies honored (DAG ordering)
   * INV-PE-003: Concurrency limit respected
   */
  async executeParallelGroup(
    steps: WorkflowStep[],
    context: ExecutionContext
  ): Promise<ParallelGroupResult> {
    const groupId = crypto.randomUUID();
    const startTime = Date.now();
    const results: Map<string, StepResult> = new Map();
    const errors: string[] = [];

    // Build dependency graph and find parallel groups
    const groups = this.buildExecutionGroups(steps);

    for (const group of groups) {
      // Execute each group with concurrency limit
      const groupResults = await this.executeGroup(group, context, results);

      for (const result of groupResults) {
        results.set(result.stepId, result);
        if (!result.success) {
          errors.push(result.stepId);

          if (this.config.failureStrategy === 'failFast') {
            return this.buildResult(groupId, results, startTime, errors);
          }
        }
      }
    }

    return this.buildResult(groupId, results, startTime, errors);
  }

  private async executeGroup(
    steps: WorkflowStep[],
    context: ExecutionContext,
    previousResults: Map<string, StepResult>
  ): Promise<StepResult[]> {
    // Use semaphore to limit concurrency
    const semaphore = new Semaphore(this.config.maxConcurrency);

    const promises = steps.map(async (step) => {
      await semaphore.acquire();
      try {
        // Inject previous step outputs into context
        const enrichedContext = this.enrichContext(context, previousResults, step);
        return await this.stepExecutor.execute(step, enrichedContext);
      } finally {
        semaphore.release();
      }
    });

    // Apply group timeout if configured
    if (this.config.groupTimeoutMs) {
      return Promise.race([
        Promise.all(promises),
        this.timeoutPromise(this.config.groupTimeoutMs),
      ]);
    }

    return Promise.all(promises);
  }

  /**
   * Build execution groups from dependency graph
   * Steps with no unmet dependencies can run in parallel
   */
  private buildExecutionGroups(steps: WorkflowStep[]): WorkflowStep[][] {
    const groups: WorkflowStep[][] = [];
    const completed = new Set<string>();
    const remaining = [...steps];

    while (remaining.length > 0) {
      const group: WorkflowStep[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const step = remaining[i];
        const deps = step.dependencies ?? [];

        if (deps.every(d => completed.has(d))) {
          group.push(step);
          remaining.splice(i, 1);
        }
      }

      if (group.length === 0 && remaining.length > 0) {
        throw new Error('Circular dependency detected in workflow steps');
      }

      for (const step of group) {
        completed.add(step.stepId);
      }

      groups.push(group);
    }

    return groups;
  }

  private enrichContext(
    context: ExecutionContext,
    previousResults: Map<string, StepResult>,
    step: WorkflowStep
  ): ExecutionContext {
    const stepOutputs: Record<string, unknown> = {};

    for (const depId of step.dependencies ?? []) {
      const result = previousResults.get(depId);
      if (result) {
        stepOutputs[depId] = result.output;
      }
    }

    return {
      ...context,
      stepOutputs,
    };
  }

  private buildResult(
    groupId: string,
    results: Map<string, StepResult>,
    startTime: number,
    failedSteps: string[]
  ): ParallelGroupResult {
    return {
      groupId,
      stepResults: Array.from(results.values()),
      totalDurationMs: Date.now() - startTime,
      allSucceeded: failedSteps.length === 0,
      failedSteps,
    };
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Parallel group timeout')), ms);
    });
  }
}

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}
```

---

### 2.3 Delegation Depth Tracking

**Purpose**: Enforce maximum delegation chain length to prevent infinite loops.

#### Contract Schema

```typescript
// packages/contracts/src/agent/v1/delegation.ts

import { z } from 'zod';

export const DelegationContextSchema = z.object({
  /** Current depth in delegation chain */
  currentDepth: z.number().int().min(0),
  /** Maximum allowed depth */
  maxDepth: z.number().int().min(1).max(10),
  /** Chain of agent IDs in delegation */
  delegationChain: z.array(z.string()),
  /** Original initiator agent */
  initiatorAgentId: z.string(),
  /** Root task ID */
  rootTaskId: z.string().uuid(),
});

export type DelegationContext = z.infer<typeof DelegationContextSchema>;

export const DelegationRequestSchema = z.object({
  fromAgentId: z.string(),
  toAgentId: z.string(),
  task: z.string().max(5000),
  context: DelegationContextSchema,
  timeout: z.number().int().min(1000).max(600000).optional(),
});

export type DelegationRequest = z.infer<typeof DelegationRequestSchema>;
```

#### Implementation

```typescript
// packages/core/agent-domain/src/delegation-tracker.ts

export class DelegationTracker {
  /**
   * Create initial delegation context for root agent
   */
  createRootContext(
    agentId: string,
    taskId: string,
    maxDepth: number
  ): DelegationContext {
    return {
      currentDepth: 0,
      maxDepth,
      delegationChain: [agentId],
      initiatorAgentId: agentId,
      rootTaskId: taskId,
    };
  }

  /**
   * Check if delegation is allowed
   * INV-DT-001: Depth never exceeds maxDepth
   * INV-DT-002: No circular delegations (agent can't delegate to itself or ancestors)
   */
  canDelegate(
    context: DelegationContext,
    toAgentId: string
  ): DelegationCheckResult {
    // Check depth limit
    if (context.currentDepth >= context.maxDepth) {
      return {
        allowed: false,
        reason: 'MAX_DEPTH_EXCEEDED',
        message: `Delegation depth ${context.currentDepth} would exceed max ${context.maxDepth}`,
      };
    }

    // Check for circular delegation
    if (context.delegationChain.includes(toAgentId)) {
      return {
        allowed: false,
        reason: 'CIRCULAR_DELEGATION',
        message: `Agent ${toAgentId} is already in delegation chain`,
      };
    }

    return { allowed: true };
  }

  /**
   * Create child context for delegated agent
   */
  createChildContext(
    parentContext: DelegationContext,
    childAgentId: string
  ): DelegationContext {
    const check = this.canDelegate(parentContext, childAgentId);
    if (!check.allowed) {
      throw new DelegationError(check.reason!, check.message!);
    }

    return {
      currentDepth: parentContext.currentDepth + 1,
      maxDepth: parentContext.maxDepth,
      delegationChain: [...parentContext.delegationChain, childAgentId],
      initiatorAgentId: parentContext.initiatorAgentId,
      rootTaskId: parentContext.rootTaskId,
    };
  }

  /**
   * Get remaining delegation depth
   */
  getRemainingDepth(context: DelegationContext): number {
    return context.maxDepth - context.currentDepth;
  }

  /**
   * Check if this is the root agent (no parent)
   */
  isRootAgent(context: DelegationContext): boolean {
    return context.currentDepth === 0;
  }

  /**
   * Get parent agent ID (if not root)
   */
  getParentAgentId(context: DelegationContext): string | null {
    if (this.isRootAgent(context)) {
      return null;
    }
    return context.delegationChain[context.delegationChain.length - 2];
  }
}

interface DelegationCheckResult {
  allowed: boolean;
  reason?: string;
  message?: string;
}

class DelegationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DelegationError';
  }
}
```

---

## Phase 3: Content Expansion (P1)

### 3.1 Additional Agent Profiles

Create 6 new agent profiles:

| Agent ID | Display Name | Role | Team |
|----------|--------------|------|------|
| `aerospace-scientist` | Dr. Astra | Aerospace & Space Systems | research |
| `ceo` | Cassandra | Chief Executive Officer | leadership |
| `creative-marketer` | Marcus | Creative Marketing Specialist | marketing |
| `quantum-engineer` | Quinn | Quantum Computing Engineer | research |
| `ml-engineer` | Maxwell | Machine Learning Engineer | ai |
| `blockchain-developer` | Blake | Blockchain Developer | web3 |

### 3.2 Additional Ability Templates

Create 29 new abilities across categories:

**Engineering:**
- `caching-strategy` - Caching patterns and invalidation
- `code-generation` - AI-assisted code generation
- `testing-automation` - Test automation frameworks
- `load-testing` - Performance and load testing
- `api-versioning` - API evolution strategies
- `state-management` - State management patterns
- `feature-flags` - Feature toggle patterns
- `chaos-engineering` - Resilience testing

**Data & AI:**
- `etl-pipelines` - Data pipeline design
- `data-modeling` - Data architecture
- `ml-ops` - ML operations and deployment
- `data-visualization` - Visualization best practices
- `stream-processing` - Real-time data processing

**Operations:**
- `monitoring` - System monitoring strategies
- `incident-response` - Incident management
- `capacity-planning` - Scaling strategies
- `cost-optimization` - Cloud cost management
- `logging-strategy` - Structured logging
- `backup-recovery` - Disaster recovery

**Security:**
- `threat-modeling` - Security threat analysis
- `penetration-testing` - Security testing
- `compliance` - Regulatory compliance
- `secrets-management` - Credential management
- `zero-trust` - Zero trust architecture

**Process:**
- `code-ownership` - Code stewardship
- `technical-debt` - Debt management
- `estimation` - Effort estimation
- `post-mortem` - Incident review
- `architecture-decision-records` - ADR best practices

---

## Phase 4: Cross-Cutting Concerns (P2)

### 4.1 Dead Letter Queue

**Purpose**: Capture and manage failed events for retry or investigation.

#### Contract Schema

```typescript
// packages/contracts/src/dlq/v1/dead-letter.ts

import { z } from 'zod';

export const DeadLetterEntrySchema = z.object({
  entryId: z.string().uuid(),
  originalEventId: z.string(),
  eventType: z.string(),
  eventPayload: z.unknown(),

  /** Error information */
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  }),

  /** Retry tracking */
  retryCount: z.number().int().min(0),
  maxRetries: z.number().int().min(0),
  lastRetryAt: z.string().datetime().optional(),
  nextRetryAt: z.string().datetime().optional(),

  /** Status */
  status: z.enum(['pending', 'retrying', 'exhausted', 'resolved']),

  /** Metadata */
  createdAt: z.string().datetime(),
  correlationId: z.string().optional(),
  source: z.string(), // Component that produced the error
});

export type DeadLetterEntry = z.infer<typeof DeadLetterEntrySchema>;

export const DLQConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryDelayMs: z.number().int().min(1000).max(3600000).default(60000),
  retryBackoffMultiplier: z.number().min(1).max(5).default(2),
  retentionDays: z.number().int().min(1).max(90).default(7),
  maxEntries: z.number().int().min(100).max(100000).default(10000),
});

export type DLQConfig = z.infer<typeof DLQConfigSchema>;
```

#### Implementation

```typescript
// packages/core/dlq/src/dead-letter-queue.ts

export interface DLQStore {
  add(entry: DeadLetterEntry): Promise<void>;
  get(entryId: string): Promise<DeadLetterEntry | null>;
  list(options: DLQListOptions): Promise<DeadLetterEntry[]>;
  update(entryId: string, updates: Partial<DeadLetterEntry>): Promise<void>;
  delete(entryId: string): Promise<void>;
  deleteExpired(): Promise<number>;
  count(status?: DeadLetterEntry['status']): Promise<number>;
}

export class DeadLetterQueue {
  constructor(
    private readonly store: DLQStore,
    private readonly config: DLQConfig,
    private readonly retryHandler: (entry: DeadLetterEntry) => Promise<boolean>
  ) {}

  /**
   * Add failed event to DLQ
   */
  async enqueue(
    eventId: string,
    eventType: string,
    eventPayload: unknown,
    error: { code: string; message: string; stack?: string },
    options?: { correlationId?: string; source?: string }
  ): Promise<DeadLetterEntry> {
    const entry: DeadLetterEntry = {
      entryId: crypto.randomUUID(),
      originalEventId: eventId,
      eventType,
      eventPayload,
      error,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending',
      createdAt: new Date().toISOString(),
      correlationId: options?.correlationId,
      source: options?.source ?? 'unknown',
    };

    if (this.config.maxRetries > 0) {
      entry.nextRetryAt = this.calculateNextRetry(0);
    }

    await this.store.add(entry);
    await this.enforceMaxEntries();

    return entry;
  }

  /**
   * Process pending retries
   */
  async processRetries(): Promise<DLQProcessResult> {
    const now = new Date().toISOString();
    const entries = await this.store.list({
      status: 'pending',
      nextRetryBefore: now,
      limit: 100,
    });

    let succeeded = 0;
    let failed = 0;
    let exhausted = 0;

    for (const entry of entries) {
      await this.store.update(entry.entryId, { status: 'retrying' });

      try {
        const success = await this.retryHandler(entry);

        if (success) {
          await this.store.update(entry.entryId, { status: 'resolved' });
          succeeded++;
        } else {
          await this.handleRetryFailure(entry);
          failed++;
        }
      } catch (error) {
        await this.handleRetryFailure(entry);
        failed++;
      }
    }

    return { processed: entries.length, succeeded, failed, exhausted };
  }

  private async handleRetryFailure(entry: DeadLetterEntry): Promise<void> {
    const newRetryCount = entry.retryCount + 1;

    if (newRetryCount >= entry.maxRetries) {
      await this.store.update(entry.entryId, {
        status: 'exhausted',
        retryCount: newRetryCount,
        lastRetryAt: new Date().toISOString(),
      });
    } else {
      await this.store.update(entry.entryId, {
        status: 'pending',
        retryCount: newRetryCount,
        lastRetryAt: new Date().toISOString(),
        nextRetryAt: this.calculateNextRetry(newRetryCount),
      });
    }
  }

  private calculateNextRetry(retryCount: number): string {
    const delay = this.config.retryDelayMs *
      Math.pow(this.config.retryBackoffMultiplier, retryCount);
    return new Date(Date.now() + delay).toISOString();
  }

  private async enforceMaxEntries(): Promise<void> {
    const count = await this.store.count();
    if (count > this.config.maxEntries) {
      // Delete oldest exhausted entries first
      await this.store.deleteExpired();
    }
  }
}

interface DLQListOptions {
  status?: DeadLetterEntry['status'];
  nextRetryBefore?: string;
  limit?: number;
  offset?: number;
}

interface DLQProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  exhausted: number;
}
```

---

### 4.2 Saga Pattern (Compensation)

**Purpose**: Manage distributed transactions with compensating actions on failure.

#### Contract Schema

```typescript
// packages/contracts/src/saga/v1/saga.ts

import { z } from 'zod';

export const CompensationActionSchema = z.object({
  stepId: z.string(),
  action: z.enum(['rollback', 'notify', 'log', 'custom']),
  handler: z.string(), // Function name or agent ID
  timeout: z.number().int().min(1000).max(300000).optional(),
  required: z.boolean().default(true), // Must succeed for saga to complete
});

export type CompensationAction = z.infer<typeof CompensationActionSchema>;

export const SagaDefinitionSchema = z.object({
  sagaId: z.string(),
  workflowId: z.string().optional(),
  compensations: z.array(CompensationActionSchema),
  onFailure: z.enum(['compensate', 'pause', 'continue']).default('compensate'),
  compensationOrder: z.enum(['reverse', 'parallel']).default('reverse'),
});

export type SagaDefinition = z.infer<typeof SagaDefinitionSchema>;

export const SagaStateSchema = z.object({
  sagaId: z.string(),
  executionId: z.string().uuid(),
  status: z.enum(['running', 'completed', 'compensating', 'failed', 'paused']),
  completedSteps: z.array(z.string()),
  failedStep: z.string().optional(),
  failureReason: z.string().optional(),
  compensatedSteps: z.array(z.string()),
  compensationErrors: z.array(z.object({
    stepId: z.string(),
    error: z.string(),
  })),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type SagaState = z.infer<typeof SagaStateSchema>;
```

#### Implementation

```typescript
// packages/core/saga/src/saga-orchestrator.ts

export class SagaOrchestrator {
  constructor(
    private readonly compensationHandlers: Map<string, CompensationHandler>,
    private readonly store: SagaStore
  ) {}

  /**
   * Execute saga with compensation on failure
   * INV-SG-001: Compensations run in reverse order on failure
   * INV-SG-002: All required compensations must succeed
   */
  async executeSaga<T>(
    definition: SagaDefinition,
    steps: SagaStep<T>[],
    context: SagaContext
  ): Promise<SagaResult<T>> {
    const executionId = crypto.randomUUID();
    const state: SagaState = {
      sagaId: definition.sagaId,
      executionId,
      status: 'running',
      completedSteps: [],
      compensatedSteps: [],
      compensationErrors: [],
      startedAt: new Date().toISOString(),
    };

    await this.store.save(state);

    try {
      const results: T[] = [];

      for (const step of steps) {
        try {
          const result = await step.execute(context);
          results.push(result);
          state.completedSteps.push(step.stepId);
          await this.store.save(state);
        } catch (error) {
          state.failedStep = step.stepId;
          state.failureReason = error instanceof Error ? error.message : 'Unknown error';

          if (definition.onFailure === 'compensate') {
            await this.runCompensations(definition, state, context);
          } else if (definition.onFailure === 'pause') {
            state.status = 'paused';
            await this.store.save(state);
          }

          return {
            success: false,
            executionId,
            error: state.failureReason,
            compensated: state.status === 'compensating',
          };
        }
      }

      state.status = 'completed';
      state.completedAt = new Date().toISOString();
      await this.store.save(state);

      return { success: true, executionId, results };
    } catch (error) {
      state.status = 'failed';
      await this.store.save(state);
      throw error;
    }
  }

  /**
   * Run compensating actions in reverse order
   */
  private async runCompensations(
    definition: SagaDefinition,
    state: SagaState,
    context: SagaContext
  ): Promise<void> {
    state.status = 'compensating';
    await this.store.save(state);

    // Get compensations for completed steps in reverse order
    const compensationsToRun = definition.compensations
      .filter(c => state.completedSteps.includes(c.stepId))
      .reverse();

    if (definition.compensationOrder === 'parallel') {
      await this.runCompensationsParallel(compensationsToRun, state, context);
    } else {
      await this.runCompensationsSequential(compensationsToRun, state, context);
    }
  }

  private async runCompensationsSequential(
    compensations: CompensationAction[],
    state: SagaState,
    context: SagaContext
  ): Promise<void> {
    for (const compensation of compensations) {
      try {
        await this.executeCompensation(compensation, context);
        state.compensatedSteps.push(compensation.stepId);
        await this.store.save(state);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        state.compensationErrors.push({
          stepId: compensation.stepId,
          error: errorMsg,
        });

        if (compensation.required) {
          state.status = 'failed';
          await this.store.save(state);
          throw new SagaCompensationError(
            `Required compensation failed for step ${compensation.stepId}`,
            state.compensationErrors
          );
        }
      }
    }
  }

  private async executeCompensation(
    compensation: CompensationAction,
    context: SagaContext
  ): Promise<void> {
    const handler = this.compensationHandlers.get(compensation.handler);
    if (!handler) {
      throw new Error(`Compensation handler not found: ${compensation.handler}`);
    }

    const timeoutMs = compensation.timeout ?? 30000;
    const result = await Promise.race([
      handler.compensate(compensation.stepId, context),
      this.timeoutPromise(timeoutMs),
    ]);

    if (!result.success) {
      throw new Error(result.error ?? 'Compensation failed');
    }
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Compensation timeout')), ms);
    });
  }

  private async runCompensationsParallel(
    compensations: CompensationAction[],
    state: SagaState,
    context: SagaContext
  ): Promise<void> {
    const results = await Promise.allSettled(
      compensations.map(c => this.executeCompensation(c, context))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const compensation = compensations[i];

      if (result.status === 'fulfilled') {
        state.compensatedSteps.push(compensation.stepId);
      } else {
        state.compensationErrors.push({
          stepId: compensation.stepId,
          error: result.reason?.message ?? 'Unknown error',
        });
      }
    }

    await this.store.save(state);
  }
}

interface SagaStep<T> {
  stepId: string;
  execute(context: SagaContext): Promise<T>;
}

interface SagaContext {
  correlationId: string;
  [key: string]: unknown;
}

interface SagaResult<T> {
  success: boolean;
  executionId: string;
  results?: T[];
  error?: string;
  compensated?: boolean;
}

interface CompensationHandler {
  compensate(stepId: string, context: SagaContext): Promise<{ success: boolean; error?: string }>;
}

class SagaCompensationError extends Error {
  constructor(
    message: string,
    public readonly compensationErrors: Array<{ stepId: string; error: string }>
  ) {
    super(message);
    this.name = 'SagaCompensationError';
  }
}
```

---

### 4.3 Data Retention

**Purpose**: Automatic cleanup of old data based on configurable policies.

#### Contract Schema

```typescript
// packages/contracts/src/retention/v1/retention.ts

import { z } from 'zod';

export const RetentionPolicySchema = z.object({
  policyId: z.string(),

  /** Data type this policy applies to */
  dataType: z.enum(['traces', 'sessions', 'memory', 'checkpoints', 'dlq', 'audit']),

  /** Retention period in days */
  retentionDays: z.number().int().min(1).max(365),

  /** Archive before delete */
  archiveBeforeDelete: z.boolean().default(false),

  /** Archive path (if archiving) */
  archivePath: z.string().optional(),

  /** Conditions for retention (optional) */
  conditions: z.object({
    status: z.array(z.string()).optional(), // Only delete if status matches
    excludeTags: z.array(z.string()).optional(), // Don't delete if has tag
  }).optional(),

  /** Run schedule (cron expression) */
  schedule: z.string().default('0 3 * * *'), // Default: 3 AM daily

  enabled: z.boolean().default(true),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

export const RetentionRunResultSchema = z.object({
  runId: z.string().uuid(),
  policyId: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  entriesProcessed: z.number().int(),
  entriesDeleted: z.number().int(),
  entriesArchived: z.number().int(),
  errors: z.array(z.string()),
});

export type RetentionRunResult = z.infer<typeof RetentionRunResultSchema>;
```

#### Implementation

```typescript
// packages/core/retention/src/retention-manager.ts

export class RetentionManager {
  constructor(
    private readonly stores: Map<string, RetentionStore>,
    private readonly archiver: DataArchiver | null
  ) {}

  /**
   * Run retention policy
   */
  async runPolicy(policy: RetentionPolicy): Promise<RetentionRunResult> {
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    let entriesProcessed = 0;
    let entriesDeleted = 0;
    let entriesArchived = 0;

    const store = this.stores.get(policy.dataType);
    if (!store) {
      throw new Error(`No store found for data type: ${policy.dataType}`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    try {
      // Find entries to process
      const entries = await store.findExpired(
        cutoffDate.toISOString(),
        policy.conditions
      );
      entriesProcessed = entries.length;

      for (const entry of entries) {
        try {
          // Archive if configured
          if (policy.archiveBeforeDelete && this.archiver) {
            await this.archiver.archive(policy.dataType, entry, policy.archivePath);
            entriesArchived++;
          }

          // Delete
          await store.delete(entry.id);
          entriesDeleted++;
        } catch (error) {
          errors.push(`Failed to process ${entry.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
    } catch (error) {
      errors.push(`Policy execution failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return {
      runId,
      policyId: policy.policyId,
      startedAt,
      completedAt: new Date().toISOString(),
      entriesProcessed,
      entriesDeleted,
      entriesArchived,
      errors,
    };
  }

  /**
   * Run all enabled policies
   */
  async runAllPolicies(policies: RetentionPolicy[]): Promise<RetentionRunResult[]> {
    const results: RetentionRunResult[] = [];

    for (const policy of policies.filter(p => p.enabled)) {
      const result = await this.runPolicy(policy);
      results.push(result);
    }

    return results;
  }
}

interface RetentionStore {
  findExpired(
    cutoffDate: string,
    conditions?: { status?: string[]; excludeTags?: string[] }
  ): Promise<Array<{ id: string; [key: string]: unknown }>>;
  delete(id: string): Promise<void>;
}

interface DataArchiver {
  archive(dataType: string, entry: unknown, path?: string): Promise<void>;
}
```

---

### 4.4 Idempotency Support

**Purpose**: Prevent duplicate processing of the same request.

#### Contract Schema

```typescript
// packages/contracts/src/idempotency/v1/idempotency.ts

import { z } from 'zod';

export const IdempotencyKeySchema = z.string().uuid();

export const IdempotencyCacheEntrySchema = z.object({
  key: IdempotencyKeySchema,
  requestHash: z.string(),
  response: z.unknown(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: z.enum(['processing', 'completed', 'failed']),
});

export type IdempotencyCacheEntry = z.infer<typeof IdempotencyCacheEntrySchema>;

export const IdempotencyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** TTL for cached responses (seconds) */
  ttlSeconds: z.number().int().min(60).max(86400).default(3600),
  /** Max cached entries */
  maxEntries: z.number().int().min(100).max(100000).default(10000),
});

export type IdempotencyConfig = z.infer<typeof IdempotencyConfigSchema>;
```

#### Implementation

```typescript
// packages/core/idempotency/src/idempotency-manager.ts

export class IdempotencyManager {
  constructor(
    private readonly store: IdempotencyStore,
    private readonly config: IdempotencyConfig
  ) {}

  /**
   * Check if request was already processed
   * Returns cached response if available
   */
  async checkAndLock(
    idempotencyKey: string,
    requestHash: string
  ): Promise<IdempotencyCheckResult> {
    const existing = await this.store.get(idempotencyKey);

    if (existing) {
      // Check if same request
      if (existing.requestHash !== requestHash) {
        return {
          status: 'conflict',
          error: 'Idempotency key already used with different request',
        };
      }

      // Return cached response if completed
      if (existing.status === 'completed') {
        return {
          status: 'cached',
          response: existing.response,
          cachedAt: existing.createdAt,
        };
      }

      // Still processing
      if (existing.status === 'processing') {
        return {
          status: 'processing',
        };
      }

      // Previous attempt failed, allow retry
      if (existing.status === 'failed') {
        await this.store.update(idempotencyKey, { status: 'processing' });
        return { status: 'new' };
      }
    }

    // Create new entry
    const entry: IdempotencyCacheEntry = {
      key: idempotencyKey,
      requestHash,
      response: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.ttlSeconds * 1000).toISOString(),
      status: 'processing',
    };

    await this.store.save(entry);
    return { status: 'new' };
  }

  /**
   * Store successful response
   */
  async complete(idempotencyKey: string, response: unknown): Promise<void> {
    await this.store.update(idempotencyKey, {
      response,
      status: 'completed',
    });
  }

  /**
   * Mark as failed (allows retry)
   */
  async fail(idempotencyKey: string, error: string): Promise<void> {
    await this.store.update(idempotencyKey, {
      response: { error },
      status: 'failed',
    });
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    return this.store.deleteExpired();
  }
}

interface IdempotencyCheckResult {
  status: 'new' | 'cached' | 'processing' | 'conflict';
  response?: unknown;
  cachedAt?: string;
  error?: string;
}

interface IdempotencyStore {
  get(key: string): Promise<IdempotencyCacheEntry | null>;
  save(entry: IdempotencyCacheEntry): Promise<void>;
  update(key: string, updates: Partial<IdempotencyCacheEntry>): Promise<void>;
  deleteExpired(): Promise<number>;
}
```

---

## Phase 5: Agent Governance (P2)

### 5.1 Agent Behavior Policies

**Purpose**: Control what agents can access and do.

#### Contract Schema

```typescript
// packages/contracts/src/guard/v1/agent-policy.ts

import { z } from 'zod';

export const AgentPolicySchema = z.object({
  policyId: z.string(),

  /** Agent this applies to (* for all) */
  agentId: z.string().default('*'),

  /** Team this applies to (optional) */
  team: z.string().optional(),

  // === Data Access Control ===

  /** Can access memory domain */
  canAccessMemory: z.boolean().default(true),

  /** Can access session domain */
  canAccessSessions: z.boolean().default(true),

  /** Allowed memory namespaces */
  allowedMemoryNamespaces: z.array(z.string()).default(['*']),

  /** Forbidden memory namespaces */
  forbiddenMemoryNamespaces: z.array(z.string()).default([]),

  // === Delegation Control ===

  /** Can delegate to other agents */
  canDelegate: z.boolean().default(true),

  /** Agents this can delegate to (patterns supported) */
  allowedDelegates: z.array(z.string()).default(['*']),

  /** Agents this cannot delegate to */
  forbiddenDelegates: z.array(z.string()).default([]),

  /** Maximum delegation depth */
  maxDelegationDepth: z.number().int().min(0).max(10).default(3),

  // === Resource Limits ===

  /** Max tokens per request */
  maxTokensPerRequest: z.number().int().min(1).max(1000000).default(100000),

  /** Max requests per minute */
  maxRequestsPerMinute: z.number().int().min(1).max(1000).default(60),

  /** Max concurrent executions */
  maxConcurrentExecutions: z.number().int().min(1).max(10).default(3),

  /** Max session duration (ms) */
  maxSessionDurationMs: z.number().int().min(60000).max(86400000).default(3600000),

  // === Capability Control ===

  /** Allowed capabilities */
  allowedCapabilities: z.array(z.string()).default(['*']),

  /** Forbidden capabilities */
  forbiddenCapabilities: z.array(z.string()).default([]),

  // === Tool Access ===

  /** Allowed MCP tools */
  allowedTools: z.array(z.string()).default(['*']),

  /** Forbidden MCP tools */
  forbiddenTools: z.array(z.string()).default([]),

  // === File System ===

  /** Allowed paths (globs) */
  allowedPaths: z.array(z.string()).default(['**']),

  /** Forbidden paths (globs) */
  forbiddenPaths: z.array(z.string()).default([]),

  /** Metadata */
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
  description: z.string().optional(),
});

export type AgentPolicy = z.infer<typeof AgentPolicySchema>;
```

#### Implementation

```typescript
// packages/guard/src/agent-policy-enforcer.ts

export class AgentPolicyEnforcer {
  constructor(
    private readonly policies: AgentPolicy[]
  ) {}

  /**
   * Get effective policy for an agent
   * Merges matching policies by priority
   */
  getEffectivePolicy(agentId: string, team?: string): EffectivePolicy {
    const matching = this.policies
      .filter(p => p.enabled)
      .filter(p => this.matchesAgent(p, agentId, team))
      .sort((a, b) => b.priority - a.priority);

    if (matching.length === 0) {
      return this.getDefaultPolicy();
    }

    // Merge policies (higher priority wins for conflicts)
    return this.mergePolicies(matching);
  }

  /**
   * Check if action is allowed
   */
  checkAccess(
    agentId: string,
    action: PolicyAction,
    resource: string,
    team?: string
  ): PolicyCheckResult {
    const policy = this.getEffectivePolicy(agentId, team);

    switch (action) {
      case 'accessMemory':
        return this.checkMemoryAccess(policy, resource);
      case 'delegate':
        return this.checkDelegation(policy, resource);
      case 'useTool':
        return this.checkToolAccess(policy, resource);
      case 'accessPath':
        return this.checkPathAccess(policy, resource);
      case 'useCapability':
        return this.checkCapability(policy, resource);
      default:
        return { allowed: false, reason: 'Unknown action type' };
    }
  }

  /**
   * Check resource limits
   */
  checkLimits(
    agentId: string,
    usage: ResourceUsage,
    team?: string
  ): LimitCheckResult {
    const policy = this.getEffectivePolicy(agentId, team);
    const violations: string[] = [];

    if (usage.tokensThisRequest > policy.maxTokensPerRequest) {
      violations.push(`Token limit exceeded: ${usage.tokensThisRequest} > ${policy.maxTokensPerRequest}`);
    }

    if (usage.requestsThisMinute > policy.maxRequestsPerMinute) {
      violations.push(`Request rate exceeded: ${usage.requestsThisMinute} > ${policy.maxRequestsPerMinute}`);
    }

    if (usage.concurrentExecutions > policy.maxConcurrentExecutions) {
      violations.push(`Concurrent execution limit exceeded: ${usage.concurrentExecutions} > ${policy.maxConcurrentExecutions}`);
    }

    return {
      withinLimits: violations.length === 0,
      violations,
      limits: {
        maxTokensPerRequest: policy.maxTokensPerRequest,
        maxRequestsPerMinute: policy.maxRequestsPerMinute,
        maxConcurrentExecutions: policy.maxConcurrentExecutions,
      },
    };
  }

  private matchesAgent(policy: AgentPolicy, agentId: string, team?: string): boolean {
    // Match by agent ID
    if (policy.agentId !== '*' && policy.agentId !== agentId) {
      // Check pattern match
      if (!this.matchPattern(policy.agentId, agentId)) {
        return false;
      }
    }

    // Match by team
    if (policy.team && team && policy.team !== team) {
      return false;
    }

    return true;
  }

  private checkMemoryAccess(policy: EffectivePolicy, namespace: string): PolicyCheckResult {
    if (!policy.canAccessMemory) {
      return { allowed: false, reason: 'Memory access disabled for agent' };
    }

    if (policy.forbiddenMemoryNamespaces.some(n => this.matchPattern(n, namespace))) {
      return { allowed: false, reason: `Namespace ${namespace} is forbidden` };
    }

    if (!policy.allowedMemoryNamespaces.some(n => this.matchPattern(n, namespace))) {
      return { allowed: false, reason: `Namespace ${namespace} is not in allowed list` };
    }

    return { allowed: true };
  }

  private checkDelegation(policy: EffectivePolicy, targetAgentId: string): PolicyCheckResult {
    if (!policy.canDelegate) {
      return { allowed: false, reason: 'Delegation disabled for agent' };
    }

    if (policy.forbiddenDelegates.some(d => this.matchPattern(d, targetAgentId))) {
      return { allowed: false, reason: `Cannot delegate to ${targetAgentId}` };
    }

    if (!policy.allowedDelegates.some(d => this.matchPattern(d, targetAgentId))) {
      return { allowed: false, reason: `${targetAgentId} is not in allowed delegates` };
    }

    return { allowed: true };
  }

  private checkToolAccess(policy: EffectivePolicy, toolName: string): PolicyCheckResult {
    if (policy.forbiddenTools.some(t => this.matchPattern(t, toolName))) {
      return { allowed: false, reason: `Tool ${toolName} is forbidden` };
    }

    if (!policy.allowedTools.some(t => this.matchPattern(t, toolName))) {
      return { allowed: false, reason: `Tool ${toolName} is not allowed` };
    }

    return { allowed: true };
  }

  private checkPathAccess(policy: EffectivePolicy, path: string): PolicyCheckResult {
    if (policy.forbiddenPaths.some(p => this.matchGlob(p, path))) {
      return { allowed: false, reason: `Path ${path} is forbidden` };
    }

    if (!policy.allowedPaths.some(p => this.matchGlob(p, path))) {
      return { allowed: false, reason: `Path ${path} is not allowed` };
    }

    return { allowed: true };
  }

  private checkCapability(policy: EffectivePolicy, capability: string): PolicyCheckResult {
    if (policy.forbiddenCapabilities.some(c => this.matchPattern(c, capability))) {
      return { allowed: false, reason: `Capability ${capability} is forbidden` };
    }

    if (!policy.allowedCapabilities.some(c => this.matchPattern(c, capability))) {
      return { allowed: false, reason: `Capability ${capability} is not allowed` };
    }

    return { allowed: true };
  }

  private matchPattern(pattern: string, value: string): boolean {
    if (pattern === '*') return true;
    if (pattern === value) return true;

    // Simple wildcard matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(value);
  }

  private matchGlob(pattern: string, path: string): boolean {
    // Simplified glob matching
    const regex = new RegExp(
      '^' + pattern
        .replace(/\*\*/g, '<<DOUBLESTAR>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<DOUBLESTAR>>/g, '.*')
        .replace(/\?/g, '.') + '$'
    );
    return regex.test(path);
  }

  private mergePolicies(policies: AgentPolicy[]): EffectivePolicy {
    // Start with highest priority policy
    const base = { ...policies[0] } as EffectivePolicy;

    // Merge arrays (union for allowed, intersection for forbidden)
    for (const policy of policies.slice(1)) {
      // For forbidden lists, take union (more restrictive)
      base.forbiddenMemoryNamespaces = [
        ...new Set([...base.forbiddenMemoryNamespaces, ...policy.forbiddenMemoryNamespaces])
      ];
      base.forbiddenDelegates = [
        ...new Set([...base.forbiddenDelegates, ...policy.forbiddenDelegates])
      ];
      base.forbiddenTools = [
        ...new Set([...base.forbiddenTools, ...policy.forbiddenTools])
      ];
      base.forbiddenPaths = [
        ...new Set([...base.forbiddenPaths, ...policy.forbiddenPaths])
      ];
      base.forbiddenCapabilities = [
        ...new Set([...base.forbiddenCapabilities, ...policy.forbiddenCapabilities])
      ];
    }

    return base;
  }

  private getDefaultPolicy(): EffectivePolicy {
    return {
      policyId: 'default',
      agentId: '*',
      canAccessMemory: true,
      canAccessSessions: true,
      allowedMemoryNamespaces: ['*'],
      forbiddenMemoryNamespaces: [],
      canDelegate: true,
      allowedDelegates: ['*'],
      forbiddenDelegates: [],
      maxDelegationDepth: 3,
      maxTokensPerRequest: 100000,
      maxRequestsPerMinute: 60,
      maxConcurrentExecutions: 3,
      maxSessionDurationMs: 3600000,
      allowedCapabilities: ['*'],
      forbiddenCapabilities: [],
      allowedTools: ['*'],
      forbiddenTools: [],
      allowedPaths: ['**'],
      forbiddenPaths: [],
      enabled: true,
      priority: 0,
    };
  }
}

type PolicyAction = 'accessMemory' | 'delegate' | 'useTool' | 'accessPath' | 'useCapability';

interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

interface ResourceUsage {
  tokensThisRequest: number;
  requestsThisMinute: number;
  concurrentExecutions: number;
}

interface LimitCheckResult {
  withinLimits: boolean;
  violations: string[];
  limits: {
    maxTokensPerRequest: number;
    maxRequestsPerMinute: number;
    maxConcurrentExecutions: number;
  };
}

type EffectivePolicy = AgentPolicy;
```

---

## Implementation Plan

### Phase 1: Provider Resilience (Week 1-2)

| Task | Package | Files | Priority |
|------|---------|-------|----------|
| Circuit breaker contract | contracts | `provider/v1/circuit-breaker.ts` | P0 |
| Circuit breaker impl | adapters/providers | `circuit-breaker.ts` | P0 |
| Rate limit contract | contracts | `provider/v1/rate-limit.ts` | P0 |
| Rate limiter impl | adapters/providers | `rate-limiter.ts` | P0 |
| Health monitor contract | contracts | `provider/v1/health.ts` | P0 |
| Health monitor impl | adapters/providers | `health-monitor.ts` | P0 |
| Resilient adapter | adapters/providers | `resilient-adapter.ts` | P0 |
| Integration tests | tests | `provider-resilience.test.ts` | P0 |

### Phase 2: Agent Execution (Week 2-3)

| Task | Package | Files | Priority |
|------|---------|-------|----------|
| Checkpoint contract | contracts | `agent/v1/checkpoint.ts` | P1 |
| Checkpoint manager | core/agent-domain | `checkpoint-manager.ts` | P1 |
| Checkpoint store | adapters/sqlite | `checkpoint-store.ts` | P1 |
| Parallel execution contract | contracts | `workflow/v1/parallel.ts` | P1 |
| Parallel executor | core/workflow-engine | `parallel-executor.ts` | P1 |
| Delegation contract | contracts | `agent/v1/delegation.ts` | P1 |
| Delegation tracker | core/agent-domain | `delegation-tracker.ts` | P1 |
| Integration tests | tests | `agent-execution.test.ts` | P1 |

### Phase 3: Content (Week 3)

| Task | Location | Count | Priority |
|------|----------|-------|----------|
| Agent profiles | examples/agents | 6 files | P1 |
| Ability templates | examples/abilities | 29 files | P1 |

### Phase 4: Cross-Cutting (Week 4-5)

| Task | Package | Files | Priority |
|------|---------|-------|----------|
| DLQ contract | contracts | `dlq/v1/dead-letter.ts` | P2 |
| DLQ impl | core/dlq | `dead-letter-queue.ts` | P2 |
| DLQ store | adapters/sqlite | `dlq-store.ts` | P2 |
| Saga contract | contracts | `saga/v1/saga.ts` | P2 |
| Saga orchestrator | core/saga | `saga-orchestrator.ts` | P2 |
| Retention contract | contracts | `retention/v1/retention.ts` | P2 |
| Retention manager | core/retention | `retention-manager.ts` | P2 |
| Idempotency contract | contracts | `idempotency/v1/idempotency.ts` | P2 |
| Idempotency manager | core/idempotency | `idempotency-manager.ts` | P2 |
| Tests | tests | `cross-cutting.test.ts` | P2 |

### Phase 5: Agent Governance (Week 5-6)

| Task | Package | Files | Priority |
|------|---------|-------|----------|
| Agent policy contract | contracts | `guard/v1/agent-policy.ts` | P2 |
| Policy enforcer | guard | `agent-policy-enforcer.ts` | P2 |
| Policy store | adapters/sqlite | `policy-store.ts` | P2 |
| CLI commands | cli | `guard.ts` updates | P2 |
| MCP tools | mcp-server | `guard.ts` updates | P2 |
| Tests | tests | `agent-governance.test.ts` | P2 |

---

## Success Criteria

### Phase 1: Provider Resilience
- [ ] Circuit breaker prevents calls to unhealthy providers
- [ ] Rate limiter enforces request limits
- [ ] Health status accurately reflects provider state
- [ ] Automatic recovery when provider becomes healthy
- [ ] All invariants tested

### Phase 2: Agent Execution
- [ ] Agents can resume from checkpoints after failure
- [ ] Parallel steps execute concurrently
- [ ] Delegation depth enforced
- [ ] No circular delegations possible
- [ ] All invariants tested

### Phase 3: Content
- [ ] 20 total agent profiles available
- [ ] 50 total ability templates available
- [ ] All content validated against schemas

### Phase 4: Cross-Cutting
- [ ] Failed events captured in DLQ
- [ ] Automatic retry with backoff
- [ ] Saga compensations work correctly
- [ ] Data retention runs on schedule
- [ ] Idempotency prevents duplicates

### Phase 5: Agent Governance
- [ ] Policies correctly restrict agent behavior
- [ ] Resource limits enforced
- [ ] Tool access controlled
- [ ] Path access controlled
- [ ] All policy types tested

---

## File Summary

### New Files to Create

```
packages/
├── contracts/src/
│   ├── provider/v1/
│   │   ├── circuit-breaker.ts
│   │   ├── rate-limit.ts
│   │   └── health.ts
│   ├── agent/v1/
│   │   ├── checkpoint.ts
│   │   └── delegation.ts
│   ├── workflow/v1/
│   │   └── parallel.ts
│   ├── dlq/v1/
│   │   └── dead-letter.ts
│   ├── saga/v1/
│   │   └── saga.ts
│   ├── retention/v1/
│   │   └── retention.ts
│   ├── idempotency/v1/
│   │   └── idempotency.ts
│   └── guard/v1/
│       └── agent-policy.ts
├── adapters/
│   ├── providers/src/
│   │   ├── circuit-breaker.ts
│   │   ├── rate-limiter.ts
│   │   ├── health-monitor.ts
│   │   └── resilient-adapter.ts
│   └── sqlite/src/
│       ├── checkpoint-store.ts
│       ├── dlq-store.ts
│       ├── saga-store.ts
│       ├── retention-store.ts
│       └── idempotency-store.ts
├── core/
│   ├── agent-domain/src/
│   │   ├── checkpoint-manager.ts
│   │   └── delegation-tracker.ts
│   ├── workflow-engine/src/
│   │   └── parallel-executor.ts
│   ├── dlq/src/
│   │   └── dead-letter-queue.ts
│   ├── saga/src/
│   │   └── saga-orchestrator.ts
│   ├── retention/src/
│   │   └── retention-manager.ts
│   └── idempotency/src/
│       └── idempotency-manager.ts
└── guard/src/
    └── agent-policy-enforcer.ts

examples/
├── agents/
│   ├── aerospace-scientist.json
│   ├── ceo.json
│   ├── creative-marketer.json
│   ├── quantum-engineer.json
│   ├── ml-engineer.json
│   └── blockchain-developer.json
└── abilities/
    └── (29 new ability files)

tests/
├── core/
│   ├── checkpoint.test.ts
│   ├── parallel-execution.test.ts
│   ├── delegation.test.ts
│   ├── dlq.test.ts
│   ├── saga.test.ts
│   ├── retention.test.ts
│   └── idempotency.test.ts
├── adapters/
│   └── provider-resilience.test.ts
└── guard/
    └── agent-policy.test.ts
```

### Estimated Effort

| Phase | New Files | Lines of Code | Tests |
|-------|-----------|---------------|-------|
| Phase 1 | 7 | ~800 | ~50 |
| Phase 2 | 6 | ~700 | ~40 |
| Phase 3 | 35 | ~2000 | ~20 |
| Phase 4 | 10 | ~900 | ~50 |
| Phase 5 | 3 | ~400 | ~30 |
| **Total** | **61** | **~4800** | **~190** |

---

## Appendix: Invariant Summary

| ID | Component | Invariant |
|----|-----------|-----------|
| INV-CB-001 | Circuit Breaker | Closed allows all requests |
| INV-CB-002 | Circuit Breaker | Open rejects until timeout |
| INV-CB-003 | Circuit Breaker | Half-open limits test requests |
| INV-CB-004 | Circuit Breaker | Threshold triggers open |
| INV-CB-005 | Circuit Breaker | Success in half-open closes |
| INV-RL-001 | Rate Limiter | Burst capacity respected |
| INV-RL-002 | Rate Limiter | Refill rate accurate |
| INV-RL-003 | Rate Limiter | Strategy honored |
| INV-RL-004 | Rate Limiter | Queue bounded |
| INV-CP-001 | Checkpoint | Contains all resume data |
| INV-CP-002 | Checkpoint | Resume starts after checkpoint |
| INV-PE-001 | Parallel Exec | Independent steps concurrent |
| INV-PE-002 | Parallel Exec | Dependencies honored |
| INV-PE-003 | Parallel Exec | Concurrency limited |
| INV-DT-001 | Delegation | Depth never exceeds max |
| INV-DT-002 | Delegation | No circular delegations |
| INV-SG-001 | Saga | Compensations reverse order |
| INV-SG-002 | Saga | Required compensations must succeed |
