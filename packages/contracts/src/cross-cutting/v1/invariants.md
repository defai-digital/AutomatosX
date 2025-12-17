# Cross-Cutting Concerns Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for cross-cutting concerns: saga management, dead letter queue, idempotency, and retention policies.

## Saga Invariants

### INV-SAGA-001: Compensation Order

**Statement:** Saga compensation MUST execute in reverse order of original steps.

**Rationale:** Later steps may depend on earlier steps' results.

**Enforcement:**
- Compensation stack built during execution
- Stack popped during compensation
- Each step's compensation runs before previous

### INV-SAGA-002: All-or-Nothing

**Statement:** Saga MUST complete fully or compensate fully.

**Rationale:** Partial execution leaves system in inconsistent state.

**Enforcement:**
- Failure triggers compensation of all completed steps
- Compensation failures logged but continue
- Final state: all done or all compensated

### INV-SAGA-003: Idempotent Compensation

**Statement:** Compensation actions MUST be idempotent.

**Rationale:** Compensation may be retried on failure.

**Enforcement:**
- Compensation checks current state before acting
- Duplicate compensation is no-op
- State verification after compensation

## Dead Letter Queue Invariants

### INV-DLQ-001: Full Context Capture

**Statement:** Failed events MUST be captured with full context.

**Rationale:** Context needed for debugging and manual intervention.

**Enforcement:**
- Original event stored verbatim
- Error message and code captured
- Timestamps for all state changes

### INV-DLQ-002: Retry Limits

**Statement:** Retries MUST respect configured `maxRetries` limit.

**Rationale:** Infinite retries waste resources on unrecoverable errors.

**Enforcement:**
- Retry count incremented on each attempt
- Entry marked `exhausted` when limit reached
- No further automatic retries after exhaustion

### INV-DLQ-003: Status Tracking

**Statement:** Entry status MUST accurately reflect retry state.

**Rationale:** Status used for monitoring and alerting.

**Enforcement:**
- `pending`: awaiting retry
- `exhausted`: max retries reached
- `resolved`: successfully processed or manually cleared

## Idempotency Invariants

### INV-IDEM-001: Duplicate Detection

**Statement:** Duplicate requests with same idempotency key MUST return cached result.

**Rationale:** Network retries should not cause duplicate operations.

**Enforcement:**
- Key checked before operation execution
- Cached result returned for duplicates
- Cache entries have TTL

### INV-IDEM-002: Key Uniqueness

**Statement:** Idempotency keys MUST be unique per operation type.

**Rationale:** Same key for different operations causes incorrect caching.

**Enforcement:**
- Key includes operation type prefix
- Client provides unique portion
- Collision detection and warning

### INV-IDEM-003: Cache Consistency

**Statement:** Cached results MUST match original operation result exactly.

**Rationale:** Different results for same key indicates bug or corruption.

**Enforcement:**
- Result stored immediately after operation
- No modification of cached results
- Cache validation on retrieval

## Retention Invariants

### INV-RET-001: Age Enforcement

**Statement:** Retention policies MUST be enforced based on configured age.

**Rationale:** Old data consumes storage and may have compliance issues.

**Enforcement:**
- Periodic cleanup job runs
- Entries older than retention period deleted
- Archive before delete if configured

### INV-RET-002: Archive Before Delete

**Statement:** When configured, data MUST be archived before deletion.

**Rationale:** Archival preserves data for compliance while freeing active storage.

**Enforcement:**
- Archive path required when archive enabled
- Archive write confirmed before delete
- Archive format preserves all data

### INV-RET-003: Cleanup Idempotency

**Statement:** Retention cleanup MUST be idempotent.

**Rationale:** Cleanup may run multiple times due to failures or scheduling.

**Enforcement:**
- Already-deleted entries skipped gracefully
- Already-archived entries not re-archived
- No errors on repeat cleanup

## Testing Requirements

1. `INV-SAGA-001`: Test compensation runs in reverse
2. `INV-SAGA-002`: Test all-or-nothing behavior
3. `INV-SAGA-003`: Test compensation idempotency
4. `INV-DLQ-001`: Test full context captured
5. `INV-DLQ-002`: Test retry limits enforced
6. `INV-DLQ-003`: Test status accuracy
7. `INV-IDEM-001`: Test duplicate detection
8. `INV-IDEM-002`: Test key uniqueness
9. `INV-IDEM-003`: Test cache consistency
10. `INV-RET-001`: Test age-based deletion
11. `INV-RET-002`: Test archive before delete
12. `INV-RET-003`: Test cleanup idempotency

## Version History

- V1 (2024-12-16): Initial contract definition
