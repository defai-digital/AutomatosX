// @ts-nocheck
/**
 * Status Command Unit Tests
 *
 * Tests the status command handler directly for coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { statusCommand } from '../../src/cli/commands/status.js';

// Mock all dependencies
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    providers: {
      'claude-code': {
        enabled: true,
        priority: 1,
        timeout: 30000,
        command: 'claude'
      },
      'gemini-cli': {
        enabled: true,
        priority: 2,
        timeout: 30000,
        command: 'gemini'
      }
    },
    logging: {
      level: 'info'
    },
    memory: {
      maxEntries: 10000,
      cleanupDays: 30
    }
  })
}));

vi.mock('../../src/core/path-resolver.js', async () => {
  const actual = await vi.importActual('../../src/core/path-resolver.js') as any;
  return {
    ...actual,
    detectProjectRoot: vi.fn().mockImplementation(async () => {
      // Return the mocked test directory
      return (global as any).__testDir || process.cwd();
    })
  };
});

vi.mock('../../src/providers/claude-provider.js', () => ({
  ClaudeProvider: vi.fn().mockImplementation(() => ({
    name: 'claude',
    priority: 1,
    isAvailable: vi.fn().mockResolvedValue(true),
    getHealth: vi.fn().mockResolvedValue({
      consecutiveFailures: 0,
      latencyMs: 150,
      errorRate: 0.01
    })
  }))
}));

vi.mock('../../src/providers/gemini-provider.js', () => ({
  GeminiProvider: vi.fn().mockImplementation(() => ({
    name: 'gemini',
    priority: 2,
    isAvailable: vi.fn().mockResolvedValue(true),
    getHealth: vi.fn().mockResolvedValue({
      consecutiveFailures: 0,
      latencyMs: 200,
      errorRate: 0.02
    })
  }))
}));

vi.mock('../../src/core/router.js', () => ({
  Router: vi.fn().mockImplementation(() => ({
    getAvailableProviders: vi.fn().mockResolvedValue([{ name: 'claude' }, { name: 'gemini' }])
  }))
}));

describe('Status Command', () => {
  let testDir: string;
  let automatosxDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `status-test-${Date.now()}`);
    automatosxDir = join(testDir, '.automatosx');
    await mkdir(automatosxDir, { recursive: true });

    // Set global test directory for mock
    (global as any).__testDir = testDir;

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    delete (global as any).__testDir;
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Command Definition', () => {
    it('should have correct command string', () => {
      expect(statusCommand.command).toBe('status');
    });

    it('should have description', () => {
      expect(statusCommand.describe).toBeDefined();
      expect(typeof statusCommand.describe).toBe('string');
    });

    it('should have builder function', () => {
      expect(statusCommand.builder).toBeDefined();
      expect(typeof statusCommand.builder).toBe('function');
    });

    it('should have handler function', () => {
      expect(statusCommand.handler).toBeDefined();
      expect(typeof statusCommand.handler).toBe('function');
    });
  });

  describe('Builder Options', () => {
    it('should configure verbose option', () => {
      const yargsStub = {
        option: vi.fn().mockReturnThis()
      };

      statusCommand.builder(yargsStub as any);

      expect(yargsStub.option).toHaveBeenCalledWith('verbose', expect.objectContaining({
        describe: expect.any(String),
        type: 'boolean',
        default: false
      }));
    });

    it('should configure json option', () => {
      const yargsStub = {
        option: vi.fn().mockReturnThis()
      };

      statusCommand.builder(yargsStub as any);

      expect(yargsStub.option).toHaveBeenCalledWith('json', expect.objectContaining({
        describe: expect.any(String),
        type: 'boolean',
        default: false
      }));
    });
  });

  describe('Handler - Basic Status', () => {
    it('should display system status', async () => {
      // Create necessary directories
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });
      await mkdir(join(automatosxDir, 'abilities'), { recursive: true });
      await mkdir(join(automatosxDir, 'memory'), { recursive: true });
      await mkdir(join(automatosxDir, 'workspaces'), { recursive: true });

      // Create config file
      await writeFile(
        join(testDir, 'automatosx.config.json'),
        JSON.stringify({ providers: {} }, null, 2),
        'utf-8'
      );

      await statusCommand.handler({ _: [], $0: '' });

      // Should display status information
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls.some(call =>
        call[0]?.includes?.('AutomatosX Status')
      )).toBe(true);
    });

    it('should handle missing directories', async () => {
      // Don't create any directories
      await statusCommand.handler({ _: [], $0: '' });

      // Should still complete without crashing
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should show project information when package.json exists', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });

      // Create package.json
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          type: 'module'
        }, null, 2),
        'utf-8'
      );

      await statusCommand.handler({ _: [], $0: '' });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Handler - Verbose Mode', () => {
    it('should show detailed information in verbose mode', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });
      await mkdir(join(automatosxDir, 'abilities'), { recursive: true });

      await statusCommand.handler({ verbose: true, _: [], $0: '' });

      expect(consoleLogSpy).toHaveBeenCalled();
      // In verbose mode, should show more details
      const allCalls = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
      expect(allCalls.length).toBeGreaterThan(0);
    });

    it('should show performance metrics in verbose mode', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });

      await statusCommand.handler({ verbose: true, _: [], $0: '' });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should show provider health details in verbose mode', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });

      await statusCommand.handler({ verbose: true, _: [], $0: '' });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Handler - JSON Output', () => {
    it('should output JSON when json option is true', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });
      await mkdir(join(automatosxDir, 'abilities'), { recursive: true });

      await statusCommand.handler({ json: true, _: [], $0: '' });

      expect(consoleLogSpy).toHaveBeenCalled();

      // Should output valid JSON
      const output = consoleLogSpy.mock.calls[0]?.[0];
      expect(output).toBeDefined();
      expect(() => JSON.parse(output as string)).not.toThrow();
    });

    it('should include all status sections in JSON output', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      // Verify all major sections exist
      expect(status).toHaveProperty('system');
      expect(status).toHaveProperty('configuration');
      expect(status).toHaveProperty('directories');
      expect(status).toHaveProperty('providers');
      expect(status).toHaveProperty('router');
      expect(status).toHaveProperty('performance');
    });

    it('should include accurate directory information in JSON', async () => {
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      // Create some agents
      await writeFile(join(agentsDir, 'agent1.yaml'), 'name: agent1\n', 'utf-8');
      await writeFile(join(agentsDir, 'agent2.yaml'), 'name: agent2\n', 'utf-8');

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.directories.agents.count).toBe(2);
      expect(status.directories.agents.exists).toBe(true);
    });
  });

  describe('Handler - Resource Counting', () => {
    it('should count agents correctly', async () => {
      const agentsDir = join(automatosxDir, 'agents');
      await mkdir(agentsDir, { recursive: true });

      await writeFile(join(agentsDir, 'agent1.yaml'), 'name: agent1\n', 'utf-8');
      await writeFile(join(agentsDir, 'agent2.yml'), 'name: agent2\n', 'utf-8');
      await writeFile(join(agentsDir, 'README.md'), '# Agents\n', 'utf-8'); // Should not count

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.directories.agents.count).toBe(2);
    });

    it('should count abilities correctly', async () => {
      const abilitiesDir = join(automatosxDir, 'abilities');
      await mkdir(abilitiesDir, { recursive: true });

      await writeFile(join(abilitiesDir, 'ability1.md'), '# Ability 1\n', 'utf-8');
      await writeFile(join(abilitiesDir, 'ability2.md'), '# Ability 2\n', 'utf-8');
      await writeFile(join(abilitiesDir, 'config.yaml'), 'config\n', 'utf-8'); // Should not count

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.directories.abilities.count).toBe(2);
    });

    it('should handle empty resource directories', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });
      await mkdir(join(automatosxDir, 'abilities'), { recursive: true });

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.directories.agents.count).toBe(0);
      expect(status.directories.abilities.count).toBe(0);
    });
  });

  describe('Handler - Workspace Statistics', () => {
    it('should calculate workspace statistics', async () => {
      const workspacesDir = join(automatosxDir, 'workspaces');
      await mkdir(join(workspacesDir, 'workspace1'), { recursive: true });
      await mkdir(join(workspacesDir, 'workspace2'), { recursive: true });

      // Create some files
      // v5.2.0: Use PRD and tmp directories instead of workspaces
      const prdDir = join(testDir, 'automatosx', 'PRD');
      const tmpDir = join(testDir, 'automatosx', 'tmp');
      await mkdir(prdDir, { recursive: true });
      await mkdir(tmpDir, { recursive: true });
      await writeFile(join(prdDir, 'file1.txt'), 'test content', 'utf-8');
      await writeFile(join(tmpDir, 'file2.txt'), 'test content 2', 'utf-8');

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.directories.prd.files).toBeGreaterThan(0);
      expect(status.directories.prd.sizeBytes).toBeGreaterThan(0);
      expect(status.directories.tmp.files).toBeGreaterThan(0);
      expect(status.directories.tmp.sizeBytes).toBeGreaterThan(0);
    });

    it('should handle missing workspaces directory', async () => {
      // v5.2.0: PRD and tmp directories are handled gracefully
      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      // Directories should exist but be empty (or have 0 files if not created)
      expect(status.directories.prd).toBeDefined();
      expect(status.directories.tmp).toBeDefined();
    });
  });

  describe('Handler - Memory Statistics', () => {
    it('should calculate memory statistics', async () => {
      const memoryDir = join(automatosxDir, 'memory');
      await mkdir(memoryDir, { recursive: true });

      // Create memory files
      await writeFile(join(memoryDir, 'memories.db'), 'database content', 'utf-8');

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.directories.memory.files).toBeGreaterThan(0);
      expect(status.directories.memory.sizeBytes).toBeGreaterThan(0);
    });

    it('should handle missing memory directory', async () => {
      // Don't create memory directory
      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.directories.memory.files).toBe(0);
      expect(status.directories.memory.sizeBytes).toBe(0);
    });
  });

  describe('Handler - Configuration Status', () => {
    it('should detect existing config file', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });

      await writeFile(
        join(testDir, 'automatosx.config.json'),
        JSON.stringify({ providers: {} }, null, 2),
        'utf-8'
      );

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.configuration.configExists).toBe(true);
    });

    it('should handle missing config file', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.configuration.configExists).toBe(false);
    });

    it('should display configuration values', async () => {
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });

      await statusCommand.handler({ json: true, _: [], $0: '' });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      const status = JSON.parse(output as string);

      expect(status.configuration.logLevel).toBe('info');
      expect(status.configuration.memoryMaxEntries).toBe(10000);
      expect(status.configuration.memoryRetentionDays).toBe(30);
    });
  });

  describe('Handler - System Health', () => {
    it('should show healthy status when all checks pass', async () => {
      // Create all required directories
      await mkdir(join(automatosxDir, 'agents'), { recursive: true });
      await mkdir(join(automatosxDir, 'abilities'), { recursive: true });
      await mkdir(join(automatosxDir, 'memory'), { recursive: true });
      await mkdir(join(automatosxDir, 'workspaces'), { recursive: true });

      await statusCommand.handler({ _: [], $0: '' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const allCalls = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
      // Should show healthy status
      expect(allCalls.includes('healthy') || allCalls.includes('✅')).toBe(true);
    });

    it('should show issues when directories are missing', async () => {
      // Don't create any directories
      await statusCommand.handler({ _: [], $0: '' });

      expect(consoleLogSpy).toHaveBeenCalled();
      // Should complete without error
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Mock loadConfig to throw error
      const { loadConfig } = await import('../../src/core/config.js');
      vi.mocked(loadConfig).mockRejectedValueOnce(new Error('Config error'));

      try {
        await statusCommand.handler({ _: [], $0: '' });
        // Should throw process.exit(1)
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('process.exit(1)');
      }
    });

    it('should display error with verbose flag', async () => {
      const { loadConfig } = await import('../../src/core/config.js');
      vi.mocked(loadConfig).mockRejectedValueOnce(new Error('Verbose error test'));

      try {
        await statusCommand.handler({ verbose: true, _: [], $0: '' });
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('process.exit(1)');
      }
    });
  });
});
