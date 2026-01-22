import type { MemoryEvent } from '@defai.digital/contracts';
import type {
  EventStore,
  AggregateState,
  EventHandler,
} from './types.js';

/**
 * Aggregate repository for event-sourced aggregates
 * INV-MEM-002: Replaying events produces identical results
 */
export class AggregateRepository<T> {
  constructor(
    private readonly eventStore: EventStore,
    private readonly initialState: () => T,
    private readonly eventHandler: EventHandler<T>
  ) {}

  /**
   * Loads an aggregate by replaying its events
   * INV-MEM-002: Replay consistency - same events produce same state
   */
  async load(aggregateId: string): Promise<AggregateState<T>> {
    const events = await this.eventStore.getEvents(aggregateId);

    if (events.length === 0) {
      return {
        aggregateId,
        version: 0,
        state: this.initialState(),
      };
    }

    // Replay events to reconstruct state (INV-MEM-002)
    let state = this.initialState();
    let lastEvent: MemoryEvent | undefined;

    for (const event of events) {
      state = this.eventHandler(state, event);
      lastEvent = event;
    }

    return {
      aggregateId,
      version: lastEvent?.version ?? events.length,
      state,
      lastEventId: lastEvent?.eventId,
      lastTimestamp: lastEvent?.timestamp,
    };
  }

  /**
   * Saves an event to the aggregate
   * INV-MEM-004: Event ordering enforced via version
   * INV-MEM-009: Optimistic concurrency is atomic via event store's version check
   *
   * If expectedVersion is provided, the event's version is set to expectedVersion + 1.
   * The event store's append() performs atomic version validation, ensuring no
   * race condition between version check and write (TOCTOU prevention).
   */
  async save(
    aggregateId: string,
    event: MemoryEvent,
    expectedVersion?: number
  ): Promise<void> {
    // INV-MEM-009: Set event version for atomic validation in event store
    // This avoids TOCTOU by letting the event store do atomic compare-and-swap
    // Ensure event has the correct aggregateId
    const eventWithAggregate: MemoryEvent = {
      ...event,
      aggregateId: event.aggregateId ?? aggregateId,
      ...(expectedVersion !== undefined ? { version: expectedVersion + 1 } : {}),
    };
    await this.eventStore.append(eventWithAggregate);
  }

  /**
   * Gets an aggregate at a specific version (point-in-time query)
   */
  async loadAtVersion(
    aggregateId: string,
    version: number
  ): Promise<AggregateState<T>> {
    const events = await this.eventStore.getEvents(aggregateId);

    // Take only events up to the requested version
    const eventsToReplay = events.filter(
      (e) => e.version !== undefined && e.version <= version
    );

    if (eventsToReplay.length === 0) {
      return {
        aggregateId,
        version: 0,
        state: this.initialState(),
      };
    }

    // Replay events (INV-MEM-002)
    let state = this.initialState();
    let lastEvent: MemoryEvent | undefined;

    for (const event of eventsToReplay) {
      state = this.eventHandler(state, event);
      lastEvent = event;
    }

    return {
      aggregateId,
      version: lastEvent?.version ?? eventsToReplay.length,
      state,
      lastEventId: lastEvent?.eventId,
      lastTimestamp: lastEvent?.timestamp,
    };
  }
}

/**
 * Creates an aggregate repository
 */
export function createAggregateRepository<T>(
  eventStore: EventStore,
  initialState: () => T,
  eventHandler: EventHandler<T>
): AggregateRepository<T> {
  return new AggregateRepository(eventStore, initialState, eventHandler);
}
