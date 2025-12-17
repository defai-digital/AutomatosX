/**
 * Configuration Events Contract V1
 *
 * Event schemas and state machine for configuration lifecycle.
 *
 * Invariants:
 * - INV-CFG-DOM-003: State transitions follow CONFIG_TRANSITIONS
 * - INV-CFG-GOV-001: All changes emit events
 */

import { z } from 'zod';
import { ConfigScopeSchema } from './config.js';

// ============================================================================
// Config Status State Machine
// ============================================================================

/**
 * Config status states
 */
export const ConfigStatusSchema = z.enum([
  'uninitialized', // No config exists
  'valid', // Config exists and is valid
  'invalid', // Config exists but failed validation
  'migrating', // Config is being migrated
]);

export type ConfigStatus = z.infer<typeof ConfigStatusSchema>;

/**
 * Valid state transitions
 *
 * State machine:
 * - uninitialized -> valid (create)
 * - valid -> valid (update)
 * - valid -> invalid (validation failure)
 * - valid -> migrating (migration start)
 * - invalid -> valid (fix)
 * - invalid -> uninitialized (reset)
 * - migrating -> valid (migration success)
 * - migrating -> invalid (migration failure)
 */
export const CONFIG_TRANSITIONS: Record<ConfigStatus, ConfigStatus[]> = {
  uninitialized: ['valid'],
  valid: ['valid', 'invalid', 'migrating'],
  invalid: ['valid', 'uninitialized'],
  migrating: ['valid', 'invalid'],
};

/**
 * Checks if a state transition is valid
 *
 * INV-CFG-DOM-003: Transitions follow CONFIG_TRANSITIONS
 */
export function isValidConfigTransition(
  from: ConfigStatus,
  to: ConfigStatus
): boolean {
  return CONFIG_TRANSITIONS[from].includes(to);
}

// ============================================================================
// Config Event Types
// ============================================================================

/**
 * Config event types
 */
export const ConfigEventTypeSchema = z.enum([
  'config.created',
  'config.updated',
  'config.reset',
  'config.migrated',
  'config.deleted',
  'config.validationFailed',
]);

export type ConfigEventType = z.infer<typeof ConfigEventTypeSchema>;

// ============================================================================
// Base Event Schema
// ============================================================================

/**
 * Base config event (follows BaseEvent pattern)
 */
export const ConfigBaseEventSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.number().int().min(1),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  spanId: z.string().optional(),
  traceId: z.string().optional(),
});

export type ConfigBaseEvent = z.infer<typeof ConfigBaseEventSchema>;

// ============================================================================
// Event Payload Schemas
// ============================================================================

/**
 * Config created event payload
 */
export const ConfigCreatedPayloadSchema = z.object({
  type: z.literal('created'),
  scope: ConfigScopeSchema,
  config: z.record(z.unknown()),
});

/**
 * Config updated event payload
 */
export const ConfigUpdatedPayloadSchema = z.object({
  type: z.literal('updated'),
  scope: ConfigScopeSchema,
  path: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
});

/**
 * Config reset event payload
 */
export const ConfigResetPayloadSchema = z.object({
  type: z.literal('reset'),
  scope: ConfigScopeSchema,
});

/**
 * Config migrated event payload
 */
export const ConfigMigratedPayloadSchema = z.object({
  type: z.literal('migrated'),
  fromVersion: z.string(),
  toVersion: z.string(),
});

/**
 * Config deleted event payload
 */
export const ConfigDeletedPayloadSchema = z.object({
  type: z.literal('deleted'),
  scope: ConfigScopeSchema,
});

/**
 * Config validation failed event payload
 */
export const ConfigValidationFailedPayloadSchema = z.object({
  type: z.literal('validationFailed'),
  errors: z.array(z.string()),
});

/**
 * Config event payload discriminated union
 */
export const ConfigEventPayloadSchema = z.discriminatedUnion('type', [
  ConfigCreatedPayloadSchema,
  ConfigUpdatedPayloadSchema,
  ConfigResetPayloadSchema,
  ConfigMigratedPayloadSchema,
  ConfigDeletedPayloadSchema,
  ConfigValidationFailedPayloadSchema,
]);

export type ConfigEventPayload = z.infer<typeof ConfigEventPayloadSchema>;

// ============================================================================
// Full Event Schema
// ============================================================================

/**
 * Full config event schema
 */
export const ConfigEventSchema = ConfigBaseEventSchema.extend({
  type: ConfigEventTypeSchema,
  payload: ConfigEventPayloadSchema,
});

export type ConfigEvent = z.infer<typeof ConfigEventSchema>;

// ============================================================================
// Event Factory Functions
// ============================================================================

/**
 * Creates a config event with generated ID and timestamp
 */
export function createConfigEvent(
  type: ConfigEventType,
  payload: ConfigEventPayload,
  correlationId: string,
  version: number,
  causationId?: string
): ConfigEvent {
  return {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    version,
    correlationId,
    causationId,
    type,
    payload,
  };
}

/**
 * Creates a config.created event
 */
export function createConfigCreatedEvent(
  scope: 'global' | 'local',
  config: Record<string, unknown>,
  correlationId: string,
  version: number
): ConfigEvent {
  return createConfigEvent(
    'config.created',
    { type: 'created', scope, config },
    correlationId,
    version
  );
}

/**
 * Creates a config.updated event
 */
export function createConfigUpdatedEvent(
  scope: 'global' | 'local',
  path: string,
  oldValue: unknown,
  newValue: unknown,
  correlationId: string,
  version: number
): ConfigEvent {
  return createConfigEvent(
    'config.updated',
    { type: 'updated', scope, path, oldValue, newValue },
    correlationId,
    version
  );
}

/**
 * Creates a config.reset event
 */
export function createConfigResetEvent(
  scope: 'global' | 'local',
  correlationId: string,
  version: number
): ConfigEvent {
  return createConfigEvent(
    'config.reset',
    { type: 'reset', scope },
    correlationId,
    version
  );
}

/**
 * Creates a config.migrated event
 */
export function createConfigMigratedEvent(
  fromVersion: string,
  toVersion: string,
  correlationId: string,
  version: number
): ConfigEvent {
  return createConfigEvent(
    'config.migrated',
    { type: 'migrated', fromVersion, toVersion },
    correlationId,
    version
  );
}

/**
 * Creates a config.deleted event
 */
export function createConfigDeletedEvent(
  scope: 'global' | 'local',
  correlationId: string,
  version: number
): ConfigEvent {
  return createConfigEvent(
    'config.deleted',
    { type: 'deleted', scope },
    correlationId,
    version
  );
}

/**
 * Creates a config.validationFailed event
 */
export function createConfigValidationFailedEvent(
  errors: string[],
  correlationId: string,
  version: number
): ConfigEvent {
  return createConfigEvent(
    'config.validationFailed',
    { type: 'validationFailed', errors },
    correlationId,
    version
  );
}
