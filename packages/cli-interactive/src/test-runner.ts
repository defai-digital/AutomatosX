/**
 * Test Runner
 *
 * Detects and runs tests with multiple frameworks (Jest, Vitest, Mocha, etc.)
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface TestFramework {
  name: string;
  command: string;
  configFile?: string;
}

export interface TestOptions {
  files?: string[];
  watch?: boolean;
  filter?: string;
  coverage?: boolean;
  verbose?: boolean;
}

export interface TestResults {
  framework: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
}

export interface CoverageMetric {
  covered: number;
  total: number;
  percentage: number;
}

export interface CoverageResults {
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
}

export class TestRunner {
  constructor(private workspaceRoot: string) {}

  /**
   * Detect test framework
   */
  async detectFramework(): Promise<TestFramework | null> {
    const packageJsonPath = join(this.workspaceRoot, 'package.json');

    if (!existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check for frameworks in order of preference
      if (deps['vitest']) {
        return {
          name: 'vitest',
          command: 'vitest',
          configFile: this.findConfig(['vitest.config.ts', 'vitest.config.js'])
        };
      }

      if (deps['jest']) {
        return {
          name: 'jest',
          command: 'jest',
          configFile: this.findConfig(['jest.config.js', 'jest.config.ts', 'jest.config.json'])
        };
      }

      if (deps['mocha']) {
        return {
          name: 'mocha',
          command: 'mocha',
          configFile: this.findConfig(['.mocharc.json', '.mocharc.js'])
        };
      }

      if (deps['ava']) {
        return {
          name: 'ava',
          command: 'ava',
          configFile: this.findConfig(['ava.config.js'])
        };
      }

      // Check for test script
      if (packageJson.scripts?.test) {
        const testScript = packageJson.scripts.test;
        if (testScript.includes('node --test') || testScript.includes('node:test')) {
          return {
            name: 'node',
            command: 'node',
            configFile: undefined
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Run tests
   */
  async runTests(options: TestOptions = {}): Promise<TestResults> {
    const framework = await this.detectFramework();

    if (!framework) {
      throw new Error('No test framework detected. Install jest, vitest, mocha, or ava.');
    }

    return this.executeTests(framework, options);
  }

  /**
   * Run coverage
   */
  async runCoverage(options: { files?: string[] } = {}): Promise<CoverageResults> {
    const framework = await this.detectFramework();

    if (!framework) {
      throw new Error('No test framework detected.');
    }

    const args = this.buildCoverageArgs(framework, options);
    const result = await this.executeCommand(framework.command, args);

    return this.parseCoverageOutput(result.stdout, framework.name);
  }

  /**
   * Execute tests
   */
  private async executeTests(framework: TestFramework, options: TestOptions): Promise<TestResults> {
    const args = this.buildTestArgs(framework, options);
    const result = await this.executeCommand(framework.command, args);

    return this.parseTestOutput(result.stdout + result.stderr, framework.name);
  }

  /**
   * Build test arguments
   */
  private buildTestArgs(framework: TestFramework, options: TestOptions): string[] {
    const args: string[] = [];

    switch (framework.name) {
      case 'vitest':
        args.push('run'); // Non-watch mode
        if (options.coverage) args.push('--coverage');
        if (options.filter) args.push('--grep', options.filter);
        if (options.watch) args.push('--watch');
        break;

      case 'jest':
        if (options.coverage) args.push('--coverage');
        if (options.filter) args.push('--testNamePattern', options.filter);
        if (options.watch) args.push('--watch');
        if (options.verbose) args.push('--verbose');
        break;

      case 'mocha':
        if (options.filter) args.push('--grep', options.filter);
        if (options.watch) args.push('--watch');
        break;

      case 'ava':
        if (options.filter) args.push('--match', options.filter);
        if (options.watch) args.push('--watch');
        break;

      case 'node':
        args.push('--test');
        break;
    }

    if (options.files && options.files.length > 0) {
      args.push(...options.files);
    }

    return args;
  }

  /**
   * Build coverage arguments
   */
  private buildCoverageArgs(framework: TestFramework, options: { files?: string[] }): string[] {
    const args: string[] = [];

    switch (framework.name) {
      case 'vitest':
        args.push('run', '--coverage');
        break;

      case 'jest':
        args.push('--coverage');
        break;

      default:
        args.push('--coverage');
    }

    if (options.files && options.files.length > 0) {
      args.push(...options.files);
    }

    return args;
  }

  /**
   * Parse test output
   */
  private parseTestOutput(output: string, framework: string): TestResults {
    const results: TestResults = {
      framework,
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0
    };

    // Parse Jest/Vitest output
    if (framework === 'jest' || framework === 'vitest') {
      const passMatch = output.match(/(\d+)\s+passed/i);
      const failMatch = output.match(/(\d+)\s+failed/i);
      const skipMatch = output.match(/(\d+)\s+skipped/i);
      const timeMatch = output.match(/([\d.]+)\s*s/);

      if (passMatch) results.passed = parseInt(passMatch[1] || '0', 10);
      if (failMatch) results.failed = parseInt(failMatch[1] || '0', 10);
      if (skipMatch) results.skipped = parseInt(skipMatch[1] || '0', 10);
      if (timeMatch) results.duration = parseFloat(timeMatch[1] || '0');

      results.total = results.passed + results.failed + results.skipped;
    }

    // Parse Mocha output
    else if (framework === 'mocha') {
      const passMatch = output.match(/(\d+)\s+passing/i);
      const failMatch = output.match(/(\d+)\s+failing/i);
      const pendingMatch = output.match(/(\d+)\s+pending/i);
      const timeMatch = output.match(/([\d.]+)ms/);

      if (passMatch) results.passed = parseInt(passMatch[1] || '0', 10);
      if (failMatch) results.failed = parseInt(failMatch[1] || '0', 10);
      if (pendingMatch) results.skipped = parseInt(pendingMatch[1] || '0', 10);
      if (timeMatch) results.duration = parseFloat(timeMatch[1] || '0') / 1000;

      results.total = results.passed + results.failed + results.skipped;
    }

    // If no results parsed, try to detect success/failure
    if (results.total === 0) {
      if (output.toLowerCase().includes('all tests passed')) {
        results.passed = 1;
        results.total = 1;
      } else if (output.toLowerCase().includes('fail')) {
        results.failed = 1;
        results.total = 1;
      }
    }

    return results;
  }

  /**
   * Parse coverage output
   */
  private parseCoverageOutput(output: string, framework: string): CoverageResults {
    const defaultMetric: CoverageMetric = {
      covered: 0,
      total: 0,
      percentage: 0
    };

    const results: CoverageResults = {
      statements: { ...defaultMetric },
      branches: { ...defaultMetric },
      functions: { ...defaultMetric },
      lines: { ...defaultMetric }
    };

    // Try to parse Istanbul/c8 style output
    const stmtMatch = output.match(/Statements\s*:\s*([\d.]+)%\s*\(\s*(\d+)\/(\d+)\s*\)/);
    const branchMatch = output.match(/Branches\s*:\s*([\d.]+)%\s*\(\s*(\d+)\/(\d+)\s*\)/);
    const funcMatch = output.match(/Functions\s*:\s*([\d.]+)%\s*\(\s*(\d+)\/(\d+)\s*\)/);
    const lineMatch = output.match(/Lines\s*:\s*([\d.]+)%\s*\(\s*(\d+)\/(\d+)\s*\)/);

    if (stmtMatch) {
      results.statements = {
        percentage: parseFloat(stmtMatch[1] || '0'),
        covered: parseInt(stmtMatch[2] || '0', 10),
        total: parseInt(stmtMatch[3] || '0', 10)
      };
    }

    if (branchMatch) {
      results.branches = {
        percentage: parseFloat(branchMatch[1] || '0'),
        covered: parseInt(branchMatch[2] || '0', 10),
        total: parseInt(branchMatch[3] || '0', 10)
      };
    }

    if (funcMatch) {
      results.functions = {
        percentage: parseFloat(funcMatch[1] || '0'),
        covered: parseInt(funcMatch[2] || '0', 10),
        total: parseInt(funcMatch[3] || '0', 10)
      };
    }

    if (lineMatch) {
      results.lines = {
        percentage: parseFloat(lineMatch[1] || '0'),
        covered: parseInt(lineMatch[2] || '0', 10),
        total: parseInt(lineMatch[3] || '0', 10)
      };
    }

    return results;
  }

  /**
   * Execute command
   */
  private async executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // BUG #32 FIX: Disable shell execution to prevent command injection
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false  // SECURITY: Prevent command injection via user-supplied filters
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1
        });
      });

      proc.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Find config file
   */
  private findConfig(candidates: string[]): string | undefined {
    for (const candidate of candidates) {
      const path = join(this.workspaceRoot, candidate);
      if (existsSync(path)) {
        return candidate;
      }
    }
    return undefined;
  }
}
