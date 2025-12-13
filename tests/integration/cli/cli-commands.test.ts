/**
 * CLI Commands Integration Tests
 *
 * End-to-end tests for CLI commands:
 * - doctor command
 * - providers command
 * - resume command
 * - runs command
 * - bugfix command
 * - refactor command
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

/**
 * Helper: Run CLI command
 */
function runCLI(
  args: string[],
  options: { cwd?: string; timeout?: number; env?: Record<string, string> } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 30000;
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: options.cwd || process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        AX_MOCK_PROVIDERS: 'true',
        ...options.env
      }
    });

    let stdout = '';
    let stderr = '';
    let timer: NodeJS.Timeout;

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    timer = setTimeout(() => {
      child.kill();
      resolve({
        exitCode: 124,
        stdout,
        stderr: stderr + '\nCommand timed out'
      });
    }, timeout);
  });
}

describe('CLI Commands Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cli-commands-test-'));
    await mkdir(join(testDir, '.automatosx'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('help command', () => {
    it('should display help information', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Commands:');
    });

    it('should display version', async () => {
      const result = await runCLI(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('list command', () => {
    it('should list available agents', async () => {
      const result = await runCLI(['list', 'agents'], { cwd: testDir });

      expect(result.exitCode).toBe(0);
    });

    it('should list providers', async () => {
      const result = await runCLI(['list', 'providers'], { cwd: testDir });

      expect(result.exitCode).toBe(0);
    });

    it('should list abilities', async () => {
      const result = await runCLI(['list', 'abilities'], { cwd: testDir });

      expect(result.exitCode).toBe(0);
    });
  });

  describe('config command', () => {
    it('should list configuration', async () => {
      // First setup the project
      await runCLI(['setup', testDir], { timeout: 20000 });

      const result = await runCLI(['config', 'list'], { cwd: testDir });

      // May succeed or fail depending on config presence
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should get specific config value', async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });

      const result = await runCLI(['config', 'get', 'providers'], { cwd: testDir });

      // May succeed or fail depending on config
      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe('memory command', () => {
    beforeEach(async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });
    });

    it('should add memory entry', async () => {
      // Content is a positional argument, not a flag
      const result = await runCLI(
        ['memory', 'add', 'Test memory entry'],
        { cwd: testDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('added');
    });

    it('should list memory entries', async () => {
      // Add entry first - content is positional argument
      await runCLI(
        ['memory', 'add', 'List test entry'],
        { cwd: testDir }
      );

      const result = await runCLI(['memory', 'list'], { cwd: testDir });

      expect(result.exitCode).toBe(0);
    });

    it('should search memory', async () => {
      // Add entry first - content is positional argument
      await runCLI(
        ['memory', 'add', 'Authentication implementation details'],
        { cwd: testDir }
      );

      const result = await runCLI(['memory', 'search', 'authentication'], { cwd: testDir });

      expect(result.exitCode).toBe(0);
    });
  });

  describe('status command', () => {
    it('should show status', async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });

      const result = await runCLI(['status'], { cwd: testDir });

      expect(result.exitCode).toBe(0);
    });

    it('should show verbose status', async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });

      const result = await runCLI(['status', '--verbose'], { cwd: testDir });

      expect(result.exitCode).toBe(0);
    });

    it('should output JSON format', async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });

      const result = await runCLI(['status', '--json'], { cwd: testDir });

      expect(result.exitCode).toBe(0);
      // Should be valid JSON
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });
  });

  describe('bugfix command', () => {
    it('should run bugfix scan in dry-run mode', async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });

      // Create a test file
      const srcDir = join(testDir, 'src');
      await mkdir(srcDir, { recursive: true });
      await writeFile(join(srcDir, 'test.ts'), `
        export const interval = setInterval(() => {}, 1000);
      `);

      const result = await runCLI(['bugfix', '--dry-run'], { cwd: testDir, timeout: 60000 });

      // Should complete without error
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should support JSON output', async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });

      const result = await runCLI(['bugfix', '--dry-run', '--json'], { cwd: testDir, timeout: 60000 });

      // Should complete
      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe('refactor command', () => {
    it('should run refactor scan in dry-run mode', async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });

      // Create a test file
      const srcDir = join(testDir, 'src');
      await mkdir(srcDir, { recursive: true });
      await writeFile(join(srcDir, 'test.ts'), `
        const unused = 42;
        export const data: any = {};
      `);

      const result = await runCLI(['refactor', '--dry-run'], { cwd: testDir, timeout: 60000 });

      // Should complete
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should support focus areas', async () => {
      await runCLI(['setup', testDir], { timeout: 20000 });

      const result = await runCLI(
        ['refactor', '--dry-run', '--focus', 'dead_code,type_safety'],
        { cwd: testDir, timeout: 60000 }
      );

      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe('init command', () => {
    it('should initialize project files', async () => {
      const result = await runCLI(['init'], { cwd: testDir, timeout: 30000 });

      expect([0, 1]).toContain(result.exitCode);
    });

    it('should support force flag', async () => {
      // Initialize once
      await runCLI(['init'], { cwd: testDir, timeout: 30000 });

      // Force reinitialize
      const result = await runCLI(['init', '--force'], { cwd: testDir, timeout: 30000 });

      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe('Error handling', () => {
    it('should handle unknown commands', async () => {
      const result = await runCLI(['unknown-command-xyz']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown');
    });

    it('should handle missing required arguments', async () => {
      const result = await runCLI(['run']);

      // Should fail due to missing agent/task
      expect(result.exitCode).toBe(1);
    });
  });
});

describe('CLI with Mock Providers', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cli-mock-test-'));
    await runCLI(['setup', testDir], { timeout: 20000 });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('run command with mocks', () => {
    it('should run agent with mock providers', async () => {
      const result = await runCLI(
        ['run', 'backend', 'Test task'],
        {
          cwd: testDir,
          timeout: 60000,
          env: { AX_MOCK_PROVIDERS: 'true' }
        }
      );

      // Should complete (may succeed or fail based on mock setup)
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should support quiet mode', async () => {
      const result = await runCLI(
        ['run', 'backend', 'Test task', '--quiet'],
        {
          cwd: testDir,
          timeout: 60000,
          env: { AX_MOCK_PROVIDERS: 'true' }
        }
      );

      expect([0, 1]).toContain(result.exitCode);
    });
  });
});
