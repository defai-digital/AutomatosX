# MCP Runtime Invariants

This document defines the behavioral guarantees for the MCP runtime components.

---

## Cache Invariants

### INV-MCP-CACHE-001: Size Bound
**Statement:** Cache size MUST NOT exceed `maxSizeBytes`.
**Rationale:** Prevents memory exhaustion and server crashes.
**Enforcement:** Eviction triggered when `highWaterMark` percentage exceeded.
**Test:** `cache.currentSizeBytes <= config.maxSizeBytes` after any operation.

### INV-MCP-CACHE-002: Entry Bound
**Statement:** Entry count MUST NOT exceed `maxEntries`.
**Rationale:** Prevents unbounded growth regardless of individual entry sizes.
**Enforcement:** Eviction triggered when `maxEntries` reached.
**Test:** `cache.entryCount <= config.maxEntries` after any operation.

### INV-MCP-CACHE-003: TTL Expiration
**Statement:** Expired entries MUST NOT be returned from `get()`.
**Rationale:** Stale data causes inconsistencies and bugs.
**Enforcement:** TTL check on every `get()`, lazy cleanup on interval.
**Test:** `get()` returns `hit: false` for entries where `now > createdAt + ttlMs`.

### INV-MCP-CACHE-004: LRU Ordering
**Statement:** When `evictionPolicy='lru'`, least recently accessed entries MUST be evicted first.
**Rationale:** Preserves frequently accessed data, improves hit rate.
**Enforcement:** `lastAccessedAt` updated on every access, eviction sorted by `lastAccessedAt` ascending.
**Test:** After eviction, remaining entries have `lastAccessedAt >= evicted entries`.

### INV-MCP-CACHE-005: Atomic Operations
**Statement:** Cache operations MUST be atomic (no partial states visible).
**Rationale:** Concurrent access safety without external locking.
**Enforcement:** Synchronous Map operations, size tracking in single operation.
**Test:** No intermediate states observable during concurrent access.

### INV-MCP-CACHE-006: Size Accuracy
**Statement:** `currentSizeBytes` MUST equal sum of all entry `sizeBytes` within 1% tolerance.
**Rationale:** Accurate eviction decisions depend on accurate size tracking.
**Enforcement:** Size recalculation on cleanup, assertion in tests.
**Test:** `|currentSizeBytes - sum(entries.sizeBytes)| / currentSizeBytes < 0.01`.

---

## Timeout Invariants

### INV-MCP-TIMEOUT-001: Guaranteed Termination
**Statement:** Every tool call MUST complete or timeout within the configured limit.
**Rationale:** Prevents hanging connections and resource exhaustion.
**Enforcement:** `Promise.race()` with timeout promise that rejects after limit.
**Test:** No operation exceeds `timeout + 100ms` (allowing for scheduling variance).

### INV-MCP-TIMEOUT-002: Category Consistency
**Statement:** Tools in the same category MUST have the same default timeout.
**Rationale:** Predictable behavior for similar operations.
**Enforcement:** Timeout lookup by category from `TOOL_CATEGORIES`, not hardcoded per-tool.
**Test:** All tools with same category return same timeout when no override exists.

### INV-MCP-TIMEOUT-003: Override Precedence
**Statement:** Tool-specific overrides MUST take precedence over category defaults.
**Rationale:** Allows fine-tuning for special cases without changing defaults.
**Enforcement:** Check `toolOverrides[toolName]` before `toolTimeouts[category]`.
**Test:** Override value returned when both override and category timeout exist.

### INV-MCP-TIMEOUT-004: Timeout Error Code
**Statement:** Timeout MUST return error code `TOOL_TIMEOUT`.
**Rationale:** Distinguishes timeout from other errors for proper handling.
**Enforcement:** Specific error code in timeout handler, not generic error.
**Test:** Timeout result has `error.code === 'TOOL_TIMEOUT'`.

### INV-MCP-TIMEOUT-005: Duration Tracking
**Statement:** Every result MUST include actual `durationMs`.
**Rationale:** Enables performance monitoring and timeout tuning.
**Enforcement:** Timer started at call initiation, duration included in all result types.
**Test:** All results (completed, timeout, error) have `durationMs >= 0`.

---

## Response Invariants

### INV-MCP-RESP-001: Consistent Envelope
**Statement:** All tool responses MUST use the standard response envelope structure.
**Rationale:** Predictable response parsing for all clients.
**Enforcement:** Response helpers enforce structure, type checking at compile time.
**Test:** All responses parse successfully with `MCPSuccessResponseSchema` or `MCPErrorResponseSchema`.

### INV-MCP-RESP-002: Error Code Required
**Statement:** All errors MUST include a valid `MCPErrorCode`.
**Rationale:** Enables programmatic error handling and retry logic.
**Enforcement:** `MCPStructuredError` schema requires `code` field from enum.
**Test:** All error responses have `error.code` matching `MCPErrorCodeSchema`.

### INV-MCP-RESP-003: Size Limit
**Statement:** Serialized response size MUST NOT exceed `maxResponseBytes`.
**Rationale:** Prevents memory issues in clients and transport.
**Enforcement:** Size check before serialization, truncation if exceeded.
**Test:** `JSON.stringify(response).length <= config.maxResponseBytes`.

### INV-MCP-RESP-004: Truncation Transparency
**Statement:** Truncated responses MUST set `metadata.truncated = true`.
**Rationale:** Clients need to know data is incomplete for proper handling.
**Enforcement:** Truncation helper sets flag when modifying response.
**Test:** Truncated responses always have `metadata.truncated === true`.

### INV-MCP-RESP-005: Duration Tracking
**Statement:** All responses SHOULD include `metadata.durationMs`.
**Rationale:** Performance monitoring and SLA tracking.
**Enforcement:** Response helpers capture duration automatically.
**Test:** Responses include `metadata.durationMs >= 0` when metadata present.

### INV-MCP-RESP-006: Retryable Accuracy
**Statement:** `error.retryable` MUST accurately reflect if retry is safe.
**Rationale:** Incorrect retryable causes duplicate operations or missed recovery.
**Enforcement:** Error classification by code using `RETRYABLE_ERRORS` set.
**Test:** `error.retryable === RETRYABLE_ERRORS.has(error.code)` for all errors.

---

## Request Limits Invariants

### INV-MCP-LIMIT-001: Array Size Enforcement
**Statement:** Arrays exceeding `maxArraySize` MUST be rejected before processing.
**Rationale:** Prevents resource exhaustion from large array processing.
**Enforcement:** Pre-processing validation of all array fields.
**Test:** Requests with oversized arrays return `ARRAY_TOO_LARGE` error.

### INV-MCP-LIMIT-002: Early Rejection
**Statement:** Invalid requests MUST be rejected without executing the handler.
**Rationale:** Don't waste resources processing invalid input.
**Enforcement:** Validation middleware runs before handler invocation.
**Test:** Handler not called when validation fails.

### INV-MCP-LIMIT-003: Tool-Specific Limits
**Statement:** Tool-specific limits MUST override global defaults.
**Rationale:** Some tools legitimately need different limits.
**Enforcement:** Check `toolArrayLimits[toolName]` before `maxArraySize`.
**Test:** Tool-specific limit used when defined, global otherwise.

### INV-MCP-LIMIT-004: Descriptive Errors
**Statement:** Validation errors MUST include `path`, `limit`, and `actual` values.
**Rationale:** Helps clients understand and fix invalid requests.
**Enforcement:** `ValidationError` schema requires these fields.
**Test:** All validation errors include complete context.

---

## Cross-Cutting Invariants

### INV-MCP-XC-001: No Silent Failures
**Statement:** All failures MUST be reported through proper error channels.
**Rationale:** Silent failures cause debugging nightmares.
**Enforcement:** Try-catch with explicit error creation, no swallowed exceptions.
**Test:** No operation completes successfully while in error state.

### INV-MCP-XC-002: Graceful Degradation
**Statement:** Cache failures MUST NOT prevent tool execution.
**Rationale:** Cache is optimization, not critical path.
**Enforcement:** Cache operations wrapped in try-catch, fallback to uncached.
**Test:** Tools work correctly when cache is unavailable.

### INV-MCP-XC-003: Resource Cleanup
**Statement:** All acquired resources MUST be released on shutdown.
**Rationale:** Prevents resource leaks in long-running processes.
**Enforcement:** Shutdown hooks for all stateful components.
**Test:** No resource warnings after graceful shutdown.
