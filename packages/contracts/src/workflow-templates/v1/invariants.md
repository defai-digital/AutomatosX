# Workflow Templates Contract V1 - Behavioral Invariants

This document defines the behavioral guarantees that MUST be enforced by any implementation of the Workflow Templates contract.

## Template Validation Invariants

### INV-WT-001: Agent Existence

**Statement:** All agents referenced in workflow steps MUST exist in the agent registry.

**Rationale:** Workflow execution requires valid agents to perform steps. Missing agents cause runtime failures.

**Enforcement:**
- Pre-execution validation checks agent registry
- Fail-fast on missing agent before workflow starts
- Error code: `WORKFLOW_TEMPLATE_AGENT_NOT_FOUND`

**Test Criteria:**
```typescript
// Given a workflow template with agent "non-existent-agent"
// When template execution is requested
// Then validation fails with AGENT_NOT_FOUND error
// And no steps are executed
```

### INV-WT-002: Tool Availability

**Statement:** All tools referenced in workflow steps MUST be available in the tool registry.

**Rationale:** Tool steps cannot execute without registered tools.

**Enforcement:**
- Tool registry check during template validation
- Fail-fast on missing tool
- Error code: `WORKFLOW_TEMPLATE_TOOL_NOT_AVAILABLE`

**Test Criteria:**
```typescript
// Given a workflow template with tool "memory_store"
// When tool registry does not have "memory_store"
// Then validation fails with TOOL_NOT_AVAILABLE error
```

### INV-WT-003: Step ID Uniqueness

**Statement:** Step IDs MUST be unique within a workflow template.

**Rationale:** Unique step IDs enable unambiguous step result tracking and debugging.

**Enforcement:**
- Schema validation rejects duplicate stepIds
- Zod refinement checks for uniqueness
- Validation occurs at template registration time

**Test Criteria:**
```typescript
// Given a workflow template with steps ["step-1", "step-1", "step-2"]
// When template is validated
// Then validation fails with schema error
// And error message indicates duplicate stepId
```

## Execution Invariants

### INV-WT-004: Category-Specific Policies

**Statement:** Workflows MUST apply category-specific guard policies during execution.

**Rationale:** Different workflow categories have different governance requirements (ML governance, business governance, etc.).

**Enforcement:**
- Guard check invoked with category-mapped policy before step execution
- Policy mapping:
  - `ml-lifecycle` → `ml-governance`
  - `product-development` → `business-governance`
  - `infrastructure` → `infrastructure-governance`
  - Other categories → `default-governance`

**Test Criteria:**
```typescript
// Given a workflow template with category "ml-lifecycle"
// When workflow executes
// Then ml-governance policy is applied
// And all ML-specific gates are evaluated
```

### INV-WT-005: Output Namespace Isolation

**Statement:** Workflow outputs MUST use the declared storage namespace only.

**Rationale:** Prevents workflows from accidentally overwriting data in other namespaces.

**Enforcement:**
- Memory store validates namespace matches template's storage.namespace
- Cross-namespace writes are rejected
- Namespace validation occurs at write time

**Test Criteria:**
```typescript
// Given a workflow template with storage.namespace = "ml-experiments"
// When step attempts to write to namespace "user-data"
// Then write is rejected
// And error indicates namespace violation
```

### INV-WT-006: Timeout Enforcement

**Statement:** Steps MUST terminate within configured timeout.

**Rationale:** Prevents runaway steps from blocking workflow execution indefinitely.

**Enforcement:**
- Timeout wrapper on all step executions
- Default timeout: 120000ms (2 minutes)
- Maximum timeout: 3600000ms (1 hour)
- Step marked as failed on timeout

**Test Criteria:**
```typescript
// Given a step with timeout = 5000ms
// When step execution exceeds 5000ms
// Then step is terminated
// And step status is "failed"
// And error message indicates timeout
```

### INV-WT-007: Step Execution Order

**Statement:** Steps MUST execute in the order defined in the template (except for parallel steps).

**Rationale:** Step order may have dependencies (later steps may depend on earlier step outputs).

**Enforcement:**
- Sequential execution for non-parallel steps
- Parallel steps execute concurrently within a parallel block
- Step N+1 does not start until step N completes (unless parallel)

**Test Criteria:**
```typescript
// Given steps ["step-1", "step-2", "step-3"] with type "prompt"
// When workflow executes
// Then step-2 starts only after step-1 completes
// And step-3 starts only after step-2 completes
```

## Registry Invariants

### INV-WT-008: Version Monotonicity

**Statement:** Template versions MUST increase monotonically (SemVer).

**Rationale:** Ensures clear upgrade path and prevents version confusion.

**Enforcement:**
- Version comparison before registration
- Reject registrations where new version <= existing version
- SemVer comparison (major.minor.patch)

**Test Criteria:**
```typescript
// Given registered template "my-workflow" version "1.0.0"
// When registering same template with version "0.9.0"
// Then registration fails
// And error indicates version must be greater
```

### INV-WT-009: Template Immutability Post-Registration

**Statement:** Registered templates MUST NOT be modified; new versions must be registered.

**Rationale:** Ensures audit trail and reproducibility of workflow executions.

**Enforcement:**
- Templates are immutable after registration
- Updates require new version registration
- Previous versions remain accessible

**Test Criteria:**
```typescript
// Given registered template "my-workflow" version "1.0.0"
// When attempting to update template in-place
// Then update is rejected
// And error indicates immutability
```

### INV-WT-010: Deprecation Preservation

**Statement:** Deprecated templates MUST remain accessible but emit warnings.

**Rationale:** Allows graceful migration while preventing accidental use of deprecated workflows.

**Enforcement:**
- Deprecated flag prevents new executions by default
- Force flag allows execution with warning
- Deprecation reason is logged

**Test Criteria:**
```typescript
// Given deprecated template "old-workflow"
// When execution is requested without force flag
// Then execution is rejected with TEMPLATE_DEPRECATED error
// When execution is requested with force flag
// Then execution proceeds with deprecation warning logged
```

## Error Handling Invariants

### INV-WT-011: Step Failure Isolation

**Statement:** Step failures MUST NOT corrupt workflow state.

**Rationale:** Partial workflow completion must be recoverable.

**Enforcement:**
- Step execution wrapped in try-catch
- Failed step status recorded
- Subsequent steps can be skipped or continue based on configuration

**Test Criteria:**
```typescript
// Given workflow with steps ["step-1", "step-2", "step-3"]
// When step-2 fails
// Then step-2 status is "failed"
// And step-3 status is "skipped" (default behavior)
// And workflow status is "failed"
// And step-1 output remains accessible
```

### INV-WT-012: Retry Determinism

**Statement:** Retry behavior MUST be deterministic based on retry policy.

**Rationale:** Same failure with same retry policy produces same retry behavior.

**Enforcement:**
- Retry count tracked per step
- Exponential backoff calculated deterministically
- No random jitter without explicit configuration

**Test Criteria:**
```typescript
// Given retry policy { maxAttempts: 3, backoffMs: 1000 }
// When step fails
// Then retry 1 occurs after 1000ms
// And retry 2 occurs after 2000ms (exponential)
// And no retry 3 (max attempts reached)
```
