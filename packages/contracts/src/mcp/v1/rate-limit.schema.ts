/**
 * MCP Tool Rate Limiting Contract
 *
 * Defines rate limiting schemas for MCP tools to prevent resource exhaustion
 * from runaway agent loops or excessive tool calls.
 *
 * Invariants:
 * - INV-RL-001: Rate limits are enforced per tool
 * - INV-RL-002: Exceeded limits return RATE_LIMITED error with retryAfter
 * - INV-RL-003: Limits are configurable without code changes
 * - INV-RL-004: Read tools have higher limits than mutation tools
 */

import { z } from 'zod';

/**
 * Tool category for rate limiting purposes
 * Different categories have different default limits
 */
export const ToolCategorySchema = z.enum([
  'execution',  // agent_run, workflow_run - most restricted
  'mutation',   // memory_store, session_create - moderate
  'read',       // memory_retrieve, agent_list - least restricted
]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

/**
 * Rate limit configuration for a single tool
 */
export const RateLimitConfigSchema = z.object({
  /** Requests per minute allowed */
  rpm: z.number().int().min(1).max(10000).default(100),

  /** Burst size (max requests in short window) */
  burst: z.number().int().min(1).max(1000).default(10),

  /** Whether rate limiting is enabled for this tool */
  enabled: z.boolean().default(true),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/**
 * Rate limit state for tracking usage
 */
export const RateLimitStateSchema = z.object({
  /** Tool name */
  toolName: z.string(),

  /** Current request count in window */
  requestCount: z.number().int().min(0),

  /** Window start timestamp (ISO string) */
  windowStart: z.string().datetime(),

  /** Tokens available for burst */
  burstTokens: z.number().int().min(0),

  /** Last request timestamp */
  lastRequest: z.string().datetime().optional(),
});

export type RateLimitState = z.infer<typeof RateLimitStateSchema>;

/**
 * Rate limit check result
 */
export const RateLimitResultSchema = z.object({
  /** Whether the request is allowed */
  allowed: z.boolean(),

  /** Remaining requests in current window */
  remaining: z.number().int().min(0),

  /** Seconds until rate limit resets */
  resetIn: z.number().int().min(0),

  /** Seconds to wait before retrying (if not allowed) */
  retryAfter: z.number().int().min(0).optional(),

  /** Current limit configuration */
  limit: RateLimitConfigSchema,
});

export type RateLimitResult = z.infer<typeof RateLimitResultSchema>;

/**
 * Rate limit error response
 * INV-RL-002: Exceeded limits return RATE_LIMITED error with retryAfter
 */
export const RateLimitErrorSchema = z.object({
  code: z.literal('RATE_LIMITED'),
  message: z.string(),
  toolName: z.string(),
  retryAfter: z.number().int().min(0),
  limit: z.number().int(),
  windowSeconds: z.number().int(),
});

export type RateLimitError = z.infer<typeof RateLimitErrorSchema>;

/**
 * Default rate limits by tool category
 * INV-RL-004: Read tools have higher limits than mutation tools
 */
export const DEFAULT_RATE_LIMITS: Record<ToolCategory, RateLimitConfig> = {
  execution: { rpm: 30, burst: 5, enabled: true },
  mutation: { rpm: 100, burst: 20, enabled: true },
  read: { rpm: 200, burst: 50, enabled: true },
};

/**
 * Tool to category mapping
 */
export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // Execution tools - most restricted
  agent_run: 'execution',
  workflow_run: 'execution',

  // Mutation tools - moderate limits
  memory_store: 'mutation',
  memory_delete: 'mutation',
  session_create: 'mutation',
  session_complete: 'mutation',
  session_join: 'mutation',
  session_leave: 'mutation',
  session_fail: 'mutation',
  agent_register: 'mutation',
  agent_remove: 'mutation',
  config_set: 'mutation',
  guard_apply: 'mutation',

  // Read tools - highest limits
  memory_retrieve: 'read',
  memory_search: 'read',
  memory_list: 'read',
  agent_list: 'read',
  agent_get: 'read',
  session_status: 'read',
  session_list: 'read',
  workflow_list: 'read',
  workflow_describe: 'read',
  trace_list: 'read',
  trace_get: 'read',
  trace_analyze: 'read',
  guard_check: 'read',
  guard_list: 'read',
  config_get: 'read',
  config_show: 'read',
  ability_list: 'read',
  ability_inject: 'read',
  review_analyze: 'read',
  review_list: 'read',
};

/**
 * Gets the category for a tool
 */
export function getToolCategory(toolName: string): ToolCategory {
  return TOOL_CATEGORIES[toolName] ?? 'read';
}

/**
 * Gets the default rate limit for a tool based on its category
 */
export function getDefaultRateLimit(toolName: string): RateLimitConfig {
  const category = getToolCategory(toolName);
  return { ...DEFAULT_RATE_LIMITS[category] };
}

/**
 * Creates a rate limit error response
 */
export function createRateLimitError(
  toolName: string,
  retryAfter: number,
  limit: number
): RateLimitError {
  return {
    code: 'RATE_LIMITED',
    message: `Rate limit exceeded for tool "${toolName}". Retry after ${retryAfter} seconds.`,
    toolName,
    retryAfter,
    limit,
    windowSeconds: 60,
  };
}

/**
 * Validates rate limit config
 */
export function validateRateLimitConfig(data: unknown): RateLimitConfig {
  return RateLimitConfigSchema.parse(data);
}

/**
 * Safely validates rate limit config
 */
export function safeValidateRateLimitConfig(
  data: unknown
): z.SafeParseReturnType<unknown, RateLimitConfig> {
  return RateLimitConfigSchema.safeParse(data);
}
