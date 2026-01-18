/**
 * Test Runner
 *
 * Execute and parse test results for the autonomous loop.
 *
 * Invariants:
 * - INV-ALO-002: Test phase required before verify (when requireTestPass=true)
 * - INV-ALO-010: Timeout per phase
 */

import type { TestResult } from '@defai.digital/contracts';
import type { TestRunnerPort } from './types.js';

/**
 * Pattern matchers for common test frameworks
 */
const TEST_PATTERNS = {
  vitest: {
    total: /Tests\s+(\d+)\s+passed|(\d+)\s+failed/i,
    passed: /(\d+)\s+passed/i,
    failed: /(\d+)\s+failed/i,
    skipped: /(\d+)\s+skipped/i,
    failedName: /FAIL\s+(.+)$/gm,
    success: /Test Files\s+\d+\s+passed/i,
  },
  jest: {
    total: /Tests:\s+(\d+)\s+total/i,
    passed: /(\d+)\s+passed/i,
    failed: /(\d+)\s+failed/i,
    skipped: /(\d+)\s+skipped/i,
    failedName: /FAIL\s+(.+)$/gm,
    success: /Tests:\s+\d+\s+passed,\s+\d+\s+total/i,
  },
  pytest: {
    total: /(\d+)\s+(passed|failed|error)/gi,
    passed: /(\d+)\s+passed/i,
    failed: /(\d+)\s+failed/i,
    skipped: /(\d+)\s+skipped/i,
    failedName: /FAILED\s+(.+)::/gm,
    success: /passed/i,
  },
  generic: {
    total: /(\d+)\s+test/i,
    passed: /(\d+)\s+pass/i,
    failed: /(\d+)\s+fail/i,
    skipped: /(\d+)\s+skip/i,
    failedName: /(fail|error).*?:\s*(.+)$/gim,
    success: /all.*pass|0\s+fail/i,
  },
};

/**
 * Detect test framework from command or output
 */
export function detectTestFramework(
  command: string,
  output?: string
): keyof typeof TEST_PATTERNS {
  const lowerCommand = command.toLowerCase();
  const lowerOutput = (output ?? '').toLowerCase();

  if (lowerCommand.includes('vitest') || lowerOutput.includes('vitest')) {
    return 'vitest';
  }
  if (lowerCommand.includes('jest') || lowerOutput.includes('jest')) {
    return 'jest';
  }
  if (lowerCommand.includes('pytest') || lowerOutput.includes('pytest')) {
    return 'pytest';
  }

  return 'generic';
}

/**
 * Parse test output to extract results
 */
export function parseTestOutput(
  output: string,
  framework?: keyof typeof TEST_PATTERNS
): {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  failedTestNames: string[];
} {
  const patterns = TEST_PATTERNS[framework ?? 'generic'];

  // Extract counts
  const passedMatch = output.match(patterns.passed);
  const failedMatch = output.match(patterns.failed);
  const skippedMatch = output.match(patterns.skipped);

  const passedTests = passedMatch ? parseInt(passedMatch[1] ?? '0', 10) : 0;
  const failedTests = failedMatch ? parseInt(failedMatch[1] ?? '0', 10) : 0;
  const skippedTests = skippedMatch ? parseInt(skippedMatch[1] ?? '0', 10) : 0;
  const totalTests = passedTests + failedTests + skippedTests;

  // Extract failed test names
  // Create a fresh regex to avoid lastIndex state issues from global flag
  const failedTestNames: string[] = [];
  const failedNamePattern = new RegExp(patterns.failedName.source, patterns.failedName.flags);
  // Determine effective framework (undefined defaults to 'generic')
  const effectiveFramework = framework ?? 'generic';
  let match;
  while ((match = failedNamePattern.exec(output)) !== null) {
    // For generic pattern, match[2] contains the test name; for others, match[1]
    const testName = effectiveFramework === 'generic'
      ? (match[2]?.trim() ?? 'unknown')
      : (match[1]?.trim() ?? 'unknown');
    failedTestNames.push(testName);
  }

  return {
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    failedTestNames,
  };
}

/**
 * Check if output indicates test success
 */
export function isTestSuccess(
  output: string,
  framework?: keyof typeof TEST_PATTERNS
): boolean {
  const patterns = TEST_PATTERNS[framework ?? 'generic'];

  // Check for explicit success pattern
  if (patterns.success.test(output)) {
    return true;
  }

  // Check for no failures
  const parsed = parseTestOutput(output, framework);
  return parsed.failedTests === 0 && parsed.totalTests > 0;
}

/**
 * Create a stub test runner port
 */
export function createStubTestRunnerPort(): TestRunnerPort {
  return {
    async runTests(): Promise<TestResult> {
      console.warn(
        '[autonomous-loop] Using stub test runner - no real tests executed. ' +
        'Inject a real TestRunnerPort for production use.'
      );

      return {
        passed: true,
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
        skippedTests: 0,
        durationMs: 100,
        errorOutput: undefined,
        failedTestNames: [],
      };
    },

    parseOutput(output: string) {
      return parseTestOutput(output);
    },
  };
}

/**
 * Create test result from execution output
 */
export function createTestResult(
  output: string,
  exitCode: number,
  durationMs: number,
  command?: string
): TestResult {
  const framework = detectTestFramework(command ?? '', output);
  const parsed = parseTestOutput(output, framework);
  const passed = exitCode === 0 && parsed.failedTests === 0;

  return {
    passed,
    totalTests: parsed.totalTests,
    passedTests: parsed.passedTests,
    failedTests: parsed.failedTests,
    skippedTests: parsed.skippedTests,
    durationMs,
    errorOutput: passed ? undefined : output.slice(-10000), // Keep last 10k chars
    failedTestNames: parsed.failedTestNames,
  };
}

/**
 * Create a failing test result
 */
export function createFailedTestResult(
  error: string,
  durationMs: number
): TestResult {
  return {
    passed: false,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    durationMs,
    errorOutput: error,
    failedTestNames: [],
  };
}

/**
 * Create a passing test result (for skipped tests)
 */
export function createPassingTestResult(durationMs: number = 0): TestResult {
  return {
    passed: true,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    durationMs,
    errorOutput: undefined,
    failedTestNames: [],
  };
}

/**
 * Format test result for display
 */
export function formatTestResult(result: TestResult): string {
  const lines: string[] = [];

  if (result.passed) {
    lines.push(`✅ Tests passed (${result.passedTests}/${result.totalTests})`);
  } else {
    lines.push(`❌ Tests failed (${result.failedTests}/${result.totalTests})`);
  }

  lines.push(`Duration: ${result.durationMs}ms`);

  if (result.skippedTests > 0) {
    lines.push(`Skipped: ${result.skippedTests}`);
  }

  if (result.failedTestNames && result.failedTestNames.length > 0) {
    lines.push('Failed tests:');
    for (const name of result.failedTestNames.slice(0, 10)) {
      lines.push(`  - ${name}`);
    }
    if (result.failedTestNames.length > 10) {
      lines.push(`  ... and ${result.failedTestNames.length - 10} more`);
    }
  }

  return lines.join('\n');
}

/**
 * Get test failure summary for agent context
 */
export function getTestFailureSummary(result: TestResult): string {
  if (result.passed) {
    return 'All tests passed';
  }

  const lines: string[] = [
    `${result.failedTests} test(s) failed out of ${result.totalTests}`,
  ];

  if (result.failedTestNames && result.failedTestNames.length > 0) {
    lines.push('Failed tests:');
    for (const name of result.failedTestNames) {
      lines.push(`- ${name}`);
    }
  }

  if (result.errorOutput) {
    lines.push('\nError output:');
    lines.push(result.errorOutput.slice(-5000)); // Last 5k chars
  }

  return lines.join('\n');
}
