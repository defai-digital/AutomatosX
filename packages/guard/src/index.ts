/**
 * @defai.digital/guard
 *
 * Post-check AI Coding Governance Engine
 *
 * AX Guard v1 is responsible for judging whether an AI coding session's
 * results are acceptable according to governance policies.
 *
 * Key principle: Guard does NOT control AI during execution.
 * It only validates results AFTER execution.
 */

// Types
export type {
  GateType,
  GateStatus,
  GateResult,
  Policy,
  PolicyVariables,
  GovernanceContext,
  GuardResult,
  GuardCheckOptions,
  GateExecutor,
} from './types.js';

// Policy Engine
export {
  getPolicy,
  listPolicies,
  resolvePolicy,
  validatePolicyId,
} from './policy-engine.js';

// Gates
export {
  pathViolationGate,
  changeRadiusGate,
  dependencyGate,
  contractTestGate,
  // Config governance gates (PRD Section 14.2)
  configValidationGate,
  sensitiveChangeGate,
  validateConfigData,
  isSensitivePath,
  getSensitivePaths,
} from './gates/index.js';

// Executor
export { executeGates, getChangedFiles } from './executor.js';

// Agent Policy Enforcer
export {
  createAgentPolicyEnforcer,
  AgentPolicyError,
  type IAgentPolicyEnforcer,
  type EffectivePolicy,
} from './agent-policy-enforcer.js';

/**
 * Main guard check function
 *
 * This is the primary entry point for running governance checks.
 */
import { resolvePolicy } from './policy-engine.js';
import { executeGates, getChangedFiles } from './executor.js';
import type { GuardResult, GuardCheckOptions } from './types.js';

export async function guardCheck(options: GuardCheckOptions): Promise<GuardResult> {
  const { policy, target, baseBranch = 'origin/main' } = options;

  // Resolve policy to governance context
  const context = resolvePolicy(policy, target);

  // Get changed files
  const changedFiles = await getChangedFiles(baseBranch);

  if (changedFiles.length === 0) {
    return {
      status: 'PASS',
      policyId: context.policyId,
      target: context.target,
      gates: [],
      summary: 'No files changed',
      suggestions: [],
      timestamp: new Date().toISOString(),
    };
  }

  // Execute gates
  return executeGates(context, changedFiles);
}
