/**
 * Policy Engine
 *
 * Loads, validates, and resolves governance policies.
 *
 * Invariants:
 * - INV-GUARD-001: Deterministic Resolution - same policy ID + variables = identical context
 * - INV-GUARD-002: Variable Substitution - all {{variable}} placeholders resolved before matching
 * - INV-GUARD-003: Path Precedence - forbidden paths take precedence over allowed paths
 */

import type { Policy, GovernanceContext, PolicyVariables } from './types.js';

/**
 * Built-in policies
 * These are embedded in the package for reliability.
 */
const BUILTIN_POLICIES: Record<string, Policy> = {
  'provider-refactor': {
    policyId: 'provider-refactor',
    allowedPaths: [
      'packages/adapters/providers/src/providers/{{target}}/**',
      'packages/adapters/providers/src/providers/{{target}}.ts',
      'tests/integration/providers/**',
    ],
    forbiddenPaths: [
      'packages/contracts/**',
      'packages/core/**',
      'packages/cli/**',
      'packages/mcp-server/**',
      'packages/guard/**',
    ],
    requiredContracts: ['routing', 'trace'],
    gates: ['path_violation', 'dependency', 'change_radius', 'contract_tests'],
    changeRadiusLimit: 2,
  },
  bugfix: {
    policyId: 'bugfix',
    allowedPaths: ['packages/**'],
    forbiddenPaths: ['packages/contracts/**'],
    requiredContracts: [],
    gates: ['path_violation', 'change_radius'],
    changeRadiusLimit: 3,
  },
  rebuild: {
    policyId: 'rebuild',
    allowedPaths: ['packages/**', 'tests/**'],
    forbiddenPaths: [],
    requiredContracts: ['workflow', 'routing', 'memory', 'trace', 'mcp'],
    gates: ['dependency', 'contract_tests'],
    changeRadiusLimit: 10,
  },
  /**
   * Config change policy (PRD Section 14.1)
   *
   * Controls which config changes are allowed in different contexts.
   * Uses config_validation and sensitive_change gates.
   */
  'config-change': {
    policyId: 'config-change',
    allowedPaths: [
      '.automatosx/config.json',
      '.automatosx/context/**',
      '**/.automatosx/config.json',
    ],
    forbiddenPaths: [
      // Cannot modify guard package during config changes
      'packages/guard/**',
      // Cannot modify contracts during config changes
      'packages/contracts/**',
    ],
    requiredContracts: [],
    gates: ['path_violation', 'config_validation', 'sensitive_change'],
    changeRadiusLimit: 2,
  },
};

/**
 * Resolves variable placeholders in a path pattern
 * INV-GUARD-002: Variable Substitution
 */
function resolvePathVariables(
  pattern: string,
  variables: PolicyVariables
): string {
  let resolved = pattern;
  for (const [key, value] of Object.entries(variables)) {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return resolved;
}

/**
 * Checks if a path pattern has unresolved variables
 */
function hasUnresolvedVariables(pattern: string): boolean {
  return /\{\{[^}]+\}\}/.test(pattern);
}

/**
 * Gets a policy by ID
 */
export function getPolicy(policyId: string): Policy | undefined {
  return BUILTIN_POLICIES[policyId];
}

/**
 * Lists all available policy IDs
 */
export function listPolicies(): string[] {
  return Object.keys(BUILTIN_POLICIES);
}

/**
 * Resolves a policy into a governance context
 * INV-GUARD-001: Deterministic Resolution
 * INV-GUARD-002: Variable Substitution (must resolve all placeholders)
 */
export function resolvePolicy(
  policyId: string,
  target: string,
  additionalVars?: PolicyVariables
): GovernanceContext {
  const policy = getPolicy(policyId);

  if (policy === undefined) {
    throw new Error(
      `Unknown policy: ${policyId}. Available policies: ${listPolicies().join(', ')}`
    );
  }

  const variables: PolicyVariables = {
    target,
    ...additionalVars,
  };

  // Resolve path variables
  const allowedPaths = policy.allowedPaths.map((p) =>
    resolvePathVariables(p, variables)
  );
  const forbiddenPaths = policy.forbiddenPaths.map((p) =>
    resolvePathVariables(p, variables)
  );

  // Check for unresolved variables
  const unresolvedAllowed = allowedPaths.filter(hasUnresolvedVariables);
  const unresolvedForbidden = forbiddenPaths.filter(hasUnresolvedVariables);

  if (unresolvedAllowed.length > 0 || unresolvedForbidden.length > 0) {
    const unresolved = [...unresolvedAllowed, ...unresolvedForbidden];
    throw new Error(
      `Unresolved variables in paths: ${unresolved.join(', ')}. ` +
        `Provide values for all {{variable}} placeholders.`
    );
  }

  return {
    policyId: policy.policyId,
    allowedPaths,
    forbiddenPaths,
    requiredContracts: [...policy.requiredContracts],
    enabledGates: [...policy.gates],
    changeRadiusLimit: policy.changeRadiusLimit,
    target,
  };
}

/**
 * Validates that a policy ID exists
 */
export function validatePolicyId(policyId: string): boolean {
  return policyId in BUILTIN_POLICIES;
}
