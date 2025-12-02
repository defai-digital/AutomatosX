/**
 * CLI Config Get Command Tests
 * Tests the "ax config get" command functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

/**
 * Helper to execute CLI command
 */
async function execCLI(args: string[], cwd?: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
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

    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, 10000);
  });
}

/**
 * Helper to create test project with config
 */
async function createTestProject(testDir: string): Promise<void> {
  const automatosxDir = join(testDir, '.automatosx');
  await mkdir(automatosxDir, { recursive: true });

  const config = {
    version: '5.0.0',
    providers: {
      'claude-code': {
        enabled: true,
        command: 'claude',
        priority: 1,
        timeout: 900000
      },
      codex: {
        enabled: true,
        command: 'codex',
        priority: 2,
        timeout: 900000
      }
    },
    memory: {
      maxEntries: 10000,
      persistPath: '.automatosx/memory',
      autoCleanup: true,
      cleanupDays: 30
    },
    workspace: {
      prdPath: 'automatosx/PRD',
      tmpPath: 'automatosx/tmp',
      autoCleanupTmp: true,
      tmpCleanupDays: 7
    },
    logging: {
      level: 'info',
      path: '.automatosx/logs',
      console: false
    },
    execution: {
      defaultTimeout: 1500000,
      maxRetries: 2
    }
  };

  await writeFile(join(automatosxDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
}

describe('CLI Config Get Command', () => {
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
      const result = await execCLI(['config', '--help']);

      expect(result.stdout).toContain('-g, --get');
      expect(result.stdout).toContain('Get configuration value');
      expect(result.stdout).toContain('--verbose');
      expect(result.exitCode).toBe(0);
    });

    it('should show usage examples', async () => {
      const result = await execCLI(['config', '--help']);

      expect(result.stdout).toContain('Examples:');
      expect(result.stdout).toContain('config --get logging.level');
      expect(result.stdout).toContain('config --list');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Get Top-Level Values', () => {
    it('should get version', async () => {
      const result = await execCLI(['config', '--get', 'version'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('5.0.0');
    });

    it('should get entire providers object', async () => {
      const result = await execCLI(['config', '--get', 'providers'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('claude-code');
      expect(result.stdout).toContain('codex');
      expect(result.stdout).toContain('enabled');
    });

    it('should get entire memory object', async () => {
      const result = await execCLI(['config', '--get', 'memory'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('maxEntries');
      expect(result.stdout).toContain('10000');
      expect(result.stdout).toContain('persistPath');
    });
  });

  describe('Get Nested Values with Dot Notation', () => {
    it('should get memory.maxEntries', async () => {
      const result = await execCLI(['config', '--get', 'memory.maxEntries'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('10000');
    });

    it('should get logging.level', async () => {
      const result = await execCLI(['config', '--get', 'logging.level'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('info');
    });

    it('should get workspace.prdPath', async () => {
      const result = await execCLI(['config', '--get', 'workspace.prdPath'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('automatosx/PRD');
    });

    it('should get execution.defaultTimeout', async () => {
      const result = await execCLI(['config', '--get', 'execution.defaultTimeout'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1500000');
    });
  });

  describe('Get Provider Configuration', () => {
    it('should get provider object', async () => {
      const result = await execCLI(['config', '--get', 'providers.codex'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('enabled');
      expect(result.stdout).toContain('command');
      expect(result.stdout).toContain('priority');
    });

    it('should get provider.enabled', async () => {
      const result = await execCLI(['config', '--get', 'providers.codex.enabled'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('true');
    });

    it('should get provider.command', async () => {
      const result = await execCLI(['config', '--get', 'providers.codex.command'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('codex');
    });

    it('should get provider.priority', async () => {
      const result = await execCLI(['config', '--get', 'providers.codex.priority'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('2');
    });
  });

  describe('Boolean Values', () => {
    it('should display true correctly', async () => {
      const result = await execCLI(['config', '--get', 'memory.autoCleanup'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('true');
    });

    it('should display false correctly', async () => {
      const result = await execCLI(['config', '--get', 'logging.console'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('false');
    });
  });

  describe('Number Values', () => {
    it('should display integer values', async () => {
      const result = await execCLI(['config', '--get', 'memory.maxEntries'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('10000');
    });

    it('should display timeout values', async () => {
      const result = await execCLI(['config', '--get', 'execution.defaultTimeout'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1500000');
    });
  });

  describe('String Values', () => {
    it('should display string values', async () => {
      const result = await execCLI(['config', '--get', 'logging.level'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('info');
    });

    it('should display path values', async () => {
      const result = await execCLI(['config', '--get', 'memory.persistPath'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('.automatosx/memory');
    });
  });

  describe('Verbose Mode', () => {
    it('should show key name with --verbose', async () => {
      const result = await execCLI(['config', '--get', 'logging.level', '--verbose'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('logging.level');
      expect(result.stdout).toContain('info');
    });

    it('should show key name with -g alias (get)', async () => {
      const result = await execCLI(['config', '-g', 'memory.maxEntries', '--verbose'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('memory.maxEntries');
      expect(result.stdout).toContain('10000');
    });
  });

  describe('Key Not Found', () => {
    it('should show error for non-existent top-level key', async () => {
      const result = await execCLI(['config', '--get', 'nonexistent'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Configuration key not found');
      expect(result.stdout).toContain('nonexistent');
    });

    it('should show error for non-existent nested key', async () => {
      const result = await execCLI(['config', '--get', 'memory.nonexistent'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Configuration key not found');
    });

    it('should show error for deeply nested non-existent key', async () => {
      const result = await execCLI(['config', '--get', 'providers.codex.nonexistent'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Configuration key not found');
    });
  });

  describe('Config File Not Found', () => {
    it('should show error when config file missing', async () => {
      await rm(join(testDir, '.automatosx', 'config.json'), { force: true });

      const result = await execCLI(['config', '--get', 'version'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Configuration file not found');
      expect(result.stdout).toContain('automatosx setup');
    });
  });

  describe('JSON Formatting', () => {
    it('should format objects as JSON', async () => {
      const result = await execCLI(['config', '--get', 'memory'], testDir);

      expect(result.exitCode).toBe(0);
      // Should be valid JSON format
      expect(result.stdout).toContain('{');
      expect(result.stdout).toContain('}');
      expect(result.stdout).toContain('"maxEntries"');
    });

    it('should pretty-print JSON with indentation', async () => {
      const result = await execCLI(['config', '--get', 'providers.codex'], testDir);

      expect(result.exitCode).toBe(0);
      // Check for indentation
      const lines = result.stdout.split('\n');
      const indentedLines = lines.filter(line => line.startsWith('  '));
      expect(indentedLines.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long key paths', async () => {
      const result = await execCLI(['config', '--get', 'providers.claude-code.timeout'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('900000');
    });

    it('should handle keys with hyphens', async () => {
      const result = await execCLI(['config', '--get', 'providers.claude-code'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('claude');
    });

    it('should handle zero values', async () => {
      // Update config with zero value
      const config = JSON.parse(await import('fs/promises').then(fs =>
        fs.readFile(join(testDir, '.automatosx', 'config.json'), 'utf-8')
      ));
      config.execution.maxRetries = 0;
      await writeFile(
        join(testDir, '.automatosx', 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      const result = await execCLI(['config', '--get', 'execution.maxRetries'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('0');
    });

    it('should handle empty string values', async () => {
      const config = JSON.parse(await import('fs/promises').then(fs =>
        fs.readFile(join(testDir, '.automatosx', 'config.json'), 'utf-8')
      ));
      config.test = '';
      await writeFile(
        join(testDir, '.automatosx', 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      const result = await execCLI(['config', '--get', 'test'], testDir);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted JSON', async () => {
      await writeFile(join(testDir, '.automatosx', 'config.json'), '{ invalid json', 'utf-8');

      const result = await execCLI(['config', '--get', 'version'], testDir);

      expect(result.exitCode).not.toBe(0);
    });

    it('should handle empty config file', async () => {
      await writeFile(join(testDir, '.automatosx', 'config.json'), '', 'utf-8');

      const result = await execCLI(['config', '--get', 'version'], testDir);

      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Output Format', () => {
    it('should output only value in normal mode', async () => {
      const result = await execCLI(['config', '--get', 'logging.level'], testDir);

      expect(result.exitCode).toBe(0);
      // Should not have extra text, just the value
      const trimmed = result.stdout.trim();
      expect(trimmed).toBe('info');
    });

    it('should include key in verbose mode', async () => {
      const result = await execCLI(['config', '--get', 'logging.level', '--verbose'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('logging.level');
      expect(result.stdout).toContain(':');
    });
  });
});
