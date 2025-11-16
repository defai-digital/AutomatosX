/**
 * Lint & Formatter Manager
 *
 * Detects and runs linters (ESLint) and formatters (Prettier)
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface Linter {
  name: string;
  command: string;
  configFile?: string;
}

export interface Formatter {
  name: string;
  command: string;
  configFile?: string;
}

export interface LintOptions {
  files?: string[];
  fix?: boolean;
  quiet?: boolean;
}

export interface FormatOptions {
  files?: string[];
  check?: boolean;
  write?: boolean;
}

export interface LintMessage {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  rule?: string;
}

export interface FileLintResults {
  file: string;
  errors: number;
  warnings: number;
  messages: LintMessage[];
}

export interface LintResults {
  linter: string;
  totalErrors: number;
  totalWarnings: number;
  files: FileLintResults[];
}

export class LintFormatter {
  constructor(private workspaceRoot: string) {}

  /**
   * Detect linter
   */
  async detectLinter(): Promise<Linter | null> {
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

      if (deps['eslint']) {
        return {
          name: 'eslint',
          command: 'eslint',
          configFile: this.findConfig([
            '.eslintrc.js',
            '.eslintrc.json',
            '.eslintrc.yml',
            '.eslintrc.yaml',
            'eslint.config.js'
          ])
        };
      }

      if (deps['standard']) {
        return {
          name: 'standard',
          command: 'standard',
          configFile: undefined
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect formatter
   */
  async detectFormatter(): Promise<Formatter | null> {
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

      if (deps['prettier']) {
        return {
          name: 'prettier',
          command: 'prettier',
          configFile: this.findConfig([
            '.prettierrc',
            '.prettierrc.json',
            '.prettierrc.js',
            'prettier.config.js'
          ])
        };
      }

      if (deps['dprint']) {
        return {
          name: 'dprint',
          command: 'dprint',
          configFile: this.findConfig(['dprint.json'])
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Run linter
   */
  async lint(options: LintOptions = {}): Promise<LintResults> {
    const linter = await this.detectLinter();

    if (!linter) {
      throw new Error('No linter detected. Install eslint or standard.');
    }

    const args = this.buildLintArgs(linter, options);
    const result = await this.executeCommand(linter.command, args);

    return this.parseLintOutput(result.stdout + result.stderr, linter.name);
  }

  /**
   * Run formatter
   */
  async format(options: FormatOptions = {}): Promise<{ formatted: string[]; unchanged: string[] }> {
    const formatter = await this.detectFormatter();

    if (!formatter) {
      throw new Error('No formatter detected. Install prettier or dprint.');
    }

    const args = this.buildFormatArgs(formatter, options);
    const result = await this.executeCommand(formatter.command, args);

    return this.parseFormatOutput(result.stdout, formatter.name, options.check || false);
  }

  /**
   * Build lint arguments
   */
  private buildLintArgs(linter: Linter, options: LintOptions): string[] {
    const args: string[] = [];

    switch (linter.name) {
      case 'eslint':
        args.push('.');
        if (options.fix) args.push('--fix');
        if (options.quiet) args.push('--quiet');
        args.push('--format', 'json');
        break;

      case 'standard':
        if (options.fix) args.push('--fix');
        break;
    }

    if (options.files && options.files.length > 0) {
      // Replace '.' with specific files
      const dotIndex = args.indexOf('.');
      if (dotIndex >= 0) {
        args.splice(dotIndex, 1, ...options.files);
      } else {
        args.push(...options.files);
      }
    }

    return args;
  }

  /**
   * Build format arguments
   */
  private buildFormatArgs(formatter: Formatter, options: FormatOptions): string[] {
    const args: string[] = [];

    switch (formatter.name) {
      case 'prettier':
        if (options.check) {
          args.push('--check');
        } else if (options.write !== false) {
          args.push('--write');
        }
        args.push('.');
        break;

      case 'dprint':
        if (options.check) {
          args.push('check');
        } else {
          args.push('fmt');
        }
        break;
    }

    if (options.files && options.files.length > 0) {
      const dotIndex = args.indexOf('.');
      if (dotIndex >= 0) {
        args.splice(dotIndex, 1, ...options.files);
      } else {
        args.push(...options.files);
      }
    }

    return args;
  }

  /**
   * Parse lint output
   */
  private parseLintOutput(output: string, linter: string): LintResults {
    const results: LintResults = {
      linter,
      totalErrors: 0,
      totalWarnings: 0,
      files: []
    };

    if (linter === 'eslint') {
      try {
        const eslintResults = JSON.parse(output);

        for (const fileResult of eslintResults) {
          const fileLint: FileLintResults = {
            file: fileResult.filePath,
            errors: fileResult.errorCount || 0,
            warnings: fileResult.warningCount || 0,
            messages: []
          };

          for (const msg of fileResult.messages || []) {
            fileLint.messages.push({
              line: msg.line || 0,
              column: msg.column || 0,
              severity: msg.severity === 2 ? 'error' : 'warning',
              message: msg.message || '',
              rule: msg.ruleId
            });
          }

          if (fileLint.errors > 0 || fileLint.warnings > 0) {
            results.files.push(fileLint);
            results.totalErrors += fileLint.errors;
            results.totalWarnings += fileLint.warnings;
          }
        }
      } catch {
        // Failed to parse JSON, fall back to text parsing
        const errorMatch = output.match(/(\d+)\s+errors?/i);
        const warningMatch = output.match(/(\d+)\s+warnings?/i);

        if (errorMatch) results.totalErrors = parseInt(errorMatch[1] || '0', 10);
        if (warningMatch) results.totalWarnings = parseInt(warningMatch[1] || '0', 10);
      }
    }

    return results;
  }

  /**
   * Parse format output
   */
  private parseFormatOutput(output: string, formatter: string, checkMode: boolean): { formatted: string[]; unchanged: string[] } {
    const formatted: string[] = [];
    const unchanged: string[] = [];

    if (formatter === 'prettier') {
      if (checkMode) {
        // In check mode, prettier lists files that would be formatted
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.trim() && !line.startsWith('Checking')) {
            formatted.push(line.trim());
          }
        }
      } else {
        // In write mode, prettier outputs formatted files
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.trim() && line.includes('.')) {
            formatted.push(line.trim());
          }
        }
      }
    }

    return { formatted, unchanged };
  }

  /**
   * Execute command
   * BUG #43 FIX: Disable shell execution to prevent command injection
   */
  private async executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false  // SECURITY: Prevent command injection via file paths/patterns
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
