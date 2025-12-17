/**
 * MCP Tool List/Filter Schemas
 *
 * Schemas for MCP tool filtering, pagination, and list operations.
 * These schemas extend domain contracts for MCP-specific tool needs.
 *
 * INV-MCP-VAL-002: All MCP schemas defined in contracts package
 */

import { z } from 'zod';
import { BugSeveritySchema, BugCategorySchema } from '../../../bugfix/v1/schema.js';
import { RefactorImpactSchema } from '../../../refactor/v1/schema.js';
import { DesignTypeSchema, DesignStatusSchema } from '../../../design/v1/schema.js';
import { MetricCategorySchema } from '../../../telemetry/v1/schema.js';
import {
  AbilitySchema,
  AbilityInjectionRequestSchema,
  AbilityInjectionResultSchema,
} from '../../../ability/v1/schema.js';

// ============================================================================
// Bugfix Tool Schemas
// ============================================================================

/**
 * bugfix_list input schema
 */
export const BugfixListInputSchema = z.object({
  scanId: z.string().uuid().optional(),
  severity: BugSeveritySchema.optional(),
  category: BugCategorySchema.optional(),
  limit: z.number().int().min(1).max(500).default(50),
});

export type BugfixListInput = z.infer<typeof BugfixListInputSchema>;

// ============================================================================
// Refactor Tool Schemas
// ============================================================================

/**
 * refactor_list input schema
 */
export const RefactorListInputSchema = z.object({
  scanId: z.string().uuid().optional(),
  type: z.string().optional(),
  impact: RefactorImpactSchema.optional(),
  limit: z.number().int().min(1).max(500).default(50),
});

export type RefactorListInput = z.infer<typeof RefactorListInputSchema>;

// ============================================================================
// Design Tool Schemas
// ============================================================================

/**
 * design_list input schema
 */
export const DesignListInputSchema = z.object({
  type: DesignTypeSchema.optional(),
  status: DesignStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).default(50),
});

export type DesignListInput = z.infer<typeof DesignListInputSchema>;

// ============================================================================
// Orchestration Tool Schemas
// ============================================================================

/**
 * task_status input schema
 */
export const TaskStatusInputSchema = z.object({
  taskId: z.string().uuid(),
});

export type TaskStatusInput = z.infer<typeof TaskStatusInputSchema>;

/**
 * queue_list input schema
 */
export const QueueListInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  includeStats: z.boolean().default(false),
});

export type QueueListInput = z.infer<typeof QueueListInputSchema>;

// ============================================================================
// Telemetry Tool Schemas
// ============================================================================

/**
 * metrics_list input schema
 */
export const MetricsListInputSchema = z.object({
  category: MetricCategorySchema.optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export type MetricsListInput = z.infer<typeof MetricsListInputSchema>;

/**
 * timer_stop input schema
 */
export const TimerStopInputSchema = z.object({
  timerId: z.string().uuid(),
});

export type TimerStopInput = z.infer<typeof TimerStopInputSchema>;

// ============================================================================
// Ability Tool Schemas
// ============================================================================

/**
 * ability_list input schema
 */
export const AbilityListInputSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).default(50),
});

export type AbilityListInput = z.infer<typeof AbilityListInputSchema>;

/**
 * ability_list output schema
 */
export const AbilityListOutputSchema = z.object({
  abilities: z.array(
    z.object({
      abilityId: z.string(),
      displayName: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      priority: z.number().optional(),
      enabled: z.boolean(),
    })
  ),
  total: z.number().int().min(0),
});

export type AbilityListOutput = z.infer<typeof AbilityListOutputSchema>;

/**
 * ability_get input schema
 */
export const AbilityGetInputSchema = z.object({
  abilityId: z.string().min(1),
});

export type AbilityGetInput = z.infer<typeof AbilityGetInputSchema>;

/**
 * ability_get output schema (reuses AbilitySchema structure)
 */
export const AbilityGetOutputSchema = AbilitySchema;

export type AbilityGetOutput = z.infer<typeof AbilityGetOutputSchema>;

/**
 * ability_inject input schema (extends domain schema with MCP-specific defaults)
 */
export const AbilityInjectInputSchema = AbilityInjectionRequestSchema.extend({
  includeMetadata: z.boolean().default(false),
});

export type AbilityInjectInput = z.infer<typeof AbilityInjectInputSchema>;

/**
 * ability_inject output schema
 */
export const AbilityInjectOutputSchema = AbilityInjectionResultSchema;

export type AbilityInjectOutput = z.infer<typeof AbilityInjectOutputSchema>;

/**
 * ability_register input schema
 */
export const AbilityRegisterInputSchema = z.object({
  abilityId: z.string().min(1).max(100).regex(/^[a-z][a-z0-9-]*$/),
  content: z.string().max(50000),
  displayName: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  priority: z.number().int().min(1).max(100).default(50),
  enabled: z.boolean().default(true),
  applicableTo: z.array(z.string()).optional(),
  excludeFrom: z.array(z.string()).optional(),
});

export type AbilityRegisterInput = z.infer<typeof AbilityRegisterInputSchema>;

/**
 * ability_register output schema
 */
export const AbilityRegisterOutputSchema = z.object({
  registered: z.boolean(),
  abilityId: z.string(),
  message: z.string(),
});

export type AbilityRegisterOutput = z.infer<typeof AbilityRegisterOutputSchema>;

/**
 * ability_remove input schema
 */
export const AbilityRemoveInputSchema = z.object({
  abilityId: z.string().min(1),
});

export type AbilityRemoveInput = z.infer<typeof AbilityRemoveInputSchema>;

/**
 * ability_remove output schema
 */
export const AbilityRemoveOutputSchema = z.object({
  removed: z.boolean(),
  abilityId: z.string(),
  message: z.string(),
});

export type AbilityRemoveOutput = z.infer<typeof AbilityRemoveOutputSchema>;
