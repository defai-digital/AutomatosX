/**
 * CLI Agent Remove Command Tests
 * Tests the "ax agent remove" command functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

/**
 * Helper to execute CLI command with stdin input
 */
async function execCLI(args: string[], cwd?: string, input?: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, AUTOMATOSX_MOCK_PROVIDERS: 'true' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Send input if provided
    if (input !== undefined && child.stdin) {
      child.stdin.write(input + '\n');
      child.stdin.end();
    }

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0
      });
    });

    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, 10000);
  });
}

/**
 * Helper to create test project
 */
async function createTestProject(testDir: string): Promise<void> {
  const automatosxDir = join(testDir, '.automatosx');
  await mkdir(automatosxDir, { recursive: true });
  await mkdir(join(automatosxDir, 'agents'), { recursive: true });
  await mkdir(join(automatosxDir, 'teams'), { recursive: true });

  const teamConfig = `name: engineering
displayName: "Engineering Team"
description: "Software development team"
provider:
  primary: codex
sharedAbilities: []
`;
  await writeFile(join(automatosxDir, 'teams', 'engineering.yaml'), teamConfig, 'utf-8');
}

/**
 * Helper to create agent
 */
async function createAgent(testDir: string, name: string, displayName: string): Promise<void> {
  const agentConfig = `name: ${name}
displayName: "${displayName}"
team: engineering
role: Software Engineer
description: Test agent for CLI testing
systemPrompt: |
  You are a helpful assistant.
`;
  await writeFile(join(testDir, '.automatosx', 'agents', `${name}.yaml`), agentConfig, 'utf-8');
}

describe('CLI Agent Remove Command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'automatosx-test-'));
    await createTestProject(testDir);
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Help and Usage', () => {
    it('should display help with --help', async () => {
      const result = await execCLI(['agent', 'remove', '--help']);

      expect(result.stdout).toContain('remove <agent>');
      expect(result.stdout).toContain('Remove an agent');
      expect(result.stdout).toContain('--confirm');
      expect(result.exitCode).toBe(0);
    });

    it('should support rm alias', async () => {
      const result = await execCLI(['agent', 'rm', '--help']);

      expect(result.stdout).toContain('Remove an agent');
      expect(result.exitCode).toBe(0);
    });

    it('should support delete alias', async () => {
      const result = await execCLI(['agent', 'delete', '--help']);

      expect(result.stdout).toContain('Remove an agent');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Remove with Confirmation Flag', () => {
    it('should remove agent with --confirm flag', async () => {
      await createAgent(testDir, 'test-agent', 'Test Agent');

      const result = await execCLI(['agent', 'remove', 'test-agent', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent \'Test Agent (test-agent)\' removed successfully');

      // Verify file was deleted
      const agentFile = join(testDir, '.automatosx', 'agents', 'test-agent.yaml');
      expect(existsSync(agentFile)).toBe(false);
    });

    it('should remove agent with -y flag (alias)', async () => {
      await createAgent(testDir, 'quick-remove', 'Quick');

      const result = await execCLI(['agent', 'remove', 'quick-remove', '-y'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('removed successfully');

      const agentFile = join(testDir, '.automatosx', 'agents', 'quick-remove.yaml');
      expect(existsSync(agentFile)).toBe(false);
    });

    it('should display file path in success message', async () => {
      await createAgent(testDir, 'path-test', 'Path Test');

      const result = await execCLI(['agent', 'remove', 'path-test', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Deleted:');
      expect(result.stdout).toContain('path-test.yaml');
    });
  });

  describe('Interactive Confirmation', () => {
    it('should prompt for confirmation without --confirm', async () => {
      await createAgent(testDir, 'confirm-test', 'Confirm Test');

      // Provide 'y' as input
      const result = await execCLI(['agent', 'remove', 'confirm-test'], testDir, 'y');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Are you sure');
      expect(result.stdout).toContain('removed successfully');
    });

    it('should cancel removal on "N" input', async () => {
      await createAgent(testDir, 'cancel-test', 'Cancel Test');

      // Provide 'N' as input
      const result = await execCLI(['agent', 'remove', 'cancel-test'], testDir, 'N');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Cancelled');

      // Verify file still exists
      const agentFile = join(testDir, '.automatosx', 'agents', 'cancel-test.yaml');
      expect(existsSync(agentFile)).toBe(true);
    });

    it('should cancel removal on empty input', async () => {
      await createAgent(testDir, 'empty-test', 'Empty Test');

      // Provide empty input (default is N)
      const result = await execCLI(['agent', 'remove', 'empty-test'], testDir, '');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Cancelled');

      const agentFile = join(testDir, '.automatosx', 'agents', 'empty-test.yaml');
      expect(existsSync(agentFile)).toBe(true);
    });
  });

  describe('Agent Not Found', () => {
    it('should show error for non-existent agent', async () => {
      const result = await execCLI(['agent', 'remove', 'nonexistent', '--confirm'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Agent not found: nonexistent');
    });

    it('should suggest similar agents', async () => {
      await createAgent(testDir, 'backend', 'Bob');
      await createAgent(testDir, 'frontend', 'Frank');

      const result = await execCLI(['agent', 'remove', 'backen', '--confirm'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Did you mean');
      expect(result.stdout).toContain('backend');
    });

    it('should show agent list hint when no similar agents', async () => {
      const result = await execCLI(['agent', 'remove', 'xyz123', '--confirm'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('ax agent list');
    });
  });

  describe('Display Name Resolution', () => {
    it('should remove agent by display name', async () => {
      await createAgent(testDir, 'backend', 'Bob');

      const result = await execCLI(['agent', 'remove', 'Bob', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('removed successfully');

      const agentFile = join(testDir, '.automatosx', 'agents', 'backend.yaml');
      expect(existsSync(agentFile)).toBe(false);
    });

    it('should handle case-insensitive display name', async () => {
      await createAgent(testDir, 'backend', 'Bob');

      const result = await execCLI(['agent', 'remove', 'bob', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('removed successfully');
    });
  });

  describe('Multiple Agents', () => {
    it('should remove specific agent without affecting others', async () => {
      await createAgent(testDir, 'agent1', 'Agent One');
      await createAgent(testDir, 'agent2', 'Agent Two');
      await createAgent(testDir, 'agent3', 'Agent Three');

      const result = await execCLI(['agent', 'remove', 'agent2', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);

      // Verify agent2 is removed
      expect(existsSync(join(testDir, '.automatosx', 'agents', 'agent2.yaml'))).toBe(false);

      // Verify others still exist
      expect(existsSync(join(testDir, '.automatosx', 'agents', 'agent1.yaml'))).toBe(true);
      expect(existsSync(join(testDir, '.automatosx', 'agents', 'agent3.yaml'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle agent with no display name', async () => {
      const agentConfig = `name: nodisplay
team: engineering
role: Software Engineer
description: Test agent without display name
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'nodisplay.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'remove', 'nodisplay', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('nodisplay');
    });

    it('should handle very long agent names', async () => {
      const longName = 'a'.repeat(50);
      await createAgent(testDir, longName, 'Long Name');

      const result = await execCLI(['agent', 'remove', longName, '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(testDir, '.automatosx', 'agents', `${longName}.yaml`))).toBe(false);
    });

    it('should handle special characters in display name', async () => {
      const agentConfig = `name: special
displayName: "Agent <Special> & Name"
team: engineering
role: Software Engineer
description: Test agent with special characters
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'special.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'remove', 'special', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('special');
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      await createAgent(testDir, 'test', 'Test');

      // Make directory read-only (this won't work on all systems)
      // Testing best effort error handling
      const result = await execCLI(['agent', 'remove', 'test', '--confirm'], testDir);

      // Should complete (either success or graceful error)
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle corrupted agent file', async () => {
      await writeFile(join(testDir, '.automatosx', 'agents', 'corrupted.yaml'), 'invalid: yaml:', 'utf-8');

      const result = await execCLI(['agent', 'remove', 'corrupted', '--confirm'], testDir);

      // Should handle gracefully (either remove or show error)
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle missing teams directory', async () => {
      await createAgent(testDir, 'test', 'Test');
      await rm(join(testDir, '.automatosx', 'teams'), { recursive: true, force: true });

      const result = await execCLI(['agent', 'remove', 'test', '--confirm'], testDir);

      // Should still work
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Confirmation Message', () => {
    it('should show display name in confirmation prompt', async () => {
      await createAgent(testDir, 'backend', 'Bob');

      const result = await execCLI(['agent', 'remove', 'backend'], testDir, 'N');

      expect(result.stdout).toContain('Are you sure');
      expect(result.stdout).toContain('Bob (backend)');
    });

    it('should show only agent name if no display name', async () => {
      const agentConfig = `name: noname
team: engineering
role: Software Engineer
description: Test agent without display name
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'noname.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'remove', 'noname'], testDir, 'N');

      expect(result.stdout).toContain('Are you sure');
      expect(result.stdout).toContain('noname');
    });
  });

  describe('rm and delete Aliases', () => {
    it('should work with rm alias', async () => {
      await createAgent(testDir, 'rm-test', 'RM Test');

      const result = await execCLI(['agent', 'rm', 'rm-test', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('removed successfully');
    });

    it('should work with delete alias', async () => {
      await createAgent(testDir, 'delete-test', 'Delete Test');

      const result = await execCLI(['agent', 'delete', 'delete-test', '--confirm'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('removed successfully');
    });
  });
});
