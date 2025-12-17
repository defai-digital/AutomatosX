/**
 * Configuration Aggregate
 *
 * Aggregate root for configuration with event sourcing.
 *
 * Invariants:
 * - INV-CFG-AGG-001: State transitions follow CONFIG_TRANSITIONS
 * - INV-CFG-AGG-002: Version increments on every event
 * - INV-CFG-AGG-003: Events are immutable once committed
 */

import {
  type AutomatosXConfig,
  type ConfigEvent,
  type ConfigStatus,
  isValidConfigTransition,
  createConfigCreatedEvent,
  createConfigUpdatedEvent,
  createConfigResetEvent,
  createConfigMigratedEvent,
  createConfigDeletedEvent,
  createConfigValidationFailedEvent,
  ConfigErrorCode,
  ConfigError,
  safeValidateConfig,
} from '@automatosx/contracts';
import { getValue, setValue } from './operations.js';

// ============================================================================
// Aggregate State
// ============================================================================

/**
 * Config aggregate state
 */
export interface ConfigAggregateState {
  status: ConfigStatus;
  config: AutomatosXConfig | undefined;
  scope: 'global' | 'local';
  version: number;
  lastUpdatedAt: string | undefined;
  pendingEvents: ConfigEvent[];
}

/**
 * Initial state for a new aggregate
 */
function createInitialState(scope: 'global' | 'local'): ConfigAggregateState {
  return {
    status: 'uninitialized',
    config: undefined,
    scope,
    version: 0,
    lastUpdatedAt: undefined,
    pendingEvents: [],
  };
}

// ============================================================================
// Config Aggregate
// ============================================================================

/**
 * Config aggregate - the aggregate root for configuration
 */
export class ConfigAggregate {
  private state: ConfigAggregateState;

  /**
   * Creates a new aggregate or rehydrates from events
   */
  constructor(scope: 'global' | 'local', events: ConfigEvent[] = []) {
    this.state = this.rehydrate(scope, events);
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Gets current state (readonly)
   */
  getState(): Readonly<ConfigAggregateState> {
    return this.state;
  }

  /**
   * Gets current status
   */
  getStatus(): ConfigStatus {
    return this.state.status;
  }

  /**
   * Gets current config (if valid)
   */
  getConfig(): AutomatosXConfig | undefined {
    return this.state.config;
  }

  /**
   * Gets current version
   */
  getVersion(): number {
    return this.state.version;
  }

  /**
   * Gets uncommitted events
   */
  getUncommittedEvents(): ConfigEvent[] {
    return [...this.state.pendingEvents];
  }

  /**
   * Checks if there are uncommitted events
   */
  hasUncommittedEvents(): boolean {
    return this.state.pendingEvents.length > 0;
  }

  // ==========================================================================
  // Command Methods
  // ==========================================================================

  /**
   * Creates config (only from uninitialized state)
   */
  create(
    config: AutomatosXConfig,
    correlationId: string
  ): ConfigEvent {
    this.assertTransition('valid');

    // Validate config
    const validation = safeValidateConfig(config);
    if (!validation.success) {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_VALIDATION_ERROR,
        'Invalid config provided',
        {
          errors: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        }
      );
    }

    const event = createConfigCreatedEvent(
      this.state.scope,
      config as unknown as Record<string, unknown>,
      correlationId,
      this.state.version + 1
    );

    this.applyEvent(event);
    return event;
  }

  /**
   * Updates a config value
   */
  update(
    path: string,
    value: unknown,
    correlationId: string
  ): ConfigEvent {
    this.assertState('valid');
    this.assertTransition('valid');

    if (this.state.config === undefined) {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_NOT_FOUND,
        'No config to update'
      );
    }

    const oldValue = getValue(this.state.config, path);
    const newConfig = setValue(this.state.config, path, value);

    // Validate new config
    const validation = safeValidateConfig(newConfig);
    if (!validation.success) {
      // Emit validation failed event
      const failEvent = createConfigValidationFailedEvent(
        validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        correlationId,
        this.state.version + 1
      );
      this.applyEvent(failEvent);

      throw new ConfigError(
        ConfigErrorCode.CONFIG_VALIDATION_ERROR,
        `Invalid value for path '${path}'`,
        {
          errors: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        }
      );
    }

    const event = createConfigUpdatedEvent(
      this.state.scope,
      path,
      oldValue,
      value,
      correlationId,
      this.state.version + 1
    );

    this.applyEvent(event);
    return event;
  }

  /**
   * Resets config to defaults
   */
  reset(correlationId: string): ConfigEvent {
    // Can reset from any state except migrating
    if (this.state.status === 'migrating') {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_INVALID_TRANSITION,
        'Cannot reset while migration is in progress'
      );
    }

    const event = createConfigResetEvent(
      this.state.scope,
      correlationId,
      this.state.version + 1
    );

    this.applyEvent(event);
    return event;
  }

  /**
   * Deletes config
   */
  delete(correlationId: string): ConfigEvent {
    if (this.state.status === 'uninitialized') {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_NOT_FOUND,
        'No config to delete'
      );
    }

    const event = createConfigDeletedEvent(
      this.state.scope,
      correlationId,
      this.state.version + 1
    );

    this.applyEvent(event);
    return event;
  }

  /**
   * Migrates config to new version
   */
  migrate(
    fromVersion: string,
    toVersion: string,
    migratedConfig: AutomatosXConfig,
    correlationId: string
  ): ConfigEvent {
    this.assertState('valid');

    // First transition to migrating state
    this.state.status = 'migrating';

    // Validate migrated config
    const validation = safeValidateConfig(migratedConfig);
    if (!validation.success) {
      // Transition to invalid
      this.state.status = 'invalid';
      throw new ConfigError(
        ConfigErrorCode.CONFIG_MIGRATION_FAILED,
        'Migration produced invalid config',
        {
          errors: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        }
      );
    }

    const event = createConfigMigratedEvent(
      fromVersion,
      toVersion,
      correlationId,
      this.state.version + 1
    );

    // Apply migration - update config
    this.state.config = validation.data;
    this.state.version += 1;
    this.state.status = 'valid';
    this.state.lastUpdatedAt = event.timestamp;
    this.state.pendingEvents.push(event);

    return event;
  }

  /**
   * Marks events as committed (clears pending events)
   */
  markEventsCommitted(): void {
    this.state.pendingEvents = [];
  }

  // ==========================================================================
  // State Machine Methods
  // ==========================================================================

  /**
   * Asserts current state is expected
   */
  private assertState(expected: ConfigStatus): void {
    if (this.state.status !== expected) {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_INVALID_TRANSITION,
        `Expected status '${expected}' but was '${this.state.status}'`
      );
    }
  }

  /**
   * Asserts transition is valid
   * INV-CFG-AGG-001: State transitions follow CONFIG_TRANSITIONS
   */
  private assertTransition(to: ConfigStatus): void {
    if (!isValidConfigTransition(this.state.status, to)) {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_INVALID_TRANSITION,
        `Cannot transition from '${this.state.status}' to '${to}'`
      );
    }
  }

  // ==========================================================================
  // Event Sourcing Methods
  // ==========================================================================

  /**
   * Applies an event to state
   */
  private applyEvent(event: ConfigEvent): void {
    this.applyToState(event);
    this.state.pendingEvents.push(event);
  }

  /**
   * Applies event to state (mutates state)
   */
  private applyToState(event: ConfigEvent): void {
    const payload = event.payload;

    switch (payload.type) {
      case 'created':
        this.state.status = 'valid';
        this.state.config = payload.config as AutomatosXConfig;
        break;

      case 'updated':
        if (this.state.config !== undefined) {
          this.state.config = setValue(this.state.config, payload.path, payload.newValue);
        }
        break;

      case 'reset':
        this.state.status = 'uninitialized';
        this.state.config = undefined;
        break;

      case 'deleted':
        this.state.status = 'uninitialized';
        this.state.config = undefined;
        break;

      case 'validationFailed':
        this.state.status = 'invalid';
        break;

      case 'migrated':
        // Config is updated separately in migrate()
        this.state.status = 'valid';
        break;
    }

    this.state.version = event.version;
    this.state.lastUpdatedAt = event.timestamp;
  }

  /**
   * Rehydrates state from events
   */
  private rehydrate(
    scope: 'global' | 'local',
    events: ConfigEvent[]
  ): ConfigAggregateState {
    const state = createInitialState(scope);

    for (const event of events) {
      // Apply without adding to pending
      const payload = event.payload;

      switch (payload.type) {
        case 'created':
          state.status = 'valid';
          state.config = payload.config as AutomatosXConfig;
          break;

        case 'updated':
          if (state.config !== undefined) {
            state.config = setValue(state.config, payload.path, payload.newValue);
          }
          break;

        case 'reset':
          state.status = 'uninitialized';
          state.config = undefined;
          break;

        case 'deleted':
          state.status = 'uninitialized';
          state.config = undefined;
          break;

        case 'validationFailed':
          state.status = 'invalid';
          break;

        case 'migrated':
          state.status = 'valid';
          break;
      }

      state.version = event.version;
      state.lastUpdatedAt = event.timestamp;
    }

    return state;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new config aggregate
 */
export function createConfigAggregate(
  scope: 'global' | 'local',
  events?: ConfigEvent[]
): ConfigAggregate {
  return new ConfigAggregate(scope, events);
}

/**
 * Creates an aggregate from existing config (for migration from file-based)
 */
export function createAggregateFromConfig(
  scope: 'global' | 'local',
  config: AutomatosXConfig,
  correlationId: string
): ConfigAggregate {
  const aggregate = new ConfigAggregate(scope, []);
  aggregate.create(config, correlationId);
  return aggregate;
}
