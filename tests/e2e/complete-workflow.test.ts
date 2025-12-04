/**
 * E2E Complete Workflow Tests
 *
 * Tests complete user workflows from init to execution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import {
  createTestEnv,
  cleanupTestEnv,
  createAgentProfile,
  execCLI,
  addMemory,
  listMemory,
  readConfig,
  updateConfig,
  assertSuccess,
  assertOutputContains,
  type E2ETestEnv
} from './helpers';

describe('E2E Complete Workflows', () => {
  let env: E2ETestEnv;

  beforeEach(async () => {
    env = await createTestEnv();
  }, 15000);

  afterEach(async () => {
    await cleanupTestEnv(env);
  }, 10000);

  describe('Core Workflows', () => {
    it('should complete init → configure → run workflow', async () => {
      // Step 1: Check status (before init)
      const statusBefore = await execCLI(env, ['status']);
      assertSuccess(statusBefore);
      assertOutputContains(statusBefore.stdout, 'AutomatosX');

      // Step 2: Create agent profile
      await createAgentProfile(env, 'assistant', {
        role: 'assistant',
        description: 'General purpose assistant',
        systemPrompt: 'You are a helpful assistant.'
      });

      // Step 3: Run agent
      // v8.5.8: In non-TTY environments, quiet mode is auto-detected
      // Check for "📝 Result" which is always shown in output
      const runResult = await execCLI(env, ['run', 'assistant', 'Hello, test!'], {
        timeout: 20000
      });
      assertSuccess(runResult);
      assertOutputContains(runResult.stdout, '📝 Result');

      // Step 4: Check status (after run)
      const statusAfter = await execCLI(env, ['status']);
      assertSuccess(statusAfter);
    }, 30000);

    it('should persist memory across commands', async () => {
      // Step 1: Add memory entries
      const add1 = await addMemory(env, 'Test task 1', 'task');
      assertOutputContains(add1, /added|success/i);

      const add2 = await addMemory(env, 'Test task 2', 'task');
      assertOutputContains(add2, /added|success/i);

      // Step 2: List memory
      const list1 = await listMemory(env);
      assertOutputContains(list1, 'Test task 1');
      assertOutputContains(list1, 'Test task 2');

      // Step 3: Create agent and run
      await createAgentProfile(env, 'assistant');
      const runResult = await execCLI(env, ['run', 'assistant', 'Use memory'], {
        timeout: 20000
      });
      assertSuccess(runResult);

      // Step 4: Verify memory still exists
      const list2 = await listMemory(env);
      assertOutputContains(list2, 'Test task 1');
      assertOutputContains(list2, 'Test task 2');
    }, 30000);

    it('should handle multi-command workflow', async () => {
      // Step 1: Add memory
      await addMemory(env, 'Important context', 'task');

      // Step 2: List memory
      const list = await listMemory(env);
      assertOutputContains(list, 'Important context');

      // Step 3: Create agent
      await createAgentProfile(env, 'worker');

      // Step 4: Run agent
      const run = await execCLI(env, ['run', 'worker', 'Do something'], {
        timeout: 20000
      });
      assertSuccess(run);

      // Step 5: Export memory
      const exportResult = await execCLI(env, [
        'memory',
        'export',
        '/tmp/test-export.json'
      ]);
      assertSuccess(exportResult);

      // Step 6: Check status
      const status = await execCLI(env, ['status']);
      assertSuccess(status);
    }, 35000);

    it('should persist configuration changes', async () => {
      // Step 1: Read initial config
      const config1 = await readConfig(env);
      expect(config1.version).toBe('5.0.0');

      // Step 2: Update config via CLI
      const configResult = await execCLI(env, [
        'config',
        '--set',
        'logging.level',
        '--value',
        'debug'
      ]);
      assertSuccess(configResult);

      // Step 3: Verify config was updated
      const config2 = await readConfig(env);
      expect(config2.logging.level).toBe('debug');

      // Step 4: Run command with new config
      await createAgentProfile(env, 'test');
      const run = await execCLI(env, ['run', 'test', 'Test with debug'], {
        timeout: 20000
      });
      assertSuccess(run);
    }, 30000);

    it('should recover from errors gracefully', async () => {
      // Step 1: Try to run non-existent agent (should fail with --no-auto-select)
      // v11.1.0: Without --no-auto-select, auto-selection would pick a fallback agent
      const run1 = await execCLI(env, ['run', 'nonexistent', 'test', '--no-auto-select']);
      expect(run1.exitCode).not.toBe(0);
      // v4.7.5+: Shows intelligent suggestions instead of simple "not found"
      assertOutputContains(run1.stderr + run1.stdout, /Agent not found|Did you mean|Available agents/i);

      // Step 2: Create the agent
      await createAgentProfile(env, 'nonexistent');

      // Step 3: Retry (should succeed)
      const run2 = await execCLI(env, ['run', 'nonexistent', 'test'], {
        timeout: 20000
      });
      assertSuccess(run2);
    }, 30000);
  });

  describe('Advanced Scenarios', () => {
    it('should handle memory export → import workflow', async () => {
      // Step 1: Add multiple memory entries
      await addMemory(env, 'Task 1', 'task');
      await addMemory(env, 'Task 2', 'task');
      await addMemory(env, 'Document 1', 'document');

      // Step 2: Export memory
      const exportPath = '/tmp/e2e-export.json';
      const memoryDbPath = join(env.testDir, '.automatosx', 'memory', 'memory.db');
      const exportResult = await execCLI(env, ['memory', 'export', exportPath, '--db', memoryDbPath]);
      assertSuccess(exportResult);
      assertOutputContains(exportResult.stdout, /exported|success/i);

      // Step 3: Clear memory
      const clearResult = await execCLI(env, ['memory', 'clear', '--all', '--confirm', '--db', memoryDbPath]);
      assertSuccess(clearResult);

      // Step 4: Verify memory is empty
      const listEmpty = await listMemory(env);
      expect(listEmpty).not.toContain('Task 1');

      // Step 5: Import memory
      const importResult = await execCLI(env, ['memory', 'import', exportPath, '--db', memoryDbPath]);
      assertSuccess(importResult);
      assertOutputContains(importResult.stdout, /imported|success/i);

      // Step 6: Verify memory is restored
      const listRestored = await listMemory(env);
      assertOutputContains(listRestored, 'Task 1');
      assertOutputContains(listRestored, 'Task 2');
      assertOutputContains(listRestored, 'Document 1');
    }, 40000);

    it('should support configuration changes persistence', async () => {
      // Step 1: Update multiple config values
      await execCLI(env, ['config', '--set', 'logging.level', '--value', 'debug']);

      // Step 2: Verify changes persisted
      const config = await readConfig(env);
      expect(config.logging.level).toBe('debug');

      // Step 3: Reset a value
      await execCLI(env, ['config', '--set', 'logging.level', '--value', 'info']);

      // Step 4: Verify reset
      const config2 = await readConfig(env);
      expect(config2.logging.level).toBe('info');
    }, 30000);

    it('should handle agent execution with memory injection', async () => {
      // Step 1: Add contextual memory
      await addMemory(env, 'User prefers concise responses', 'task');
      await addMemory(env, 'Project uses TypeScript', 'document');

      // Step 2: Create agent
      await createAgentProfile(env, 'coder', {
        role: 'developer',
        systemPrompt: 'You are a code assistant. Use provided context.'
      });

      // Step 3: Run agent (should have access to memory)
      const run = await execCLI(env, ['run', 'coder', 'Write a hello function'], {
        timeout: 40000
      });
      assertSuccess(run);
      // v8.5.8: In non-TTY environments, check for "📝 Result" instead of "Complete"
      assertOutputContains(run.stdout, '📝 Result');
    }, 60000);

    it('should support resource cleanup after execution', async () => {
      // Step 1: Create agent and run
      await createAgentProfile(env, 'worker');
      const run1 = await execCLI(env, ['run', 'worker', 'Task 1'], {
        timeout: 20000
      });
      assertSuccess(run1);

      // Step 2: Run again (should not conflict)
      const run2 = await execCLI(env, ['run', 'worker', 'Task 2'], {
        timeout: 20000
      });
      assertSuccess(run2);

      // Step 3: Verify no temp files leaked
      const status = await execCLI(env, ['status']);
      assertSuccess(status);
    }, 40000);

    it('should maintain state consistency across workflow', async () => {
      // Step 1: Initial state
      const stats1 = await execCLI(env, ['memory', 'stats']);
      assertSuccess(stats1);

      // Step 2: Add memory
      await addMemory(env, 'State test', 'task');

      // Step 3: Verify state updated
      const stats2 = await execCLI(env, ['memory', 'stats']);
      assertSuccess(stats2);
      assertOutputContains(stats2.stdout, '1'); // 1 entry

      // Step 4: Clear all and verify
      await execCLI(env, ['memory', 'clear', '--all', '--confirm']);

      // Step 5: Verify final state (should be 0)
      const statsFinal = await execCLI(env, ['memory', 'stats']);
      assertSuccess(statsFinal);
      assertOutputContains(statsFinal.stdout, '0');
    }, 30000);

    it('should handle long task execution', async () => {
      // Create agent
      await createAgentProfile(env, 'worker');

      // Run with extended timeout
      const run = await execCLI(
        env,
        ['run', 'worker', 'Analyze this complex problem in detail'],
        { timeout: 30000 }
      );

      assertSuccess(run);
      // v8.5.8: In non-TTY environments, check for "📝 Result" instead of "Complete"
      assertOutputContains(run.stdout, '📝 Result');
    }, 40000); // Test timeout > command timeout

    it('should handle partial failure scenarios', async () => {
      // Step 1: Successful operation
      await addMemory(env, 'Success 1', 'task');

      // Step 2: Failed operation (invalid type)
      const failed = await execCLI(env, ['memory', 'add', 'Test', '--type', 'invalid']);
      expect(failed.exitCode).not.toBe(0);

      // Step 3: Another successful operation
      await addMemory(env, 'Success 2', 'task');

      // Step 4: Verify workflow continued
      const list = await listMemory(env);
      assertOutputContains(list, 'Success 1');
      assertOutputContains(list, 'Success 2');
    }, 30000);

    it('should support agent profile switching', async () => {
      // Step 1: Create multiple agents
      await createAgentProfile(env, 'assistant', {
        role: 'assistant',
        systemPrompt: 'You are a general assistant.'
      });
      await createAgentProfile(env, 'coder', {
        role: 'developer',
        systemPrompt: 'You are a code expert.'
      });

      // Step 2: Run first agent
      const run1 = await execCLI(env, ['run', 'assistant', 'General task'], {
        timeout: 20000
      });
      assertSuccess(run1);

      // Step 3: Run second agent
      const run2 = await execCLI(env, ['run', 'coder', 'Code task'], {
        timeout: 20000
      });
      assertSuccess(run2);

      // Both should succeed independently
      // v8.5.8: In non-TTY environments, check for "📝 Result" instead of "Complete"
      assertOutputContains(run1.stdout, '📝 Result');
      assertOutputContains(run2.stdout, '📝 Result');
    }, 40000);

    it('should handle memory filtering workflow', async () => {
      // Step 1: Add diverse memory types
      await addMemory(env, 'Task item', 'task');
      await addMemory(env, 'Code snippet', 'code');
      await addMemory(env, 'Documentation', 'document');

      // Step 2: Filter by type
      const tasks = await listMemory(env, { type: 'task' });
      assertOutputContains(tasks, 'Task item');
      expect(tasks).not.toContain('Code snippet');

      const code = await listMemory(env, { type: 'code' });
      assertOutputContains(code, 'Code snippet');
      expect(code).not.toContain('Task item');

      // Step 3: List all
      const all = await listMemory(env);
      assertOutputContains(all, 'Task item');
      assertOutputContains(all, 'Code snippet');
      assertOutputContains(all, 'Documentation');
    }, 30000);

    it('should verify command help accessibility', async () => {
      // All commands should have help
      const commands = ['run', 'memory', 'config', 'status', 'list'];

      for (const cmd of commands) {
        const help = await execCLI(env, [cmd, '--help']);
        assertSuccess(help);
        assertOutputContains(help.stdout, cmd);
      }
    }, 20000);
  });
});
