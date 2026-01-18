/**
 * Guard Integration
 *
 * Integration with the guard package for policy enforcement.
 *
 * Invariants:
 * - INV-ALO-001: Guard gates run after EVERY write phase
 * - INV-ALO-009: Guard block stops execution
 */

import type {
  AutonomousLoopState,
  GuardCheckResult,
  GuardGateResult,
} from '@defai.digital/contracts';
import type { GuardPort } from './types.js';

/**
 * Default stub guard port for when no guard is configured
 */
export function createStubGuardPort(): GuardPort {
  return {
    async check({ policyId, changedPaths }): Promise<GuardCheckResult> {
      // Warn that stub is being used
      console.warn(
        '[autonomous-loop] Using stub guard - no real policy enforcement. ' +
        'Inject a real GuardPort for production use.'
      );

      return {
        policyId,
        passed: true,
        blocked: false,
        gateResults: [],
        summary: `Stub check: ${changedPaths.length} paths would be checked`,
        checkedAt: new Date().toISOString(),
      };
    },

    async listPolicies(): Promise<string[]> {
      return ['autonomous-development'];
    },
  };
}

/**
 * Run guard check for loop state
 * INV-ALO-001: Guard gates run after EVERY write phase
 */
export async function runGuardCheck(
  guard: GuardPort,
  state: AutonomousLoopState
): Promise<GuardCheckResult> {
  const { config, changedFiles } = state;

  // If no policy configured, return passing result
  if (!config.guardPolicy) {
    return {
      policyId: 'none',
      passed: true,
      blocked: false,
      gateResults: [],
      summary: 'No guard policy configured',
      checkedAt: new Date().toISOString(),
    };
  }

  // If no changed files, skip guard check
  if (changedFiles.length === 0) {
    return {
      policyId: config.guardPolicy,
      passed: true,
      blocked: false,
      gateResults: [],
      summary: 'No changed files to check',
      checkedAt: new Date().toISOString(),
    };
  }

  // Run the guard check
  return guard.check({
    policyId: config.guardPolicy,
    changedPaths: changedFiles,
  });
}

/**
 * Check if guard result should block execution
 * INV-ALO-009: Guard block stops execution
 */
export function shouldBlockExecution(result: GuardCheckResult): boolean {
  return result.blocked || hasBlockingViolations(result.gateResults);
}

/**
 * Check if any gate results have blocking violations
 */
export function hasBlockingViolations(gateResults: GuardGateResult[]): boolean {
  return gateResults.some(
    (gate) => !gate.passed && gate.severity === 'error'
  );
}

/**
 * Get summary of guard violations
 */
export function getViolationSummary(result: GuardCheckResult): string {
  const violations: string[] = [];

  for (const gate of result.gateResults) {
    if (!gate.passed && gate.violations) {
      for (const violation of gate.violations) {
        violations.push(`[${gate.gateId}] ${violation.message}`);
      }
    }
  }

  if (violations.length === 0) {
    return result.summary ?? 'No violations';
  }

  return violations.join('\n');
}

/**
 * Create guard result for when guard is disabled
 */
export function createDisabledGuardResult(): GuardCheckResult {
  return {
    policyId: 'disabled',
    passed: true,
    blocked: false,
    gateResults: [],
    summary: 'Guard checks disabled',
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Create guard result for error
 */
export function createErrorGuardResult(
  policyId: string,
  error: string
): GuardCheckResult {
  return {
    policyId,
    passed: false,
    blocked: true,
    gateResults: [
      {
        gateId: 'error',
        passed: false,
        severity: 'error',
        message: error,
      },
    ],
    summary: `Guard check failed: ${error}`,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Merge guard results from multiple iterations
 */
export function mergeGuardResults(
  results: GuardCheckResult[]
): GuardCheckResult {
  if (results.length === 0) {
    return createDisabledGuardResult();
  }

  const firstResult = results[0];
  if (!firstResult) {
    return createDisabledGuardResult();
  }

  if (results.length === 1) {
    return firstResult;
  }

  const allGateResults: GuardGateResult[] = [];
  let anyBlocked = false;
  let allPassed = true;

  for (const result of results) {
    allGateResults.push(...result.gateResults);
    if (result.blocked) anyBlocked = true;
    if (!result.passed) allPassed = false;
  }

  return {
    policyId: firstResult.policyId,
    passed: allPassed,
    blocked: anyBlocked,
    gateResults: allGateResults,
    summary: `Merged ${results.length} guard checks: ${allPassed ? 'all passed' : 'some failed'}`,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Default autonomous development policy configuration
 */
export const AUTONOMOUS_DEVELOPMENT_POLICY = {
  policyId: 'autonomous-development',
  description: 'Policy for autonomous code development loops',
  allowedPaths: ['src/**', 'tests/**', 'lib/**'],
  forbiddenPaths: [
    '**/.env*',
    '**/secrets*',
    '**/credentials*',
    'node_modules/**',
    '.git/**',
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
  ],
  gates: [
    'path_violation',
    'secrets_detection',
    'change_radius',
    'autonomous_safety',
  ],
  changeRadiusLimit: 5,
} as const;
