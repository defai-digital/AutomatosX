/**
 * Integration Tests for CLI: config command
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import { constants } from 'fs';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import type { AutomatosXConfig } from '../../src/types/config.js';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

describe('CLI: config command', () => {
  let testDir: string;
  let configPath: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'automatosx-config-test-'));
    const automatosxDir = join(testDir, '.automatosx');
    configPath = join(automatosxDir, 'config.json');

    // Create .automatosx directory
    await writeFile(join(testDir, '.gitkeep'), '', 'utf-8'); // Ensure testDir exists
    const { mkdir } = await import('fs/promises');
    await mkdir(automatosxDir, { recursive: true });

    // Create a valid config file
    const config: AutomatosXConfig = {
      ...DEFAULT_CONFIG,
      $schema: './schema/config.json',
      version: '5.0.0'
    };
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('--list', () => {
    it('should list all configuration', async () => {
      const result = await runCLI(['config', '--list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('AutomatosX Configuration');
      expect(result.stdout).toContain('Providers');
      expect(result.stdout).toContain('Memory');
      expect(result.stdout).toContain('Workspace');
      expect(result.stdout).toContain('Logging');
    }, 10000);

    it('should show detailed output with --verbose', async () => {
      const result = await runCLI(['config', '--list', '--verbose'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Priority');
      expect(result.stdout).toContain('Timeout');
      expect(result.stdout).toContain('Command');
      expect(result.stdout).toContain('Cleanup Days');
      expect(result.stdout).toContain('Tmp Path');
    }, 10000);
  });

  describe('--get', () => {
    it('should get top-level configuration value', async () => {
      const result = await runCLI(['config', '--get', 'logging.level'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('info');
    }, 10000);

    it('should get nested configuration value', async () => {
      const result = await runCLI(['config', '--get', 'memory.maxEntries'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('10000');
    }, 10000);

    it('should get object value as JSON', async () => {
      const result = await runCLI(['config', '--get', 'logging'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('level');
      expect(result.stdout).toContain('path');
      expect(result.stdout).toContain('console');
    }, 10000);

    it('should fail for invalid key', async () => {
      const result = await runCLI(['config', '--get', 'invalid.key'], testDir);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('not found');
    }, 10000);
  });

  describe('--set', () => {
    it('should set string configuration value', async () => {
      const result = await runCLI(['config', '--set', 'logging.level', '--value', 'debug'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration updated');

      // Verify file was updated
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.logging.level).toBe('debug');
    }, 10000);

    it('should set numeric configuration value', async () => {
      const result = await runCLI(['config', '--set', 'memory.maxEntries', '--value', '20000'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration updated');

      // Verify file was updated
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.memory.maxEntries).toBe(20000);
    }, 10000);

    it('should set boolean configuration value', async () => {
      const result = await runCLI(['config', '--set', 'workspace.autoCleanup', '--value', 'false'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration updated');

      // Verify file was updated
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.workspace.autoCleanup).toBe(false);
    }, 10000);

    it('should fail for invalid key', async () => {
      const result = await runCLI(['config', '--set', 'invalid.key', '--value', 'test'], testDir);

      expect(result.exitCode).toBe(1);
      const output = result.stdout + result.stderr;
      expect(output).toContain('not found');
    }, 10000);

    it('should fail when --value is missing', async () => {
      const result = await runCLI(['config', '--set', 'logging.level'], testDir);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('--value is required');
    }, 10000);

    it('should fail for invalid value (validation)', async () => {
      const result = await runCLI(['config', '--set', 'memory.maxEntries', '--value', '50'], testDir);

      expect(result.exitCode).toBe(1);
      const output = result.stdout + result.stderr;
      expect(output).toContain('Validation failed');
      expect(output).toContain('maxEntries must be >= 100');
    }, 10000);
  });

  describe('--validate', () => {
    it('should validate valid configuration', async () => {
      const result = await runCLI(['config', '--validate'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration is valid');
    }, 10000);

    it('should fail for invalid configuration', async () => {
      // Create invalid config
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        memory: {
          ...DEFAULT_CONFIG.memory,
          maxEntries: 50 // Invalid: should be >= 100
        }
      };
      await writeFile(configPath, JSON.stringify(invalidConfig, null, 2), 'utf-8');

      const result = await runCLI(['config', '--validate'], testDir);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('validation error');
      expect(result.stdout).toContain('maxEntries must be >= 100');
    }, 10000);

    it('should show detailed validation info with --verbose', async () => {
      const result = await runCLI(['config', '--validate', '--verbose'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Validation checks passed');
      expect(result.stdout).toContain('All required fields present');
      expect(result.stdout).toContain('At least one provider enabled');
    }, 10000);
  });

  describe('--reset', () => {
    it('should reset configuration to defaults', async () => {
      // Modify config first
      await runCLI(['config', '--set', 'logging.level', '--value', 'debug'], testDir);

      // Reset
      const result = await runCLI(['config', '--reset'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration reset to defaults');

      // Verify file was reset
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.logging.level).toBe(DEFAULT_CONFIG.logging.level);
      // Note: $schema is no longer included (not copied to user projects)
      expect(config.$schema).toBeUndefined();
      // Version field is optional after reset (v8.3.0: version moved to package.json)
      if (config.version) {
        expect(config.version).toMatch(/^\d+\.\d+\.\d+/); // Semantic version format if present
      }
    }, 10000);
  });

  describe('no options', () => {
    it('should show config file path', async () => {
      const result = await runCLI(['config'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration file');
      expect(result.stdout).toContain('.automatosx/config.json');
    }, 10000);
  });

  describe('error handling', () => {
    it('should fail when config file does not exist', async () => {
      // Remove config file and directory
      await rm(join(testDir, '.automatosx'), { recursive: true, force: true });

      const result = await runCLI(['config', '--list'], testDir);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Configuration file not found');
      expect(result.stdout).toContain('automatosx setup');
    }, 10000);
  });
});

/**
 * Helper: Check if path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Run CLI command
 */
function runCLI(args: string[], cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
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
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
  });
}
