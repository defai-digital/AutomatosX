/**
 * Configuration Repository
 *
 * Persistence layer for config aggregate following repository pattern.
 *
 * Invariants:
 * - INV-CFG-GOV-001: All changes emit events (audit trail)
 */

import type { ConfigEvent } from '@automatosx/contracts';
import { ConfigAggregate, createConfigAggregate, createAggregateFromConfig } from './aggregate.js';
import { createConfigStore, type ConfigStore } from './store.js';

// ============================================================================
// Event Store Interface
// ============================================================================

/**
 * Event store interface for config events
 */
export interface ConfigEventStore {
  /**
   * Appends events for a scope
   */
  append(scope: 'global' | 'local', events: ConfigEvent[]): Promise<void>;

  /**
   * Gets all events for a scope
   */
  getEvents(scope: 'global' | 'local'): Promise<ConfigEvent[]>;

  /**
   * Gets events since a specific version
   */
  getEventsSince(scope: 'global' | 'local', version: number): Promise<ConfigEvent[]>;

  /**
   * Clears all events for a scope
   */
  clear(scope: 'global' | 'local'): Promise<void>;
}

// ============================================================================
// In-Memory Event Store
// ============================================================================

/**
 * In-memory event store implementation
 * Suitable for development and testing
 */
export class InMemoryConfigEventStore implements ConfigEventStore {
  private events: Map<string, ConfigEvent[]> = new Map();

  async append(scope: 'global' | 'local', events: ConfigEvent[]): Promise<void> {
    const existing = this.events.get(scope) ?? [];
    this.events.set(scope, [...existing, ...events]);
  }

  async getEvents(scope: 'global' | 'local'): Promise<ConfigEvent[]> {
    return [...(this.events.get(scope) ?? [])];
  }

  async getEventsSince(scope: 'global' | 'local', version: number): Promise<ConfigEvent[]> {
    const events = this.events.get(scope) ?? [];
    return events.filter((e) => e.version > version);
  }

  async clear(scope: 'global' | 'local'): Promise<void> {
    this.events.delete(scope);
  }
}

// ============================================================================
// Config Repository Interface
// ============================================================================

/**
 * Config repository interface (follows Repository pattern)
 */
export interface ConfigRepository {
  /**
   * Loads config aggregate from store
   */
  load(scope: 'global' | 'local'): Promise<ConfigAggregate>;

  /**
   * Saves config aggregate (commits events and persists config)
   */
  save(aggregate: ConfigAggregate): Promise<void>;

  /**
   * Gets event history
   */
  getEvents(
    scope: 'global' | 'local',
    options?: { limit?: number; since?: number }
  ): Promise<ConfigEvent[]>;

  /**
   * Checks if config exists
   */
  exists(scope: 'global' | 'local'): Promise<boolean>;

  /**
   * Deletes config
   */
  delete(scope: 'global' | 'local'): Promise<boolean>;
}

// ============================================================================
// File-Based Repository
// ============================================================================

/**
 * Repository options
 */
export interface ConfigRepositoryOptions {
  eventStore?: ConfigEventStore;
  configStore?: ConfigStore;
}

/**
 * Creates a file-based config repository
 *
 * This implementation:
 * - Persists config to JSON files (via ConfigStore)
 * - Stores events in memory (optionally in an event store)
 * - Loads config from file and creates aggregate from it
 */
export function createConfigRepository(
  options: ConfigRepositoryOptions = {}
): ConfigRepository {
  const eventStore = options.eventStore ?? new InMemoryConfigEventStore();
  const configStore = options.configStore ?? createConfigStore();

  return {
    async load(scope: 'global' | 'local'): Promise<ConfigAggregate> {
      // Load events from event store
      const events = await eventStore.getEvents(scope);

      // If we have events, rehydrate from them
      if (events.length > 0) {
        return createConfigAggregate(scope, events);
      }

      // Otherwise, try to load from file (for migration from non-event-sourced)
      const config = await configStore.read(scope);
      if (config !== undefined) {
        // Create synthetic "created" event from existing config
        const correlationId = crypto.randomUUID();
        const aggregate = createAggregateFromConfig(scope, config, correlationId);

        // Store the initial event
        await eventStore.append(scope, aggregate.getUncommittedEvents());
        aggregate.markEventsCommitted();

        return aggregate;
      }

      // No config exists - return empty aggregate
      return createConfigAggregate(scope, []);
    },

    async save(aggregate: ConfigAggregate): Promise<void> {
      const uncommittedEvents = aggregate.getUncommittedEvents();
      const state = aggregate.getState();

      if (uncommittedEvents.length === 0) {
        return;
      }

      // Append events to event store
      await eventStore.append(state.scope, uncommittedEvents);

      // Persist current config to file
      const config = aggregate.getConfig();
      if (config !== undefined && state.status === 'valid') {
        await configStore.write(config, state.scope);
      } else if (state.status === 'uninitialized') {
        // Config was deleted/reset
        await configStore.delete(state.scope);
      }

      // Mark events as committed
      aggregate.markEventsCommitted();
    },

    async getEvents(
      scope: 'global' | 'local',
      options?: { limit?: number; since?: number }
    ): Promise<ConfigEvent[]> {
      let events: ConfigEvent[];

      if (options?.since !== undefined) {
        events = await eventStore.getEventsSince(scope, options.since);
      } else {
        events = await eventStore.getEvents(scope);
      }

      if (options?.limit !== undefined && options.limit > 0) {
        return events.slice(-options.limit);
      }

      return events;
    },

    async exists(scope: 'global' | 'local'): Promise<boolean> {
      return configStore.exists(scope);
    },

    async delete(scope: 'global' | 'local'): Promise<boolean> {
      await eventStore.clear(scope);
      return configStore.delete(scope);
    },
  };
}

// ============================================================================
// Shared Repository Instance
// ============================================================================

let sharedRepository: ConfigRepository | undefined;

/**
 * Gets or creates a shared repository instance
 */
export function getConfigRepository(): ConfigRepository {
  if (sharedRepository === undefined) {
    sharedRepository = createConfigRepository();
  }
  return sharedRepository;
}

/**
 * Sets the shared repository instance (useful for testing)
 */
export function setConfigRepository(repository: ConfigRepository): void {
  sharedRepository = repository;
}

/**
 * Resets the shared repository instance
 */
export function resetConfigRepository(): void {
  sharedRepository = undefined;
}
