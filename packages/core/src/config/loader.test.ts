/**
 * Config Loader Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig, loadConfigSync, getDefaultConfig, isValidConfig } from './loader.js';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('Config Loader', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), 'ax-config-test-' + randomUUID());
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
    // Reset environment variables
    delete process.env.AX_PROVIDER;
    delete process.env.AX_DEBUG;
    delete process.env.AX_TIMEOUT;
  });

  describe('loadConfig()', () => {
    it('should load default config when no file exists', async () => {
      const { config, source } = await loadConfig({ baseDir: testDir });

      expect(source).toBe('default');
      expect(config.providers.default).toBe('claude');
    });

    it('should load from JSON config file', async () => {
      const configPath = join(testDir, 'ax.config.json');
      await writeFile(configPath, JSON.stringify({
        providers: { default: 'gemini' },
      }));

      const { config, configPath: loadedPath, source } = await loadConfig({ baseDir: testDir });

      expect(source).toBe('file');
      expect(loadedPath).toBe(configPath);
      expect(config.providers.default).toBe('gemini');
    });

    it('should load from YAML config file', async () => {
      const configPath = join(testDir, 'ax.config.yaml');
      await writeFile(configPath, `
providers:
  default: openai
execution:
  timeout: 60000
`);

      const { config, source } = await loadConfig({ baseDir: testDir });

      expect(source).toBe('file');
      expect(config.providers.default).toBe('openai');
      expect(config.execution.timeout).toBe(60000);
    });

    it('should merge file config with defaults', async () => {
      const configPath = join(testDir, 'ax.config.json');
      await writeFile(configPath, JSON.stringify({
        providers: { default: 'gemini' },
        // Not specifying execution, should use defaults
      }));

      const { config } = await loadConfig({ baseDir: testDir });

      expect(config.providers.default).toBe('gemini');
      expect(config.execution.timeout).toBeGreaterThan(0); // Default value
    });

    it('should apply environment variable overrides', async () => {
      process.env.AX_PROVIDER = 'openai';

      const { config, source } = await loadConfig({ baseDir: testDir });

      expect(source).toBe('env');
      expect(config.providers.default).toBe('openai');
    });

    it('should prioritize env over file config', async () => {
      const configPath = join(testDir, 'ax.config.json');
      await writeFile(configPath, JSON.stringify({
        providers: { default: 'gemini' },
      }));

      process.env.AX_PROVIDER = 'claude';

      const { config, source } = await loadConfig({ baseDir: testDir });

      expect(source).toBe('env');
      expect(config.providers.default).toBe('claude');
    });

    it('should handle AX_DEBUG environment variable', async () => {
      process.env.AX_DEBUG = 'true';

      const { config } = await loadConfig({ baseDir: testDir });

      expect(config.logging.level).toBe('debug');
    });

    it('should handle AX_TIMEOUT environment variable', async () => {
      process.env.AX_TIMEOUT = '30000';

      const { config } = await loadConfig({ baseDir: testDir });

      expect(config.execution.timeout).toBe(30000);
    });

    it('should ignore invalid AX_TIMEOUT', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.AX_TIMEOUT = 'invalid';

      const { config } = await loadConfig({ baseDir: testDir });

      expect(config.execution.timeout).toBe(300000); // Default value (5 minutes)
      consoleSpy.mockRestore();
    });

    it('should search parent directories', async () => {
      const subDir = join(testDir, 'sub', 'dir');
      await mkdir(subDir, { recursive: true });

      const configPath = join(testDir, 'ax.config.json');
      await writeFile(configPath, JSON.stringify({
        providers: { default: 'gemini' },
      }));

      const { config, configPath: loadedPath } = await loadConfig({ baseDir: subDir });

      expect(loadedPath).toBe(configPath);
      expect(config.providers.default).toBe('gemini');
    });

    it('should not search parents when disabled', async () => {
      const subDir = join(testDir, 'sub');
      await mkdir(subDir, { recursive: true });

      const configPath = join(testDir, 'ax.config.json');
      await writeFile(configPath, JSON.stringify({
        providers: { default: 'gemini' },
      }));

      const { source, configPath: loadedPath } = await loadConfig({
        baseDir: subDir,
        searchParents: false,
      });

      expect(loadedPath).toBeNull();
      expect(source).toBe('default');
    });

    it('should use specific file name when provided', async () => {
      const configPath = join(testDir, 'custom.config.json');
      await writeFile(configPath, JSON.stringify({
        providers: { default: 'openai' },
      }));

      const { config, configPath: loadedPath } = await loadConfig({
        baseDir: testDir,
        fileName: 'custom.config.json',
      });

      expect(loadedPath).toBe(configPath);
      expect(config.providers.default).toBe('openai');
    });

    it('should handle malformed config file gracefully', async () => {
      const configPath = join(testDir, 'ax.config.json');
      await writeFile(configPath, 'not valid json');

      await expect(loadConfig({ baseDir: testDir })).rejects.toThrow('Failed to parse');
    });

    it('should use custom env prefix', async () => {
      process.env.CUSTOM_PROVIDER = 'gemini';

      const { config, source } = await loadConfig({
        baseDir: testDir,
        envPrefix: 'CUSTOM',
      });

      expect(source).toBe('env');
      expect(config.providers.default).toBe('gemini');

      delete process.env.CUSTOM_PROVIDER;
    });
  });

  describe('loadConfigSync()', () => {
    it('should return default config', () => {
      const config = loadConfigSync();

      expect(config.providers.default).toBe('claude');
    });

    it('should apply environment overrides', () => {
      process.env.AX_PROVIDER = 'openai';

      const config = loadConfigSync();

      expect(config.providers.default).toBe('openai');
    });
  });

  describe('getDefaultConfig()', () => {
    it('should return a copy of default config', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should have required fields', () => {
      const config = getDefaultConfig();

      expect(config.providers).toBeDefined();
      expect(config.execution).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.session).toBeDefined();
    });
  });

  describe('isValidConfig()', () => {
    it('should return true for valid config', () => {
      const config = getDefaultConfig();
      expect(isValidConfig(config)).toBe(true);
    });

    it('should return false for invalid config', () => {
      // ConfigSchema has defaults for all fields, so extra properties don't fail
      // Use invalid nested values that fail refinements
      expect(isValidConfig({
        execution: {
          retry: {
            initialDelay: 10000,
            maxDelay: 100, // maxDelay < initialDelay fails refinement
          },
        },
      })).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidConfig(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidConfig(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidConfig('string')).toBe(false);
      expect(isValidConfig(123)).toBe(false);
    });
  });
});
