/**
 * Contract Test Gate
 *
 * Runs contract tests for the required contracts.
 * Fails if contract test files themselves are modified.
 *
 * Invariants:
 * - INV-GUARD-TEST-001: Scope Limiting - only contracts in required_contracts are tested
 * - INV-GUARD-TEST-002: No Test Modification - if contract test files modified, gate MUST FAIL
 * - INV-GUARD-TEST-003: Test Isolation - contract tests run in isolation from other tests
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { TIMEOUT_GATE_CONTRACT_TEST } from '@defai.digital/contracts';
import type { GovernanceContext, GateResult } from '../types.js';

const execAsync = promisify(exec);

/**
 * Maps contract names to test file patterns
 */
const CONTRACT_TEST_FILES: Record<string, string> = {
  workflow: 'tests/contract/workflow.test.ts',
  routing: 'tests/contract/routing.test.ts',
  memory: 'tests/contract/memory.test.ts',
  trace: 'tests/contract/trace.test.ts',
  mcp: 'tests/contract/mcp.test.ts',
};

/**
 * Checks if any contract test files were modified
 * INV-GUARD-TEST-002: No Test Modification - detect forbidden changes
 */
function checkTestFileModifications(
  changedFiles: string[],
  requiredContracts: string[]
): string[] {
  const modified: string[] = [];

  for (const contract of requiredContracts) {
    const testFile = CONTRACT_TEST_FILES[contract];
    if (testFile !== undefined && changedFiles.includes(testFile)) {
      modified.push(testFile);
    }
  }

  return modified;
}

/**
 * Runs vitest for specific contract tests
 */
async function runContractTests(
  contracts: string[]
): Promise<{ passed: boolean; output: string; error?: string }> {
  if (contracts.length === 0) {
    return { passed: true, output: 'No contracts to test' };
  }

  const testFiles = contracts
    .map((c) => CONTRACT_TEST_FILES[c])
    .filter((f): f is string => f !== undefined);

  if (testFiles.length === 0) {
    return { passed: true, output: 'No test files found for specified contracts' };
  }

  try {
    const { stdout } = await execAsync(
      `npx vitest run ${testFiles.join(' ')} --reporter=line`,
      { cwd: process.cwd(), timeout: TIMEOUT_GATE_CONTRACT_TEST }
    );

    return { passed: true, output: stdout };
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      const stdout = (error as { stdout: string }).stdout || '';
      return { passed: false, output: stdout };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return { passed: false, output: '', error: message };
  }
}

/**
 * Executes the contract test gate
 * INV-GUARD-TEST-001: Scope Limiting - only required contracts tested
 * INV-GUARD-TEST-002: No Test Modification - FAIL if test files modified
 * INV-GUARD-TEST-003: Test Isolation - tests run independently
 */
export async function contractTestGate(
  context: GovernanceContext,
  changedFiles: string[]
): Promise<GateResult> {
  const requiredContracts = context.requiredContracts;

  if (requiredContracts.length === 0) {
    return {
      gate: 'contract_tests',
      status: 'PASS',
      message: 'No required contracts specified',
    };
  }

  // Check if contract test files were modified (forbidden)
  const modifiedTestFiles = checkTestFileModifications(
    changedFiles,
    requiredContracts
  );

  if (modifiedTestFiles.length > 0) {
    return {
      gate: 'contract_tests',
      status: 'FAIL',
      message: 'Contract test files were modified (forbidden)',
      details: {
        modifiedTestFiles,
        reason:
          'Contract tests are the source of truth and must not be modified during feature work',
      },
    };
  }

  // Run the contract tests
  const result = await runContractTests(requiredContracts);

  if (result.error !== undefined) {
    return {
      gate: 'contract_tests',
      status: 'WARN',
      message: `Contract tests could not complete: ${result.error}`,
      details: { error: result.error },
    };
  }

  if (result.passed) {
    return {
      gate: 'contract_tests',
      status: 'PASS',
      message: `Contract tests passed for: ${requiredContracts.join(', ')}`,
      details: { contracts: requiredContracts },
    };
  }

  return {
    gate: 'contract_tests',
    status: 'FAIL',
    message: `Contract tests failed for: ${requiredContracts.join(', ')}`,
    details: {
      contracts: requiredContracts,
      output: result.output.slice(0, 2000), // Limit output size
    },
  };
}
