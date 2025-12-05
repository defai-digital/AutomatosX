/**
 * Zod Schemas for Provider Types
 *
 * Runtime validation for provider requests, responses, and health status.
 * Ensures provider communication integrity and type safety.
 */

import { z } from 'zod';

// ========================================
// Execution Request Schema
// ========================================

/**
 * Execution request schema
 * Validates incoming requests to providers
 */
export const executionRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().positive().optional(),
  stopSequences: z.array(z.string()).optional(),
  stream: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional()
}).describe('Provider execution request');

export type ExecutionRequestZod = z.infer<typeof executionRequestSchema>;

// ========================================
// Token Usage Schema
// ========================================

/**
 * Token usage schema
 * Validates token counts in responses
 *
 * BUG FIX: Relaxed validation from strict equality to >= comparison.
 * Previously required `total === prompt + completion` which failed for:
 * - Providers that include overhead tokens in total
 * - Rounding differences in API responses
 * - Providers that report total without detailed breakdown
 *
 * New rule: total >= prompt + completion (allows overhead tokens)
 */
export const tokenUsageSchema = z.object({
  prompt: z.number().int().nonnegative(),
  completion: z.number().int().nonnegative(),
  total: z.number().int().nonnegative()
}).refine(
  (data) => data.total >= data.prompt + data.completion,
  'Total tokens must be greater than or equal to prompt + completion'
).describe('Token usage information');

export type TokenUsageZod = z.infer<typeof tokenUsageSchema>;

// ========================================
// Execution Response Schema
// ========================================

/**
 * Finish reason for responses
 */
export const finishReasonSchema = z.enum([
  'stop',           // Natural completion
  'length',         // Max tokens reached
  'content_filter', // Content filtered
  'tool_calls',     // Function/tool called
  'error'           // Error occurred
]).describe('Response finish reason');

/**
 * Execution response schema
 * Validates provider responses
 */
export const executionResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  tokensUsed: tokenUsageSchema,
  latencyMs: z.number().nonnegative(),
  finishReason: finishReasonSchema,
  cached: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).optional()
}).describe('Provider execution response');

export type ExecutionResponseZod = z.infer<typeof executionResponseSchema>;

// ========================================
// Health Status Schema
// ========================================

/**
 * Provider health status schema
 * Validates health check results
 */
export const healthStatusSchema = z.object({
  available: z.boolean(),
  latencyMs: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
  consecutiveFailures: z.number().int().nonnegative(),
  lastCheckTime: z.number().int().nonnegative().optional()
}).describe('Provider health status');

export type HealthStatusZod = z.infer<typeof healthStatusSchema>;

// ========================================
// Provider Capabilities Schema
// ========================================

/**
 * Provider capabilities schema
 * Validates provider feature support
 */
export const providerCapabilitiesSchema = z.object({
  supportsStreaming: z.boolean().default(false),
  supportsEmbedding: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  supportsFunctionCalling: z.boolean().default(false),
  maxContextTokens: z.number().int().positive(),
  supportedModels: z.array(z.string()).min(1)
}).describe('Provider capabilities');

export type ProviderCapabilitiesZod = z.infer<typeof providerCapabilitiesSchema>;

// ========================================
// Rate Limit Status Schema
// ========================================

/**
 * Rate limit status schema
 * Validates rate limit information
 */
export const rateLimitStatusSchema = z.object({
  hasCapacity: z.boolean(),
  requestsRemaining: z.number().int().nonnegative(),
  tokensRemaining: z.number().int().nonnegative(),
  resetAtMs: z.number().int().positive()
}).describe('Rate limit status');

export type RateLimitStatusZod = z.infer<typeof rateLimitStatusSchema>;

// ========================================
// Cost Estimate Schema
// ========================================

/**
 * Cost breakdown schema
 */
export const costBreakdownSchema = z.object({
  prompt: z.number().nonnegative(),
  completion: z.number().nonnegative(),
  embedding: z.number().nonnegative().optional(),
  other: z.number().nonnegative().optional()
}).describe('Cost breakdown');

/**
 * Cost estimate schema
 * Validates cost estimation results
 */
export const costEstimateSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default('USD'),
  breakdown: costBreakdownSchema
}).describe('Cost estimate');

export type CostEstimateZod = z.infer<typeof costEstimateSchema>;

// ========================================
// Usage Stats Schema
// ========================================

/**
 * Provider usage statistics schema
 * Validates usage tracking data
 */
export const usageStatsSchema = z.object({
  totalRequests: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  totalCost: z.number().nonnegative(),
  successRate: z.number().min(0).max(1),
  averageLatencyMs: z.number().nonnegative().optional(),
  lastRequestTime: z.number().int().nonnegative().optional()
}).describe('Provider usage statistics');

export type UsageStatsZod = z.infer<typeof usageStatsSchema>;

// ========================================
// Provider Error Schema
// ========================================

/**
 * Provider error type enum
 */
export const providerErrorTypeSchema = z.enum([
  'not_found',
  'timeout',
  'rate_limit',
  'auth_error',
  'invalid_request',
  'api_error',
  'network_error',
  'config_error',
  'exec_error',
  'unknown'
]).describe('Provider error type');

/**
 * Provider error schema
 * Validates error information
 */
export const providerErrorSchema = z.object({
  type: providerErrorTypeSchema,
  message: z.string(),
  code: z.string().optional(),
  retryable: z.boolean().default(false),
  details: z.record(z.string(), z.any()).optional()
}).describe('Provider error');

export type ProviderErrorZod = z.infer<typeof providerErrorSchema>;

// ========================================
// Validation Helper Functions
// ========================================

/**
 * Validate execution request
 */
export function validateExecutionRequest(request: unknown): ExecutionRequestZod {
  return executionRequestSchema.parse(request);
}

/**
 * Validate execution response
 */
export function validateExecutionResponse(response: unknown): ExecutionResponseZod {
  return executionResponseSchema.parse(response);
}

/**
 * Validate health status
 */
export function validateHealthStatus(status: unknown): HealthStatusZod {
  return healthStatusSchema.parse(status);
}

/**
 * Safe validation (returns result instead of throwing)
 */
export function safeValidateExecutionRequest(request: unknown) {
  return executionRequestSchema.safeParse(request);
}

export function safeValidateExecutionResponse(response: unknown) {
  return executionResponseSchema.safeParse(response);
}

export function safeValidateHealthStatus(status: unknown) {
  return healthStatusSchema.safeParse(status);
}
