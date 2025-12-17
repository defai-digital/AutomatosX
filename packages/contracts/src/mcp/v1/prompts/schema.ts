/**
 * MCP Prompt Contracts
 *
 * Zod schemas for MCP prompts (user-controlled templates).
 */

import { z } from 'zod';

// ============================================================================
// Prompt Argument Schema
// ============================================================================

/**
 * Prompt argument definition
 */
export const PromptArgumentSchema = z.object({
  /** Argument name */
  name: z.string().min(1),
  /** Description of the argument */
  description: z.string().optional(),
  /** Whether the argument is required */
  required: z.boolean().optional(),
});

export type PromptArgument = z.infer<typeof PromptArgumentSchema>;

// ============================================================================
// Prompt Definition Schema
// ============================================================================

/**
 * MCP Prompt definition
 */
export const McpPromptSchema = z.object({
  /** Unique prompt name */
  name: z.string().min(1),
  /** Description of what the prompt does */
  description: z.string().optional(),
  /** Arguments the prompt accepts */
  arguments: z.array(PromptArgumentSchema).optional(),
});

export type McpPrompt = z.infer<typeof McpPromptSchema>;

// ============================================================================
// Prompt Message Schema
// ============================================================================

/**
 * Message role
 */
export const PromptRoleSchema = z.enum(['user', 'assistant']);

export type PromptRole = z.infer<typeof PromptRoleSchema>;

/**
 * Message content
 */
export const PromptContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export type PromptContent = z.infer<typeof PromptContentSchema>;

/**
 * Prompt message
 */
export const PromptMessageSchema = z.object({
  role: PromptRoleSchema,
  content: PromptContentSchema,
});

export type PromptMessage = z.infer<typeof PromptMessageSchema>;

// ============================================================================
// Prompt List Response
// ============================================================================

/**
 * Response for prompts/list method
 */
export const PromptListResponseSchema = z.object({
  prompts: z.array(McpPromptSchema),
});

export type PromptListResponse = z.infer<typeof PromptListResponseSchema>;

// ============================================================================
// Get Prompt Response
// ============================================================================

/**
 * Response for prompts/get method
 */
export const GetPromptResponseSchema = z.object({
  description: z.string().optional(),
  messages: z.array(PromptMessageSchema),
});

export type GetPromptResponse = z.infer<typeof GetPromptResponseSchema>;

// ============================================================================
// Prompt Error Codes
// ============================================================================

/**
 * Prompt-specific error codes
 */
export const PromptErrorCode = {
  PROMPT_NOT_FOUND: 'PROMPT_NOT_FOUND',
  MISSING_REQUIRED_ARGUMENT: 'MISSING_REQUIRED_ARGUMENT',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
} as const;

export type PromptErrorCode = (typeof PromptErrorCode)[keyof typeof PromptErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates prompt definition
 */
export function validatePrompt(data: unknown): McpPrompt {
  return McpPromptSchema.parse(data);
}

/**
 * Validates prompt list response
 */
export function validatePromptListResponse(data: unknown): PromptListResponse {
  return PromptListResponseSchema.parse(data);
}

/**
 * Validates get prompt response
 */
export function validateGetPromptResponse(data: unknown): GetPromptResponse {
  return GetPromptResponseSchema.parse(data);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a prompt definition
 */
export function createPrompt(
  name: string,
  description?: string,
  args?: PromptArgument[]
): McpPrompt {
  return {
    name,
    description,
    arguments: args,
  };
}

/**
 * Creates a prompt message
 */
export function createPromptMessage(
  role: PromptRole,
  text: string
): PromptMessage {
  return {
    role,
    content: { type: 'text', text },
  };
}

/**
 * Creates a get prompt response
 */
export function createGetPromptResponse(
  messages: PromptMessage[],
  description?: string
): GetPromptResponse {
  return {
    description,
    messages,
  };
}
