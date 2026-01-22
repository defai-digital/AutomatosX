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

  /**
   * ML Governance Policy (PRD v15)
   *
   * Governance gates for ML lifecycle workflows including:
   * - Experiment tracking
   * - Model evaluation
   * - Model registry
   * - Model monitoring
   * - A/B testing
   */
  'ml-governance': {
    policyId: 'ml-governance',
    allowedPaths: [
      'packages/core/ml-lifecycle-domain/**',
      'packages/contracts/src/ml-lifecycle/**',
      'examples/workflows/ml-*',
      'examples/agents/ml*',
      'examples/agents/data-*',
      'tests/core/ml-*',
      'tests/contract/ml-*',
    ],
    forbiddenPaths: [
      // Cannot modify core routing during ML workflows
      'packages/core/routing-engine/**',
      // Cannot modify provider adapters
      'packages/adapters/providers/**',
      // Cannot modify guard itself
      'packages/guard/**',
    ],
    requiredContracts: ['ml-lifecycle', 'workflow-templates', 'memory'],
    gates: ['path_violation', 'dependency', 'contract_tests'],
    changeRadiusLimit: 4,
  },

  /**
   * Business Governance Policy (PRD v15)
   *
   * Governance gates for business workflows including:
   * - Product discovery
   * - Strategic planning
   * - Technology research
   */
  'business-governance': {
    policyId: 'business-governance',
    allowedPaths: [
      'examples/workflows/product-*',
      'examples/workflows/strategic-*',
      'examples/workflows/technology-*',
      'examples/agents/product*',
      'examples/agents/cto*',
      'examples/agents/ceo*',
      'examples/agents/researcher*',
      'packages/contracts/src/workflow-templates/**',
    ],
    forbiddenPaths: [
      // Cannot modify core packages during business workflows
      'packages/core/**',
      // Cannot modify adapters
      'packages/adapters/**',
      // Cannot modify guard
      'packages/guard/**',
    ],
    requiredContracts: ['workflow-templates'],
    gates: ['path_violation', 'change_radius'],
    changeRadiusLimit: 3,
  },

  /**
   * Infrastructure Governance Policy (PRD v15)
   *
   * Governance gates for infrastructure/DevOps workflows including:
   * - Infrastructure automation
   * - CI/CD pipelines
   * - Cloud provisioning
   */
  'infrastructure-governance': {
    policyId: 'infrastructure-governance',
    allowedPaths: [
      'examples/workflows/infrastructure-*',
      'examples/agents/devops*',
      '.github/**',
      'docker/**',
      'terraform/**',
      'k8s/**',
    ],
    forbiddenPaths: [
      // Cannot modify production secrets
      '**/.env*',
      '**/credentials*',
      '**/secrets*',
    ],
    requiredContracts: ['workflow-templates'],
    gates: ['path_violation', 'secrets_detection', 'change_radius'],
    changeRadiusLimit: 5,
  },
};

/**
 * Pattern for detecting path traversal attempts
 * INV-GUARD-PATH-001: Path traversal prevention
 */
const PATH_TRAVERSAL_PATTERN = /(?:^|[/\\])\.\.(?:[/\\]|$)/;

/**
 * Validates a variable value is safe for path substitution
 * INV-GUARD-PATH-001: Prevent path traversal via variable injection
 */
function isSafePathValue(value: string): boolean {
  // Reject empty values
  if (value.length === 0) return false;

  // Reject path traversal attempts
  if (PATH_TRAVERSAL_PATTERN.test(value)) return false;

  // Reject absolute paths
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;

  // Reject null bytes (could truncate paths)
  if (value.includes('\0')) return false;

  return true;
}

/**
 * Escapes a string for use in a regular expression
 * INV-GUARD-REGEX-001: Prevent regex injection via variable keys
 */
function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves variable placeholders in a path pattern
 * INV-GUARD-002: Variable Substitution
 * INV-GUARD-PATH-001: Path traversal prevention
 * INV-GUARD-REGEX-001: Regex key escaping
 */
function resolvePathVariables(
  pattern: string,
  variables: PolicyVariables
): string {
  let resolved = pattern;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    // Only validate values that will actually be substituted
    if (pattern.includes(placeholder)) {
      // INV-GUARD-PATH-001: Validate each variable value before substitution
      if (!isSafePathValue(value)) {
        throw new Error(
          `Unsafe path value for variable '${key}': path traversal or absolute paths not allowed`
        );
      }
    }
    // INV-GUARD-REGEX-001: Escape key to prevent regex injection
    const escapedKey = escapeRegexChars(key);
    resolved = resolved.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), value);
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
