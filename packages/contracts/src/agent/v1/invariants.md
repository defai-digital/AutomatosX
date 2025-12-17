# Agent Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for the agent domain. The agent system MUST satisfy all invariants for profile validation, execution, checkpointing, delegation, and tool execution.

## Agent Profile Invariants

### INV-AGT-001: Profile Validation

**Statement:** All agent profiles MUST pass schema validation before registration.

**Rationale:** Invalid profiles cause runtime errors and unpredictable behavior. Early validation prevents system instability.

**Enforcement:**
- `AgentProfileSchema.parse()` called before any registration
- Invalid profiles rejected with descriptive error
- No partial profiles allowed in registry

### INV-AGT-002: Unique Agent IDs

**Statement:** Agent IDs MUST be unique within a registry.

**Rationale:** Duplicate IDs cause overwrites and lost configurations. Uniqueness ensures reliable agent lookup.

**Enforcement:**
- Registry checks for existing ID before registration
- Update vs create distinguished explicitly
- ID format: lowercase alphanumeric with hyphens

### INV-AGT-003: Workflow Step Order

**Statement:** Agent workflow steps MUST execute in definition array order.

**Rationale:** Step ordering is intentional and may have dependencies. Random execution breaks workflows.

**Enforcement:**
- Steps executed via array iteration, not parallel by default
- No reordering optimizations
- Parallel execution only when explicitly configured

## Checkpoint Invariants

### INV-CP-001: Checkpoint Completeness

**Statement:** Checkpoints MUST contain all data needed to resume execution.

**Rationale:** Incomplete checkpoints cause data loss and broken resumption.

**Enforcement:**
- Checkpoint includes: stepIndex, completedStepId, stepOutputs, context, memorySnapshot
- Validation before save
- Resume context derivable from checkpoint alone

### INV-CP-002: Resume Position

**Statement:** Resumed execution MUST start from the step AFTER the checkpoint.

**Rationale:** Re-executing completed steps wastes resources and may have side effects.

**Enforcement:**
- `resumeFromStep = checkpoint.stepIndex + 1`
- Completed outputs restored, not re-computed
- Step outputs from checkpoint used for dependent steps

## Delegation Invariants

### INV-DT-001: Maximum Delegation Depth

**Statement:** Delegation depth MUST NOT exceed configured `maxDepth`.

**Rationale:** Unbounded delegation causes stack overflow and resource exhaustion.

**Enforcement:**
- Default maxDepth: 5
- `canDelegate()` returns false when depth exceeded
- Error returned to caller with clear message

### INV-DT-002: No Circular Delegation

**Statement:** An agent MUST NOT delegate to itself or any ancestor in the delegation chain.

**Rationale:** Circular delegation causes infinite loops.

**Enforcement:**
- Chain tracked during execution
- `isInChain(agentId)` checked before delegation
- Circular delegation returns error, not exception

## Tool Execution Invariants

### INV-TOOL-001: Input Validation

**Statement:** Tool execution MUST validate inputs before execution.

**Rationale:** Invalid inputs cause unpredictable tool behavior and security risks.

**Enforcement:**
- Schema validation on all tool inputs
- Validation errors returned as `ToolExecutionResult` with `success: false`
- No tool code executed with invalid inputs

### INV-TOOL-002: Result Immutability

**Statement:** Tool execution results MUST be immutable after creation.

**Rationale:** Mutable results can be accidentally modified, causing inconsistent state.

**Enforcement:**
- `Object.freeze()` applied to all results
- Results created via factory functions
- No result modification after return

### INV-TOOL-003: Graceful Unknown Tools

**Statement:** Unknown tools MUST return error response, NOT throw exceptions.

**Rationale:** Throwing exceptions breaks execution flow. Error responses allow graceful handling.

**Enforcement:**
- `isToolAvailable()` checked before execution
- Unknown tool returns `ToolExecutionResult` with error code `TOOL_NOT_FOUND`
- Error includes tool name for debugging

## Parallel Execution Invariants

### INV-PE-001: Independent Step Concurrency

**Statement:** Independent steps MAY execute concurrently up to configured limit.

**Rationale:** Parallelism improves performance for independent work.

**Enforcement:**
- Dependency analysis identifies independent steps
- `maxConcurrency` respected
- Results collected before dependent steps

### INV-PE-002: Dependency Ordering

**Statement:** Dependent steps MUST wait for their dependencies to complete.

**Rationale:** Using incomplete data causes errors and incorrect results.

**Enforcement:**
- DAG ordering computed before execution
- Step waits for all input dependencies
- Circular dependencies detected and rejected

### INV-PE-003: Failure Strategy

**Statement:** Parallel failure handling MUST follow configured strategy.

**Rationale:** Different use cases require different failure behaviors.

**Enforcement:**
- `failFast`: Stop all on first failure
- `continueOnError`: Complete remaining, aggregate errors
- `rollback`: Compensate completed steps (when supported)

## Ability Injection Invariants

### INV-AGT-ABL-001: Injection Timing

**Statement:** Abilities MUST be injected BEFORE prompt execution.

**Rationale:** Abilities provide context that influences prompt behavior.

**Enforcement:**
- Injection occurs in prompt preparation phase
- Injected content prepended to system prompt
- No injection after prompt sent to provider

### INV-AGT-ABL-002: Core Abilities Included

**Statement:** Agent profile's `coreAbilities` MUST always be included.

**Rationale:** Core abilities define agent's fundamental knowledge.

**Enforcement:**
- Core abilities loaded regardless of task matching
- Core abilities cannot be filtered out
- Order: core abilities first, then task-matched

### INV-AGT-ABL-003: Token Budget Respected

**Statement:** Ability injection MUST NOT exceed configured token limit.

**Rationale:** Excessive injection reduces response capacity and increases costs.

**Enforcement:**
- Token count tracked during injection
- Abilities prioritized by relevance
- Truncation with warning if limit reached

## Testing Requirements

Each invariant must have corresponding tests:

1. `INV-AGT-001`: Test invalid profiles rejected
2. `INV-AGT-002`: Test duplicate ID registration fails
3. `INV-AGT-003`: Test steps execute in order
4. `INV-CP-001`: Test checkpoint contains all required data
5. `INV-CP-002`: Test resume starts at correct step
6. `INV-DT-001`: Test delegation blocked at max depth
7. `INV-DT-002`: Test circular delegation detected
8. `INV-TOOL-001`: Test invalid inputs rejected
9. `INV-TOOL-002`: Test results are frozen
10. `INV-TOOL-003`: Test unknown tools return error
11. `INV-PE-001`: Test parallel execution respects limit
12. `INV-PE-002`: Test dependencies honored
13. `INV-PE-003`: Test failure strategies work correctly
14. `INV-AGT-ABL-001`: Test abilities injected before prompt
15. `INV-AGT-ABL-002`: Test core abilities always included
16. `INV-AGT-ABL-003`: Test token limit respected

## Version History

- V1 (2024-12-16): Initial contract definition
