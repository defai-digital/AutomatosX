/**
 * CLI Index Entry Point Tests
 *
 * Tests the main CLI entry point including:
 * - Command parsing
 * - Global options
 * - Help/version output
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { readFileSync } from 'fs';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');
const PACKAGE_JSON = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
const VERSION = PACKAGE_JSON.version;

/**
 * Helper to execute CLI command
 */
async function execCLI(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, AX_MOCK_PROVIDERS: 'true' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0
      });
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, 10000);
  });
}

describe('CLI Entry Point (index.ts)', () => {
  beforeEach(async () => {
    // Ensure CLI is built
    // Note: In real scenarios, this would be handled by CI/CD
  });

  describe('Version and Help', () => {
    it('should display version with --version', async () => {
      const result = await execCLI(['--version']);

      expect(result.stdout).toContain(VERSION);
      expect(result.exitCode).toBe(0);
    });

    it('should display version with -v', async () => {
      const result = await execCLI(['-v']);

      expect(result.stdout).toContain(VERSION);
      expect(result.exitCode).toBe(0);
    });

    it('should display help with --help', async () => {
      const result = await execCLI(['--help']);

      expect(result.stdout).toContain('automatosx');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('setup');
      expect(result.stdout).toContain('run');
      expect(result.stdout).toContain('config');
      expect(result.stdout).toContain('status');
      expect(result.stdout).toContain('memory');
      expect(result.stdout).toContain('list');
      expect(result.exitCode).toBe(0);
    });

    it('should display help with -h', async () => {
      const result = await execCLI(['-h']);

      expect(result.stdout).toContain('automatosx');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Global Options', () => {
    it('should accept --debug flag', async () => {
      const result = await execCLI(['--debug', '--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(VERSION);
    });

    it('should accept -d flag (debug alias)', async () => {
      const result = await execCLI(['-d', '--version']);

      expect(result.exitCode).toBe(0);
    });

    it('should accept --quiet flag', async () => {
      const result = await execCLI(['--quiet', '--version']);

      expect(result.exitCode).toBe(0);
    });

    it('should accept -q flag (quiet alias)', async () => {
      const result = await execCLI(['-q', '--version']);

      expect(result.exitCode).toBe(0);
    });

    it('should accept --config flag', async () => {
      const result = await execCLI(['--config', '/tmp/test.json', '--version']);

      expect(result.exitCode).toBe(0);
    });

    it('should accept -c flag (config alias)', async () => {
      const result = await execCLI(['-c', '/tmp/test.json', '--version']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('Command Execution', () => {
    it('should execute init command', async () => {
      const result = await execCLI(['setup', '--help']);

      expect(result.stdout).toContain('setup');
      expect(result.exitCode).toBe(0);
    });

    it('should execute list command', async () => {
      const result = await execCLI(['list', '--help']);

      expect(result.stdout).toContain('list');
      expect(result.exitCode).toBe(0);
    });

    it('should execute run command', async () => {
      const result = await execCLI(['run', '--help']);

      expect(result.stdout).toContain('run');
      expect(result.exitCode).toBe(0);
    });

    it('should execute config command', async () => {
      const result = await execCLI(['config', '--help']);

      expect(result.stdout).toContain('config');
      expect(result.exitCode).toBe(0);
    });

    it('should execute status command', async () => {
      const result = await execCLI(['status', '--help']);

      expect(result.stdout).toContain('status');
      expect(result.exitCode).toBe(0);
    });

    it('should execute memory command', async () => {
      const result = await execCLI(['memory', '--help']);

      expect(result.stdout).toContain('memory');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should show error when no command provided', async () => {
      const result = await execCLI([]);

      expect(result.stderr).toContain('You must provide a command');
      expect(result.exitCode).not.toBe(0);
    });

    it('should show error for unknown command', async () => {
      const result = await execCLI(['unknown-command']);

      expect(result.exitCode).not.toBe(0);
    });

    it('should handle invalid flags gracefully', async () => {
      const result = await execCLI(['setup', '--totally-invalid-flag-12345']);

      // Should exit with error code
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Examples in Help', () => {
    it('should show usage examples', async () => {
      const result = await execCLI(['--help']);

      expect(result.stdout).toContain('Examples:');
      expect(result.stdout).toContain('automatosx setup');
      expect(result.stdout).toContain('automatosx run');
      expect(result.stdout).toContain('automatosx list');
      expect(result.stdout).toContain('automatosx memory');
      expect(result.stdout).toContain('automatosx config');
    });
  });

  describe('Script Name and Usage', () => {
    it('should show correct script name', async () => {
      const result = await execCLI(['--help']);

      expect(result.stdout).toContain('automatosx');
    });

    it('should show usage information', async () => {
      const result = await execCLI(['--help']);

      expect(result.stdout).toContain('AI Agent Orchestration Platform');
    });
  });

  describe('Strict Mode', () => {
    it('should enforce strict mode for unknown options', async () => {
      const result = await execCLI(['setup', '--unknown-flag']);

      expect(result.stderr).toContain('Unknown');
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Performance Tracking', () => {
    it('should complete successfully with --debug', async () => {
      const result = await execCLI(['--debug', '--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(VERSION);
    });
  });

  describe('Combined Flags', () => {
    it('should handle multiple global flags', async () => {
      const result = await execCLI(['--debug', '--quiet', '--version']);

      expect(result.exitCode).toBe(0);
    });

    it('should handle debug with config path', async () => {
      const result = await execCLI(['--debug', '--config', '/tmp/test.json', '--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(VERSION);
    });
  });
});
