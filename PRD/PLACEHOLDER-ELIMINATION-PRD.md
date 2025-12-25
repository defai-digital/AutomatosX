# PRD: Placeholder Code Elimination

**Version:** 1.0.0
**Status:** Draft
**Created:** 2025-12-16
**Priority:** Critical

---

## Executive Summary

A comprehensive audit revealed multiple placeholder, stub, and non-functional code paths in the AutomatosX codebase. This PRD defines the work required to eliminate all placeholders and make the system fully functional.

---

## Critical Issues

### Issue 1: Ability Integration is Broken

**Severity:** CRITICAL

**Problem:** The ability injection system is implemented but never connected to agent execution.

| Component | Location | Issue |
|-----------|----------|-------|
| EnhancedAgentExecutor | `packages/core/agent-domain/src/enhanced-executor.ts` | Has NO ability injection code |
| shared-registry.ts | `packages/mcp-server/src/shared-registry.ts` | Never passes `abilityManager` to executor |

**Current Behavior:**
- MCP ability tools work in isolation
- Example abilities are loaded but never used
- `agent_run` executes without any ability context

**Required Fix:**
1. Add ability injection logic to `EnhancedAgentExecutor` prompt step
2. Create and pass `AbilityManager` in `shared-registry.ts`

---

### Issue 2: Tool Step Execution is Stubbed

**Severity:** CRITICAL

**Problem:** Tool steps return placeholder data instead of invoking actual tools.

| Location | Current Behavior |
|----------|------------------|
| `agent-domain/executor.ts:682-692` | Returns `{ step, type: 'tool', config }` |
| `agent-domain/enhanced-executor.ts:853` | Returns placeholder message |
| `workflow-engine/executor.ts:144-165` | Returns `status: 'requires_executor'` |

**Required Fix:**
1. Create `ToolExecutor` interface for invoking MCP tools
2. Integrate tool registry with agent executor
3. Execute actual tool calls during workflow steps

---

### Issue 3: Loop/Parallel Nested Execution Missing

**Severity:** HIGH

**Problem:** Loop and parallel steps collect items but don't execute nested workflows.

| Step Type | Works | Missing |
|-----------|-------|---------|
| Loop | Item collection, max iterations | Nested step execution per item |
| Parallel | Batching, concurrency limits | Concurrent nested step execution |

**Required Fix:**
1. Implement recursive step execution within loops
2. Implement concurrent execution for parallel steps
3. Handle context propagation for nested execution

---

## Medium Issues

### Issue 4: CLI Cleanup Commands Placeholder

**Severity:** MEDIUM

**Location:** `packages/cli/src/commands/cleanup.ts`

| Function | Line | Returns |
|----------|------|---------|
| `cleanCheckpoints()` | 220 | `{ count: 0 }` |
| `cleanTraces()` | 282 | `{ count: 0 }` |
| `cleanDLQ()` | 294 | `{ count: 0 }` |

**Required Fix:**
1. Integrate with checkpoint storage
2. Integrate with trace-domain
3. Integrate with cross-cutting DLQ

---

### Issue 5: CLI Status Command Placeholder

**Severity:** MEDIUM

**Location:** `packages/cli/src/commands/status.ts`

| Function | Line | Returns |
|----------|------|---------|
| `getProviderStatus()` | 143 | `[]` (empty) |
| `getPendingCheckpointCount()` | 177 | `0` |

**Required Fix:**
1. Implement provider health checks via CLI adapters
2. Query checkpoint storage for pending count

---

### Issue 6: Guard Policy Application Placeholder

**Severity:** MEDIUM

**Location:** `packages/mcp-server/src/tools/guard.ts:249-288`

**Current Behavior:** Returns hardcoded success without actual enforcement.

**Required Fix:**
1. Implement session-policy binding storage
2. Enforce policies during session operations

---

## Implementation Plan

### Phase 1: Critical Fixes (Ability + Tool Integration)

#### 1.1 Fix Ability Integration

**Files to modify:**
- `packages/core/agent-domain/src/enhanced-executor.ts`
- `packages/mcp-server/src/shared-registry.ts`

**Changes:**
```typescript
// shared-registry.ts - Add ability manager
import { createAbilityRegistry, createAbilityManager } from '@defai.digital/ability-domain';

const abilityRegistry = createAbilityRegistry();
const abilityManager = createAbilityManager(abilityRegistry);

// Load abilities
const loader = createAbilityLoader({ abilitiesDir: 'examples/abilities' });
const abilities = await loader.loadAll();
for (const ability of abilities) {
  await abilityRegistry.register(ability);
}

// Pass to executor
const config: EnhancedAgentDomainConfig = {
  ...DEFAULT_AGENT_DOMAIN_CONFIG,
  promptExecutor,
  abilityManager,  // ADD THIS
  // ...
};
```

**Invariants to enforce:**
- INV-AGT-ABL-001: Abilities injected before prompt execution
- INV-AGT-ABL-002: Core abilities from agent profile included
- INV-AGT-ABL-003: Token limits respected

#### 1.2 Implement Tool Step Execution

**Files to modify:**
- `packages/core/agent-domain/src/types.ts` - Add ToolExecutor interface
- `packages/core/agent-domain/src/executor.ts` - Implement tool step
- `packages/core/agent-domain/src/enhanced-executor.ts` - Implement tool step
- `packages/mcp-server/src/shared-registry.ts` - Connect tool registry

**New interface:**
```typescript
export interface ToolExecutor {
  execute(toolName: string, input: Record<string, unknown>): Promise<ToolExecutionResult>;
  listTools(): Promise<string[]>;
  hasTool(toolName: string): Promise<boolean>;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}
```

---

### Phase 2: Loop/Parallel Implementation

#### 2.1 Loop Step Nested Execution

**File:** `packages/core/workflow-engine/src/executor.ts`

**Changes:**
- Accept nested step executor function
- Execute nested steps for each item in loop
- Propagate item context to nested steps
- Collect results per iteration

#### 2.2 Parallel Step Concurrent Execution

**File:** `packages/core/workflow-engine/src/executor.ts`

**Changes:**
- Accept nested step executor function
- Execute steps concurrently up to concurrency limit
- Implement fail-fast and fail-safe strategies
- Collect all results

---

### Phase 3: CLI and Guard Fixes

#### 3.1 CLI Cleanup Integration

**File:** `packages/cli/src/commands/cleanup.ts`

**Changes:**
- Integrate checkpoint cleanup with actual storage
- Integrate trace cleanup with trace-domain
- Integrate DLQ cleanup with cross-cutting

#### 3.2 CLI Status Integration

**File:** `packages/cli/src/commands/status.ts`

**Changes:**
- Query provider CLIs for health status
- Query checkpoint storage for counts

#### 3.3 Guard Policy Implementation

**File:** `packages/mcp-server/src/tools/guard.ts`

**Changes:**
- Create policy-session binding storage
- Enforce bindings during checks

---

## Success Metrics

| Issue | Metric | Target |
|-------|--------|--------|
| Ability integration | Abilities injected during agent_run | 100% |
| Tool execution | Tool steps invoke actual tools | 100% |
| Loop execution | Nested steps executed per item | 100% |
| Parallel execution | Concurrent nested execution | 100% |
| CLI cleanup | Actual resources cleaned | Non-zero counts |
| CLI status | Real provider health | Accurate data |
| Guard policy | Policies enforced | Binding tracked |

---

## Testing Requirements

1. **Ability Integration Tests:**
   - Verify abilities are injected during agent_run
   - Verify core abilities from profile are included
   - Verify token limits are respected

2. **Tool Execution Tests:**
   - Verify tool steps call registered tools
   - Verify error handling for missing tools

3. **Loop/Parallel Tests:**
   - Verify nested steps execute per item
   - Verify concurrency limits respected
   - Verify fail-fast behavior

4. **CLI Integration Tests:**
   - Verify cleanup removes actual data
   - Verify status shows real health

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing tests | Medium | Run full test suite after each change |
| Circular dependencies | High | Follow dependency layer rules |
| Performance regression | Medium | Profile execution times |
| Memory leaks in loops | High | Proper cleanup in nested execution |

---

## Implementation Order

1. **Phase 1.1:** Fix ability integration (highest impact, enables agent knowledge)
2. **Phase 1.2:** Implement tool execution (enables workflow automation)
3. **Phase 2:** Loop/parallel nested execution (enables complex workflows)
4. **Phase 3:** CLI and guard fixes (improves ops experience)
