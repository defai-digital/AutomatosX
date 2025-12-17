# Storage Contract V1 - Behavioral Invariants

## Overview

The Storage Contract defines port interfaces for persistent storage following the Ports & Adapters (Hexagonal Architecture) pattern. Application and core layers depend on these interfaces, while the adapter layer provides concrete implementations (SQLite, in-memory, etc.).

Storage types covered:
- **Key-Value Storage**: Generic key-value store for memory and configuration
- **Event Storage**: Append-only event store for event sourcing patterns
- **Trace Storage**: Execution trace storage for observability
- **FTS Storage**: Full-text search for content discovery

## Invariants

### INV-ST-001: Storage Mode Configuration

**Statement:** Storage mode MUST be one of the defined modes (`sqlite` or `memory`). Invalid modes MUST be rejected at validation time.

**Rationale:** Consistent storage mode ensures predictable behavior across the application. Unknown modes could lead to silent failures or undefined behavior.

**Enforcement:**
- `StorageModeSchema` validates mode at parse time
- Configuration validation rejects unknown modes
- Environment variable `AX_STORAGE` maps to valid modes

---

### INV-ST-002: Key-Value Namespace Isolation

**Statement:** Keys in different namespaces MUST be completely independent. Operations on keys in one namespace MUST NOT affect keys in another namespace, even if they have the same key name.

**Rationale:** Namespace isolation enables multi-tenant storage and prevents accidental key collisions between different components.

**Enforcement:**
- `KVStoragePort.store()` scopes key to namespace
- `KVStoragePort.retrieve()` only finds keys in specified namespace
- `KVStoragePort.delete()` only removes key from specified namespace
- Default namespace is used when not specified

---

### INV-ST-003: Event Immutability

**Statement:** Events stored via `EventStoragePort` MUST be immutable after storage. No update or modification operations are permitted on stored events.

**Rationale:** Event immutability is fundamental to event sourcing. Modifying past events would break replay consistency and audit trails.

**Enforcement:**
- `EventStoragePort` only provides `append()`, no update method
- Events are deep-frozen after storage
- Adapter implementations must reject any modification attempts

---

### INV-ST-004: Event Ordering Within Aggregate

**Statement:** Events retrieved for an aggregate MUST be returned in version/sequence order. This order MUST be deterministic and consistent across all reads.

**Rationale:** Event sourcing relies on replaying events in the exact order they occurred. Out-of-order events would produce incorrect aggregate state.

**Enforcement:**
- `EventStoragePort.getEvents()` returns events sorted by version
- Each event has monotonically increasing version within aggregate
- Version conflicts are rejected at write time

---

### INV-ST-005: Trace Event Sequencing

**Statement:** Trace events MUST maintain sequence order within a trace. Events with sequence numbers MUST be returned in sequence order.

**Rationale:** Trace analysis and replay depend on understanding the order of operations. Incorrect sequencing would produce misleading traces.

**Enforcement:**
- `TraceStoragePort.getTrace()` returns events sorted by sequence
- Sequence numbers are monotonically increasing
- Timestamp is used as fallback when sequence is not present

---

### INV-ST-006: Trace Deletion Completeness

**Statement:** Deleting a trace via `TraceStoragePort.deleteTrace()` MUST remove all associated events. No orphaned events may remain.

**Rationale:** Partial deletion could leave inconsistent state and waste storage. Users expect complete cleanup when deleting a trace.

**Enforcement:**
- `deleteTrace()` is transactional (all or nothing)
- Implementation verifies no events remain for traceId after delete
- Cascading delete in SQL implementations

---

### INV-ST-007: FTS Search Ranking

**Statement:** Full-text search results MUST be ranked by relevance score in descending order. Higher scores indicate better matches.

**Rationale:** Users expect search results ordered by relevance. Arbitrary ordering would make search less useful.

**Enforcement:**
- `FTSStoragePort.search()` returns results sorted by score descending
- Score is a number between 0 and 1 (normalized)
- Results with equal scores are sub-sorted deterministically (by ID)

---

### INV-ST-008: TTL Best-Effort Expiration

**Statement:** Key-value entries with TTL MAY persist slightly past expiration time. Expired entries MUST NOT be returned by `retrieve()`.

**Rationale:** Exact TTL enforcement would require real-time cleanup, adding complexity. Best-effort expiration with read-time filtering provides a good balance.

**Enforcement:**
- `retrieve()` checks expiration time and returns undefined for expired keys
- Background cleanup removes expired entries periodically
- `expiresAt` field is set at write time based on `ttlMs`

---

## Testing Requirements

1. **INV-ST-001**: Test that invalid storage modes are rejected by schema validation
2. **INV-ST-002**: Test that keys in different namespaces are isolated (same key name, different namespaces)
3. **INV-ST-003**: Verify no update method exists on EventStoragePort; events cannot be modified after storage
4. **INV-ST-004**: Test event ordering by appending events and verifying retrieval order
5. **INV-ST-005**: Test trace event sequencing with out-of-order writes, verify ordered retrieval
6. **INV-ST-006**: Test trace deletion removes all events (count events before/after)
7. **INV-ST-007**: Test FTS results are ordered by score (inject test documents with known relevance)
8. **INV-ST-008**: Test TTL expiration: store with TTL, wait, verify retrieve returns undefined

## Version History

- **V1** (2024-12-16): Initial contract definition with 8 invariants
