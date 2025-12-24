# Trace Contract

## Purpose

The Trace domain provides observability by recording execution events. Every significant operation (routing decisions, tool calls, agent steps) is captured with timing and context for debugging and analysis.

## Key Concepts

- **Trace**: Complete record of an execution run
- **TraceEvent**: Single event within a trace (run.start, step.completed, etc.)
- **Span**: Hierarchical grouping of events (parent-child relationships)
- **TraceId/SpanId**: Identifiers for correlation

## Schemas

| Schema | Purpose |
|--------|---------|
| `TraceSchema` | Complete execution trace |
| `TraceEventSchema` | Single trace event |
| `TraceEventTypeSchema` | Enum of event types |
| `TraceQuerySchema` | Query parameters for trace retrieval |

## Usage Example

```typescript
import {
  TraceEventSchema,
  validateTraceEvent,
  type TraceEvent,
} from '@automatosx/contracts/trace/v1';

// Record a trace event
const event: TraceEvent = validateTraceEvent({
  traceId: 'trace-abc123',
  spanId: 'span-001',
  parentSpanId: undefined,
  eventType: 'run.start',
  timestamp: new Date().toISOString(),
  payload: {
    agentId: 'code-reviewer',
    input: { code: '...' },
  },
});

// Store event
await traceStore.record(event);

// Query traces
const recentTraces = await traceStore.query({
  status: 'success',
  limit: 10,
});
```

## Related Domains

- `agent`: Records agent execution traces
- `workflow`: Records workflow step traces
- `mcp`: Exposes trace tools for analysis

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-TR-001: Every trace has run.start and run.end events
- INV-TR-002: Events are strictly ordered by timestamp
- INV-TR-003: Full input/output captured for replay
- INV-TR-005: All errors captured with context
