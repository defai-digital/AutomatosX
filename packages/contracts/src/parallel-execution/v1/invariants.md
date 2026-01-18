# Parallel Agent Execution Invariants

## Overview

This document defines the behavioral invariants for the Parallel Agent Execution domain.
These invariants MUST be enforced by all implementations.

## Invariant Categories

- `001-099`: Configuration invariants
- `100-199`: Execution invariants
- `200-299`: Dependency invariants
- `300-399`: Context invariants

---

## INV-APE-001: Concurrency Limit Enforcement

**Category**: Configuration

**Statement**: The number of concurrently executing agents MUST NOT exceed `maxConcurrentAgents`.

**Rationale**: Prevents resource exhaustion and ensures predictable system behavior under load.

**Enforcement**:
- Parallel orchestrator tracks active task count
- New tasks queued when at limit
- Tasks started only when slot becomes available

**Test Scenarios**:
1. Submit 10 tasks with `maxConcurrentAgents=3` → At most 3 running at any time
2. Complete one task → Next queued task starts immediately
3. Cancel execution → Running count decreases properly

---

## INV-APE-002: DAG Dependency Ordering

**Category**: Dependency

**Statement**: Tasks with dependencies MUST NOT start execution until ALL their dependencies have completed successfully.

**Rationale**: Ensures data flow correctness and prevents undefined behavior from premature execution.

**Enforcement**:
- DAG analyzer builds execution layers
- Layer N tasks only start after Layer N-1 completes
- Dependency failures cascade to dependent tasks (skip)

**Test Scenarios**:
1. Task B depends on Task A → B starts only after A completes
2. Task C depends on [A, B] → C waits for both
3. Task A fails → All dependents marked as skipped

---

## INV-APE-003: Shared Context Immutability

**Category**: Context

**Statement**: The shared context passed to parallel agents MUST remain immutable during execution.

**Rationale**: Prevents race conditions and ensures all agents see consistent data.

**Enforcement**:
- SharedContext object frozen on creation
- Agents receive read-only reference
- Any mutation attempt throws error

**Test Scenarios**:
1. Agent attempts to modify shared context → Error thrown
2. Multiple agents read same context → Identical values
3. Context created with Object.freeze → Verified frozen

---

## INV-APE-004: Result Aggregation Consistency

**Category**: Execution

**Statement**: Result aggregation MUST follow the configured `resultAggregation` strategy exactly.

**Rationale**: Ensures predictable output format regardless of execution order.

**Aggregation Strategies**:
- `merge`: Deep merge all outputs into single object
- `list`: Array of individual results in task order
- `firstSuccess`: Return first successful result only
- `custom`: Delegate to provided aggregation function

**Test Scenarios**:
1. `merge` with overlapping keys → Later tasks override earlier
2. `list` → Results ordered by task definition order
3. `firstSuccess` with all failures → Return error, no output

---

## INV-APE-005: Independent Timeout Enforcement

**Category**: Execution

**Statement**: Each agent's timeout MUST be enforced independently, not affected by other agents' execution time.

**Rationale**: Prevents slow agents from affecting fast agents, enables fair resource allocation.

**Enforcement**:
- Each task has its own timeout timer
- Timer starts when task begins execution
- Timeout cancels only that specific task

**Test Scenarios**:
1. Task A timeout=5s, Task B timeout=60s → A times out independently
2. Task A slow → B unaffected if within its timeout
3. Group timeout reached → All running tasks cancelled

---

## INV-APE-100: Execution Layer Isolation

**Category**: Execution

**Statement**: Tasks within the same execution layer MUST be able to run in any order without affecting correctness.

**Rationale**: Enables true parallelism within layers.

**Enforcement**:
- Layer assignment via topological sort
- No implicit ordering within layers
- Results collected regardless of completion order

---

## INV-APE-101: Failure Strategy Adherence

**Category**: Execution

**Statement**: The configured `failureStrategy` MUST be honored for all failure scenarios.

**Strategies**:
- `failFast`: Cancel remaining, return immediately
- `failSafe`: Complete all, collect all errors
- `continueOnError`: Skip failed, continue others

**Test Scenarios**:
1. `failFast` + first task fails → Others cancelled immediately
2. `failSafe` + task fails → All tasks complete, errors collected
3. `continueOnError` + task fails → Other tasks continue normally

---

## INV-APE-200: Circular Dependency Detection

**Category**: Dependency

**Statement**: Circular dependencies MUST be detected before execution begins.

**Rationale**: Prevents infinite loops and deadlocks.

**Enforcement**:
- DAG analyzer uses Kahn's algorithm
- Cycle detected if processed < total tasks
- Error with cycle path reported

**Test Scenarios**:
1. A→B→C→A cycle → Error before execution
2. A→B, B→A cycle → Error with [A, B] path
3. Valid DAG → Execution proceeds normally

---

## INV-APE-201: Dependency Cascading

**Category**: Dependency

**Statement**: When a dependency fails, all dependent tasks MUST be marked as skipped with `DEPENDENCY_FAILED` error code.

**Rationale**: Prevents wasted computation on tasks that cannot succeed.

**Enforcement**:
- Failed task ID added to failed set
- Dependents checked against failed set
- Skipped tasks not counted as failures

---

## INV-APE-300: Context Snapshot Timing

**Category**: Context

**Statement**: Shared context MUST be captured/frozen BEFORE any task begins execution.

**Rationale**: Ensures all agents see identical initial state.

**Enforcement**:
- Context frozen in orchestrator before first task
- Timestamp recorded in SharedContext
- Late modifications rejected

---

## Compliance Verification

All implementations must pass the contract test suite at:
`tests/contract/parallel-execution.test.ts`

Test coverage requirements:
- Each invariant has at least one dedicated test
- Edge cases for boundary conditions
- Failure scenario coverage ≥ 80%
