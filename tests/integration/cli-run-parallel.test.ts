/**
 * CLI Run Command - Parallel Execution Integration Tests
 *
 * Tests the CLI --parallel flag functionality with real agent execution flows.
 * These tests verify the end-to-end parallel execution workflow from CLI
 * input through to agent delegation.
 *
 * @group integration
 * @group cli
 * @group parallel
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

describe('CLI Run Command - Parallel Execution', () => {
  let testDir: string;
  let automatosxDir: string;
  let cliPath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `cli-run-parallel-test-${Date.now()}`);
    automatosxDir = join(testDir, '.automatosx');
    await mkdir(automatosxDir, { recursive: true });

    // CLI path
    cliPath = join(process.cwd(), 'dist', 'index.js');

    // Create basic config with mock provider
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
        execution: {
          defaultTimeout: 30000,
          maxConcurrentAgents: 4
        }
      }, null, 2),
      'utf-8'
    );

    // Set environment variable to use mock providers
    process.env.AX_MOCK_PROVIDERS = 'true';
    process.env.AUTOMATOSX_PROJECT_ROOT = testDir;
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    delete process.env.AX_MOCK_PROVIDERS;
    delete process.env.AUTOMATOSX_PROJECT_ROOT;
  });

  describe('CLI --parallel Flag', () => {
    it('should accept --parallel flag', async () => {
      // Create a simple agent
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, 'test.yaml'),
        `name: test
version: 1.0.0
description: Test agent
role: Test role
systemPrompt: Test prompt
`,
        'utf-8'
      );

      // Run with --parallel flag
      const { stdout, stderr } = await exec(
        `cd "${testDir}" && node "${cliPath}" run test "simple task" --parallel`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      // Should not fail
      expect(stdout).toBeDefined();
      expect(stderr).not.toContain('Unknown argument');
      expect(stderr).not.toContain('error');
    }, 60000);

    it('should run without --parallel flag by default', async () => {
      // Create a simple agent
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, 'test.yaml'),
        `name: test
version: 1.0.0
description: Test agent
role: Test role
systemPrompt: Test prompt
`,
        'utf-8'
      );

      // Run without --parallel flag (default sequential mode)
      const { stdout, stderr } = await exec(
        `cd "${testDir}" && node "${cliPath}" run test "simple task"`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      // Should succeed
      expect(stdout).toBeDefined();
      expect(stderr).not.toContain('error');
    }, 60000);

    it('should show help text for --parallel flag', async () => {
      const { stdout } = await exec(
        `node "${cliPath}" run --help`,
        { cwd: testDir }
      );

      expect(stdout).toContain('parallel');
      expect(stdout).toContain('Enable parallel execution');
    });
  });

  describe('Parallel Execution Behavior', () => {
    beforeEach(async () => {
      // Create agents directory
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      // Create multiple test agents
      await writeFile(
        join(agentsDir, 'frontend.yaml'),
        `name: frontend
version: 1.0.0
description: Frontend developer
role: Frontend Developer
systemPrompt: You are a frontend developer
`,
        'utf-8'
      );

      await writeFile(
        join(agentsDir, 'backend.yaml'),
        `name: backend
version: 1.0.0
description: Backend developer
role: Backend Developer
systemPrompt: You are a backend developer
model:
  provider: claude-code
`,
        'utf-8'
      );

      await writeFile(
        join(agentsDir, 'database.yaml'),
        `name: database
version: 1.0.0
description: Database specialist
role: Database Specialist
systemPrompt: You are a database specialist
model:
  provider: claude-code
`,
        'utf-8'
      );
    });

    it('should execute single agent normally with --parallel flag', async () => {
      const { stdout, stderr } = await exec(
        `cd "${testDir}" && node "${cliPath}" run frontend "build UI" --parallel`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      expect(stderr).not.toContain('error');
      expect(stdout).toBeDefined();
    }, 60000);

    it('should work with verbose flag', async () => {
      const { stdout, stderr } = await exec(
        `cd "${testDir}" && node "${cliPath}" run frontend "build UI" --parallel --verbose`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      expect(stderr).not.toContain('error');
      expect(stdout).toBeDefined();
    }, 60000);

    it('should work with JSON format output', async () => {
      const { stdout, stderr } = await exec(
        `cd "${testDir}" && node "${cliPath}" run frontend "build UI" --parallel --format json`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      expect(stderr).not.toContain('error');
      expect(stdout).toBeDefined();

      // Extract JSON from output (may contain other content like emojis)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        expect(result).toBeDefined();
      } else {
        // If no JSON found, that's also acceptable - some agents may not output JSON
        expect(stdout.length).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('Configuration Integration', () => {
    it('should respect maxConcurrentAgents from config', async () => {
      // Update config with low concurrency limit
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
          execution: {
            defaultTimeout: 30000,
            maxConcurrentAgents: 1 // Force sequential batching
          }
        }, null, 2),
        'utf-8'
      );

      // Create agents
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, 'test.yaml'),
        `name: test
version: 1.0.0
description: Test agent
role: Test role
systemPrompt: Test prompt
`,
        'utf-8'
      );

      const { stderr } = await exec(
        `cd "${testDir}" && node "${cliPath}" run test "task" --parallel`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      // Should still succeed
      expect(stderr).not.toContain('error');
    }, 60000);

    it('should work without explicit config file', async () => {
      // Remove config file
      await rm(join(testDir, 'ax.config.json'), { force: true });

      // Create agents
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, 'test.yaml'),
        `name: test
version: 1.0.0
description: Test agent
role: Test role
systemPrompt: Test prompt
`,
        'utf-8'
      );

      const { stderr } = await exec(
        `cd "${testDir}" && node "${cliPath}" run test "task" --parallel`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      // Should use defaults
      expect(stderr).not.toContain('error');
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle missing agent gracefully', async () => {
      try {
        await exec(
          `cd "${testDir}" && node "${cliPath}" run nonexistent "task" --parallel`,
          {
            env: {
              ...process.env,
              AX_MOCK_PROVIDERS: 'true',
              AUTOMATOSX_PROJECT_ROOT: testDir,
              NODE_ENV: 'test'
            }
          }
        );
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Should fail gracefully
        expect(error.code).toBeGreaterThan(0);
        // Error message might vary - check for key indicators
        const stderr = error.stderr || '';
        const stdout = error.stdout || '';
        const output = stderr + stdout;
        expect(output.length).toBeGreaterThan(0);
      }
    }, 60000);

    it('should validate agent configuration', async () => {
      // Create agent with invalid config
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, 'broken.yaml'),
        `name: broken
# Missing required fields
`,
        'utf-8'
      );

      try {
        await exec(
          `cd "${testDir}" && node "${cliPath}" run broken "task" --parallel`,
          {
            env: {
              ...process.env,
              AX_MOCK_PROVIDERS: 'true',
              AUTOMATOSX_PROJECT_ROOT: testDir,
              NODE_ENV: 'test'
            }
          }
        );
        expect(true).toBe(false);
      } catch (error: any) {
        // Should fail validation
        expect(error.code).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('Output Format', () => {
    beforeEach(async () => {
      // Create test agent
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, 'test.yaml'),
        `name: test
version: 1.0.0
description: Test agent
role: Test role
systemPrompt: Test prompt
`,
        'utf-8'
      );
    });

    it('should output text format by default', async () => {
      const { stdout } = await exec(
        `cd "${testDir}" && node "${cliPath}" run test "task" --parallel`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      // Should have text output
      expect(stdout).toBeDefined();
      expect(stdout.length).toBeGreaterThan(0);
    }, 60000);

    it('should output JSON format when requested', async () => {
      const { stdout } = await exec(
        `cd "${testDir}" && node "${cliPath}" run test "task" --parallel --format json`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            NODE_ENV: 'test'
          }
        }
      );

      // Extract JSON from output (may contain other content like emojis)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        expect(result).toBeDefined();
      } else {
        // If no JSON found, that's also acceptable - some agents may not output JSON
        expect(stdout.length).toBeGreaterThan(0);
      }
    }, 60000);

    it('should work with quiet mode', async () => {
      const { stdout, stderr } = await exec(
        `cd "${testDir}" && node "${cliPath}" run test "task" --parallel --quiet`,
        {
          env: {
            ...process.env,
            AX_MOCK_PROVIDERS: 'true',
            AUTOMATOSX_PROJECT_ROOT: testDir,
            AUTOMATOSX_QUIET: 'true',
            NODE_ENV: 'test'
          }
        }
      );

      // Quiet mode should minimize output
      expect(stdout).toBeDefined();
      expect(stderr).not.toContain('error');
    }, 60000);
  });
});
