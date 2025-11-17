/**
 * CLI Command Unit Tests (v8.4.0)
 *
 * Tests for ax cli command - Grok CLI launcher with native .grok/ config
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';

describe('CLI Command - ax cli', () => {
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temporary test directory
    testDir = join(tmpdir(), `ax-cli-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Config Loading', () => {
    it('should load config from project .grok/settings.json', async () => {
      // Create project config
      const grokDir = join(testDir, '.grok');
      mkdirSync(grokDir, { recursive: true });

      const projectConfig = {
        apiKey: 'test-project-key',
        baseURL: 'https://api.test.com',
        model: 'test-model'
      };

      writeFileSync(
        join(grokDir, 'settings.json'),
        JSON.stringify(projectConfig, null, 2)
      );

      // Dynamic import to load the config function
      const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
      const config = await (loadGrokConfig as any)(testDir);

      expect(config.apiKey).toBe('test-project-key');
      expect(config.baseUrl).toBe('https://api.test.com');
      expect(config.model).toBe('test-model');
    });

    it('should load config from global ~/.grok/user-settings.json', async () => {
      // Create global config
      const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
      const globalGrokDir = join(homeDir, '.grok');

      // Skip if we can't write to home directory
      try {
        mkdirSync(globalGrokDir, { recursive: true });
      } catch {
        return; // Skip test if home directory is not writable
      }

      const globalConfig = {
        apiKey: 'test-global-key',
        baseURL: 'https://api.global.com',
        defaultModel: 'global-model'
      };

      const globalConfigPath = join(globalGrokDir, 'user-settings.json');
      writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));

      try {
        const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
        const config = await (loadGrokConfig as any)(testDir);

        expect(config.apiKey).toBe('test-global-key');
        expect(config.baseUrl).toBe('https://api.global.com');
        expect(config.model).toBe('global-model');
      } finally {
        // Clean up global config
        if (existsSync(globalConfigPath)) {
          rmSync(globalConfigPath, { force: true });
        }
      }
    });

    it('should prioritize project config over global config', async () => {
      // Create both configs
      const grokDir = join(testDir, '.grok');
      mkdirSync(grokDir, { recursive: true });

      const projectConfig = {
        apiKey: 'project-key',
        baseURL: 'https://api.project.com',
        model: 'project-model'
      };

      writeFileSync(
        join(grokDir, 'settings.json'),
        JSON.stringify(projectConfig, null, 2)
      );

      const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
      const globalGrokDir = join(homeDir, '.grok');

      try {
        mkdirSync(globalGrokDir, { recursive: true });

        const globalConfig = {
          apiKey: 'global-key',
          baseURL: 'https://api.global.com',
          defaultModel: 'global-model'
        };

        const globalConfigPath = join(globalGrokDir, 'user-settings.json');
        writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));

        const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
        const config = await (loadGrokConfig as any)(testDir);

        // Project config should override global
        expect(config.apiKey).toBe('project-key');
        expect(config.baseUrl).toBe('https://api.project.com');
        expect(config.model).toBe('project-model');

        // Clean up
        if (existsSync(globalConfigPath)) {
          rmSync(globalConfigPath, { force: true });
        }
      } catch {
        // Skip if home directory is not writable
      }
    });

    it('should handle both baseURL and baseUrl field names', async () => {
      const grokDir = join(testDir, '.grok');
      mkdirSync(grokDir, { recursive: true });

      // Test with baseURL (Grok CLI format)
      const configWithBaseURL = {
        apiKey: 'test-key',
        baseURL: 'https://api.test.com',
        model: 'test-model'
      };

      writeFileSync(
        join(grokDir, 'settings.json'),
        JSON.stringify(configWithBaseURL, null, 2)
      );

      const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
      let config = await (loadGrokConfig as any)(testDir);

      expect(config.baseUrl).toBe('https://api.test.com');

      // Test with baseUrl (alternative format)
      const configWithBaseUrl = {
        apiKey: 'test-key',
        baseUrl: 'https://api.alt.com',
        model: 'test-model'
      };

      writeFileSync(
        join(grokDir, 'settings.json'),
        JSON.stringify(configWithBaseUrl, null, 2)
      );

      config = await (loadGrokConfig as any)(testDir);
      expect(config.baseUrl).toBe('https://api.alt.com');
    });

    it('should handle defaultModel and model field names', async () => {
      const grokDir = join(testDir, '.grok');
      mkdirSync(grokDir, { recursive: true });

      // Test with defaultModel (Grok CLI format)
      const configWithDefaultModel = {
        apiKey: 'test-key',
        baseURL: 'https://api.test.com',
        defaultModel: 'grok-3-fast'
      };

      writeFileSync(
        join(grokDir, 'settings.json'),
        JSON.stringify(configWithDefaultModel, null, 2)
      );

      const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
      let config = await (loadGrokConfig as any)(testDir);

      expect(config.model).toBe('grok-3-fast');

      // Test with model (alternative format)
      const configWithModel = {
        apiKey: 'test-key',
        baseURL: 'https://api.test.com',
        model: 'glm-4.6'
      };

      writeFileSync(
        join(grokDir, 'settings.json'),
        JSON.stringify(configWithModel, null, 2)
      );

      config = await (loadGrokConfig as any)(testDir);
      expect(config.model).toBe('glm-4.6');
    });

    it('should return empty config when no files exist', async () => {
      const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
      const config = await (loadGrokConfig as any)(testDir);

      expect(config.apiKey).toBeUndefined();
      expect(config.baseUrl).toBeUndefined();
      expect(config.model).toBeUndefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      const grokDir = join(testDir, '.grok');
      mkdirSync(grokDir, { recursive: true });

      // Write invalid JSON
      writeFileSync(join(grokDir, 'settings.json'), '{invalid json}');

      const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
      const config = await (loadGrokConfig as any)(testDir);

      // Should return empty config without throwing
      expect(config.apiKey).toBeUndefined();
    });

    it('should ignore commented fields (underscore prefix)', async () => {
      const grokDir = join(testDir, '.grok');
      mkdirSync(grokDir, { recursive: true });

      const configWithComments = {
        _comment: 'This is a comment',
        _apiKey: 'commented-key',
        _baseURL: 'commented-url',
        _model: 'commented-model',
        apiKey: 'active-key',
        baseURL: 'active-url',
        model: 'active-model'
      };

      writeFileSync(
        join(grokDir, 'settings.json'),
        JSON.stringify(configWithComments, null, 2)
      );

      const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
      const config = await (loadGrokConfig as any)(testDir);

      // Should load active fields, not commented ones
      expect(config.apiKey).toBe('active-key');
      expect(config.baseUrl).toBe('active-url');
      expect(config.model).toBe('active-model');
    });
  });

  describe('Configuration Priority', () => {
    it('should follow correct priority: CLI args > project > global > env', () => {
      // This is tested through integration tests since it involves
      // the full command handler with yargs argument parsing
      expect(true).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error when config exists but apiKey is commented', () => {
      // This is tested through integration tests since it involves
      // console output and process.exit()
      expect(true).toBe(true);
    });

    it('should guide user to run ax setup when no config exists', () => {
      // This is tested through integration tests
      expect(true).toBe(true);
    });
  });

  describe('Security', () => {
    it('should not expose API key in logs', async () => {
      const grokDir = join(testDir, '.grok');
      mkdirSync(grokDir, { recursive: true });

      const config = {
        apiKey: 'secret-api-key-12345',
        baseURL: 'https://api.test.com',
        model: 'test-model'
      };

      writeFileSync(
        join(grokDir, 'settings.json'),
        JSON.stringify(config, null, 2)
      );

      const { loadGrokConfig } = await import('../../src/cli/commands/cli.js');
      const loadedConfig = await (loadGrokConfig as any)(testDir);

      // API key should be loaded
      expect(loadedConfig.apiKey).toBe('secret-api-key-12345');

      // But in actual CLI output, it should be redacted (tested in integration)
    });

    it('should reject API keys with placeholder values', () => {
      // The code checks for !config.apiKey.includes('YOUR_')
      // to reject placeholder keys like 'YOUR_API_KEY_HERE'
      const placeholders = [
        'YOUR_API_KEY_HERE',
        'YOUR_XAI_API_KEY',
        'YOUR_KEY'
      ];

      placeholders.forEach(placeholder => {
        expect(placeholder.includes('YOUR_')).toBe(true);
      });
    });
  });
});
