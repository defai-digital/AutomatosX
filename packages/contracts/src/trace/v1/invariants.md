# Trace Event Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for the trace event system. The tracing infrastructure MUST satisfy all invariants.

## Invariants

### INV-TR-001: Complete Event Chain

**Statement:** Every run MUST produce a complete event chain (run.start → ... → run.end).

**Rationale:** Incomplete traces make debugging impossible and indicate system failures.

**Enforcement:**
- run.start must be the first event in any trace
- run.end must be the last event (success or failure)
- Missing run.end after timeout indicates system crash

### INV-TR-002: Strict Event Ordering

**Statement:** Events MUST be strictly ordered within a trace.

**Rationale:** Out-of-order events make replay and analysis unreliable.

**Enforcement:**
- Sequence numbers must be monotonically increasing
- Timestamps must be consistent with sequence order
- Parent-child relationships must be temporally valid

### INV-TR-003: Full Decision Replay

**Statement:** Trace logs MUST support full decision replay.

**Rationale:** Debugging and auditing require the ability to understand exactly what decisions were made and why.

**Enforcement:**
- All routing decisions must be traced with full input context
- All step executions must include input and output
- All tool invocations must be traced with parameters and results

### INV-TR-004: Trace Isolation

**Statement:** Each trace MUST be independent and self-contained.

**Rationale:** Traces should be analyzable in isolation without requiring external context.

**Enforcement:**
- traceId must be unique across all traces
- All events within a trace share the same traceId
- No cross-trace references in payloads

### INV-TR-005: Error Traceability

**Statement:** All errors MUST be captured in the trace with full context.

**Rationale:** Error diagnosis requires understanding the full context in which errors occurred.

**Enforcement:**
- Every error must generate a trace event of type 'error'
- Error events must include code, message, and stack trace
- Error context must include the step/operation that failed

## Trace Structure Requirements

### Required Event Sequence

1. `run.start` - Always first
2. `decision.routing` - Before any model calls
3. `step.start` → `step.execute` → `step.end` - For each step
4. `tool.invoke` → `tool.result` - For tool calls within steps
5. `run.end` - Always last

### Hierarchical Tracing

- parentEventId creates a tree structure
- step.execute is parent of tool.invoke within that step
- run.start is root parent of all events

## Testing Requirements

Each invariant must have corresponding tests:

1. `INV-TR-001`: Test that all traces have start and end events
2. `INV-TR-002`: Test event ordering is consistent
3. `INV-TR-003`: Test that traces contain all decision data for replay
4. `INV-TR-004`: Test trace isolation
5. `INV-TR-005`: Test error capture with full context

## JSONL Format

Traces should be stored in JSONL format for streaming and analysis:

```jsonl
{"traceId":"...","eventId":"...","type":"run.start",...}
{"traceId":"...","eventId":"...","type":"decision.routing",...}
{"traceId":"...","eventId":"...","type":"step.execute",...}
{"traceId":"...","eventId":"...","type":"run.end",...}
```

## Version History

- V1 (2024-12-14): Initial contract definition
