/**
 * Agent MCP Tool Contracts
 *
 * Zod schemas for agent tool inputs and outputs.
 */

import { z } from 'zod';

// ============================================================================
// agent_list Tool
// ============================================================================

/**
 * Input schema for agent_list tool
 */
export const AgentListInputSchema = z.object({
  team: z.string().max(100).optional(),
  enabled: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

export type AgentListInput = z.infer<typeof AgentListInputSchema>;

/**
 * Agent summary in list output
 */
export const AgentSummarySchema = z.object({
  agentId: z.string(),
  displayName: z.string().optional(),
  description: z.string(),
  team: z.string().optional(),
  enabled: z.boolean(),
  capabilities: z.array(z.string()).optional(),
});

export type AgentSummary = z.infer<typeof AgentSummarySchema>;

/**
 * Output schema for agent_list tool
 */
export const AgentListOutputSchema = z.object({
  agents: z.array(AgentSummarySchema),
  total: z.number().int().min(0),
});

export type AgentListOutput = z.infer<typeof AgentListOutputSchema>;

// ============================================================================
// agent_run Tool
// ============================================================================

/**
 * Input schema for agent_run tool
 */
export const AgentRunInputSchema = z.object({
  agentId: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      'Agent ID must start with letter and contain only alphanumeric, dash, underscore'
    ),
  input: z.record(z.unknown()).optional(),
  sessionId: z.string().uuid().optional(),
});

export type AgentRunInput = z.infer<typeof AgentRunInputSchema>;

/**
 * Step result in agent run output
 */
export const AgentStepResultSchema = z.object({
  stepId: z.string(),
  success: z.boolean(),
  durationMs: z.number(),
});

export type AgentStepResult = z.infer<typeof AgentStepResultSchema>;

/**
 * Output schema for agent_run tool
 */
export const AgentRunOutputSchema = z.object({
  success: z.boolean(),
  agentId: z.string(),
  sessionId: z.string().uuid().optional(),
  output: z.unknown().optional(),
  stepResults: z.array(AgentStepResultSchema).optional(),
  totalDurationMs: z.number(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type AgentRunOutput = z.infer<typeof AgentRunOutputSchema>;

// ============================================================================
// agent_get Tool
// ============================================================================

/**
 * Input schema for agent_get tool
 */
export const AgentGetInputSchema = z.object({
  agentId: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      'Agent ID must start with letter and contain only alphanumeric, dash, underscore'
    ),
});

export type AgentGetInput = z.infer<typeof AgentGetInputSchema>;

/**
 * Workflow step in agent details
 */
export const AgentWorkflowStepSummarySchema = z.object({
  stepId: z.string(),
  name: z.string(),
  type: z.string(),
});

export type AgentWorkflowStepSummary = z.infer<typeof AgentWorkflowStepSummarySchema>;

/**
 * Orchestration config in agent details
 */
export const AgentOrchestrationSummarySchema = z.object({
  maxDelegationDepth: z.number().optional(),
  canReadWorkspaces: z.array(z.string()).optional(),
  canWriteToShared: z.boolean().optional(),
});

export type AgentOrchestrationSummary = z.infer<typeof AgentOrchestrationSummarySchema>;

/**
 * Output schema for agent_get tool
 */
export const AgentGetOutputSchema = z.object({
  agentId: z.string(),
  displayName: z.string().optional(),
  version: z.string().optional(),
  description: z.string(),
  role: z.string().optional(),
  expertise: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  team: z.string().optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean(),
  workflow: z.array(AgentWorkflowStepSummarySchema).optional(),
  orchestration: AgentOrchestrationSummarySchema.optional(),
});

export type AgentGetOutput = z.infer<typeof AgentGetOutputSchema>;

// ============================================================================
// agent_register Tool
// ============================================================================

/**
 * Workflow step schema for agent registration
 * (Simplified version of AgentWorkflowStepSchema from agent/v1)
 */
const WorkflowStepInputSchema = z.object({
  stepId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  type: z.enum(['prompt', 'tool', 'conditional', 'loop', 'parallel', 'delegate', 'discuss']),
  config: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.array(z.string()).optional(),
});

/**
 * Available workflow template names
 */
const WorkflowTemplateSchema = z.enum([
  'prompt-response',
  'research',
  'code-review',
  'multi-step',
  'delegate-chain',
  'agent-selection',
]);

/**
 * Input schema for agent_register tool
 */
export const AgentRegisterInputSchema = z.object({
  agentId: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      'Agent ID must start with letter and contain only alphanumeric, dash, underscore'
    ),
  description: z.string().min(1).max(1000),
  displayName: z.string().max(100).optional(),
  systemPrompt: z.string().max(10000).optional(),
  team: z.string().max(100).optional(),
  capabilities: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  workflowTemplate: WorkflowTemplateSchema.optional(),
  workflow: z.array(WorkflowStepInputSchema).max(100).optional(),
  enabled: z.boolean().optional().default(true),
});

export type AgentRegisterInput = z.infer<typeof AgentRegisterInputSchema>;

/**
 * Output schema for agent_register tool
 */
export const AgentRegisterOutputSchema = z.object({
  registered: z.boolean(),
  agentId: z.string(),
  message: z.string(),
  createdAt: z.string().datetime().optional(),
});

export type AgentRegisterOutput = z.infer<typeof AgentRegisterOutputSchema>;

// ============================================================================
// agent_remove Tool
// ============================================================================

/**
 * Input schema for agent_remove tool
 */
export const AgentRemoveInputSchema = z.object({
  agentId: z.string().min(1).max(50),
});

export type AgentRemoveInput = z.infer<typeof AgentRemoveInputSchema>;

/**
 * Output schema for agent_remove tool
 */
export const AgentRemoveOutputSchema = z.object({
  removed: z.boolean(),
  agentId: z.string(),
  message: z.string(),
});

export type AgentRemoveOutput = z.infer<typeof AgentRemoveOutputSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Agent tool error codes
 */
export const AgentToolErrorCode = {
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_PERMISSION_DENIED: 'AGENT_PERMISSION_DENIED',
  AGENT_STAGE_FAILED: 'AGENT_STAGE_FAILED',
  AGENT_DELEGATION_DEPTH_EXCEEDED: 'AGENT_DELEGATION_DEPTH_EXCEEDED',
  AGENT_ALREADY_EXISTS: 'AGENT_ALREADY_EXISTS',
  AGENT_REMOVE_FAILED: 'AGENT_REMOVE_FAILED',
} as const;

export type AgentToolErrorCode =
  (typeof AgentToolErrorCode)[keyof typeof AgentToolErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates agent_list input
 */
export function validateAgentListInput(data: unknown): AgentListInput {
  return AgentListInputSchema.parse(data);
}

/**
 * Safely validates agent_list input
 */
export function safeValidateAgentListInput(
  data: unknown
): { success: true; data: AgentListInput } | { success: false; error: z.ZodError } {
  const result = AgentListInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates agent_run input
 */
export function validateAgentRunInput(data: unknown): AgentRunInput {
  return AgentRunInputSchema.parse(data);
}

/**
 * Safely validates agent_run input
 */
export function safeValidateAgentRunInput(
  data: unknown
): { success: true; data: AgentRunInput } | { success: false; error: z.ZodError } {
  const result = AgentRunInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates agent_get input
 */
export function validateAgentGetInput(data: unknown): AgentGetInput {
  return AgentGetInputSchema.parse(data);
}

/**
 * Safely validates agent_get input
 */
export function safeValidateAgentGetInput(
  data: unknown
): { success: true; data: AgentGetInput } | { success: false; error: z.ZodError } {
  const result = AgentGetInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates agent_register input
 */
export function validateAgentRegisterInput(data: unknown): AgentRegisterInput {
  return AgentRegisterInputSchema.parse(data);
}

/**
 * Safely validates agent_register input
 */
export function safeValidateAgentRegisterInput(
  data: unknown
): { success: true; data: AgentRegisterInput } | { success: false; error: z.ZodError } {
  const result = AgentRegisterInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates agent_remove input
 */
export function validateAgentRemoveInput(data: unknown): AgentRemoveInput {
  return AgentRemoveInputSchema.parse(data);
}

/**
 * Safely validates agent_remove input
 */
export function safeValidateAgentRemoveInput(
  data: unknown
): { success: true; data: AgentRemoveInput } | { success: false; error: z.ZodError } {
  const result = AgentRemoveInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
