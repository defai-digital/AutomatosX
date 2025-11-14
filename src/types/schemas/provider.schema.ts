/**
 * provider.schema.ts
 *
 * Zod schemas for AI provider request/response validation.
 * Provides type-safe validation for provider lifecycle management.
 *
 * Phase 2 Week 1 Day 3: Provider Schemas
 */

import { z } from 'zod';

// ============================================================================
// Provider Types
// ============================================================================

export const ProviderTypeSchema = z.enum([
  'claude',
  'gemini',
  'openai',
]);

export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const ProviderModelSchema = z.object({
  provider: ProviderTypeSchema,
  model: z.string().min(1),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().positive().optional(),
});

export type ProviderModel = z.infer<typeof ProviderModelSchema>;

// ============================================================================
// Message Schemas
// ============================================================================

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageContentSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
});

export type MessageContent = z.infer<typeof MessageContentSchema>;

// ============================================================================
// Provider Request Schemas
// ============================================================================

export const ProviderRequestSchema = z.object({
  provider: ProviderTypeSchema,
  model: z.string().min(1),
  messages: z.array(MessageContentSchema).min(1),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().positive().optional(),
  stream: z.boolean().default(false),
  stopSequences: z.array(z.string()).optional(),
  metadata: z.object({
    requestId: z.string().uuid(),
    conversationId: z.string().uuid().optional(),
    userId: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export type ProviderRequest = z.infer<typeof ProviderRequestSchema>;

export const StreamingRequestSchema = ProviderRequestSchema.extend({
  stream: z.literal(true),
});

export type StreamingRequest = z.infer<typeof StreamingRequestSchema>;

export const NonStreamingRequestSchema = ProviderRequestSchema.extend({
  stream: z.literal(false),
});

export type NonStreamingRequest = z.infer<typeof NonStreamingRequestSchema>;

// ============================================================================
// Provider Response Schemas
// ============================================================================

export const TokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const ProviderResponseSchema = z.object({
  content: z.string(),
  tokens: TokenUsageSchema,
  duration: z.number().nonnegative(),
  model: z.string(),
  provider: ProviderTypeSchema,
  finishReason: z.enum(['stop', 'length', 'content_filter', 'error']).optional(),
});

export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;

export const StreamChunkSchema = z.object({
  chunk: z.string(),
  index: z.number().int().nonnegative(),
  delta: z.string(),
  finishReason: z.enum(['stop', 'length', 'content_filter', 'error']).optional(),
});

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

// ============================================================================
// Rate Limit Schemas
// ============================================================================

export const RateLimitInfoSchema = z.object({
  retryAfter: z.number().int().positive(),
  limit: z.number().int().positive().optional(),
  remaining: z.number().int().nonnegative().optional(),
  reset: z.number().int().positive().optional(),
});

export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;

// ============================================================================
// Error Schemas
// ============================================================================

export const ProviderErrorCodeSchema = z.enum([
  'authentication_error',
  'invalid_request',
  'rate_limit_exceeded',
  'server_error',
  'timeout',
  'network_error',
  'content_filter',
  'model_not_found',
  'quota_exceeded',
  'unknown_error',
]);

export type ProviderErrorCode = z.infer<typeof ProviderErrorCodeSchema>;

export const ProviderErrorSchema = z.object({
  error: z.string(),
  code: ProviderErrorCodeSchema.optional(),
  provider: ProviderTypeSchema.optional(),
  statusCode: z.number().int().optional(),
  retryable: z.boolean().default(false),
});

export type ProviderError = z.infer<typeof ProviderErrorSchema>;

// ============================================================================
// Retry Schemas
// ============================================================================

export const RetryStrategySchema = z.enum([
  'exponential',
  'linear',
  'constant',
]);

export type RetryStrategy = z.infer<typeof RetryStrategySchema>;

export const RetryConfigSchema = z.object({
  maxAttempts: z.number().int().positive().default(3),
  initialDelayMs: z.number().int().positive().default(1000),
  maxDelayMs: z.number().int().positive().default(30000),
  strategy: RetryStrategySchema.default('exponential'),
  backoffMultiplier: z.number().positive().default(2),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

export const RetryInfoSchema = z.object({
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  delayMs: z.number().int().nonnegative().optional(),
  lastError: z.string().optional(),
});

export type RetryInfo = z.infer<typeof RetryInfoSchema>;

// ============================================================================
// Fallback Schemas
// ============================================================================

export const FallbackConfigSchema = z.object({
  enabled: z.boolean().default(true),
  providers: z.array(ProviderTypeSchema).min(1),
  modelMapping: z.record(z.string()).optional(),
});

export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;

export const FallbackInfoSchema = z.object({
  provider: ProviderTypeSchema,
  model: z.string(),
  reason: z.string(),
});

export type FallbackInfo = z.infer<typeof FallbackInfoSchema>;

// ============================================================================
// Provider State Schemas
// ============================================================================

export const ProviderStateSchema = z.enum([
  'idle',
  'validating',
  'requesting',
  'streaming',
  'rate_limited',
  'retrying',
  'completed',
  'failed',
]);

export type ProviderState = z.infer<typeof ProviderStateSchema>;

export const ProviderMetricsSchema = z.object({
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative().optional(),
  firstTokenLatency: z.number().nonnegative().optional(),
  totalDuration: z.number().nonnegative().optional(),
  tokenCount: TokenUsageSchema,
});

export type ProviderMetrics = z.infer<typeof ProviderMetricsSchema>;

export const ProviderContextSchema = z.object({
  state: ProviderStateSchema,
  provider: ProviderTypeSchema,
  model: z.string(),
  requestId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  userId: z.string().optional(),
  metrics: ProviderMetricsSchema,
  retryAttempt: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().positive().default(3),
  tags: z.array(z.string()).default([]),
  fallbackProvider: ProviderTypeSchema.optional(),
});

export type ProviderContext = z.infer<typeof ProviderContextSchema>;

// ============================================================================
// Provider Log Schemas
// ============================================================================

export const ProviderLogSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  userId: z.string().optional(),
  provider: ProviderTypeSchema,
  model: z.string(),
  state: ProviderStateSchema,
  request: z.string(), // JSON stringified ProviderRequest
  response: z.string().optional(), // JSON stringified ProviderResponse
  error: z.string().optional(),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative().optional(),
  duration: z.number().nonnegative().optional(),
  tokenCount: TokenUsageSchema.optional(),
  retryAttempt: z.number().int().nonnegative(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProviderLog = z.infer<typeof ProviderLogSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export const validateProviderRequest = (data: unknown): ProviderRequest => {
  return ProviderRequestSchema.parse(data);
};

export const validateProviderResponse = (data: unknown): ProviderResponse => {
  return ProviderResponseSchema.parse(data);
};

export const validateStreamChunk = (data: unknown): StreamChunk => {
  return StreamChunkSchema.parse(data);
};

export const validateProviderError = (data: unknown): ProviderError => {
  return ProviderErrorSchema.parse(data);
};

export const validateRetryConfig = (data: unknown): RetryConfig => {
  return RetryConfigSchema.parse(data);
};

export const validateProviderContext = (data: unknown): ProviderContext => {
  return ProviderContextSchema.parse(data);
};

// ============================================================================
// Type Guards
// ============================================================================

export const isStreamingRequest = (req: ProviderRequest): req is StreamingRequest => {
  return req.stream === true;
};

export const isNonStreamingRequest = (req: ProviderRequest): req is NonStreamingRequest => {
  return req.stream === false;
};

export const isTerminalState = (state: ProviderState): boolean => {
  return state === 'completed' || state === 'failed';
};

export const isRetryableError = (error: ProviderError): boolean => {
  return error.retryable === true;
};
