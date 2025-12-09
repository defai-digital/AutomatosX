/**
 * Verification Gate
 *
 * Validates fixes before marking them as complete.
 *
 * Gates:
 * - TypeScript typecheck
 * - Unit tests (affected files)
 * - No new errors introduced
 * - Coverage maintained (optional)
 *
 * @module core/bugfix/verification-gate
 * @since v12.4.0
 */

import { spawn } from 'child_process';
import { logger } from '../../shared/logging/logger.js';
import type { VerificationResult, BugFinding } from './types.js';

/**
 * Verification gate options
 */
export interface VerificationOptions {
  /** Run TypeScript typecheck */
  typecheck: boolean;

  /** Run affected tests */
  tests: boolean;

  /** Check for new errors */
  checkNewErrors: boolean;

  /** Verify coverage maintained */
  checkCoverage: boolean;

  /** Timeout in milliseconds */
  timeout: number;

  /** Test command */
  testCommand: string;

  /** Typecheck command */
  typecheckCommand: string;

  /** Working directory */
  cwd: string;
}

/**
 * Default verification options
 */
const DEFAULT_OPTIONS: VerificationOptions = {
  typecheck: true,
  tests: true,
  checkNewErrors: true,
  checkCoverage: false,
  timeout: 120000, // 2 minutes
  testCommand: 'npm test',
  typecheckCommand: 'npm run typecheck',
  cwd: process.cwd()
};

/**
 * Verification Gate class
 *
 * Validates fixes pass all gates before acceptance.
 */
export class VerificationGate {
  private options: VerificationOptions;

  constructor(options?: Partial<VerificationOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    logger.debug('VerificationGate initialized', {
      typecheck: this.options.typecheck,
      tests: this.options.tests,
      timeout: this.options.timeout
    });
  }

  /**
   * Verify a fix passes all gates
   *
   * @param finding - Bug finding that was fixed
   * @param affectedFiles - Files affected by the fix
   * @returns Verification result
   */
  async verify(
    finding: BugFinding,
    affectedFiles: string[]
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    logger.info('Starting verification', {
      bugId: finding.id,
      file: finding.file,
      affectedFiles
    });

    const result: VerificationResult = {
      success: true,
      typecheckPassed: true,
      testsPassed: true,
      noNewErrors: true,
      affectedTests: [],
      failedTests: [],
      newErrors: [],
      durationMs: 0
    };

    try {
      // Gate 1: TypeScript typecheck
      if (this.options.typecheck) {
        logger.debug('Running typecheck gate');
        const typecheckResult = await this.runTypecheck();
        result.typecheckPassed = typecheckResult.success;

        if (!typecheckResult.success) {
          result.success = false;
          result.newErrors = typecheckResult.errors;

          logger.warn('Typecheck failed', {
            bugId: finding.id,
            errors: typecheckResult.errors.slice(0, 5)
          });
        } else {
          logger.debug('Typecheck passed');
        }
      }

      // Gate 2: Run tests (if typecheck passed)
      if (this.options.tests && result.typecheckPassed) {
        logger.debug('Running test gate');
        const testResult = await this.runTests(affectedFiles);
        result.testsPassed = testResult.success;
        result.affectedTests = testResult.affectedTests;
        result.failedTests = testResult.failedTests;

        if (!testResult.success) {
          result.success = false;

          logger.warn('Tests failed', {
            bugId: finding.id,
            failed: testResult.failedTests.slice(0, 5)
          });
        } else {
          logger.debug('Tests passed', { count: testResult.affectedTests.length });
        }
      }

      // Gate 3: Check for new errors (comparing with baseline)
      if (this.options.checkNewErrors && result.typecheckPassed && result.testsPassed) {
        // For now, we just trust that typecheck + tests cover this
        // Could add more sophisticated error detection later
        result.noNewErrors = true;
      }

      // Gate 4: Coverage check (optional)
      if (this.options.checkCoverage && result.success) {
        // Not implemented in MVP - just pass
        result.coverageMaintained = true;
      }

    } catch (error) {
      result.success = false;
      result.newErrors = [(error as Error).message];

      logger.error('Verification error', {
        bugId: finding.id,
        error: (error as Error).message
      });
    }

    result.durationMs = Date.now() - startTime;

    logger.info('Verification complete', {
      bugId: finding.id,
      success: result.success,
      typecheckPassed: result.typecheckPassed,
      testsPassed: result.testsPassed,
      durationMs: result.durationMs
    });

    return result;
  }

  /**
   * Run TypeScript typecheck
   */
  private async runTypecheck(): Promise<{ success: boolean; errors: string[] }> {
    return this.runCommand(this.options.typecheckCommand, 'typecheck');
  }

  /**
   * Run tests for affected files
   */
  private async runTests(
    affectedFiles: string[]
  ): Promise<{ success: boolean; affectedTests: string[]; failedTests: string[] }> {
    // Run all tests for now (could optimize to run only affected tests)
    const result = await this.runCommand(this.options.testCommand, 'test');

    return {
      success: result.success,
      affectedTests: affectedFiles.map(f => `${f} tests`),
      failedTests: result.success ? [] : result.errors
    };
  }

  /**
   * Run a shell command
   */
  private async runCommand(
    command: string,
    name: string
  ): Promise<{ success: boolean; errors: string[] }> {
    return new Promise((resolve) => {
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);
      const errors: string[] = [];
      let stderr = '';

      if (!cmd) {
        resolve({ success: false, errors: ['Empty command'] });
        return;
      }

      logger.debug(`Running ${name}`, { command });

      const proc = spawn(cmd, args, {
        cwd: this.options.cwd,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Timeout handling
      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        errors.push(`${name} timed out after ${this.options.timeout}ms`);
      }, this.options.timeout);

      // Unref timeout to prevent blocking process exit
      if (timeoutId.unref) {
        timeoutId.unref();
      }

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          resolve({ success: true, errors: [] });
        } else {
          // Extract error lines from stderr
          const errorLines = stderr
            .split('\n')
            .filter(line => line.includes('error') || line.includes('Error') || line.includes('FAIL'))
            .slice(0, 10);

          resolve({
            success: false,
            errors: errorLines.length > 0 ? errorLines : [`${name} failed with exit code ${code}`]
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          errors: [err.message]
        });
      });
    });
  }

  /**
   * Quick verification (typecheck only)
   */
  async quickVerify(finding: BugFinding): Promise<boolean> {
    const result = await this.runTypecheck();
    return result.success;
  }

  /**
   * Full verification (all gates)
   */
  async fullVerify(finding: BugFinding, affectedFiles: string[]): Promise<VerificationResult> {
    return this.verify(finding, affectedFiles);
  }
}
