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

### INV-TR-010: Provider Correlation

**Statement:** All trace events from provider calls MUST include `context.providerId` matching the provider's identifier.

**Rationale:** Enables drill-down by provider in the dashboard, allowing users to see all requests to a specific provider.

**Enforcement:**
- Provider calls (via `ax call`) must include `providerId` in trace context
- Discussion provider responses must include `providerId` in context
- The `providerId` must match the configured provider identifier (e.g., 'claude', 'grok', 'gemini')

### INV-TR-011: Agent Correlation

**Statement:** All trace events from agent executions MUST include `context.agentId` matching the agent's identifier.

**Rationale:** Enables drill-down by agent in the dashboard, allowing users to see all executions of a specific agent.

**Enforcement:**
- Agent runs (via `ax agent run`) must include `agentId` in trace context
- Nested agent delegations must include the delegated `agentId`
- The `agentId` must match the registered agent identifier

### INV-TR-012: Token Usage Recording

**Statement:** Provider completion events SHOULD include `context.tokenUsage` when the provider reports token counts.

**Rationale:** Enables cost tracking and optimization by showing token consumption per provider/agent.

**Enforcement:**
- When provider response includes usage data, it must be captured in `tokenUsage`
- `tokenUsage.input` for input/prompt tokens
- `tokenUsage.output` for output/completion tokens
- `tokenUsage.total` for combined total (optional, can be computed)

### INV-TR-013: Workflow Event Chain

**Statement:** Workflow executions MUST produce a complete event chain (workflow.start → workflow.step* → workflow.end).

**Rationale:** Enables workflow visualization in the dashboard, showing timeline and step details.

**Enforcement:**
- `workflow.start` must be emitted before any step execution
- `workflow.step` must be emitted for each step with timing and status
- `workflow.end` must be emitted after all steps complete (success or failure)
- All workflow events must share the same `workflowId` in context

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
6. `INV-TR-010`: Test provider calls include providerId in context
7. `INV-TR-011`: Test agent runs include agentId in context
8. `INV-TR-012`: Test token usage is captured when available
9. `INV-TR-013`: Test workflow executions have complete event chain

## Hierarchical Tracing Invariants

### INV-TR-020: Root Trace Correlation

**Statement:** All traces within a delegation hierarchy MUST share the same `rootTraceId`.

**Rationale:** Enables discovery of all traces spawned from a single user-initiated action, allowing trace tree reconstruction.

**Enforcement:**
- User-initiated traces set `rootTraceId` to their own `traceId`
- Child traces inherit `rootTraceId` from parent
- Query by `rootTraceId` returns complete hierarchy

### INV-TR-021: Parent Trace Linking

**Statement:** Child traces MUST reference their parent via `parentTraceId`.

**Rationale:** Enables traversal from child to parent and construction of the trace tree.

**Enforcement:**
- Root traces have no `parentTraceId` (undefined)
- Child traces set `parentTraceId` to the spawning trace's `traceId`
- `parentTraceId` must reference a valid, existing trace

### INV-TR-022: Trace Depth Consistency

**Statement:** `traceDepth` MUST equal parent's depth + 1 for child traces.

**Rationale:** Enables depth-based queries and prevents infinite delegation loops.

**Enforcement:**
- Root traces have `traceDepth = 0`
- Child traces compute `traceDepth = parent.traceDepth + 1`
- Maximum depth can be enforced via policy (e.g., max depth = 10)

### INV-TR-023: Session Trace Correlation

**Statement:** Related traces MAY share a `sessionId` for grouping.

**Rationale:** Enables viewing all traces within a collaboration session together.

**Enforcement:**
- Session-scoped traces include `sessionId` in context
- Child traces inherit `sessionId` from parent
- Query by `sessionId` returns all session traces

### INV-TR-024: Backward Compatibility

**Statement:** All hierarchy fields are OPTIONAL to maintain backward compatibility.

**Rationale:** Existing traces without hierarchy fields remain valid and functional.

**Enforcement:**
- Missing `rootTraceId` implies trace is its own root
- Missing `parentTraceId` implies root trace
- Missing `traceDepth` implies depth 0
- Dashboard falls back to flat list for traces without hierarchy

## JSONL Format

Traces should be stored in JSONL format for streaming and analysis:

```jsonl
{"traceId":"...","eventId":"...","type":"run.start",...}
{"traceId":"...","eventId":"...","type":"decision.routing",...}
{"traceId":"...","eventId":"...","type":"step.execute",...}
{"traceId":"...","eventId":"...","type":"run.end",...}
```

### Hierarchical Trace Example

```jsonl
{"traceId":"abc12345","eventId":"...","type":"run.start","context":{"rootTraceId":"abc12345","traceDepth":0}}
{"traceId":"def67890","eventId":"...","type":"run.start","context":{"rootTraceId":"abc12345","parentTraceId":"abc12345","traceDepth":1}}
{"traceId":"ghi11111","eventId":"...","type":"run.start","context":{"rootTraceId":"abc12345","parentTraceId":"def67890","traceDepth":2}}
```

## Version History

- V1 (2024-12-14): Initial contract definition
- V1.1 (2026-01-17): Added INV-TR-010 (provider correlation), INV-TR-011 (agent correlation), INV-TR-012 (token usage), INV-TR-013 (workflow events)
- V1.2 (2026-01-17): Added INV-TR-020 (root trace correlation), INV-TR-021 (parent trace linking), INV-TR-022 (trace depth consistency), INV-TR-023 (session correlation), INV-TR-024 (backward compatibility)
