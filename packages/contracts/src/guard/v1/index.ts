/**
 * AX Guard Policy Contract V1
 *
 * Governance policy schemas for AI coding checks and agent behavior.
 */

// Code Change Policy
export {
  PolicySchema,
  GateTypeSchema,
  ContractTypeSchema,
  validatePolicy,
  safeValidatePolicy,
} from './schema.js';

export type { Policy, GateType, ContractType } from './schema.js';

// Agent Behavior Policy
export {
  AgentPolicySchema,
  PolicyActionSchema,
  PolicyCheckResultSchema,
  ResourceUsageSchema,
  LimitCheckResultSchema,
  AgentPolicyErrorCodes,
  validateAgentPolicy,
  createDefaultAgentPolicy,
  createRestrictiveAgentPolicy,
  type AgentPolicy,
  type PolicyAction,
  type PolicyCheckResult,
  type ResourceUsage,
  type LimitCheckResult,
  type AgentPolicyErrorCode,
} from './schema.js';
