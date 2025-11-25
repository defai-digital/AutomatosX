/**
 * Agent profile schemas for AutomatosX
 * @module @ax/schemas/agent
 */

import { z } from 'zod';
import { AgentId, NormalizedScore, TokenUsage } from './common.js';

// =============================================================================
// Personality Schema
// =============================================================================

/**
 * Communication style for agent interactions
 */
export const CommunicationStyle = z.enum(['formal', 'casual', 'technical', 'friendly']);
export type CommunicationStyle = z.infer<typeof CommunicationStyle>;

/**
 * Decision making approach
 */
export const DecisionMaking = z.enum(['data-driven', 'intuitive', 'collaborative', 'analytical']);
export type DecisionMaking = z.infer<typeof DecisionMaking>;

/**
 * Agent personality configuration
 */
export const PersonalitySchema = z.object({
  /** Character traits that define the agent's behavior (1-5 traits) */
  traits: z.array(z.string().min(1).max(50)).min(1).max(5),
  /** Optional catchphrase or signature expression */
  catchphrase: z.string().max(200).optional(),
  /** How the agent communicates */
  communicationStyle: CommunicationStyle.default('technical'),
  /** How the agent makes decisions */
  decisionMaking: DecisionMaking.default('data-driven'),
});
export type Personality = z.infer<typeof PersonalitySchema>;

// =============================================================================
// Ability Selection Schema
// =============================================================================

/**
 * Smart ability loading configuration
 * Allows agents to load abilities based on task context
 */
export const AbilitySelectionSchema = z.object({
  /** Core abilities always loaded for this agent */
  core: z.array(z.string()).default([]),
  /** Task-based abilities loaded by keyword matching */
  taskBased: z.record(z.string(), z.array(z.string())).default({}),
});
export type AbilitySelection = z.infer<typeof AbilitySelectionSchema>;

// =============================================================================
// Orchestration Schema
// =============================================================================

/**
 * Agent orchestration and delegation settings
 */
export const OrchestrationSchema = z.object({
  /** Maximum depth of delegation chain (0 = cannot delegate) */
  maxDelegationDepth: z.number().int().min(0).max(3).default(0),
  /** Workspaces this agent can read from */
  canReadWorkspaces: z.array(z.string()).default([]),
  /** Whether agent can write to shared workspace */
  canWriteToShared: z.boolean().default(false),
  /** Agents this agent can delegate to */
  canDelegateTo: z.array(z.string()).default([]),
  /** Priority level for task routing (1 = highest) */
  priority: z.number().int().min(1).max(10).default(5),
});
export type Orchestration = z.infer<typeof OrchestrationSchema>;

// =============================================================================
// Agent Profile Schema
// =============================================================================

/**
 * Complete agent profile definition
 * This is the main schema for defining agent personalities and capabilities
 */
export const AgentProfileSchema = z.object({
  /** Unique identifier for the agent (lowercase, alphanumeric with hyphens) */
  name: AgentId,
  /** Human-friendly display name */
  displayName: z.string().min(1).max(50),
  /** Agent's role description */
  role: z.string().min(1).max(100),
  /** Team affiliation */
  team: z.string().default('default'),
  /** Detailed description of agent capabilities */
  description: z.string().max(500).optional(),
  /** List of ability identifiers */
  abilities: z.array(z.string()).default([]),
  /** Smart ability selection configuration */
  abilitySelection: AbilitySelectionSchema.optional(),
  /** Agent personality configuration */
  personality: PersonalitySchema.optional(),
  /** Orchestration settings */
  orchestration: OrchestrationSchema.default({}),
  /** System prompt that defines agent behavior */
  systemPrompt: z.string().min(10).max(50000),
  /** Whether agent is enabled */
  enabled: z.boolean().default(true),
  /** Agent version for tracking changes */
  version: z.string().default('1.0.0'),
  /** Custom metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AgentProfile = z.infer<typeof AgentProfileSchema>;

// =============================================================================
// Agent Execution Context
// =============================================================================

/**
 * Context passed to agent during execution
 */
export const ExecutionContextSchema = z.object({
  /** The task to execute */
  task: z.string().min(1),
  /** Session ID if part of a multi-agent session */
  sessionId: z.string().uuid().optional(),
  /** Parent agent ID if delegated */
  parentAgentId: z.string().optional(),
  /** Delegation chain for tracking depth */
  delegationChain: z.array(z.string()).default([]),
  /** Relevant memory entries */
  memoryContext: z.array(z.unknown()).default([]),
  /** Additional context data */
  context: z.record(z.string(), z.unknown()).default({}),
  /** Timeout in milliseconds */
  timeout: z.number().int().positive().default(300000),
  /** Whether to stream output */
  stream: z.boolean().default(false),
});
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;

// =============================================================================
// Agent Execution Response
// =============================================================================

/**
 * Response from agent execution
 */
export const AgentResponseSchema = z.object({
  /** Whether execution was successful */
  success: z.boolean(),
  /** Agent output/response */
  output: z.string(),
  /** Agent ID that produced this response */
  agentId: z.string(),
  /** Execution duration in milliseconds */
  duration: z.number().int().nonnegative(),
  /** Provider used for execution */
  provider: z.string().optional(),
  /** Token usage if available */
  tokens: TokenUsage.optional(),
  /** Delegation requests made by agent */
  delegations: z.array(z.object({
    toAgent: z.string(),
    task: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
  })).default([]),
  /** Error information if failed */
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  /** Metadata about execution */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// =============================================================================
// Agent Registration
// =============================================================================

/**
 * Agent registration for the agent registry
 */
export const AgentRegistrationSchema = z.object({
  /** Agent profile */
  profile: AgentProfileSchema,
  /** Registration timestamp */
  registeredAt: z.date(),
  /** Last updated timestamp */
  updatedAt: z.date(),
  /** Source file path */
  sourcePath: z.string().optional(),
  /** Health score (0-1) based on recent executions */
  healthScore: NormalizedScore.default(1),
  /** Total executions */
  executionCount: z.number().int().nonnegative().default(0),
  /** Successful executions */
  successCount: z.number().int().nonnegative().default(0),
});
export type AgentRegistration = z.infer<typeof AgentRegistrationSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate agent profile data
 */
export function validateAgentProfile(data: unknown): AgentProfile {
  return AgentProfileSchema.parse(data);
}

/**
 * Safe validate agent profile data
 */
export function safeValidateAgentProfile(data: unknown): z.SafeParseReturnType<unknown, AgentProfile> {
  return AgentProfileSchema.safeParse(data);
}

/**
 * Create a partial agent profile for updates
 */
export const PartialAgentProfileSchema = AgentProfileSchema.partial().extend({
  name: AgentId, // Name is required for identification
});
export type PartialAgentProfile = z.infer<typeof PartialAgentProfileSchema>;
