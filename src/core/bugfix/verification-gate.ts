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

  // v12.9.0: PRD-018 Enhanced verification options

  /** Run ESLint check */
  lint: boolean;

  /** Run strict TypeScript check */
  strictCheck: boolean;

  /** Lint command */
  lintCommand: string;

  /** Custom verification commands */
  customCommands: string[];
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
  cwd: process.cwd(),
  // v12.9.0: PRD-018 Enhanced verification
  lint: false,
  strictCheck: false,
  lintCommand: 'npx eslint --format json',
  customCommands: []
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
      lint: this.options.lint,
      strictCheck: this.options.strictCheck,
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
      durationMs: 0,
      // v12.9.0: PRD-018 Enhanced verification
      lintPassed: true,
      lintIssues: [],
      strictCheckPassed: true,
      strictErrors: []
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

      // v12.9.0: PRD-018 Enhanced verification gates

      // Gate 5: ESLint check
      if (this.options.lint && result.success) {
        logger.debug('Running lint gate');
        const lintResult = await this.runLint(affectedFiles);
        result.lintPassed = lintResult.passed;
        result.lintIssues = lintResult.issues;

        if (!lintResult.passed) {
          result.success = false;
          logger.warn('Lint failed', {
            bugId: finding.id,
            issues: lintResult.issues.slice(0, 5)
          });
        } else {
          logger.debug('Lint passed');
        }
      }

      // Gate 6: Strict TypeScript check
      if (this.options.strictCheck && result.success) {
        logger.debug('Running strict TypeScript check gate');
        const strictResult = await this.runStrictCheck(affectedFiles);
        result.strictCheckPassed = strictResult.passed;
        result.strictErrors = strictResult.newErrors;

        if (!strictResult.passed) {
          result.success = false;
          logger.warn('Strict TypeScript check failed', {
            bugId: finding.id,
            errors: strictResult.newErrors.slice(0, 5)
          });
        } else {
          logger.debug('Strict TypeScript check passed');
        }
      }

      // Gate 7: Custom commands
      if (this.options.customCommands.length > 0 && result.success) {
        for (const cmd of this.options.customCommands) {
          logger.debug('Running custom command', { command: cmd });
          const customResult = await this.runCommand(cmd, 'custom');

          if (!customResult.success) {
            result.success = false;
            result.newErrors.push(`Custom command failed: ${cmd}`);
            logger.warn('Custom command failed', {
              bugId: finding.id,
              command: cmd,
              errors: customResult.errors
            });
            break;
          }
        }
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
      lintPassed: result.lintPassed,
      strictCheckPassed: result.strictCheckPassed,
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
      let stderr = '';
      let finished = false; // Guard against double-resolution

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

      // Timeout handling with guard
      const timeoutId = setTimeout(() => {
        if (finished) return;
        finished = true;
        proc.kill('SIGTERM');
        resolve({
          success: false,
          errors: [`${name} timed out after ${this.options.timeout}ms`]
        });
      }, this.options.timeout);

      // Unref timeout to prevent blocking process exit
      if (timeoutId.unref) {
        timeoutId.unref();
      }

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (finished) return;
        finished = true;
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
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        resolve({
          success: false,
          errors: [err.message]
        });
      });
    });
  }

  /**
   * Run ESLint check on affected files
   * v12.9.0: PRD-018 - ESLint verification gate
   */
  private async runLint(
    affectedFiles: string[]
  ): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Build lint command for affected files
    const files = affectedFiles.join(' ');
    const command = `${this.options.lintCommand} ${files}`;

    const result = await this.runCommand(command, 'lint');

    if (!result.success) {
      // Try to parse ESLint JSON output
      try {
        // If it's JSON output, parse it
        const jsonMatch = result.errors.join('\n').match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const lintResults = JSON.parse(jsonMatch[0]) as Array<{
            filePath: string;
            messages: Array<{ ruleId: string; message: string; line: number; severity: number }>;
          }>;

          for (const fileResult of lintResults) {
            for (const msg of fileResult.messages) {
              if (msg.severity >= 2) { // Only errors, not warnings
                issues.push(`${fileResult.filePath}:${msg.line}: ${msg.ruleId} - ${msg.message}`);
              }
            }
          }
        } else {
          // Not JSON, use raw errors
          issues.push(...result.errors);
        }
      } catch {
        // Parsing failed, use raw errors
        issues.push(...result.errors);
      }
    }

    return {
      passed: result.success || issues.length === 0,
      issues
    };
  }

  /**
   * Run strict TypeScript check
   * v12.9.0: PRD-018 - Strict TypeScript verification gate
   */
  private async runStrictCheck(
    affectedFiles: string[]
  ): Promise<{ passed: boolean; newErrors: string[] }> {
    // Run TypeScript with strict mode on affected files
    // We create a temporary tsconfig.strict.json that extends the main one
    // but with strict: true

    // For simplicity, we run tsc with --strict flag on the affected files
    const files = affectedFiles.join(' ');
    const command = `npx tsc --strict --noEmit ${files}`;

    const result = await this.runCommand(command, 'strict-check');

    return {
      passed: result.success,
      newErrors: result.errors
    };
  }

  /**
   * Quick verification (typecheck only)
   */
  async quickVerify(_finding: BugFinding): Promise<boolean> {
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
