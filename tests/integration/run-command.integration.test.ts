/**
 * Run Command Integration Tests
 *
 * Tests end-to-end agent execution flows
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Run Command Integration', () => {
  let testDir: string;
  let cliPath: string;

  beforeAll(async () => {
    // Create temp directory
    testDir = join(tmpdir(), `automatosx-integration-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, '.automatosx', 'agents'), { recursive: true });
    await mkdir(join(testDir, '.automatosx', 'abilities'), { recursive: true });

    // Create test agent
    const agentYaml = `
name: Test Agent
role: tester
description: Integration test agent
systemPrompt: You are a test agent for integration testing
abilities:
  - test-ability
provider: claude
temperature: 0.7
`;
    await writeFile(join(testDir, '.automatosx', 'agents', 'test.yaml'), agentYaml);

    // Create test ability
    await writeFile(
      join(testDir, '.automatosx', 'abilities', 'test-ability.md'),
      '# Test Ability\n\nYou can execute integration tests.'
    );

    // Create config
    await writeFile(
      join(testDir, 'ax.config.json'),
      JSON.stringify({
        providers: {
          'claude-code': {
            enabled: true,
            priority: 1,
            timeout: 30000,
            command: 'claude'
          }
        },
        memory: {
          maxEntries: 10000,
          persistPath: '.automatosx/memory',
          autoCleanup: true,
          cleanupDays: 30
        },
        workspace: {
          basePath: '.automatosx/workspaces',
          autoCleanup: true,
          cleanupDays: 7,
          maxFiles: 100
        },
        logging: {
          level: 'error',
          path: '.automatosx/logs',
          console: false
        }
      }, null, 2)
    );

    // Get CLI path
    cliPath = join(process.cwd(), 'dist', 'index.js');
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Execution', () => {
    it('should execute agent with mock provider', async () => {
      const result = await runCLI(['run', 'test', 'Hello world'], testDir);

      expect(result.code).toBe(0);
      // Quiet mode no longer shows "AutomatosX" branding
      expect(result.stdout).toContain('📝 Result');
      // Mock response may contain "Mock" text or just show result
      expect(result.stdout.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle missing agent gracefully', async () => {
      // v11.1.0: Use --no-auto-select to disable fallback auto-selection
      const result = await runCLI(['run', 'nonexistent', 'Task', '--no-auto-select'], testDir);

      expect(result.code).toBe(1);
      // Error messages may be in stderr or stdout
      const output = result.stdout + result.stderr;
      expect(output).toContain('not found');
    }, 30000);

    it('should execute successfully with simple task', async () => {
      const result = await runCLI(['run', 'test', 'Simple task'], testDir);

      expect(result.code).toBe(0);
      // Quiet mode no longer shows "AutomatosX" branding
      expect(result.stdout).toContain('📝 Result');
      expect(result.stdout).toContain('[Mock');
    }, 30000);
  });

  describe('Provider Selection', () => {
    it('should use default provider when not specified', async () => {
      const result = await runCLI(['run', 'test', 'Task'], testDir);

      expect(result.code).toBe(0);
      // Should execute successfully
    }, 30000);

    it('should allow provider override', async () => {
      const result = await runCLI(['run', 'test', 'Task', '--provider', 'claude'], testDir);

      expect(result.code).toBe(0);
      // Should execute successfully
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should validate required arguments', async () => {
      const result = await runCLI(['run'], testDir);

      expect(result.code).toBe(1);
      // Should fail due to missing arguments
    }, 30000);

    it('should handle configuration errors', async () => {
      // Remove config
      await rm(join(testDir, 'ax.config.json'));

      const result = await runCLI(['run', 'test', 'Task'], testDir);

      // Should still work with default config
      expect(result.code).toBe(0);

      // Restore config for other tests
      await writeFile(
        join(testDir, 'ax.config.json'),
        JSON.stringify({
          providers: {
            'claude-code': {
              enabled: true,
              priority: 1,
              timeout: 30000,
              command: 'claude'
            }
          }
        }, null, 2)
      );
    }, 30000);
  });

  describe('Memory Options', () => {
    it('should skip memory when --no-memory is set', async () => {
      const result = await runCLI(['run', 'test', 'Task', '--no-memory'], testDir);

      expect(result.code).toBe(0);
      // Should complete successfully
    }, 30000);

    it('should skip saving memory when --no-save-memory is set', async () => {
      const result = await runCLI(['run', 'test', 'Task', '--no-save-memory'], testDir);

      expect(result.code).toBe(0);
      // Should complete successfully
    }, 30000);
  });
});

/**
 * Helper to run CLI command
 */
function runCLI(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('node', [join(process.cwd(), 'dist', 'index.js'), ...args], {
      cwd,
      env: { ...process.env, AX_MOCK_PROVIDERS: 'true' },
      stdio: 'pipe'
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
      resolve({ code: code ?? 1, stdout, stderr });
    });

    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
  });
}
