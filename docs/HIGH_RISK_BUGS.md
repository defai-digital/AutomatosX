# High-Risk Bugs Requiring Architecture Changes

This document tracks bugs identified during the audit that require significant architectural changes to fix properly. These bugs cannot be safely fixed with simple code changes and need careful planning.

**Last Updated**: 2026-01-20
**Audit Session**: Rounds 8-11 via ax agent auditor

---

## Resolution Status Summary

| Bug | Original Severity | Actual Status | Resolution |
|-----|-------------------|---------------|------------|
| Bug 1 | High | **Overblown** - Low-Medium | Simplified fix applied |
| Bug 2 | High | **FALSE POSITIVE** | Already implemented in dag-analyzer.ts |
| Bug 3 | Medium-High | **Real** - Medium | Has existing mitigations, p-limit added |

---

## Bug 1: TOCTOU Race Condition in Agent Registration

**File**: `packages/mcp-server/src/tools/agent.ts`
**Severity**: ~~High~~ **Low-Medium** (Revised)
**Type**: Race Condition (Time-of-Check to Time-of-Use)
**Status**: **RESOLVED** - Simplified fix applied

### Description

When registering a new agent, there's a gap between checking if an agent exists and creating it:

```typescript
// Current code pattern (simplified):
const existing = await registry.get(agentId);
if (existing) {
  return { error: 'Agent already exists' };
}
// <-- Race window: another request could register the same agentId here
await registry.register(newAgent);
```

If two concurrent requests try to register the same `agentId`, both may pass the existence check and attempt to create the agent, leading to:
- Duplicate entries
- Data corruption
- Inconsistent state

### Impact

- **Likelihood**: Low (requires concurrent requests with same agentId)
- **Severity**: High (data corruption if triggered)
- **Affected Operations**: `ax_agent_register` MCP tool

### Required Architecture Changes

1. **Option A: Database-Level Constraints**
   - Add unique constraint on `agentId` in SQLite schema
   - Use `INSERT OR IGNORE` / `ON CONFLICT` clauses
   - Requires: Schema migration, adapter changes

2. **Option B: Distributed Locking**
   - Implement advisory locks for agent operations
   - Use file-based or Redis-based locking
   - Requires: New locking infrastructure

3. **Option C: Optimistic Concurrency**
   - Add version field to agent records
   - Use compare-and-swap pattern
   - Requires: Schema changes, retry logic

### Recommended Approach

Option A (Database-Level Constraints) is preferred:
- Leverages SQLite's ACID guarantees
- Minimal code changes
- No external dependencies

### Implementation Plan

```typescript
// 1. Update SQLite schema (trace-store.ts or new agent-store.ts)
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,  -- Natural unique constraint
  ...
);

// 2. Use INSERT with conflict handling
async register(agent: AgentProfile): Promise<{ created: boolean }> {
  const result = await db.run(`
    INSERT INTO agents (agent_id, ...)
    VALUES (?, ...)
    ON CONFLICT(agent_id) DO NOTHING
  `, [agent.agentId, ...]);

  return { created: result.changes > 0 };
}
```

### Workaround (Current)

The current code works correctly for single-threaded usage. The race condition only manifests under concurrent requests, which is rare in typical MCP usage patterns.

---

## Bug 2: Task Dependency Cycle Detection in Parallel Execution

**File**: `packages/mcp-server/src/tools/parallel.ts`
**Severity**: ~~High~~ **N/A**
**Type**: Missing Validation
**Status**: **FALSE POSITIVE - Already Implemented**

### Resolution

**This bug does not exist.** Cycle detection is already implemented using Kahn's algorithm in:
- `packages/core/agent-parallel/src/dag-analyzer.ts:142-165` - Kahn's algorithm with cycle detection
- `packages/core/agent-parallel/src/dag-analyzer.ts:235-277` - `findCyclePath` DFS utility for detailed error messages
- `packages/core/agent-parallel/src/orchestrator.ts:477-478` - Integration point

The implementation:
1. Uses Kahn's algorithm for topological sorting
2. Detects cycles when processed count != task count
3. Reports specific nodes involved in the cycle
4. Throws `DAGAnalysisError.circularDependency()` with clear error message

### Original (Incorrect) Description

~~The parallel task execution system accepts task dependencies but does not validate for cycles:~~

```typescript
// Example payload that WOULD cause infinite hang IF cycle detection didn't exist:
// But it DOES exist and this returns an error immediately:
{
  tasks: [
    { agentId: "agent-a", dependencies: ["task-b"] },
    { agentId: "agent-b", dependencies: ["task-a"] }  // Circular!
  ]
}
// Result: Error "Circular dependency detected: task-a, task-b"
```

~~Without cycle detection:~~
~~- Tasks wait forever for dependencies that can never complete~~
~~- System hangs until timeout~~
~~- No meaningful error message~~

**Actual behavior**: Returns immediately with descriptive error message identifying the cycle.

### ~~Impact~~ (N/A - Bug doesn't exist)

~~- **Likelihood**: Medium (user error in complex workflows)~~
~~- **Severity**: High (system hang, resource exhaustion)~~
~~- **Affected Operations**: `ax_parallel_run` MCP tool~~

### ~~Required Architecture Changes~~ (N/A - Already Implemented)

The implementation already exists in `packages/core/agent-parallel/src/dag-analyzer.ts`:

```typescript
// Actual implementation (dag-analyzer.ts:142-165)
// Uses Kahn's algorithm exactly as suggested
const hasCycles = processedCount !== tasks.length;
if (hasCycles) {
  cycleNodes = tasks
    .filter(t => inDegree.get(t.taskId)! > 0)
    .map(t => t.taskId);
}
```

---

## Bug 3: Unbounded Concurrent Provider Calls

**File**: `packages/core/discussion-domain/src/executor.ts`
**Severity**: ~~Medium-High~~ **Medium** (Revised - has existing mitigations)
**Type**: Resource Exhaustion
**Status**: **MITIGATED** - Existing bounds + p-limit added

### Existing Mitigations (Not Previously Documented)

The following safeguards already exist:
- `maxCalls` parameter (default: 20) - global call limit
- `maxDepth` parameter (default: 4) - recursion limit
- `budget-manager.ts` - timeout budgeting per depth level
- `context-tracker.ts` - enforces INV-DISC-600 (depth never exceeds maxDepth)
- Throws `MAX_CALLS_EXCEEDED` and `MAX_DEPTH_EXCEEDED` errors

### Description

The discussion executor can make concurrent calls to providers within bounds:

```typescript
// In recursive discussions, each provider can spawn sub-discussions
// Without limits, this can exponentially grow:
// - Round 1: 3 providers
// - Each spawns sub-discussion: 3 × 3 = 9 calls
// - Each of those spawns: 9 × 3 = 27 calls
// Total: 3 + 9 + 27 = 39 concurrent calls possible
```

### Impact

- **Likelihood**: Medium (recursive discussions with high depth)
- **Severity**: Medium-High (API rate limits, cost explosion)
- **Affected Operations**: `ax_discuss_recursive` MCP tool

### Required Architecture Changes

1. **Implement Semaphore/Rate Limiter**
   - Add concurrency limit to discussion executor
   - Queue excess requests
   - Configurable limit per session

2. **Add to Resilience Domain**
   - Extend `packages/core/resilience-domain/`
   - Create `Semaphore` class alongside `CircuitBreaker`

### Implementation Sketch

```typescript
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
    return new Promise(resolve => this.waiting.push(resolve));
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

// Usage in executor:
const concurrencyLimit = new Semaphore(config.maxConcurrentCalls ?? 10);

async callProvider(providerId: string, prompt: string) {
  await concurrencyLimit.acquire();
  try {
    return await this.providerExecutor.call(providerId, prompt);
  } finally {
    concurrencyLimit.release();
  }
}
```

### Workaround (Current)

- `maxCalls` parameter limits total calls (default: 20)
- `timeout` parameter prevents infinite waits
- But concurrent calls within limits are unbounded

---

## Priority for Resolution

| Bug | Priority | Effort | Risk if Unfixed |
|-----|----------|--------|-----------------|
| TOCTOU in Agent Registration | P2 | Medium | Low (rare in practice) |
| Dependency Cycle Detection | P1 | Medium | Medium (user confusion) |
| Unbounded Concurrent Calls | P2 | Low | Medium (cost/rate limits) |

## Tracking

- [ ] Create GitHub issues for each bug
- [ ] Schedule architecture review
- [ ] Implement fixes in dedicated PR
- [ ] Add integration tests for race conditions

---

*This document should be updated when these bugs are addressed.*
