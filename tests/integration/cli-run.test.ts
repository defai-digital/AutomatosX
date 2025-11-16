/**
 * CLI Run Command Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('CLI Run Command Integration', () => {
  let testDir: string;
  let cliPath: string;

  beforeEach(async () => {
    // Create test directory
    testDir = join(tmpdir(), `automatosx-cli-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // CLI path (built binary)
    cliPath = join(process.cwd(), 'dist', 'index.js');
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('run command', () => {
    it('should show error when agent profile not found', async () => {
      try {
        await execFileAsync('node', [cliPath, 'run', 'nonexistent', 'test task'], {
          cwd: testDir,
          env: {
            ...process.env,
            AUTOMATOSX_MOCK_PROVIDERS: 'true'
          }
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        // Error message should be present in stderr
        expect(error.stderr).toBeTruthy();
      }
    });

    it('should execute with mock provider when configured', async () => {
      // Create agent profile
      const agentDir = join(testDir, '.automatosx', 'agents');
      await mkdir(agentDir, { recursive: true });

      const agentProfile = `
name: Test Agent
role: tester
description: A test agent
systemPrompt: You are a test agent
abilities: []
provider: claude
temperature: 0.7
`;
      await writeFile(join(agentDir, 'test.yaml'), agentProfile);

      // Run with mock provider
      const result = await execFileAsync('node', [cliPath, 'run', 'test', 'test task'], {
        cwd: testDir,
        env: {
          ...process.env,
          AUTOMATOSX_MOCK_PROVIDERS: 'true'
        },
        timeout: 15000,
        killSignal: 'SIGINT'
      });

      expect(result.stdout).toContain('AutomatosX');
      expect(result.stdout).toContain('Complete');
    });
  });

  describe('help command', () => {
    it('should display help text', async () => {
      const result = await execFileAsync('node', [cliPath, '--help'], {
        cwd: testDir
      });

      expect(result.stdout).toContain('AutomatosX');
      expect(result.stdout).toContain('Commands:');
    });

    it('should display run command help', async () => {
      const result = await execFileAsync('node', [cliPath, 'run', '--help'], {
        cwd: testDir
      });

      expect(result.stdout).toContain('run');
      expect(result.stdout).toContain('agent');
      expect(result.stdout).toContain('task');
    });
  });

  describe('displayName support', () => {
    it('should accept displayName instead of agent filename', async () => {
      // Create agent profile with displayName
      const agentDir = join(testDir, '.automatosx', 'agents');
      await mkdir(agentDir, { recursive: true });

      const agentProfile = `
name: backend
displayName: Bob
role: Backend Developer
description: A backend developer
systemPrompt: You are a backend developer
abilities: []
provider: claude
temperature: 0.7
`;
      await writeFile(join(agentDir, 'backend.yaml'), agentProfile);

      // Run with displayName "Bob" instead of filename "backend"
      const result = await execFileAsync('node', [cliPath, 'run', 'Bob', 'test task'], {
        cwd: testDir,
        env: {
          ...process.env,
          AUTOMATOSX_MOCK_PROVIDERS: 'true'
        },
        timeout: 15000,
        killSignal: 'SIGINT'
      });

      expect(result.stdout).toContain('AutomatosX');
      expect(result.stdout).toContain('Complete');
    });

    it('should work with case-insensitive displayName', async () => {
      // Create agent profile with displayName
      const agentDir = join(testDir, '.automatosx', 'agents');
      await mkdir(agentDir, { recursive: true });

      const agentProfile = `
name: backend
displayName: Bob
role: Backend Developer
description: A backend developer
systemPrompt: You are a backend developer
abilities: []
provider: claude
temperature: 0.7
`;
      await writeFile(join(agentDir, 'backend.yaml'), agentProfile);

      // Run with lowercase "bob"
      const result = await execFileAsync('node', [cliPath, 'run', 'bob', 'test task'], {
        cwd: testDir,
        env: {
          ...process.env,
          AUTOMATOSX_MOCK_PROVIDERS: 'true'
        },
        timeout: 15000,
        killSignal: 'SIGINT'
      });

      expect(result.stdout).toContain('AutomatosX');
      expect(result.stdout).toContain('Complete');
    });
  });

  describe('version command', () => {
    it('should display version', async () => {
      const result = await execFileAsync('node', [cliPath, '--version'], {
        cwd: testDir
      });

      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });
});
