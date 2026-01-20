/**
 * Gate Executor
 *
 * Orchestrates the execution of governance gates and produces results.
 *
 * Invariants:
 * - INV-GUARD-004: Order Independence - gates may execute in any order
 * - INV-GUARD-005: Fail Fast Option - implementation may stop on first FAIL
 * - INV-GUARD-006: No Side Effects - gate execution must not modify files
 * - INV-GUARD-RES-001: Status Determination - FAIL > WARN > PASS
 * - INV-GUARD-RES-002: Suggestion Quality - every FAIL has actionable suggestion
 * - INV-GUARD-RES-003: Traceability - all results include timestamp
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  GovernanceContext,
  GateResult,
  GuardResult,
  GateType,
  GateExecutor,
} from './types.js';
import { pathViolationGate } from './gates/path.js';
import { changeRadiusGate } from './gates/change-radius.js';
import { dependencyGate } from './gates/dependency.js';
import { contractTestGate } from './gates/contract-tests.js';
import { configValidationGate, sensitiveChangeGate } from './gates/config.js';
import { secretsDetectionGate } from './gates/secrets.js';
import { taskClassifierGate } from './gates/task-classifier.js';

const execAsync = promisify(exec);

/**
 * Agent selection gate wrapper
 *
 * The agent_selection gate is designed to be used with specific selection context
 * via the agentSelectionGate function. In the standard gate execution flow (which
 * operates on changed files), it returns PASS as a placeholder.
 *
 * For actual agent selection validation, use agentSelectionGate directly with
 * the AgentSelectionGateContext parameter.
 */
const agentSelectionGateWrapper: GateExecutor = async () => {
  return {
    gate: 'agent_selection',
    status: 'PASS',
    message: 'Agent selection gate requires specific selection context; use agentSelectionGate directly',
  };
};

/**
 * Gate registry
 */
const GATES: Record<GateType, GateExecutor> = {
  path_violation: pathViolationGate,
  change_radius: changeRadiusGate,
  dependency: dependencyGate,
  contract_tests: contractTestGate,
  config_validation: configValidationGate,
  sensitive_change: sensitiveChangeGate,
  secrets_detection: secretsDetectionGate,
  agent_selection: agentSelectionGateWrapper,
  task_classifier: taskClassifierGate,
};

/**
 * Validates a git branch name to prevent command injection
 * INV-GUARD-SEC-001: Sanitize git branch names before shell execution
 */
function isValidGitBranchName(branch: string): boolean {
  // Git branch names cannot contain: space, ~, ^, :, ?, *, [, \, control chars
  // Also reject shell metacharacters: ;, |, &, $, `, (, ), {, }, <, >, ', "
  const invalidChars = /[\s~^:?*[\]\\;|&$`(){}><'"]/;
  return branch.length > 0 && branch.length <= 255 && !invalidChars.test(branch);
}

/**
 * Gets list of changed files from git
 * INV-GUARD-SEC-001: Branch names are validated before use in shell commands
 */
export async function getChangedFiles(baseBranch: string): Promise<string[]> {
  try {
    // Validate branch name to prevent command injection
    if (!isValidGitBranchName(baseBranch)) {
      throw new Error(`Invalid branch name: "${baseBranch}"`);
    }

    const { stdout } = await execAsync(
      `git diff --name-only ${baseBranch}...HEAD`,
      { cwd: process.cwd() }
    );

    return stdout
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  } catch {
    // Fallback to comparing with HEAD~1 if branch comparison fails
    try {
      const { stdout } = await execAsync('git diff --name-only HEAD~1', {
        cwd: process.cwd(),
      });

      return stdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0);
    } catch {
      // If that also fails, check staged files
      // INV-GUARD-SEC-002: Final fallback wrapped in try-catch
      try {
        const { stdout } = await execAsync('git diff --name-only --cached', {
          cwd: process.cwd(),
        });

        return stdout
          .trim()
          .split('\n')
          .filter((f) => f.length > 0);
      } catch {
        // Not in a git repository or git unavailable - return empty array
        console.warn('[guard] Unable to get changed files from git - not in a git repository?');
        return [];
      }
    }
  }
}

/**
 * Generates suggestions based on gate failures
 * INV-GUARD-RES-002: Every FAIL result must include actionable suggestions
 */
interface PathViolationDetails {
  forbiddenPathViolations?: string[];
  outsideAllowedPaths?: string[];
}

interface ContractTestDetails {
  modifiedTestFiles?: string[];
}

interface SecretsDetectionDetails {
  secrets?: {
    file: string;
    line: number;
    type: string;
    severity: string;
  }[];
}

function generateSuggestions(gateResults: GateResult[]): string[] {
  const suggestions: string[] = [];

  for (const result of gateResults) {
    if (result.status !== 'FAIL') continue;

    switch (result.gate) {
      case 'path_violation': {
        const details = result.details as PathViolationDetails | undefined;
        const forbidden = details?.forbiddenPathViolations;
        if (forbidden !== undefined && forbidden.length > 0) {
          suggestions.push(
            `Revert changes to forbidden paths: ${forbidden.slice(0, 3).join(', ')}`
          );
        }
        const outside = details?.outsideAllowedPaths;
        if (outside !== undefined && outside.length > 0) {
          suggestions.push(
            'Move changes to allowed paths or update the policy scope'
          );
        }
        break;
      }
      case 'change_radius': {
        suggestions.push('Split changes into smaller, focused PRs');
        suggestions.push('Each PR should modify fewer packages');
        break;
      }
      case 'dependency': {
        suggestions.push('Fix import statements to respect layer boundaries');
        suggestions.push('Check .dependency-cruiser.cjs for allowed patterns');
        break;
      }
      case 'contract_tests': {
        const details = result.details as ContractTestDetails | undefined;
        const modified = details?.modifiedTestFiles;
        if (modified !== undefined && modified.length > 0) {
          suggestions.push('Do not modify contract test files during feature work');
          suggestions.push('Contract tests are the source of truth');
        } else {
          suggestions.push('Fix the code to pass contract tests');
          suggestions.push('Run: pnpm test:contract to see failures');
        }
        break;
      }
      case 'config_validation': {
        suggestions.push('Validate config with: ax config show');
        suggestions.push('Ensure config.json is valid JSON matching the schema');
        suggestions.push('Run: ax doctor to verify configuration');
        break;
      }
      case 'sensitive_change': {
        suggestions.push('Review security-sensitive config changes carefully');
        suggestions.push('Consider the impact of disabling tracing or guard');
        suggestions.push('Document reasons for sensitive config changes');
        break;
      }
      case 'secrets_detection': {
        const details = result.details as SecretsDetectionDetails | undefined;
        const secrets = details?.secrets;
        if (secrets !== undefined && secrets.length > 0) {
          // Show first few secret locations
          const locations = secrets.slice(0, 3).map(s => `${s.file}:${s.line}`);
          suggestions.push(`Remove hardcoded secrets from: ${locations.join(', ')}`);
        }
        suggestions.push('Use environment variables or secret management for credentials');
        suggestions.push('Add false positives to .secretsignore file if needed');
        break;
      }
      case 'agent_selection': {
        suggestions.push('Verify the selected agent is enabled and has required capabilities');
        suggestions.push('Check agent selection confidence threshold in policy');
        suggestions.push('Ensure agent is not in the excluded list');
        break;
      }
    }
  }

  return [...new Set(suggestions)]; // Deduplicate
}

/**
 * Executes all enabled gates for a governance context
 *
 * INV-GUARD-004: Order Independence - results consistent regardless of order
 * INV-GUARD-006: No Side Effects - no files or state modified
 * INV-GUARD-RES-001: Status = FAIL if any gate FAILs, WARN if any WARN, else PASS
 * INV-GUARD-RES-003: Result includes timestamp for traceability
 */
export async function executeGates(
  context: GovernanceContext,
  changedFiles: string[]
): Promise<GuardResult> {
  // INV-GUARD-004: Order Independence - gates can be executed in parallel
  // INV-GUARD-006: No Side Effects - parallel execution is safe
  // INV-GUARD-SEC-003: Validate gate types and handle errors gracefully
  const gateResults = await Promise.all(
    context.enabledGates.map(async (gateType) => {
      const gate = GATES[gateType];
      // Validate gate exists
      if (!gate) {
        console.warn(`[guard] Unknown gate type: "${gateType}", skipping`);
        return {
          gate: gateType,
          status: 'WARN' as const,
          message: `Unknown gate type: ${gateType}`,
          details: { error: 'Gate not found in registry' },
        };
      }
      // Catch errors from individual gates to prevent masking other results
      try {
        return await gate(context, changedFiles);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[guard] Gate "${gateType}" threw error: ${errorMessage}`);
        return {
          gate: gateType,
          status: 'FAIL' as const,
          message: `Gate execution failed: ${errorMessage}`,
          details: { error: errorMessage },
        };
      }
    })
  );

  // Determine overall status
  const hasFail = gateResults.some((r) => r.status === 'FAIL');
  const hasWarn = gateResults.some((r) => r.status === 'WARN');

  let status: 'PASS' | 'FAIL' | 'WARN';
  if (hasFail) {
    status = 'FAIL';
  } else if (hasWarn) {
    status = 'WARN';
  } else {
    status = 'PASS';
  }

  // Generate summary
  const passed = gateResults.filter((r) => r.status === 'PASS').length;
  const failed = gateResults.filter((r) => r.status === 'FAIL').length;
  const warned = gateResults.filter((r) => r.status === 'WARN').length;

  let summary: string;
  if (status === 'PASS') {
    summary = `All ${String(gateResults.length)} governance checks passed`;
  } else if (status === 'FAIL') {
    summary = `${String(failed)} check(s) failed, ${String(passed)} passed`;
  } else {
    summary = `${String(warned)} warning(s), ${String(passed)} passed`;
  }

  return {
    status,
    policyId: context.policyId,
    target: context.target,
    gates: gateResults,
    summary,
    suggestions: generateSuggestions(gateResults),
    timestamp: new Date().toISOString(),
  };
}
