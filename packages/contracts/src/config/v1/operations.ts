/**
 * Configuration Operations Contract V1
 *
 * Input/output schemas for configuration operations.
 *
 * Invariants:
 * - INV-CFG-DOM-004: Idempotent operations (same idempotencyKey = same result)
 */

import { z } from 'zod';
import { ConfigScopeSchema, ConfigReadScopeSchema } from './config.js';

// ============================================================================
// Setup Operation Schemas
// ============================================================================

/**
 * Setup operation input
 */
export const SetupInputSchema = z.object({
  scope: ConfigScopeSchema.default('global'),
  force: z.boolean().default(false),
  nonInteractive: z.boolean().default(false),
  idempotencyKey: z.string().uuid().optional(),
});

export type SetupInput = z.infer<typeof SetupInputSchema>;

/**
 * Setup operation output
 *
 * Note: AutomatosX does NOT manage credentials.
 * All authentication is delegated to CLI tools.
 */
export const SetupOutputSchema = z.object({
  success: z.boolean(),
  configPath: z.string(),
  providers: z.object({
    detected: z.array(z.string()),
    enabled: z.array(z.string()),
  }),
  defaultProvider: z.string().optional(),
  version: z.string(),
  correlationId: z.string().uuid(),
});

export type SetupOutput = z.infer<typeof SetupOutputSchema>;

// ============================================================================
// Config Get Operation Schemas
// ============================================================================

/**
 * Config get operation input
 */
export const ConfigGetInputSchema = z.object({
  path: z.string().min(1),
  scope: ConfigReadScopeSchema.default('merged'),
});

export type ConfigGetInput = z.infer<typeof ConfigGetInputSchema>;

/**
 * Config get operation output
 */
export const ConfigGetOutputSchema = z.object({
  path: z.string(),
  value: z.unknown(),
  scope: ConfigReadScopeSchema,
  found: z.boolean(),
});

export type ConfigGetOutput = z.infer<typeof ConfigGetOutputSchema>;

// ============================================================================
// Config Set Operation Schemas
// ============================================================================

/**
 * Config set operation input
 */
export const ConfigSetInputSchema = z.object({
  path: z.string().min(1),
  value: z.unknown(),
  scope: ConfigScopeSchema.default('global'),
  idempotencyKey: z.string().uuid().optional(),
});

export type ConfigSetInput = z.infer<typeof ConfigSetInputSchema>;

/**
 * Config set operation output
 */
export const ConfigSetOutputSchema = z.object({
  success: z.boolean(),
  path: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  correlationId: z.string().uuid(),
});

export type ConfigSetOutput = z.infer<typeof ConfigSetOutputSchema>;

// ============================================================================
// Config Show Operation Schemas
// ============================================================================

/**
 * Config show operation input
 */
export const ConfigShowInputSchema = z.object({
  scope: ConfigReadScopeSchema.default('merged'),
  format: z.enum(['text', 'json', 'yaml']).default('text'),
});

export type ConfigShowInput = z.infer<typeof ConfigShowInputSchema>;

/**
 * Config show operation output
 */
export const ConfigShowOutputSchema = z.object({
  scope: ConfigReadScopeSchema,
  config: z.record(z.unknown()),
  formatted: z.string(),
});

export type ConfigShowOutput = z.infer<typeof ConfigShowOutputSchema>;

// ============================================================================
// Config Reset Operation Schemas
// ============================================================================

/**
 * Config reset operation input
 */
export const ConfigResetInputSchema = z.object({
  scope: z.enum(['global', 'local', 'all']).default('global'),
  confirm: z.boolean().default(false),
  idempotencyKey: z.string().uuid().optional(),
});

export type ConfigResetInput = z.infer<typeof ConfigResetInputSchema>;

/**
 * Config reset operation output
 */
export const ConfigResetOutputSchema = z.object({
  success: z.boolean(),
  scope: z.enum(['global', 'local', 'all']),
  deletedPaths: z.array(z.string()),
  correlationId: z.string().uuid(),
});

export type ConfigResetOutput = z.infer<typeof ConfigResetOutputSchema>;

// ============================================================================
// Config Path Operation Schemas
// ============================================================================

/**
 * Config path operation output
 */
export const ConfigPathOutputSchema = z.object({
  global: z.object({
    path: z.string(),
    exists: z.boolean(),
  }),
  local: z.object({
    path: z.string(),
    exists: z.boolean(),
  }),
});

export type ConfigPathOutput = z.infer<typeof ConfigPathOutputSchema>;

// ============================================================================
// Provider Detection Operation Schemas
// ============================================================================

/**
 * Provider detection operation input
 */
export const DetectProvidersInputSchema = z.object({
  providers: z.array(z.string()).optional(),
  timeout: z.number().int().min(1000).max(30000).default(5000),
});

export type DetectProvidersInput = z.infer<typeof DetectProvidersInputSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates setup input
 */
export function validateSetupInput(data: unknown): SetupInput {
  return SetupInputSchema.parse(data);
}

/**
 * Validates config get input
 */
export function validateConfigGetInput(data: unknown): ConfigGetInput {
  return ConfigGetInputSchema.parse(data);
}

/**
 * Validates config set input
 */
export function validateConfigSetInput(data: unknown): ConfigSetInput {
  return ConfigSetInputSchema.parse(data);
}

/**
 * Validates config reset input
 */
export function validateConfigResetInput(data: unknown): ConfigResetInput {
  return ConfigResetInputSchema.parse(data);
}
