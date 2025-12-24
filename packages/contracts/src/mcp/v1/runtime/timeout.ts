import { z } from 'zod';

// ============================================================================
// Tool Categories
// ============================================================================

export const ToolCategorySchema = z.enum([
  'query', // memory_retrieve, agent_get, session_status
  'mutation', // memory_store, agent_register, session_create
  'scan', // bugfix_scan, refactor_scan
  'execution', // agent_run, workflow_run
]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

// ============================================================================
// Timeout Configuration
// ============================================================================

export const MCPTimeoutConfigSchema = z.object({
  /** Default timeout for all operations (ms) */
  defaultTimeoutMs: z.number().int().positive().default(30_000),
  /** Timeout per tool category */
  toolTimeouts: z
    .object({
      /** Quick read operations */
      query: z.number().int().positive().default(10_000), // 10 seconds
      /** Write operations */
      mutation: z.number().int().positive().default(30_000), // 30 seconds
      /** Scan/analysis operations */
      scan: z.number().int().positive().default(120_000), // 2 minutes
      /** Execution operations (agent/workflow) */
      execution: z.number().int().positive().default(1_200_000), // 20 minutes
    })
    .default({}),
  /** Per-tool overrides */
  toolOverrides: z.record(z.string(), z.number().int().positive()).default({}),
});

export type MCPTimeoutConfig = z.infer<typeof MCPTimeoutConfigSchema>;

// ============================================================================
// Timeout Result
// ============================================================================

export const TimeoutResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    result: z.unknown(),
    durationMs: z.number().int().nonnegative(),
  }),
  z.object({
    status: z.literal('timeout'),
    timeoutMs: z.number().int().positive(),
    partialResult: z.unknown().optional(),
    durationMs: z.number().int().nonnegative(),
  }),
  z.object({
    status: z.literal('error'),
    error: z.object({
      code: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    }),
    durationMs: z.number().int().nonnegative(),
  }),
]);

export type TimeoutResult = z.infer<typeof TimeoutResultSchema>;

// ============================================================================
// Tool Category Mapping
// ============================================================================

export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // Query tools
  memory_retrieve: 'query',
  memory_search: 'query',
  memory_list: 'query',
  agent_get: 'query',
  agent_list: 'query',
  session_status: 'query',
  session_list: 'query',
  trace_get: 'query',
  trace_list: 'query',
  config_get: 'query',
  config_show: 'query',
  ability_list: 'query',
  guard_list: 'query',
  review_list: 'query',
  workflow_list: 'query',
  workflow_describe: 'query',

  // Mutation tools
  memory_store: 'mutation',
  memory_delete: 'mutation',
  agent_register: 'mutation',
  agent_remove: 'mutation',
  session_create: 'mutation',
  session_join: 'mutation',
  session_leave: 'mutation',
  session_complete: 'mutation',
  session_fail: 'mutation',
  config_set: 'mutation',
  guard_apply: 'mutation',

  // Scan tools
  review_analyze: 'scan',
  trace_analyze: 'scan',
  guard_check: 'scan',

  // Execution tools
  agent_run: 'execution',
  workflow_run: 'execution',
  ability_inject: 'execution',
};

/**
 * Get timeout for a specific tool
 */
export function getToolTimeout(
  toolName: string,
  config: MCPTimeoutConfig
): number {
  // Check for tool-specific override first
  if (config.toolOverrides[toolName] !== undefined) {
    return config.toolOverrides[toolName];
  }

  // Get category and return category timeout
  const category = TOOL_CATEGORIES[toolName];
  if (category && config.toolTimeouts[category] !== undefined) {
    return config.toolTimeouts[category];
  }

  // Fall back to default
  return config.defaultTimeoutMs;
}
