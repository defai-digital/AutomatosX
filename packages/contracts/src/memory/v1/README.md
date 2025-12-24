# Memory Contract

## Purpose

The Memory domain provides event-sourced storage for conversations, agent state, and key-value data. All changes are recorded as immutable events, enabling full replay and audit capabilities.

## Key Concepts

- **MemoryEvent**: Immutable record of a state change
- **Conversation**: Sequence of messages with metadata
- **EventStore**: Append-only storage for events
- **Correlation**: Linking related events via correlationId

## Schemas

| Schema | Purpose |
|--------|---------|
| `MemoryEventSchema` | Single immutable event |
| `ConversationSchema` | Message sequence with context |
| `MessageSchema` | Individual message in conversation |
| `EventQuerySchema` | Query parameters for event retrieval |

## Usage Example

```typescript
import {
  MemoryEventSchema,
  validateMemoryEvent,
  type MemoryEvent,
} from '@automatosx/contracts/memory/v1';

// Create a memory event
const event: MemoryEvent = validateMemoryEvent({
  eventId: crypto.randomUUID(),
  eventType: 'message.added',
  aggregateId: 'conversation-123',
  version: 1,
  timestamp: new Date().toISOString(),
  payload: {
    role: 'user',
    content: 'Hello, how can you help?',
  },
  correlationId: crypto.randomUUID(),
});

// Store event
await eventStore.append(event);

// Replay to rebuild state
const events = await eventStore.getByAggregate('conversation-123');
const conversation = events.reduce(replayReducer, initialState);
```

## Related Domains

- `agent`: Stores agent execution state
- `session`: Uses memory for session data
- `trace`: Complements with execution traces

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-MEM-001: Events are immutable after storage
- INV-MEM-002: Replay produces deterministic state
- INV-MEM-004: Events ordered by monotonic version
- INV-MEM-005: All events have correlationId
