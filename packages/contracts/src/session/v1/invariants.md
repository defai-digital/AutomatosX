# Session Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for the session management domain. Sessions track collaborative agent execution and MUST satisfy all invariants.

## Session Lifecycle Invariants

### INV-SESS-001: Valid State Transitions

**Statement:** Session state transitions MUST follow the defined state machine.

**Rationale:** Invalid transitions indicate bugs and corrupt session state.

**Valid Transitions:**
- `created` → `active` (on first activity)
- `active` → `completed` (explicit completion)
- `active` → `failed` (on error)
- `completed` → (terminal, no transitions)
- `failed` → (terminal, no transitions)

**Enforcement:**
- State machine enforced in session manager
- Invalid transitions throw `SessionStateError`
- Transition attempts logged for debugging

### INV-SESS-002: Participant Uniqueness

**Statement:** Each agent can only join a session once.

**Rationale:** Duplicate participants cause confusion and incorrect state.

**Enforcement:**
- Participant list uses Set semantics
- `join()` is idempotent - second join returns existing participation
- Leave removes agent completely from participants

### INV-SESS-003: Audit Trail

**Statement:** All session state changes MUST emit corresponding events.

**Rationale:** Audit trail required for debugging and compliance.

**Enforcement:**
- Events emitted for: create, join, leave, complete, fail
- Events include: sessionId, agentId, timestamp, previousState, newState
- Event emission cannot be disabled

## Session Data Invariants

### INV-SESS-004: Required Fields

**Statement:** Sessions MUST have initiator, task, and createdAt.

**Rationale:** These fields are essential for session identification and tracking.

**Enforcement:**
- Schema validation on creation
- Missing fields cause validation error
- No null or empty values for required fields

### INV-SESS-005: Immutable Initiator

**Statement:** Session initiator MUST NOT change after creation.

**Rationale:** Initiator is historical record of who started the session.

**Enforcement:**
- Initiator set at creation only
- No update method for initiator
- Initiator field readonly in schema

## Concurrency Invariants

### INV-SESS-006: Concurrent Modification Safety

**Statement:** Concurrent session modifications MUST be serialized.

**Rationale:** Race conditions cause lost updates and inconsistent state.

**Enforcement:**
- Optimistic locking via version numbers
- Version conflict detection and retry
- Atomic read-modify-write operations

## Testing Requirements

1. `INV-SESS-001`: Test all valid transitions succeed, invalid fail
2. `INV-SESS-002`: Test duplicate join is idempotent
3. `INV-SESS-003`: Test events emitted for all state changes
4. `INV-SESS-004`: Test required fields validated
5. `INV-SESS-005`: Test initiator cannot be changed
6. `INV-SESS-006`: Test concurrent modifications handled

## Version History

- V1 (2024-12-16): Initial contract definition
