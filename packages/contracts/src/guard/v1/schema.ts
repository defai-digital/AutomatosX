/**
 * AX Guard Policy Schema
 *
 * Zod schema for runtime validation of governance policies.
 */

import { z } from 'zod';
import {
  LIMIT_DELEGATION_DEPTH,
  LIMIT_CONCURRENT_EXECUTIONS,
  RATE_LIMIT_RPM_DEFAULT,
  RATE_LIMIT_TPM_DEFAULT,
  TIMEOUT_SESSION,
  PRIORITY_DEFAULT,
  PRIORITY_MAX,
} from '../../constants.js';

/**
 * Available gate types
 */
export const GateTypeSchema = z.enum([
  'path_violation',
  'dependency',
  'change_radius',
  'contract_tests',
  'config_validation',
  'sensitive_change',
  'secrets_detection',
  'agent_selection',
  'task_classifier',
]);

export type GateType = z.infer<typeof GateTypeSchema>;

/**
 * Available contract types for testing
 */
export const ContractTypeSchema = z.enum([
  'workflow',
  'workflow-templates',
  'ml-lifecycle',
  'routing',
  'memory',
  'trace',
  'mcp',
  'agent',
  'session',
  'config',
  'guard',
  'ability',
]);

export type ContractType = z.infer<typeof ContractTypeSchema>;

/**
 * Policy schema for AI coding governance
 */
export const PolicySchema = z.object({
  /**
   * Unique identifier for this policy
   */
  policyId: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, 'Policy ID must be lowercase with hyphens'),

  /**
   * Glob patterns for paths that may be modified
   * Supports {{variable}} placeholders
   */
  allowedPaths: z.array(z.string()).default([]),

  /**
   * Glob patterns for paths that must not be modified
   */
  forbiddenPaths: z.array(z.string()).default([]),

  /**
   * Contract test suites that must pass
   */
  requiredContracts: z.array(ContractTypeSchema).default([]),

  /**
   * Gates to execute for this policy
   */
  gates: z
    .array(GateTypeSchema)
    .default(['path_violation', 'change_radius']),

  /**
   * Maximum number of packages that can be modified
   */
  changeRadiusLimit: z.number().int().min(1).default(3),
});

export type Policy = z.infer<typeof PolicySchema>;

/**
 * Validates a policy object
 */
export function validatePolicy(data: unknown): Policy {
  return PolicySchema.parse(data);
}

/**
 * Safely validates a policy object
 */
export function safeValidatePolicy(
  data: unknown
): { success: true; data: Policy } | { success: false; error: z.ZodError } {
  const result = PolicySchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ============================================================================
// Agent Behavior Policy Contracts
// ============================================================================

/**
 * Agent behavior policy for controlling agent capabilities
 *
 * Invariants:
 * - INV-AP-001: Policies merged by priority (higher wins)
 * - INV-AP-002: Forbidden lists take precedence over allowed
 * - INV-AP-003: Resource limits strictly enforced
 */
export const AgentPolicySchema = z.object({
  /** Policy identifier */
  policyId: z.string(),

  /** Agent this applies to (* for all) */
  agentId: z.string().default('*'),

  /** Team this applies to */
  team: z.string().optional(),

  // === Data Access Control ===

  /** Can access memory domain */
  canAccessMemory: z.boolean().default(true),

  /** Can access session domain */
  canAccessSessions: z.boolean().default(true),

  /** Allowed memory namespaces (glob patterns) */
  allowedMemoryNamespaces: z.array(z.string()).default(['*']),

  /** Forbidden memory namespaces */
  forbiddenMemoryNamespaces: z.array(z.string()).default([]),

  // === Delegation Control ===

  /** Can delegate to other agents */
  canDelegate: z.boolean().default(true),

  /** Agents this can delegate to (patterns supported) */
  allowedDelegates: z.array(z.string()).default(['*']),

  /** Agents this cannot delegate to */
  forbiddenDelegates: z.array(z.string()).default([]),

  /** Maximum delegation depth */
  maxDelegationDepth: z.number().int().min(0).max(10).default(LIMIT_DELEGATION_DEPTH),

  // === Resource Limits (INV-AP-003) ===

  /** Max tokens per request */
  maxTokensPerRequest: z.number().int().min(1).max(1000000).default(RATE_LIMIT_TPM_DEFAULT),

  /** Max requests per minute */
  maxRequestsPerMinute: z.number().int().min(1).max(1000).default(RATE_LIMIT_RPM_DEFAULT),

  /** Max concurrent executions */
  maxConcurrentExecutions: z.number().int().min(1).max(10).default(LIMIT_CONCURRENT_EXECUTIONS),

  /** Max session duration in ms */
  maxSessionDurationMs: z
    .number()
    .int()
    .min(60000)
    .max(86400000)
    .default(TIMEOUT_SESSION),

  // === Capability Control ===

  /** Allowed capabilities (patterns) */
  allowedCapabilities: z.array(z.string()).default(['*']),

  /** Forbidden capabilities */
  forbiddenCapabilities: z.array(z.string()).default([]),

  // === Tool Access ===

  /** Allowed MCP tools (patterns) */
  allowedTools: z.array(z.string()).default(['*']),

  /** Forbidden MCP tools */
  forbiddenTools: z.array(z.string()).default([]),

  // === File System ===

  /** Allowed paths (glob patterns) */
  allowedPaths: z.array(z.string()).default(['**']),

  /** Forbidden paths (glob patterns) */
  forbiddenPaths: z.array(z.string()).default([]),

  // === Metadata ===

  /** Policy enabled flag */
  enabled: z.boolean().default(true),

  /** Priority for policy merging (INV-AP-001) */
  priority: z.number().int().min(0).max(PRIORITY_MAX).default(PRIORITY_DEFAULT),

  /** Policy description */
  description: z.string().optional(),

  /** Policy tags */
  tags: z.array(z.string()).optional(),
});

export type AgentPolicy = z.infer<typeof AgentPolicySchema>;

/**
 * Policy check action types
 */
export const PolicyActionSchema = z.enum([
  'accessMemory',
  'accessSession',
  'delegate',
  'useTool',
  'accessPath',
  'useCapability',
]);

export type PolicyAction = z.infer<typeof PolicyActionSchema>;

/**
 * Policy check result
 */
export const PolicyCheckResultSchema = z.object({
  /** Whether action is allowed */
  allowed: z.boolean(),

  /** Reason if not allowed */
  reason: z.string().optional(),

  /** Policy that made the decision */
  policyId: z.string().optional(),
});

export type PolicyCheckResult = z.infer<typeof PolicyCheckResultSchema>;

/**
 * Resource usage for limit checking
 */
export const ResourceUsageSchema = z.object({
  /** Tokens used in current request */
  tokensThisRequest: z.number().int().min(0),

  /** Requests in current minute */
  requestsThisMinute: z.number().int().min(0),

  /** Current concurrent executions */
  concurrentExecutions: z.number().int().min(0),

  /** Session duration in ms */
  sessionDurationMs: z.number().int().min(0).optional(),
});

export type ResourceUsage = z.infer<typeof ResourceUsageSchema>;

/**
 * Limit check result
 */
export const LimitCheckResultSchema = z.object({
  /** Whether within all limits */
  withinLimits: z.boolean(),

  /** List of violated limits */
  violations: z.array(z.string()),

  /** Current limits */
  limits: z.object({
    maxTokensPerRequest: z.number().int(),
    maxRequestsPerMinute: z.number().int(),
    maxConcurrentExecutions: z.number().int(),
    maxSessionDurationMs: z.number().int().optional(),
  }),
});

export type LimitCheckResult = z.infer<typeof LimitCheckResultSchema>;

/**
 * Agent policy error codes
 */
export const AgentPolicyErrorCodes = {
  POLICY_NOT_FOUND: 'AGENT_POLICY_NOT_FOUND',
  ACCESS_DENIED: 'AGENT_POLICY_ACCESS_DENIED',
  LIMIT_EXCEEDED: 'AGENT_POLICY_LIMIT_EXCEEDED',
  DELEGATION_DENIED: 'AGENT_POLICY_DELEGATION_DENIED',
  TOOL_DENIED: 'AGENT_POLICY_TOOL_DENIED',
  PATH_DENIED: 'AGENT_POLICY_PATH_DENIED',
  CAPABILITY_DENIED: 'AGENT_POLICY_CAPABILITY_DENIED',
} as const;

export type AgentPolicyErrorCode =
  (typeof AgentPolicyErrorCodes)[keyof typeof AgentPolicyErrorCodes];

/**
 * Validates agent policy
 */
export function validateAgentPolicy(data: unknown): AgentPolicy {
  return AgentPolicySchema.parse(data);
}

/**
 * Creates default agent policy (permissive)
 */
export function createDefaultAgentPolicy(agentId = '*'): AgentPolicy {
  return AgentPolicySchema.parse({ policyId: 'default', agentId });
}

/**
 * Creates restrictive agent policy
 */
export function createRestrictiveAgentPolicy(
  policyId: string,
  agentId = '*'
): AgentPolicy {
  return {
    policyId,
    agentId,
    canAccessMemory: false,
    canAccessSessions: false,
    canDelegate: false,
    allowedMemoryNamespaces: [],
    forbiddenMemoryNamespaces: ['*'],
    allowedDelegates: [],
    forbiddenDelegates: ['*'],
    maxDelegationDepth: 0,
    maxTokensPerRequest: 10000,
    maxRequestsPerMinute: 10,
    maxConcurrentExecutions: 1,
    maxSessionDurationMs: 300000,
    allowedCapabilities: [],
    forbiddenCapabilities: ['*'],
    allowedTools: [],
    forbiddenTools: ['*'],
    allowedPaths: [],
    forbiddenPaths: ['**'],
    enabled: true,
    priority: 100,
  };
}
