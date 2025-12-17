/**
 * Ability Domain Contracts v1
 *
 * Zod schemas for abilities - reusable knowledge modules that agents can load.
 */

import { z } from 'zod';

// ============================================================================
// Ability Schema
// ============================================================================

/**
 * Ability definition schema
 */
export const AbilitySchema = z.object({
  // Identity
  abilityId: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Ability ID must start with letter and contain only lowercase, digits, and dashes'
    ),
  displayName: z.string().max(200).optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be SemVer format')
    .optional(),
  description: z.string().max(2000).optional(),

  // Category and Tags
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),

  // Content - the actual ability knowledge/instructions
  content: z.string().max(50000),

  // Metadata
  author: z.string().max(100).optional(),
  source: z.string().max(500).optional(),
  lastUpdated: z.string().datetime().optional(),

  // Dependencies
  requires: z.array(z.string().max(100)).max(20).optional(),
  conflicts: z.array(z.string().max(100)).max(20).optional(),

  // Applicability
  applicableTo: z.array(z.string().max(100)).max(50).optional(), // agent IDs or '*' for all
  excludeFrom: z.array(z.string().max(100)).max(50).optional(),

  // Priority for loading order
  priority: z.number().int().min(1).max(100).default(50),

  // Enabled flag
  enabled: z.boolean().default(true),
});

export type Ability = z.infer<typeof AbilitySchema>;

// ============================================================================
// Ability Manifest Schema
// ============================================================================

/**
 * Ability manifest for bundling multiple abilities
 */
export const AbilityManifestSchema = z.object({
  version: z.string().default('1.0.0'),
  name: z.string().max(100),
  description: z.string().max(500).optional(),
  abilities: z.array(AbilitySchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AbilityManifest = z.infer<typeof AbilityManifestSchema>;

// ============================================================================
// Ability Loading Result
// ============================================================================

/**
 * Result of loading abilities for an agent
 */
export const AbilityLoadResultSchema = z.object({
  agentId: z.string(),
  loadedAbilities: z.array(z.string()),
  skippedAbilities: z.array(
    z.object({
      abilityId: z.string(),
      reason: z.string(),
    })
  ),
  totalTokens: z.number().int().min(0).optional(),
  loadedAt: z.string().datetime(),
});

export type AbilityLoadResult = z.infer<typeof AbilityLoadResultSchema>;

// ============================================================================
// Ability Injection Request
// ============================================================================

/**
 * Request to inject abilities into an agent prompt
 */
export const AbilityInjectionRequestSchema = z.object({
  agentId: z.string(),
  task: z.string().max(5000),
  coreAbilities: z.array(z.string()).optional(),
  taskKeywords: z.array(z.string()).optional(),
  maxAbilities: z.number().int().min(1).max(50).default(10),
  maxTokens: z.number().int().min(100).max(100000).optional(),
});

export type AbilityInjectionRequest = z.infer<typeof AbilityInjectionRequestSchema>;

/**
 * Result of ability injection
 */
export const AbilityInjectionResultSchema = z.object({
  agentId: z.string(),
  injectedAbilities: z.array(z.string()),
  combinedContent: z.string(),
  tokenCount: z.number().int().min(0).optional(),
  truncated: z.boolean().default(false),
});

export type AbilityInjectionResult = z.infer<typeof AbilityInjectionResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Ability error codes
 */
export const AbilityErrorCode = {
  ABILITY_NOT_FOUND: 'ABILITY_NOT_FOUND',
  ABILITY_VALIDATION_ERROR: 'ABILITY_VALIDATION_ERROR',
  ABILITY_LOAD_FAILED: 'ABILITY_LOAD_FAILED',
  ABILITY_CONFLICT: 'ABILITY_CONFLICT',
  ABILITY_DEPENDENCY_MISSING: 'ABILITY_DEPENDENCY_MISSING',
  ABILITY_TOKEN_LIMIT_EXCEEDED: 'ABILITY_TOKEN_LIMIT_EXCEEDED',
} as const;

export type AbilityErrorCode = (typeof AbilityErrorCode)[keyof typeof AbilityErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates an ability
 */
export function validateAbility(data: unknown): Ability {
  return AbilitySchema.parse(data);
}

/**
 * Safely validates an ability
 */
export function safeValidateAbility(
  data: unknown
): { success: true; data: Ability } | { success: false; error: z.ZodError } {
  const result = AbilitySchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates an ability injection request
 */
export function validateAbilityInjectionRequest(
  data: unknown
): AbilityInjectionRequest {
  return AbilityInjectionRequestSchema.parse(data);
}
