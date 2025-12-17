# Orchestration Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for multi-agent orchestration.

## Planning Invariants

### INV-ORC-PLAN-001: Plan Validation

**Statement:** Orchestration plans MUST be validated before execution.

**Rationale:** Invalid plans cause runtime failures.

**Enforcement:**
- Schema validation on plan
- Agent references validated (exist and enabled)
- Dependency graph validated (no cycles)

### INV-ORC-PLAN-002: Step Dependencies

**Statement:** Plan step dependencies MUST form a valid DAG.

**Rationale:** Cycles cause deadlock.

**Enforcement:**
- Topological sort on dependencies
- Cycle detection before execution
- Clear error on invalid graph

## Agent Selection Invariants

### INV-ORC-AGT-001: Capability Matching

**Statement:** Selected agents MUST have required capabilities.

**Rationale:** Agents without capabilities will fail the task.

**Enforcement:**
- Task requirements extracted
- Agent capabilities checked
- Only capable agents selected

### INV-ORC-AGT-002: Selection Determinism

**Statement:** Same task MUST select same agents (when available).

**Rationale:** Reproducibility aids debugging.

**Enforcement:**
- Selection algorithm is deterministic
- Tie-breaking is consistent
- Selection logged for audit

## Result Invariants

### INV-ORC-RES-001: Result Aggregation

**Statement:** Multi-agent results MUST be aggregated consistently.

**Rationale:** Consistent aggregation enables reliable composition.

**Enforcement:**
- Results keyed by agent ID
- Order matches execution order
- Errors collected, not lost

### INV-ORC-RES-002: Partial Results

**Statement:** Partial results MUST be available on failure.

**Rationale:** Completed work should not be lost.

**Enforcement:**
- Results captured incrementally
- Failure includes completed results
- Resume possible from partial results

## Application Initialization Invariants

### INV-INIT-001: Single Composition Root

**Statement:** Each application (CLI, MCP Server) MUST have exactly one composition root.

**Rationale:** Dependency injection requires a single point of composition to prevent duplicate instances and ensure consistent configuration.

**Enforcement:**
- Only `bootstrap.ts` imports adapter implementations
- All other code depends on port interfaces
- dependency-cruiser rules enforce this boundary
- Composition root is the only module that wires ports to adapters

### INV-INIT-002: Storage Fallback

**Statement:** SQLite unavailability MUST fall back to in-memory storage.

**Rationale:** Application must remain functional even without persistent storage, allowing operation in restricted environments.

**Enforcement:**
- SQLite import wrapped in try/catch
- Fallback logged as warning (not error)
- `usingSqlite` flag indicates actual mode
- All storage operations work identically with either backend

### INV-INIT-003: Idempotent Bootstrap

**Statement:** Multiple bootstrap calls MUST return the same instance.

**Rationale:** Prevents duplicate resource allocation and ensures consistent application state.

**Enforcement:**
- Singleton pattern with `_initialized` flag
- `getDependencies()` returns cached instance
- `resetBootstrap()` only available for testing
- Concurrent calls handled via promise deduplication

### INV-INIT-004: Graceful Degradation

**Statement:** Individual feature initialization failures MUST NOT prevent application startup.

**Rationale:** Partial functionality is better than complete failure. Users can still use available features.

**Enforcement:**
- Each feature (agents, abilities, providers, tracing) initialized independently
- Failures logged as warnings
- `enabledFeatures` tracks what actually initialized
- Bootstrap result includes warnings list

## Testing Requirements

1. `INV-ORC-PLAN-001`: Test plan validation
2. `INV-ORC-PLAN-002`: Test cycle detection
3. `INV-ORC-AGT-001`: Test capability matching
4. `INV-ORC-AGT-002`: Test selection determinism
5. `INV-ORC-RES-001`: Test result aggregation
6. `INV-ORC-RES-002`: Test partial results on failure
7. `INV-INIT-001`: Test single composition root pattern
8. `INV-INIT-002`: Test SQLite fallback to memory
9. `INV-INIT-003`: Test idempotent bootstrap
10. `INV-INIT-004`: Test graceful degradation on feature failure

## Version History

- V1 (2024-12-16): Initial contract definition
- V1.1 (2025-12-17): Added application initialization invariants (INV-INIT-001/002/003/004)
