# Workflow Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for the Workflow contract. Implementations MUST satisfy all invariants listed here.

## Invariants

### INV-WF-001: Step Execution Order

**Statement:** Step execution order MUST match the YAML/JSON definition exactly.

**Rationale:** Predictable execution is essential for debugging and reproducibility. Users must be able to reason about workflow behavior by reading the definition.

**Enforcement:**
- Core engine must iterate steps in array index order
- No step reordering optimizations allowed
- Parallel steps execute concurrently but their results are collected in definition order

### INV-WF-002: Retry Scope Isolation

**Statement:** Retries are scoped to the current step ONLY.

**Rationale:** Retry cascades can cause exponential execution time and unexpected side effects. A failing step should not cause previous successful steps to re-execute.

**Enforcement:**
- Retry counter resets at step boundaries
- Failed retries do not propagate to parent steps
- Workflow-level retry (if needed) must be explicit, not implicit

### INV-WF-003: Schema Strictness

**Statement:** Undefined fields MUST NOT be parsed or used by the core engine.

**Rationale:** Prevents implicit feature creep and ensures forward compatibility. Unknown fields indicate schema version mismatch.

**Enforcement:**
- JSON Schema uses `additionalProperties: false`
- Zod schemas use `.strict()` mode in validation
- Runtime validation must reject unknown fields

### INV-WF-004: Step ID Uniqueness

**Statement:** All stepIds within a workflow MUST be unique.

**Rationale:** Step IDs are used for logging, tracing, and state management. Duplicates would cause ambiguous references.

**Enforcement:**
- Pre-execution validation must check for duplicates
- Validation error on duplicate stepId

### INV-WF-005: Immutable Definition

**Statement:** Workflow definitions MUST NOT be modified during execution.

**Rationale:** Runtime mutation makes debugging impossible and violates the principle of declarative workflows.

**Enforcement:**
- Workflow object should be frozen after parsing
- Engine must not modify step configurations
- Any dynamic behavior must be through explicit step outputs, not definition mutation

## Testing Requirements

Each invariant must have corresponding tests in `tests/contract/workflow.test.ts`:

1. `INV-WF-001`: Test that steps execute in definition order
2. `INV-WF-002`: Test that retry failures don't affect other steps
3. `INV-WF-003`: Test that unknown fields cause validation errors
4. `INV-WF-004`: Test that duplicate stepIds are rejected
5. `INV-WF-005`: Test that workflow object is immutable during execution (Phase 2)

## Version History

- V1 (2024-12-14): Initial contract definition
