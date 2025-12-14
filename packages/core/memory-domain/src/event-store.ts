import type { MemoryEvent, MemoryEventType } from '@automatosx/contracts';
import type { EventStore } from './types.js';
import { MemoryErrorCodes } from './types.js';

/**
 * Error thrown by event store operations
 */
export class EventStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EventStoreError';
  }
}

/**
 * In-memory event store implementation
 * INV-MEM-001: Events are immutable - stored as frozen objects
 * INV-MEM-004: Events are ordered by version within aggregate
 */
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, MemoryEvent[]>();
  private readonly allEvents: MemoryEvent[] = [];
  private readonly correlationIndex = new Map<string, MemoryEvent[]>();

  /**
   * Appends an event to the store
   * INV-MEM-001: Events are immutable
   * INV-MEM-004: Version ordering enforced
   */
  async append(event: MemoryEvent): Promise<void> {
    // Validate event
    if (event.eventId === '') {
      throw new EventStoreError(
        MemoryErrorCodes.INVALID_EVENT,
        'Event must have an eventId'
      );
    }

    const aggregateId = event.aggregateId ?? 'global';

    // Check version ordering (INV-MEM-004)
    if (event.version !== undefined) {
      const currentVersion = await this.getVersion(aggregateId);
      if (event.version !== currentVersion + 1) {
        throw new EventStoreError(
          MemoryErrorCodes.VERSION_CONFLICT,
          `Version conflict: expected ${String(currentVersion + 1)}, got ${String(event.version)}`,
          { expected: currentVersion + 1, actual: event.version }
        );
      }
    }

    // Freeze the event to make it immutable (INV-MEM-001)
    const frozenEvent = Object.freeze(structuredClone(event));

    // Store in aggregate bucket
    const aggregateEvents = this.events.get(aggregateId) ?? [];
    aggregateEvents.push(frozenEvent);
    this.events.set(aggregateId, aggregateEvents);

    // Store in global list
    this.allEvents.push(frozenEvent);

    // Index by correlation ID (INV-MEM-005)
    if (event.metadata?.correlationId !== undefined) {
      const correlatedEvents =
        this.correlationIndex.get(event.metadata.correlationId) ?? [];
      correlatedEvents.push(frozenEvent);
      this.correlationIndex.set(event.metadata.correlationId, correlatedEvents);
    }
  }

  /**
   * Gets all events for an aggregate
   * INV-MEM-004: Events returned in version order
   */
  getEvents(aggregateId: string): Promise<MemoryEvent[]> {
    const events = this.events.get(aggregateId) ?? [];
    // Events are already in append order, which should be version order
    return Promise.resolve([...events]);
  }

  /**
   * Gets events by type
   */
  getEventsByType(type: MemoryEventType): Promise<MemoryEvent[]> {
    return Promise.resolve(this.allEvents.filter((e) => e.type === type));
  }

  /**
   * Gets events by correlation ID
   * INV-MEM-005: Support correlation tracing
   */
  getEventsByCorrelation(correlationId: string): Promise<MemoryEvent[]> {
    return Promise.resolve(this.correlationIndex.get(correlationId) ?? []);
  }

  /**
   * Gets the current version for an aggregate
   */
  getVersion(aggregateId: string): Promise<number> {
    const events = this.events.get(aggregateId) ?? [];
    if (events.length === 0) {
      return Promise.resolve(0);
    }
    const lastEvent = events[events.length - 1];
    return Promise.resolve(lastEvent?.version ?? events.length);
  }

  /**
   * Clears all events (for testing)
   */
  clear(): void {
    this.events.clear();
    this.allEvents.length = 0;
    this.correlationIndex.clear();
  }
}

/**
 * Creates an in-memory event store
 */
export function createInMemoryEventStore(): InMemoryEventStore {
  return new InMemoryEventStore();
}
