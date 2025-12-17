# Agentic Integration PRD

## Overview

This PRD addresses the gap between existing agentic components that are implemented but not connected. Users report agents "missing steps" and lacking visibility - but the infrastructure exists, it's just not wired together.

## Problem Statement

Current state analysis reveals:
1. **SQLite Checkpoint Storage** - Implemented but CLI uses in-memory stub
2. **Agent Policy Enforcer** - Implemented but never injected into executor
3. **Delegation Tracker** - Contract exists but uses stub (always succeeds)
4. **Guard Gates** - Implemented but not integrated with workflow steps
5. **Progress Visibility** - No standard events for stage transitions

## Goals

1. Wire existing components without adding unnecessary abstractions
2. Enable checkpoint-based resume for long-running agents
3. Enforce guard policies during agent execution
4. Add step-level guards for workflow validation
5. Provide visibility into agent progress

## Non-Goals

1. Creating a separate "Stage" domain (workflows already have steps)
2. Building distributed orchestration (NATS/Temporal)
3. ML-based predictions or complex scheduling

---

## Architecture

### Tier 1: Wire Existing Components

#### 1.1 Checkpoint Storage Wiring

**Current**: `EnhancedAgentExecutor` uses `stubCheckpointStorageFactory`
**Target**: Inject `SqliteCheckpointStorage` via factory

```
CLI/MCP → createCheckpointStorageFactory(sqliteAdapter) → EnhancedAgentExecutor
```

**Files**:
- `packages/cli/src/bootstrap.ts` - Create and inject real factory
- `packages/mcp-server/src/bootstrap.ts` - Same for MCP server

#### 1.2 Guard Policy Wiring

**Current**: `AgentPolicyEnforcer` exists but never used
**Target**: Inject into executor, check before step execution

```
EnhancedAgentExecutor.executeStep()
  → AgentPolicyEnforcer.checkAccess(agent, step)
  → Execute or reject
```

**Files**:
- `packages/core/agent-domain/src/executor/enhanced-executor.ts` - Add guard integration

#### 1.3 Delegation Tracker Wiring

**Current**: `stubDelegationTrackerFactory` always succeeds
**Target**: Real implementation with depth/circular detection

**Files**:
- `packages/core/agent-execution/src/delegation/tracker.ts` - Already exists
- Wire factory in bootstrap

---

### Tier 2: New Contracts & Domain Logic

#### 2.1 Workflow Step Guards

**Contract**: `packages/contracts/src/workflow/v1/step-guard.ts`

```typescript
// Step guard configuration
WorkflowStepGuardSchema = {
  stepId: string,           // Which step to guard
  position: 'before' | 'after',
  gates: string[],          // Gate IDs to run
  onFail: 'block' | 'warn' | 'continue'
}

// Guard result
StepGuardResultSchema = {
  stepId: string,
  position: 'before' | 'after',
  status: 'PASS' | 'WARN' | 'FAIL',
  gates: GuardCheckResult[],
  blocked: boolean
}
```

**Invariants** (`packages/contracts/src/workflow/v1/step-guard-invariants.md`):
- `INV-WF-GUARD-001`: Before guards run before step execution starts
- `INV-WF-GUARD-002`: After guards run after step completes (before next step)
- `INV-WF-GUARD-003`: Block failures prevent step execution/continuation
- `INV-WF-GUARD-004`: Guard results included in trace events

**Domain**: `packages/core/workflow-engine/src/step-guard.ts`

```typescript
class WorkflowStepGuard {
  async checkBefore(stepId: string, context: StepContext): Promise<StepGuardResult>
  async checkAfter(stepId: string, context: StepContext): Promise<StepGuardResult>
}
```

#### 2.2 Progress Events

**Contract**: `packages/contracts/src/trace/v1/progress.ts`

```typescript
StageProgressEventSchema = {
  type: 'stage.progress',
  executionId: string,
  stageIndex: number,
  stageTotal: number,
  stageName: string,
  status: 'pending' | 'starting' | 'completed' | 'failed' | 'skipped',
  durationMs?: number,
  metadata?: Record<string, unknown>
}
```

**Invariants**:
- `INV-PROG-001`: Every stage emits 'starting' event before execution
- `INV-PROG-002`: Every stage emits terminal event (completed/failed/skipped)
- `INV-PROG-003`: stageIndex is 0-based, stageTotal is constant per execution

#### 2.3 Goal Anchoring

**Contract**: `packages/contracts/src/ability/v1/goal-anchor.ts`

```typescript
GoalAnchorConfigSchema = {
  originalTask: string,
  checkpoints: string[],      // Key decision points reached
  reminderTrigger: 'every_step' | 'on_checkpoint' | 'on_decision',
}

GoalAnchorContextSchema = {
  task: string,
  progress: string,           // "Step 3 of 5: Implementation"
  checkpointsReached: string[],
  remainingSteps: string[]
}
```

**Domain**: `packages/core/ability-domain/src/goal-anchor.ts`

Injects context at configured trigger points to prevent context drift.

---

## Implementation Plan

### Phase 1: Wire Existing (Tier 1)

| Task | Files | Invariants |
|------|-------|------------|
| 1.1 Checkpoint factory | `cli/bootstrap.ts`, `mcp-server/bootstrap.ts` | INV-CP-001, INV-CP-002 |
| 1.2 Guard integration | `agent-domain/executor/enhanced-executor.ts` | INV-GUARD-001 |
| 1.3 Delegation factory | `agent-execution/delegation/` | INV-DT-001, INV-DT-002 |

### Phase 2: Step Guards (Tier 2)

| Task | Files | Invariants |
|------|-------|------------|
| 2.1 Step guard contract | `contracts/workflow/v1/step-guard.ts` | INV-WF-GUARD-* |
| 2.2 Step guard domain | `workflow-engine/src/step-guard.ts` | - |
| 2.3 Runner integration | `workflow-engine/src/runner.ts` | - |

### Phase 3: Progress & Goal Anchoring (Tier 2)

| Task | Files | Invariants |
|------|-------|------------|
| 3.1 Progress contract | `contracts/trace/v1/progress.ts` | INV-PROG-* |
| 3.2 Progress emitter | `workflow-engine/src/progress.ts` | - |
| 3.3 Goal anchor contract | `contracts/ability/v1/goal-anchor.ts` | - |
| 3.4 Goal anchor ability | `ability-domain/src/goal-anchor.ts` | - |

---

## Guard Integration Points

### New Guard Gates

1. **StepExecutionGate** - Validates step can execute
   - Checks agent capabilities against step requirements
   - Validates resource limits not exceeded

2. **DelegationGate** - Validates delegation is allowed
   - Checks depth limit
   - Validates target agent exists and is enabled

### Guard Policy Extensions

```typescript
// New policy type for step guards
StepGuardPolicySchema = {
  policyId: string,
  appliesTo: {
    workflowPatterns?: string[],  // Glob patterns
    stepTypes?: StepType[],
    agentPatterns?: string[]
  },
  beforeGates: string[],
  afterGates: string[]
}
```

---

## Success Metrics

1. **Resume Rate**: % of failed executions that successfully resume from checkpoint
2. **Guard Block Rate**: % of policy violations caught before execution
3. **Step Visibility**: All executions emit progress events
4. **Context Retention**: Reduced "forgot original task" incidents

---

## Testing Strategy

### Contract Tests
- Schema validation for all new contracts
- Invariant verification

### Domain Tests
- Step guard execution flow
- Progress event emission
- Goal anchor context building

### Integration Tests
- End-to-end workflow with guards
- Checkpoint save/resume cycle
- Guard blocking invalid operations

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance overhead from guards | Medium | Make guards async, cache policy resolution |
| Breaking existing workflows | High | Guards default to 'warn' mode initially |
| Checkpoint bloat | Low | Add TTL-based cleanup (already in SqliteCheckpointStorage) |

---

## Timeline

- Phase 1 (Wiring): 2-3 days
- Phase 2 (Step Guards): 2-3 days
- Phase 3 (Progress/Goal): 2 days
- Testing: 1-2 days

**Total: ~8-10 days**
