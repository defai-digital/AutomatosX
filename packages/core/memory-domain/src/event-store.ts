import type { MemoryEvent, MemoryEventType } from '@defai.digital/contracts';
import type { EventStore } from './types.js';
import { MemoryErrorCodes } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Default aggregate ID for events without explicit aggregate */
const DEFAULT_AGGREGATE_ID = 'global';

/** Default maximum events to store before eviction (INV-MEM-006) */
const DEFAULT_MAX_EVENTS = 100_000;

// ============================================================================
// Error Class
// ============================================================================

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
 * INV-MEM-006: Memory growth is bounded with LRU eviction
 * INV-MEM-008: Eviction uses O(1) reverse index lookup
 */
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, MemoryEvent[]>();
  private readonly allEvents: MemoryEvent[] = [];
  private readonly correlationIndex = new Map<string, MemoryEvent[]>();
  // Reverse index: eventId -> aggregateId for O(1) eviction lookup
  private readonly eventToAggregate = new Map<string, string>();
  private readonly maxEvents: number;

  constructor(maxEvents: number = DEFAULT_MAX_EVENTS) {
    this.maxEvents = maxEvents;
  }

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

    const aggregateId = event.aggregateId ?? DEFAULT_AGGREGATE_ID;

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

    // INV-MEM-008: Maintain reverse index for O(1) eviction
    this.eventToAggregate.set(frozenEvent.eventId, aggregateId);

    // INV-MEM-006: Evict oldest events if over limit to prevent unbounded memory growth
    if (this.allEvents.length > this.maxEvents) {
      this.evictOldest(this.allEvents.length - this.maxEvents);
    }

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
   * INV-MEM-007: Version calculation handles edge cases correctly
   */
  getVersion(aggregateId: string): Promise<number> {
    const events = this.events.get(aggregateId) ?? [];
    if (events.length === 0) {
      return Promise.resolve(0);
    }
    const lastEvent = events[events.length - 1];
    // INV-MEM-007: Explicit undefined check - version 0 is valid, undefined means use length
    if (lastEvent === undefined) {
      return Promise.resolve(0);
    }
    if (lastEvent.version === undefined) {
      return Promise.resolve(events.length);
    }
    return Promise.resolve(lastEvent.version);
  }

  /**
   * Evicts the oldest events to maintain memory bounds
   * INV-MEM-006: LRU eviction when over maxEvents
   * INV-MEM-008: Uses reverse index for O(1) aggregate lookup
   */
  private evictOldest(count: number): void {
    // Remove from global list (oldest events are at the front)
    const evicted = this.allEvents.splice(0, count);

    for (const event of evicted) {
      // INV-MEM-008: O(1) lookup using reverse index
      const aggregateId = this.eventToAggregate.get(event.eventId) ?? event.aggregateId ?? DEFAULT_AGGREGATE_ID;
      this.eventToAggregate.delete(event.eventId);

      // Remove from aggregate bucket - events are ordered, so oldest is at index 0
      const aggregateEvents = this.events.get(aggregateId);
      if (aggregateEvents !== undefined && aggregateEvents.length > 0) {
        // Since we evict in order, the event should be at the front of the aggregate array
        if (aggregateEvents[0]?.eventId === event.eventId) {
          aggregateEvents.shift(); // O(n) but only on the aggregate, not all events
        } else {
          // Fallback: search for the event (should rarely happen)
          const index = aggregateEvents.findIndex((e) => e.eventId === event.eventId);
          if (index !== -1) {
            aggregateEvents.splice(index, 1);
          }
        }
        if (aggregateEvents.length === 0) {
          this.events.delete(aggregateId);
        }
      }

      // Remove from correlation index
      if (event.metadata?.correlationId !== undefined) {
        const correlatedEvents = this.correlationIndex.get(event.metadata.correlationId);
        if (correlatedEvents !== undefined && correlatedEvents.length > 0) {
          // Same optimization: check front first
          if (correlatedEvents[0]?.eventId === event.eventId) {
            correlatedEvents.shift();
          } else {
            const index = correlatedEvents.findIndex((e) => e.eventId === event.eventId);
            if (index !== -1) {
              correlatedEvents.splice(index, 1);
            }
          }
          if (correlatedEvents.length === 0) {
            this.correlationIndex.delete(event.metadata.correlationId);
          }
        }
      }
    }
  }

  /**
   * Clears all events (for testing)
   */
  clear(): void {
    this.events.clear();
    this.allEvents.length = 0;
    this.correlationIndex.clear();
    this.eventToAggregate.clear();
  }
}

/**
 * Creates an in-memory event store
 * @param maxEvents Maximum events to store before eviction (default: 100000)
 */
export function createInMemoryEventStore(maxEvents?: number): InMemoryEventStore {
  return new InMemoryEventStore(maxEvents);
}
