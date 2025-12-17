/**
 * Provider Port - Interface for LLM Provider Access
 *
 * This defines the contract that provider adapters implement.
 * Application layers (CLI, MCP Server) should depend on these interfaces,
 * not on the concrete adapter implementations.
 *
 * Following Ports & Adapters (Hexagonal Architecture) pattern.
 */

import { z } from 'zod';

// ============================================================================
// Provider Request/Response Schemas
// ============================================================================

/**
 * Message in a provider request
 */
export const ProviderMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

/**
 * Provider request schema
 */
export const ProviderRequestSchema = z.object({
  requestId: z.string().uuid(),
  model: z.string().min(1),
  messages: z.array(ProviderMessageSchema).min(1),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().optional(),
});

/**
 * Provider response schema
 */
export const ProviderResponseSchema = z.object({
  requestId: z.string().uuid(),
  success: z.boolean(),
  content: z.string().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
  usage: z
    .object({
      promptTokens: z.number().int().nonnegative(),
      completionTokens: z.number().int().nonnegative(),
    })
    .optional(),
  model: z.string().optional(),
  finishReason: z.enum(['stop', 'length', 'error']).optional(),
});

/**
 * Model info schema
 */
export const ModelInfoSchema = z.object({
  modelId: z.string().min(1),
  displayName: z.string().optional(),
  contextLength: z.number().int().positive().optional(),
  isDefault: z.boolean().optional(),
  capabilities: z.array(z.string()).optional(),
});

// ============================================================================
// Types
// ============================================================================

export type ProviderMessage = z.infer<typeof ProviderMessageSchema>;
export type ProviderRequest = z.infer<typeof ProviderRequestSchema>;
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

// ============================================================================
// Port Interfaces
// ============================================================================

/**
 * Provider Port Interface
 *
 * INV-PROV-PORT-001: Implementations must validate requests before execution
 * INV-PROV-PORT-002: Responses must match ProviderResponseSchema
 * INV-PROV-PORT-003: Errors must not throw; return error response instead
 */
export interface ProviderPort {
  /**
   * Provider identifier
   */
  readonly providerId: string;

  /**
   * Complete a request
   * INV-PROV-PORT-003: Must not throw; returns error in response
   */
  complete(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get available models
   */
  getModels(): ModelInfo[];

  /**
   * Get provider status (open, closed, half-open for circuit breaker)
   */
  getStatus(): 'open' | 'closed' | 'half-open';
}

/**
 * Provider Registry Port Interface
 *
 * INV-PROV-REG-001: getProvider returns undefined for unknown providers
 * INV-PROV-REG-002: listProviders returns deterministic order
 */
export interface ProviderRegistryPort {
  /**
   * Get a provider by ID
   * Returns undefined if not found (INV-PROV-REG-001)
   */
  getProvider(providerId: string): ProviderPort | undefined;

  /**
   * Get the default provider
   */
  getDefaultProvider(): ProviderPort | undefined;

  /**
   * List all provider IDs
   * Returns deterministic order (INV-PROV-REG-002)
   */
  listProviders(): string[];

  /**
   * Check if a provider exists
   */
  hasProvider(providerId: string): boolean;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a provider request
 */
export function validateProviderRequest(data: unknown): ProviderRequest {
  return ProviderRequestSchema.parse(data);
}

/**
 * Validate a provider response
 */
export function validateProviderResponse(data: unknown): ProviderResponse {
  return ProviderResponseSchema.parse(data);
}

/**
 * Safe validation for provider request
 */
export function safeValidateProviderRequest(data: unknown): {
  success: true;
  data: ProviderRequest;
} | { success: false; error: z.ZodError } {
  const result = ProviderRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create a success response
 */
export function createProviderSuccessResponse(
  requestId: string,
  content: string,
  options?: {
    model?: string;
    usage?: { promptTokens: number; completionTokens: number };
    finishReason?: 'stop' | 'length';
  }
): ProviderResponse {
  return {
    requestId,
    success: true,
    content,
    model: options?.model,
    usage: options?.usage,
    finishReason: options?.finishReason ?? 'stop',
  };
}

/**
 * Create an error response
 */
export function createProviderErrorResponse(
  requestId: string,
  code: string,
  message: string
): ProviderResponse {
  return {
    requestId,
    success: false,
    error: { code, message },
    finishReason: 'error',
  };
}
