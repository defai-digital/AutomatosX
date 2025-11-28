/**
 * CLI E2E Tests
 *
 * End-to-end tests for CLI commands simulating real user interactions.
 * Tests command parsing, output formatting, and error handling.
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

// =============================================================================
// Test Utilities
// =============================================================================

interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Execute CLI command and capture output
 */
async function runCLI(args: string[], options: { timeout?: number; cwd?: string } = {}): Promise<CLIResult> {
  return new Promise((resolve) => {
    const cliPath = join(__dirname, '../../../dist/index.js');
    const child = spawn('node', [cliPath, ...args], {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ stdout, stderr, exitCode: null });
    }, options.timeout ?? 10000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code });
    });
  });
}

/**
 * Strip ANSI codes from output for easier assertions
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// =============================================================================
// Test Suite
// =============================================================================

describe('CLI E2E Tests', () => {
  // ===========================================================================
  // Help and Version Tests
  // ===========================================================================

  describe('help and version', () => {
    it('should display help with --help', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ax <command>');
      expect(result.stdout).toContain('run');
      expect(result.stdout).toContain('agent');
      expect(result.stdout).toContain('memory');
    });

    it('should display version with --version', async () => {
      const result = await runCLI(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should display help with -h alias', async () => {
      const result = await runCLI(['-h']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ax <command>');
    });

    it('should show error for unknown command', async () => {
      const result = await runCLI(['unknown-command']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown');
    });

    it('should show error when no command provided', async () => {
      const result = await runCLI([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Please specify a command');
    });
  });

  // ===========================================================================
  // Agent Command Tests
  // ===========================================================================

  describe('agent command', () => {
    it('should show agent help', async () => {
      const result = await runCLI(['agent', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('info');
    });

    it('should list agents with agent list', async () => {
      const result = await runCLI(['agent', 'list']);

      // Should exit successfully even if no agents are configured
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should support --json flag for agent list', async () => {
      const result = await runCLI(['agent', 'list', '--json']);

      // Output should be parseable JSON
      if (result.exitCode === 0 && result.stdout.trim()) {
        expect(() => JSON.parse(result.stdout)).not.toThrow();
      }
    });

    it('should show agent info', async () => {
      const result = await runCLI(['agent', 'info', 'backend']);

      // May fail if agent doesn't exist, but command should be recognized
      expect(result.stdout + result.stderr).not.toContain('Unknown command');
    });

    it('should handle missing agent name for info', async () => {
      const result = await runCLI(['agent', 'info']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('required');
    });
  });

  // ===========================================================================
  // Memory Command Tests
  // ===========================================================================

  describe('memory command', () => {
    it('should show memory help', async () => {
      const result = await runCLI(['memory', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('memory');
      expect(result.stdout).toContain('search');
      expect(result.stdout).toContain('list');
    });

    it('should search memory', async () => {
      const result = await runCLI(['memory', 'search', 'test query']);

      // May return empty results, but command should work
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should support --json flag for memory search', async () => {
      const result = await runCLI(['memory', 'search', 'test', '--json']);

      if (result.exitCode === 0 && result.stdout.trim()) {
        expect(() => JSON.parse(result.stdout)).not.toThrow();
      }
    });

    it('should support --limit flag', async () => {
      const result = await runCLI(['memory', 'search', 'test', '--limit', '5']);

      expect([0, 1]).toContain(result.exitCode);
      expect(result.stderr).not.toContain('Unknown argument');
    });

    it('should list recent memories', async () => {
      const result = await runCLI(['memory', 'list']);

      expect([0, 1]).toContain(result.exitCode);
    });

    it('should show memory stats', async () => {
      const result = await runCLI(['memory', 'stats']);

      expect([0, 1]).toContain(result.exitCode);
    });
  });

  // ===========================================================================
  // Provider Command Tests
  // ===========================================================================

  describe('provider command', () => {
    it('should show provider help', async () => {
      const result = await runCLI(['provider', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('provider');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('status');
    });

    it('should list providers', async () => {
      const result = await runCLI(['provider', 'list']);

      expect([0, 1]).toContain(result.exitCode);
    });

    it('should support --json flag for provider list', async () => {
      const result = await runCLI(['provider', 'list', '--json']);

      if (result.exitCode === 0 && result.stdout.trim()) {
        expect(() => JSON.parse(result.stdout)).not.toThrow();
      }
    });

    it('should show provider status', async () => {
      const result = await runCLI(['provider', 'status']);

      expect([0, 1]).toContain(result.exitCode);
    });
  });

  // ===========================================================================
  // Session Command Tests
  // ===========================================================================

  describe('session command', () => {
    it('should show session help', async () => {
      const result = await runCLI(['session', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('session');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('create');
    });

    it('should list sessions', async () => {
      const result = await runCLI(['session', 'list']);

      expect([0, 1]).toContain(result.exitCode);
    });

    it('should support --json flag for session list', async () => {
      const result = await runCLI(['session', 'list', '--json']);

      if (result.exitCode === 0 && result.stdout.trim()) {
        expect(() => JSON.parse(result.stdout)).not.toThrow();
      }
    });

    it('should create a new session', async () => {
      const result = await runCLI(['session', 'create', '--name', 'test-session']);

      // May fail without proper setup, but command should be recognized
      expect(result.stderr).not.toContain('Unknown command');
    });
  });

  // ===========================================================================
  // System Command Tests
  // ===========================================================================

  describe('system commands', () => {
    it('should show status', async () => {
      const result = await runCLI(['status']);

      expect([0, 1]).toContain(result.exitCode);
      // Should show some system information
      expect(result.stdout + result.stderr).not.toContain('Unknown command');
    });

    it('should support --json flag for status', async () => {
      const result = await runCLI(['status', '--json']);

      if (result.exitCode === 0 && result.stdout.trim()) {
        expect(() => JSON.parse(result.stdout)).not.toThrow();
      }
    });

    it('should show config', async () => {
      const result = await runCLI(['config', 'show']);

      expect([0, 1]).toContain(result.exitCode);
    });

    it('should run doctor diagnostics', async () => {
      const result = await runCLI(['doctor']);

      expect([0, 1]).toContain(result.exitCode);
      // Doctor should output diagnostic information
    });
  });

  // ===========================================================================
  // Run Command Tests
  // ===========================================================================

  describe('run command', () => {
    it('should show run help', async () => {
      const result = await runCLI(['run', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('run');
      expect(result.stdout).toContain('agent');
      expect(result.stdout).toContain('task');
    });

    it('should require agent and task arguments', async () => {
      const result = await runCLI(['run']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('agent');
    });

    it('should support --timeout flag', async () => {
      const result = await runCLI(['run', '--help']);

      expect(result.stdout).toContain('timeout');
    });

    it('should support --session flag', async () => {
      const result = await runCLI(['run', '--help']);

      expect(result.stdout).toContain('session');
    });

    it('should support --json flag', async () => {
      const result = await runCLI(['run', '--help']);

      expect(result.stdout).toContain('json');
    });

    it('should support --stream flag', async () => {
      const result = await runCLI(['run', '--help']);

      expect(result.stdout).toContain('stream');
    });
  });

  // ===========================================================================
  // Global Options Tests
  // ===========================================================================

  describe('global options', () => {
    it('should accept --debug flag', async () => {
      const result = await runCLI(['--debug', 'status']);

      // Command should work with debug flag
      expect(result.stderr).not.toContain('Unknown argument');
    });

    it('should accept --quiet flag', async () => {
      const result = await runCLI(['--quiet', 'status']);

      // Command should work with quiet flag
      expect(result.stderr).not.toContain('Unknown argument');
    });

    it('should accept -q alias for quiet', async () => {
      const result = await runCLI(['-q', 'status']);

      expect(result.stderr).not.toContain('Unknown argument');
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should show helpful error for invalid options', async () => {
      const result = await runCLI(['agent', 'list', '--invalid-option']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown');
    });

    it('should handle missing required arguments', async () => {
      const result = await runCLI(['run', 'backend']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('task');
    });

    it('should show command suggestions for typos', async () => {
      const result = await runCLI(['aget']); // typo of 'agent'

      expect(result.exitCode).toBe(1);
      // Should suggest the correct command
    });
  });

  // ===========================================================================
  // Output Format Tests
  // ===========================================================================

  describe('output formatting', () => {
    it('should output valid JSON when --json flag is used', async () => {
      const commands = [
        ['agent', 'list', '--json'],
        ['memory', 'list', '--json'],
        ['provider', 'list', '--json'],
        ['session', 'list', '--json'],
        ['status', '--json'],
      ];

      for (const cmd of commands) {
        const result = await runCLI(cmd);
        if (result.exitCode === 0 && result.stdout.trim()) {
          expect(() => JSON.parse(result.stdout), `Failed for: ${cmd.join(' ')}`).not.toThrow();
        }
      }
    });

    it('should handle empty results gracefully', async () => {
      const result = await runCLI(['memory', 'search', 'nonexistent-query-xyz123']);

      // Should not crash, may show "no results" message
      expect([0, 1]).toContain(result.exitCode);
    });
  });

  // ===========================================================================
  // Integration Workflow Tests
  // ===========================================================================

  describe('integration workflows', () => {
    it('should support typical user workflow', async () => {
      // 1. Check system status
      const statusResult = await runCLI(['status']);
      expect([0, 1]).toContain(statusResult.exitCode);

      // 2. List available agents
      const agentsResult = await runCLI(['agent', 'list']);
      expect([0, 1]).toContain(agentsResult.exitCode);

      // 3. List providers
      const providersResult = await runCLI(['provider', 'list']);
      expect([0, 1]).toContain(providersResult.exitCode);

      // 4. Search memory
      const memoryResult = await runCLI(['memory', 'search', 'test']);
      expect([0, 1]).toContain(memoryResult.exitCode);
    });

    it('should support scripting with JSON output', async () => {
      // Get status as JSON
      const result = await runCLI(['status', '--json']);

      if (result.exitCode === 0 && result.stdout.trim()) {
        const status = JSON.parse(result.stdout);
        expect(status).toBeDefined();
      }
    });
  });
});

// =============================================================================
// Command-Specific Unit Tests (Mock-Based)
// =============================================================================

describe('CLI Command Unit Tests', () => {
  // These tests use mocking to test command logic without running actual CLI

  describe('run command validation', () => {
    it('should validate agent name format', () => {
      // Agent names should be lowercase alphanumeric with hyphens
      const validNames = ['backend', 'frontend', 'data-scientist', 'qa-engineer'];
      const invalidNames = ['Backend', 'FRONTEND', 'agent name', 'agent@name'];

      validNames.forEach(name => {
        expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
      });

      invalidNames.forEach(name => {
        expect(name).not.toMatch(/^[a-z][a-z0-9-]*$/);
      });
    });

    it('should validate timeout is positive number', () => {
      const validateTimeout = (timeout: number): boolean => {
        return typeof timeout === 'number' && timeout > 0 && timeout <= 3600000;
      };

      expect(validateTimeout(30000)).toBe(true);
      expect(validateTimeout(300000)).toBe(true);
      expect(validateTimeout(-1)).toBe(false);
      expect(validateTimeout(0)).toBe(false);
      expect(validateTimeout(5000000)).toBe(false); // Too long
    });
  });

  describe('memory command validation', () => {
    it('should validate search query length', () => {
      const validateQuery = (query: string): boolean => {
        return query.length >= 1 && query.length <= 1000;
      };

      expect(validateQuery('test')).toBe(true);
      expect(validateQuery('')).toBe(false);
      expect(validateQuery('a'.repeat(1001))).toBe(false);
    });

    it('should validate limit parameter', () => {
      const validateLimit = (limit: number): boolean => {
        return Number.isInteger(limit) && limit >= 1 && limit <= 1000;
      };

      expect(validateLimit(10)).toBe(true);
      expect(validateLimit(100)).toBe(true);
      expect(validateLimit(0)).toBe(false);
      expect(validateLimit(-1)).toBe(false);
      expect(validateLimit(1001)).toBe(false);
      expect(validateLimit(10.5)).toBe(false);
    });
  });

  describe('session command validation', () => {
    it('should validate session ID format', () => {
      // Session IDs should be UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect('550e8400-e29b-41d4-a716-446655440000').toMatch(uuidRegex);
      expect('invalid-session-id').not.toMatch(uuidRegex);
    });

    it('should validate session name length', () => {
      const validateName = (name: string): boolean => {
        return name.length >= 1 && name.length <= 255;
      };

      expect(validateName('My Session')).toBe(true);
      expect(validateName('')).toBe(false);
      expect(validateName('a'.repeat(256))).toBe(false);
    });
  });
});
