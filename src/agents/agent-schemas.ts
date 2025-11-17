/**
 * Zod Schemas for Agent Profiles
 *
 * Runtime validation for agent profile YAML files.
 * Ensures all agent configurations are valid and complete.
 */

import { z } from 'zod';

// ========================================
// Stage Schema
// ========================================

/**
 * Stage schema - validates workflow steps
 */
export const stageSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  key_questions: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  // Deprecated but still accepted for backward compatibility
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  // Advanced stage features
  dependencies: z.array(z.string()).optional(),
  condition: z.string().optional(),
  parallel: z.boolean().optional(),
  streaming: z.boolean().optional(),
  saveToMemory: z.boolean().optional(),
  // Checkpoint and retry
  checkpoint: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().max(10).optional(),
  retryDelay: z.number().int().nonnegative().optional()
}).describe('Agent workflow stage');

export type StageZod = z.infer<typeof stageSchema>;

// ========================================
// Personality Schema
// ========================================

/**
 * Personality schema - validates agent character
 */
export const personalitySchema = z.object({
  traits: z.array(z.string()).optional(),
  catchphrase: z.string().optional(),
  communication_style: z.string().optional(),
  decision_making: z.string().optional()
}).describe('Agent personality');

export type PersonalityZod = z.infer<typeof personalitySchema>;

// ========================================
// Ability Selection Schema
// ========================================

/**
 * Ability selection strategy schema
 */
export const abilitySelectionSchema = z.object({
  core: z.array(z.string()).optional(),
  taskBased: z.record(z.string(), z.array(z.string())).optional(),
  loadAll: z.boolean().optional()
}).describe('Ability selection strategy');

export type AbilitySelectionZod = z.infer<typeof abilitySelectionSchema>;

// ========================================
// Redirect Rule Schema
// ========================================

/**
 * Redirect rule schema - when to suggest alternative agents
 */
export const redirectRuleSchema = z.object({
  phrase: z.string().regex(/.+/, 'Redirect phrase must be a valid regex pattern'),
  suggest: z.string().min(1)
}).describe('Agent redirect rule');

export type RedirectRuleZod = z.infer<typeof redirectRuleSchema>;

// ========================================
// Selection Metadata Schema
// ========================================

/**
 * Selection metadata schema
 * Helps Claude Code and ax agent suggest make better selections
 */
export const selectionMetadataSchema = z.object({
  primaryIntents: z.array(z.string()).optional(),
  secondarySignals: z.array(z.string()).optional(),
  negativeIntents: z.array(z.string()).optional(),
  redirectWhen: z.array(redirectRuleSchema).optional(),
  keywords: z.array(z.string()).optional(),
  antiKeywords: z.array(z.string()).optional()
}).describe('Agent selection metadata');

export type SelectionMetadataZod = z.infer<typeof selectionMetadataSchema>;

// ========================================
// Agent Profile Schema
// ========================================

/**
 * Complete agent profile schema
 * Validates entire agent YAML configuration
 */
export const agentProfileSchema = z.object({
  // Basic information
  name: z.string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Agent name must be alphanumeric with dash/underscore only')
    .optional(), // Optional - uses filename if not provided
  displayName: z.string().max(100).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format').optional(),
  description: z.string().min(1),

  // Role and expertise
  role: z.string().min(1).optional(),
  expertise: z.array(z.string()).min(1).optional(),
  capabilities: z.array(z.string()).optional(),

  // System prompt (required by profile-loader validateProfile, but optional here for flexibility)
  systemPrompt: z.string().min(1).optional(),

  // Workflow
  workflow: z.array(stageSchema).min(1).optional(),

  // Personality
  personality: personalitySchema.optional(),

  // Abilities - accepts both array (legacy) and object (new) formats
  abilities: z.union([
    z.array(z.string()), // Legacy format: ['ability1', 'ability2']
    abilitySelectionSchema // New format: { core: [...], taskBased: {...}, loadAll: true }
  ]).optional(),

  // Ability selection strategy (v4.5.8+)
  abilitySelection: abilitySelectionSchema.optional(),

  // Thinking patterns
  thinking_patterns: z.array(z.string()).optional(),

  // Dependencies
  dependencies: z.array(z.string()).optional(),

  // Parallel execution
  parallel: z.boolean().optional(),

  // Model parameters (deprecated but still accepted)
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),

  // Orchestration (v4.7.0+)
  orchestration: z.object({
    maxDelegationDepth: z.number().int().nonnegative().optional(),
    canReadWorkspaces: z.array(z.string()).optional(),
    canWriteToShared: z.boolean().optional()
  }).optional(),

  // Selection metadata (v5.7.0+)
  selectionMetadata: selectionMetadataSchema.optional(),

  // Team and collaboration
  team: z.string().optional(),
  collaboratesWith: z.array(z.string()).optional(),

  // Deprecated fields (accepted but ignored)
  model: z.string().optional(),
  provider: z.string().optional(),
  fallbackProvider: z.string().optional(),

  // Additional metadata
  tags: z.array(z.string()).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  enabled: z.boolean().default(true),

  // Custom metadata
  metadata: z.record(z.string(), z.any()).optional()
}).describe('Agent profile');

export type AgentProfileZod = z.infer<typeof agentProfileSchema>;

// ========================================
// CLI Input Schemas
// ========================================

/**
 * Agent run command options schema
 */
export const agentRunOptionsSchema = z.object({
  memory: z.boolean().optional(),
  saveMemory: z.boolean().optional(),
  session: z.string().optional(),
  sessionCreate: z.boolean().optional(),
  provider: z.string().optional(),
  format: z.enum(['text', 'json']).optional(),
  verbose: z.boolean().optional(),
  debug: z.boolean().optional(),
  quiet: z.boolean().optional(),
  config: z.string().optional(),
  parallel: z.boolean().optional(),
  streaming: z.boolean().optional(),
  resumable: z.boolean().optional(),
  checkpoint: z.boolean().optional()
}).describe('Agent run command options');

export type AgentRunOptionsZod = z.infer<typeof agentRunOptionsSchema>;

/**
 * Agent create command options schema
 */
export const agentCreateOptionsSchema = z.object({
  template: z.string().optional(),
  interactive: z.boolean().optional(),
  force: z.boolean().optional(),
  description: z.string().optional(),
  role: z.string().optional(),
  expertise: z.array(z.string()).optional(),
  displayName: z.string().optional()
}).describe('Agent create command options');

export type AgentCreateOptionsZod = z.infer<typeof agentCreateOptionsSchema>;

/**
 * Memory search options schema
 */
export const memorySearchOptionsSchema = z.object({
  limit: z.number().int().positive().max(10000).optional(),
  agent: z.string().optional(),
  session: z.string().optional(),
  format: z.enum(['text', 'json']).optional(),
  before: z.string().optional(),  // ISO date string
  after: z.string().optional()    // ISO date string
}).describe('Memory search options');

export type MemorySearchOptionsZod = z.infer<typeof memorySearchOptionsSchema>;

/**
 * Session create options schema
 */
export const sessionCreateOptionsSchema = z.object({
  agents: z.array(z.string()).min(1),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional()
}).describe('Session create options');

export type SessionCreateOptionsZod = z.infer<typeof sessionCreateOptionsSchema>;

// ========================================
// Validation Helper Functions
// ========================================

/**
 * Validate agent profile
 */
export function validateAgentProfile(profile: unknown): AgentProfileZod {
  return agentProfileSchema.parse(profile);
}

/**
 * Validate agent run options
 */
export function validateAgentRunOptions(options: unknown): AgentRunOptionsZod {
  return agentRunOptionsSchema.parse(options);
}

/**
 * Validate agent create options
 */
export function validateAgentCreateOptions(options: unknown): AgentCreateOptionsZod {
  return agentCreateOptionsSchema.parse(options);
}

/**
 * Safe validation (returns result instead of throwing)
 */
export function safeValidateAgentProfile(profile: unknown) {
  return agentProfileSchema.safeParse(profile);
}

export function safeValidateAgentRunOptions(options: unknown) {
  return agentRunOptionsSchema.safeParse(options);
}

export function safeValidateAgentCreateOptions(options: unknown) {
  return agentCreateOptionsSchema.safeParse(options);
}

/**
 * Validate and coerce agent profile from YAML
 * Handles common YAML parsing issues (type coercion, etc.)
 */
export function validateAgentProfileFromYAML(yamlData: unknown): AgentProfileZod {
  // Zod will handle coercion and validation
  return agentProfileSchema.parse(yamlData);
}

/**
 * Partial profile validation (for updates)
 */
export const partialAgentProfileSchema = agentProfileSchema.partial();

export function validatePartialAgentProfile(profile: unknown) {
  return partialAgentProfileSchema.safeParse(profile);
}
