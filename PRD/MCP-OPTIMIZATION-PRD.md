# MCP Server Optimization PRD

## Overview

This PRD addresses critical performance, reliability, and maintainability issues in the AutomatosX MCP server implementation. All optimizations follow the contract-first architecture with Zod schemas, domain separation, invariants, and guard policies.

---

## Problems Identified

| ID | Problem | Severity | Impact |
|----|---------|----------|--------|
| P1 | Unbounded artifact cache memory growth | Critical | Server crashes |
| P2 | Missing timeout protection | Critical | Hanging requests |
| P3 | Duplicated response formatting | High | Maintenance burden |
| P4 | Missing array size validation | High | Resource exhaustion |
| P5 | Inefficient memory tool operations | High | O(n) on every call |
| P6 | Incomplete error handling | Medium | Poor debuggability |
| P7 | Missing output schema validation | Medium | Inconsistent responses |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Application Layer                                              │
│  packages/mcp-server/src/                                       │
├─────────────────────────────────────────────────────────────────┤
│  Guard Layer                                                    │
│  packages/guard/src/policies/mcp-policy.ts                      │
│  - Request size limits                                          │
│  - Timeout enforcement                                          │
│  - Memory pressure checks                                       │
├─────────────────────────────────────────────────────────────────┤
│  Core Domain                                                    │
│  packages/core/mcp-runtime/src/                                 │
│  - Cache management (LRU eviction)                              │
│  - Timeout handling                                             │
│  - Response formatting                                          │
│  - Request validation                                           │
├─────────────────────────────────────────────────────────────────┤
│  Contracts                                                      │
│  packages/contracts/src/mcp/v1/                                 │
│  - Runtime schemas (cache, timeout, limits)                     │
│  - Response schemas                                             │
│  - Error schemas                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: LRU Cache with Eviction

### Contract: `packages/contracts/src/mcp/v1/cache/schema.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// Cache Entry Schema
// ============================================================================

export const MCPCacheEntrySchema = z.object({
  /** Unique key */
  key: z.string().min(1).max(256),
  /** Stored value */
  value: z.unknown(),
  /** Size in bytes (estimated) */
  sizeBytes: z.number().int().nonnegative(),
  /** Creation timestamp */
  createdAt: z.number().int().positive(),
  /** Last access timestamp */
  lastAccessedAt: z.number().int().positive(),
  /** Access count */
  accessCount: z.number().int().nonnegative().default(0),
  /** Time-to-live in milliseconds (0 = no expiry) */
  ttlMs: z.number().int().nonnegative().default(0),
});

export type MCPCacheEntry = z.infer<typeof MCPCacheEntrySchema>;

// ============================================================================
// Cache Configuration Schema
// ============================================================================

export const MCPCacheConfigSchema = z.object({
  /** Maximum cache size in bytes */
  maxSizeBytes: z.number().int().positive().default(104_857_600), // 100MB
  /** Maximum number of entries */
  maxEntries: z.number().int().positive().default(10_000),
  /** Default TTL in milliseconds (0 = no expiry) */
  defaultTtlMs: z.number().int().nonnegative().default(3_600_000), // 1 hour
  /** Eviction policy */
  evictionPolicy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
  /** High water mark (trigger eviction) */
  highWaterMark: z.number().min(0.5).max(1).default(0.9),
  /** Low water mark (eviction target) */
  lowWaterMark: z.number().min(0.1).max(0.9).default(0.7),
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs: z.number().int().positive().default(60_000), // 1 minute
});

export type MCPCacheConfig = z.infer<typeof MCPCacheConfigSchema>;

// ============================================================================
// Cache Statistics Schema
// ============================================================================

export const MCPCacheStatsSchema = z.object({
  /** Current entry count */
  entryCount: z.number().int().nonnegative(),
  /** Current size in bytes */
  currentSizeBytes: z.number().int().nonnegative(),
  /** Maximum size in bytes */
  maxSizeBytes: z.number().int().positive(),
  /** Hit count since start */
  hitCount: z.number().int().nonnegative(),
  /** Miss count since start */
  missCount: z.number().int().nonnegative(),
  /** Hit rate (0-1) */
  hitRate: z.number().min(0).max(1),
  /** Eviction count since start */
  evictionCount: z.number().int().nonnegative(),
  /** Last cleanup timestamp */
  lastCleanupAt: z.number().int().nonnegative().optional(),
  /** Memory pressure level */
  pressureLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

export type MCPCacheStats = z.infer<typeof MCPCacheStatsSchema>;

// ============================================================================
// Cache Operations
// ============================================================================

export const CacheGetResultSchema = z.object({
  hit: z.boolean(),
  value: z.unknown().optional(),
  entry: MCPCacheEntrySchema.optional(),
});

export type CacheGetResult = z.infer<typeof CacheGetResultSchema>;

export const CacheSetOptionsSchema = z.object({
  ttlMs: z.number().int().nonnegative().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export type CacheSetOptions = z.infer<typeof CacheSetOptionsSchema>;
```

### Invariants: `packages/contracts/src/mcp/v1/cache/invariants.md`

```markdown
# MCP Cache Invariants

## INV-MCP-CACHE-001: Size Bound
**Statement:** Cache size MUST NOT exceed maxSizeBytes.
**Rationale:** Prevents memory exhaustion.
**Enforcement:** Eviction triggered when highWaterMark exceeded.

## INV-MCP-CACHE-002: Entry Bound
**Statement:** Entry count MUST NOT exceed maxEntries.
**Rationale:** Prevents unbounded growth regardless of entry size.
**Enforcement:** Eviction triggered when maxEntries reached.

## INV-MCP-CACHE-003: TTL Expiration
**Statement:** Expired entries MUST NOT be returned.
**Rationale:** Stale data causes inconsistencies.
**Enforcement:** TTL check on get(), lazy cleanup on interval.

## INV-MCP-CACHE-004: LRU Ordering
**Statement:** When evictionPolicy='lru', least recently accessed entries MUST be evicted first.
**Rationale:** Preserves frequently accessed data.
**Enforcement:** lastAccessedAt updated on every access, eviction sorted by lastAccessedAt.

## INV-MCP-CACHE-005: Atomic Operations
**Statement:** Cache operations MUST be atomic (no partial states).
**Rationale:** Concurrent access safety.
**Enforcement:** Synchronous Map operations, size tracking in single operation.

## INV-MCP-CACHE-006: Size Accuracy
**Statement:** currentSizeBytes MUST equal sum of all entry sizeBytes within 1% tolerance.
**Rationale:** Accurate eviction decisions.
**Enforcement:** Size recalculation on cleanup, assertion in tests.
```

---

## Feature 2: Timeout Protection

### Contract: `packages/contracts/src/mcp/v1/timeout/schema.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// Timeout Configuration
// ============================================================================

export const MCPTimeoutConfigSchema = z.object({
  /** Default timeout for all operations (ms) */
  defaultTimeoutMs: z.number().int().positive().default(30_000),
  /** Timeout per tool category */
  toolTimeouts: z.object({
    /** Quick read operations */
    query: z.number().int().positive().default(10_000),
    /** Write operations */
    mutation: z.number().int().positive().default(30_000),
    /** Scan/analysis operations */
    scan: z.number().int().positive().default(120_000),
    /** Execution operations (agent/workflow) */
    execution: z.number().int().positive().default(1_200_000), // 20 minutes
  }),
  /** Per-tool overrides */
  toolOverrides: z.record(z.string(), z.number().int().positive()).default({}),
});

export type MCPTimeoutConfig = z.infer<typeof MCPTimeoutConfigSchema>;

// ============================================================================
// Timeout Result
// ============================================================================

export const TimeoutResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    result: z.unknown(),
    durationMs: z.number().int().nonnegative(),
  }),
  z.object({
    status: z.literal('timeout'),
    timeoutMs: z.number().int().positive(),
    partialResult: z.unknown().optional(),
  }),
  z.object({
    status: z.literal('error'),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
    durationMs: z.number().int().nonnegative(),
  }),
]);

export type TimeoutResult = z.infer<typeof TimeoutResultSchema>;

// ============================================================================
// Tool Categories
// ============================================================================

export const ToolCategorySchema = z.enum([
  'query',      // memory_retrieve, agent_get, session_status
  'mutation',   // memory_store, agent_register, session_create
  'scan',       // bugfix_scan, refactor_scan
  'execution',  // agent_run, workflow_run
]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // Query tools
  memory_retrieve: 'query',
  memory_search: 'query',
  memory_list: 'query',
  agent_get: 'query',
  agent_list: 'query',
  session_status: 'query',
  trace_get: 'query',
  trace_list: 'query',
  config_get: 'query',
  config_show: 'query',
  ability_list: 'query',
  guard_list: 'query',
  bugfix_list: 'query',
  refactor_list: 'query',
  workflow_list: 'query',
  workflow_describe: 'query',

  // Mutation tools
  memory_store: 'mutation',
  memory_delete: 'mutation',
  agent_register: 'mutation',
  agent_remove: 'mutation',
  session_create: 'mutation',
  session_join: 'mutation',
  session_leave: 'mutation',
  session_complete: 'mutation',
  session_fail: 'mutation',
  config_set: 'mutation',
  guard_apply: 'mutation',

  // Scan tools
  bugfix_scan: 'scan',
  refactor_scan: 'scan',
  trace_analyze: 'scan',
  guard_check: 'scan',

  // Execution tools
  agent_run: 'execution',
  workflow_run: 'execution',
  bugfix_run: 'execution',
  refactor_apply: 'execution',
  ability_inject: 'execution',
};
```

### Invariants: `packages/contracts/src/mcp/v1/timeout/invariants.md`

```markdown
# MCP Timeout Invariants

## INV-MCP-TIMEOUT-001: Guaranteed Termination
**Statement:** Every tool call MUST complete or timeout within configured limit.
**Rationale:** Prevents hanging connections and resource exhaustion.
**Enforcement:** Promise.race with timeout promise.

## INV-MCP-TIMEOUT-002: Category Consistency
**Statement:** Tools in same category MUST have same default timeout.
**Rationale:** Predictable behavior for similar operations.
**Enforcement:** Timeout lookup by category, not per-tool.

## INV-MCP-TIMEOUT-003: Override Precedence
**Statement:** Tool-specific overrides MUST take precedence over category defaults.
**Rationale:** Allows fine-tuning for special cases.
**Enforcement:** Check toolOverrides before toolTimeouts.

## INV-MCP-TIMEOUT-004: Timeout Error Code
**Statement:** Timeout MUST return error code 'TOOL_TIMEOUT'.
**Rationale:** Distinguishes timeout from other errors.
**Enforcement:** Specific error code in timeout handler.

## INV-MCP-TIMEOUT-005: Duration Tracking
**Statement:** Every result MUST include actual durationMs.
**Rationale:** Enables performance monitoring.
**Enforcement:** Timer started at call, duration included in result.
```

---

## Feature 3: Unified Response Helpers

### Contract: `packages/contracts/src/mcp/v1/response/schema.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// MCP Error Codes
// ============================================================================

export const MCPErrorCodeSchema = z.enum([
  // Validation errors
  'INVALID_INPUT',
  'MISSING_REQUIRED_FIELD',
  'INVALID_FORMAT',
  'ARRAY_TOO_LARGE',

  // Resource errors
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'CONFLICT',

  // Operation errors
  'OPERATION_FAILED',
  'TOOL_TIMEOUT',
  'RATE_LIMITED',
  'MEMORY_PRESSURE',

  // System errors
  'INTERNAL_ERROR',
  'NOT_IMPLEMENTED',
  'SERVICE_UNAVAILABLE',
]);

export type MCPErrorCode = z.infer<typeof MCPErrorCodeSchema>;

// ============================================================================
// Structured Error
// ============================================================================

export const MCPStructuredErrorSchema = z.object({
  /** Error code for programmatic handling */
  code: MCPErrorCodeSchema,
  /** Human-readable message */
  message: z.string().min(1).max(1000),
  /** Additional context */
  context: z.record(z.unknown()).optional(),
  /** Whether the operation can be retried */
  retryable: z.boolean().default(false),
  /** Suggested retry delay in ms (if retryable) */
  retryAfterMs: z.number().int().positive().optional(),
});

export type MCPStructuredError = z.infer<typeof MCPStructuredErrorSchema>;

// ============================================================================
// Standard Response Envelope
// ============================================================================

export const MCPResponseEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
      metadata: z.object({
        durationMs: z.number().int().nonnegative(),
        cached: z.boolean().default(false),
        truncated: z.boolean().default(false),
      }).optional(),
    }),
    z.object({
      success: z.literal(false),
      error: MCPStructuredErrorSchema,
      metadata: z.object({
        durationMs: z.number().int().nonnegative(),
      }).optional(),
    }),
  ]);

// ============================================================================
// List Response (for paginated results)
// ============================================================================

export const MCPListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  });

// ============================================================================
// Response Size Limits
// ============================================================================

export const MCPResponseLimitsSchema = z.object({
  /** Maximum response size in bytes */
  maxResponseBytes: z.number().int().positive().default(1_048_576), // 1MB
  /** Maximum items in list responses */
  maxListItems: z.number().int().positive().default(100),
  /** Maximum string field length */
  maxStringLength: z.number().int().positive().default(10_000),
  /** Truncation indicator */
  truncationSuffix: z.string().default('... [truncated]'),
});

export type MCPResponseLimits = z.infer<typeof MCPResponseLimitsSchema>;
```

### Invariants: `packages/contracts/src/mcp/v1/response/invariants.md`

```markdown
# MCP Response Invariants

## INV-MCP-RESP-001: Consistent Envelope
**Statement:** All tool responses MUST use MCPResponseEnvelope structure.
**Rationale:** Predictable response parsing for clients.
**Enforcement:** Response helpers enforce structure.

## INV-MCP-RESP-002: Error Code Required
**Statement:** All errors MUST include a valid MCPErrorCode.
**Rationale:** Enables programmatic error handling.
**Enforcement:** MCPStructuredError requires code field.

## INV-MCP-RESP-003: Size Limit
**Statement:** Response size MUST NOT exceed maxResponseBytes.
**Rationale:** Prevents memory issues in clients.
**Enforcement:** Truncation before serialization.

## INV-MCP-RESP-004: Truncation Transparency
**Statement:** Truncated responses MUST set metadata.truncated=true.
**Rationale:** Clients need to know data is incomplete.
**Enforcement:** Truncation helper sets flag.

## INV-MCP-RESP-005: Duration Tracking
**Statement:** All responses SHOULD include metadata.durationMs.
**Rationale:** Performance monitoring.
**Enforcement:** Response helpers capture duration.

## INV-MCP-RESP-006: Retryable Accuracy
**Statement:** error.retryable MUST accurately reflect if retry is safe.
**Rationale:** Incorrect retryable causes duplicate operations or missed recovery.
**Enforcement:** Error classification by code.
```

---

## Feature 4: Request Validation with Limits

### Contract: `packages/contracts/src/mcp/v1/limits/schema.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// Request Limits Configuration
// ============================================================================

export const MCPRequestLimitsSchema = z.object({
  /** Maximum array size in requests */
  maxArraySize: z.number().int().positive().default(100),
  /** Maximum string length in requests */
  maxStringLength: z.number().int().positive().default(100_000),
  /** Maximum object depth */
  maxObjectDepth: z.number().int().positive().default(10),
  /** Maximum total request size in bytes */
  maxRequestBytes: z.number().int().positive().default(10_485_760), // 10MB
  /** Per-tool array limits */
  toolArrayLimits: z.record(z.string(), z.number().int().positive()).default({
    bugfix_scan: 100,
    refactor_scan: 100,
    memory_bulk_delete: 1000,
    ability_inject: 20,
  }),
});

export type MCPRequestLimits = z.infer<typeof MCPRequestLimitsSchema>;

// ============================================================================
// Validation Result
// ============================================================================

export const ValidationResultSchema = z.discriminatedUnion('valid', [
  z.object({
    valid: z.literal(true),
  }),
  z.object({
    valid: z.literal(false),
    errors: z.array(z.object({
      path: z.string(),
      code: z.string(),
      message: z.string(),
      limit: z.number().optional(),
      actual: z.number().optional(),
    })),
  }),
]);

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
```

### Invariants: `packages/contracts/src/mcp/v1/limits/invariants.md`

```markdown
# MCP Request Limits Invariants

## INV-MCP-LIMIT-001: Array Size Enforcement
**Statement:** Arrays exceeding maxArraySize MUST be rejected before processing.
**Rationale:** Prevents resource exhaustion from large arrays.
**Enforcement:** Pre-processing validation.

## INV-MCP-LIMIT-002: Early Rejection
**Statement:** Invalid requests MUST be rejected without executing handler.
**Rationale:** Don't waste resources on invalid input.
**Enforcement:** Validation middleware before handler.

## INV-MCP-LIMIT-003: Tool-Specific Limits
**Statement:** Tool-specific limits MUST override global defaults.
**Rationale:** Some tools need different limits.
**Enforcement:** Check toolArrayLimits before maxArraySize.

## INV-MCP-LIMIT-004: Descriptive Errors
**Statement:** Validation errors MUST include path, limit, and actual value.
**Rationale:** Helps clients fix requests.
**Enforcement:** ValidationResult structure.
```

---

## Guard Policy: `packages/guard/src/policies/mcp-runtime-policy.ts`

```typescript
import type { GuardPolicy } from '@defai.digital/contracts';

export const mcpRuntimePolicy: GuardPolicy = {
  id: 'mcp-runtime-policy',
  name: 'MCP Runtime Governance',
  description: 'Ensures MCP operations meet runtime governance requirements',

  gates: [
    {
      id: 'memory-pressure-check',
      name: 'Memory Pressure Check',
      description: 'Blocks operations when memory pressure is critical',
      check: async (context) => {
        const cacheStats = context.cacheStats;
        if (!cacheStats) return { passed: true };

        if (cacheStats.pressureLevel === 'critical') {
          return {
            passed: false,
            reason: 'Memory pressure is critical',
            recommendation: 'Wait for cache eviction or increase maxSizeBytes',
          };
        }

        if (cacheStats.pressureLevel === 'high') {
          return {
            passed: true,
            warning: 'Memory pressure is high, consider reducing cache usage',
          };
        }

        return { passed: true };
      },
    },
    {
      id: 'request-size-check',
      name: 'Request Size Check',
      description: 'Rejects oversized requests',
      check: async (context) => {
        const requestSize = context.requestSizeBytes;
        const limits = context.limits;

        if (!requestSize || !limits) return { passed: true };

        if (requestSize > limits.maxRequestBytes) {
          return {
            passed: false,
            reason: `Request size (${requestSize} bytes) exceeds limit (${limits.maxRequestBytes} bytes)`,
            recommendation: 'Reduce request payload size',
          };
        }

        return { passed: true };
      },
    },
    {
      id: 'array-size-check',
      name: 'Array Size Check',
      description: 'Rejects requests with oversized arrays',
      check: async (context) => {
        const violations = context.arraySizeViolations;

        if (!violations || violations.length === 0) {
          return { passed: true };
        }

        return {
          passed: false,
          reason: `Array size violations: ${violations.map(v => `${v.path} has ${v.actual} items (max: ${v.limit})`).join(', ')}`,
          recommendation: 'Reduce array sizes or paginate requests',
        };
      },
    },
    {
      id: 'timeout-audit',
      name: 'Timeout Audit',
      description: 'Logs operations approaching timeout',
      check: async (context) => {
        const durationMs = context.durationMs;
        const timeoutMs = context.timeoutMs;

        if (!durationMs || !timeoutMs) return { passed: true };

        const ratio = durationMs / timeoutMs;

        if (ratio > 0.8) {
          return {
            passed: true,
            audit: {
              event: 'near_timeout',
              tool: context.toolName,
              durationMs,
              timeoutMs,
              ratio: (ratio * 100).toFixed(1) + '%',
            },
          };
        }

        return { passed: true };
      },
    },
  ],
};
```

---

## Domain Implementation

### Directory Structure

```
packages/core/mcp-runtime/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── cache/
│   │   ├── index.ts
│   │   ├── lru-cache.ts
│   │   ├── eviction.ts
│   │   └── size-estimator.ts
│   ├── timeout/
│   │   ├── index.ts
│   │   ├── wrapper.ts
│   │   └── categories.ts
│   ├── response/
│   │   ├── index.ts
│   │   ├── helpers.ts
│   │   ├── truncation.ts
│   │   └── errors.ts
│   └── validation/
│       ├── index.ts
│       ├── array-limits.ts
│       └── request-validator.ts
├── package.json
└── tsconfig.json
```

---

## Implementation Plan

### Phase 1: Contracts (Day 1)
- [ ] Create `packages/contracts/src/mcp/v1/cache/`
- [ ] Create `packages/contracts/src/mcp/v1/timeout/`
- [ ] Create `packages/contracts/src/mcp/v1/response/`
- [ ] Create `packages/contracts/src/mcp/v1/limits/`
- [ ] Write invariants documentation

### Phase 2: Core Domain (Day 2-3)
- [ ] Create `packages/core/mcp-runtime/`
- [ ] Implement LRU cache with eviction
- [ ] Implement timeout wrapper
- [ ] Implement response helpers
- [ ] Implement request validation

### Phase 3: Integration (Day 4)
- [ ] Update `packages/mcp-server/src/utils/artifact-store.ts` to use new cache
- [ ] Update `packages/mcp-server/src/server.ts` to use timeout wrapper
- [ ] Update all tool handlers to use response helpers
- [ ] Add request validation middleware

### Phase 4: Guard & Tests (Day 5)
- [ ] Implement `mcp-runtime-policy.ts`
- [ ] Write contract tests
- [ ] Write domain tests
- [ ] Write integration tests

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Memory growth (1h run) | Unbounded | < 100MB |
| Timeout compliance | 0% | 100% |
| Response structure consistency | ~60% | 100% |
| Request validation coverage | ~40% | 100% |
| Test coverage (new code) | N/A | > 90% |
