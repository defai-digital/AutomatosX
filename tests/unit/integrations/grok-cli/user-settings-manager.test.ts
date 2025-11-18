/**
 * Tests for GrokUserSettingsManager (v8.6.0)
 *
 * @module tests/unit/integrations/grok-cli/user-settings-manager.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrokUserSettingsManager, type GrokUserSettings } from '../../../../src/integrations/grok-cli/user-settings-manager.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('GrokUserSettingsManager', () => {
  let tempDir: string;
  let manager: GrokUserSettingsManager;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = path.join(os.tmpdir(), `grok-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    const settingsPath = path.join(tempDir, 'user-settings.json');
    manager = new GrokUserSettingsManager(settingsPath);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }
  });

  describe('constructor()', () => {
    it('should use default path when no custom path provided', () => {
      const defaultManager = new GrokUserSettingsManager();
      const expectedPath = path.join(os.homedir(), '.grok', 'user-settings.json');
      expect(defaultManager.getPath()).toBe(expectedPath);
    });

    it('should use custom path when provided', () => {
      const customPath = '/custom/path/settings.json';
      const customManager = new GrokUserSettingsManager(customPath);
      expect(customManager.getPath()).toBe(customPath);
    });
  });

  describe('load()', () => {
    it('should return empty object when file does not exist', async () => {
      const settings = await manager.load();
      expect(settings).toEqual({});
    });

    it('should load valid settings from file', async () => {
      const testSettings: GrokUserSettings = {
        apiKey: 'test-key',
        defaultModel: 'grok-3-fast',
        preferences: {
          verbosity: 'verbose'
        }
      };

      await fs.promises.writeFile(
        manager.getPath(),
        JSON.stringify(testSettings),
        'utf-8'
      );

      const loaded = await manager.load();
      expect(loaded).toEqual(testSettings);
    });

    it('should return empty object for invalid JSON', async () => {
      await fs.promises.writeFile(
        manager.getPath(),
        'invalid json{',
        'utf-8'
      );

      const settings = await manager.load();
      expect(settings).toEqual({});
    });

    it('should return empty object for invalid settings schema', async () => {
      await fs.promises.writeFile(
        manager.getPath(),
        JSON.stringify({
          apiKey: 123, // Should be string
          baseUrl: 'not-a-url' // Should be valid URL
        }),
        'utf-8'
      );

      const settings = await manager.load();
      expect(settings).toEqual({});
    });

    it('should cache loaded settings', async () => {
      const testSettings: GrokUserSettings = {
        apiKey: 'test-key'
      };

      await fs.promises.writeFile(
        manager.getPath(),
        JSON.stringify(testSettings),
        'utf-8'
      );

      await manager.load();
      const cached = manager.getCached();

      expect(cached).toEqual(testSettings);
    });
  });

  describe('save()', () => {
    it('should save settings to file', async () => {
      const settings: GrokUserSettings = {
        apiKey: 'test-key',
        defaultModel: 'grok-3-fast'
      };

      await manager.save(settings);

      const content = await fs.promises.readFile(manager.getPath(), 'utf-8');
      const saved = JSON.parse(content);

      expect(saved).toEqual(settings);
    });

    it('should create parent directory if it does not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'settings.json');
      const nestedManager = new GrokUserSettingsManager(nestedPath);

      await nestedManager.save({ apiKey: 'test' });

      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it('should throw error for invalid settings', async () => {
      const invalidSettings = {
        baseUrl: 'not-a-url' // Invalid URL
      } as GrokUserSettings;

      await expect(manager.save(invalidSettings)).rejects.toThrow();
    });

    it('should update cache after saving', async () => {
      const settings: GrokUserSettings = {
        apiKey: 'test-key'
      };

      await manager.save(settings);
      const cached = manager.getCached();

      expect(cached).toEqual(settings);
    });

    it('should use atomic write pattern', async () => {
      const settings: GrokUserSettings = { apiKey: 'test' };

      await manager.save(settings);

      // Verify temp file was cleaned up
      const tempPath = `${manager.getPath()}.tmp`;
      expect(fs.existsSync(tempPath)).toBe(false);
    });

    it('should overwrite existing file', async () => {
      await manager.save({ apiKey: 'old-key' });
      await manager.save({ apiKey: 'new-key' });

      const content = await fs.promises.readFile(manager.getPath(), 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.apiKey).toBe('new-key');
    });
  });

  describe('merge()', () => {
    it('should merge new settings with existing', async () => {
      await manager.save({
        apiKey: 'original-key',
        defaultModel: 'grok-3'
      });

      await manager.merge({
        preferences: { verbosity: 'verbose' }
      });

      const settings = await manager.load();

      expect(settings).toEqual({
        apiKey: 'original-key',
        defaultModel: 'grok-3',
        preferences: { verbosity: 'verbose' }
      });
    });

    it('should override existing values', async () => {
      await manager.save({
        apiKey: 'old-key',
        defaultModel: 'grok-3'
      });

      await manager.merge({
        apiKey: 'new-key'
      });

      const settings = await manager.load();

      expect(settings.apiKey).toBe('new-key');
      expect(settings.defaultModel).toBe('grok-3');
    });

    it('should work on empty file', async () => {
      await manager.merge({
        apiKey: 'test-key'
      });

      const settings = await manager.load();

      expect(settings).toEqual({
        apiKey: 'test-key'
      });
    });

    it('should merge nested preferences', async () => {
      await manager.save({
        preferences: {
          verbosity: 'quiet',
          autoApprove: false
        }
      });

      await manager.merge({
        preferences: {
          verbosity: 'verbose'
        }
      });

      const settings = await manager.load();

      expect(settings.preferences).toEqual({
        verbosity: 'verbose'
      });
    });
  });

  describe('get()', () => {
    it('should get specific setting value', async () => {
      await manager.save({
        apiKey: 'test-key',
        defaultModel: 'grok-3-fast'
      });

      const apiKey = await manager.get('apiKey');
      const model = await manager.get('defaultModel');

      expect(apiKey).toBe('test-key');
      expect(model).toBe('grok-3-fast');
    });

    it('should return undefined for non-existent key', async () => {
      const value = await manager.get('apiKey');
      expect(value).toBeUndefined();
    });

    it('should handle nested preferences', async () => {
      await manager.save({
        preferences: {
          verbosity: 'verbose',
          maxToolRounds: 500
        }
      });

      const prefs = await manager.get('preferences');

      expect(prefs).toEqual({
        verbosity: 'verbose',
        maxToolRounds: 500
      });
    });
  });

  describe('set()', () => {
    it('should set specific setting value', async () => {
      await manager.set('apiKey', 'test-key');

      const settings = await manager.load();

      expect(settings.apiKey).toBe('test-key');
    });

    it('should preserve other settings', async () => {
      await manager.save({
        apiKey: 'test-key',
        defaultModel: 'grok-3'
      });

      await manager.set('baseUrl', 'https://api.test.com');

      const settings = await manager.load();

      expect(settings).toEqual({
        apiKey: 'test-key',
        defaultModel: 'grok-3',
        baseUrl: 'https://api.test.com'
      });
    });

    it('should override existing value', async () => {
      await manager.set('apiKey', 'old-key');
      await manager.set('apiKey', 'new-key');

      const apiKey = await manager.get('apiKey');

      expect(apiKey).toBe('new-key');
    });
  });

  describe('exists()', () => {
    it('should return false when file does not exist', () => {
      expect(manager.exists()).toBe(false);
    });

    it('should return true when file exists', async () => {
      await manager.save({ apiKey: 'test' });

      expect(manager.exists()).toBe(true);
    });

    it('should return false after delete', async () => {
      await manager.save({ apiKey: 'test' });
      await manager.delete();

      expect(manager.exists()).toBe(false);
    });
  });

  describe('getPath()', () => {
    it('should return the settings file path', () => {
      const expectedPath = path.join(tempDir, 'user-settings.json');
      expect(manager.getPath()).toBe(expectedPath);
    });
  });

  describe('delete()', () => {
    it('should delete the settings file', async () => {
      await manager.save({ apiKey: 'test' });

      await manager.delete();

      expect(fs.existsSync(manager.getPath())).toBe(false);
    });

    it('should clear the cache', async () => {
      await manager.save({ apiKey: 'test' });
      await manager.delete();

      const cached = manager.getCached();

      expect(cached).toBeNull();
    });

    it('should not throw if file does not exist', async () => {
      await expect(manager.delete()).resolves.not.toThrow();
    });
  });

  describe('getCached()', () => {
    it('should return null when no settings loaded', () => {
      expect(manager.getCached()).toBeNull();
    });

    it('should return cached settings after load', async () => {
      const settings: GrokUserSettings = {
        apiKey: 'test-key'
      };

      await manager.save(settings);
      await manager.load();

      const cached = manager.getCached();

      expect(cached).toEqual(settings);
    });

    it('should return cached settings after save', async () => {
      const settings: GrokUserSettings = {
        apiKey: 'test-key'
      };

      await manager.save(settings);

      const cached = manager.getCached();

      expect(cached).toEqual(settings);
    });

    it('should return null after delete', async () => {
      await manager.save({ apiKey: 'test' });
      await manager.delete();

      const cached = manager.getCached();

      expect(cached).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should accept valid API key', async () => {
      await expect(manager.save({ apiKey: 'test-key-123' })).resolves.not.toThrow();
    });

    it('should accept valid URL for baseUrl', async () => {
      await expect(manager.save({ baseUrl: 'https://api.example.com' })).resolves.not.toThrow();
    });

    it('should accept valid model name', async () => {
      await expect(manager.save({ defaultModel: 'grok-3-fast' })).resolves.not.toThrow();
    });

    it('should accept valid available models array', async () => {
      await expect(manager.save({
        availableModels: ['grok-3', 'grok-3-fast', 'grok-turbo']
      })).resolves.not.toThrow();
    });

    it('should accept valid verbosity values', async () => {
      for (const verbosity of ['quiet', 'normal', 'verbose'] as const) {
        await expect(manager.save({
          preferences: { verbosity }
        })).resolves.not.toThrow();
      }
    });

    it('should accept valid maxToolRounds range', async () => {
      await expect(manager.save({
        preferences: { maxToolRounds: 1 }
      })).resolves.not.toThrow();

      await expect(manager.save({
        preferences: { maxToolRounds: 500 }
      })).resolves.not.toThrow();

      await expect(manager.save({
        preferences: { maxToolRounds: 1000 }
      })).resolves.not.toThrow();
    });

    it('should accept boolean for autoApprove', async () => {
      await expect(manager.save({
        preferences: { autoApprove: true }
      })).resolves.not.toThrow();

      await expect(manager.save({
        preferences: { autoApprove: false }
      })).resolves.not.toThrow();
    });

    it('should accept empty object', async () => {
      await expect(manager.save({})).resolves.not.toThrow();
    });

    it('should accept partial settings', async () => {
      await expect(manager.save({
        apiKey: 'test-key'
      })).resolves.not.toThrow();

      await expect(manager.save({
        preferences: { verbosity: 'verbose' }
      })).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle read errors gracefully', async () => {
      // Create file with no read permissions (Unix only)
      if (process.platform !== 'win32') {
        await manager.save({ apiKey: 'test' });
        await fs.promises.chmod(manager.getPath(), 0o000);

        const settings = await manager.load();

        expect(settings).toEqual({});

        // Restore permissions for cleanup
        await fs.promises.chmod(manager.getPath(), 0o644);
      }
    });

    it('should handle write errors gracefully', async () => {
      // Try to write to a directory path (will fail)
      const dirPath = path.join(tempDir, 'dir-not-file');
      await fs.promises.mkdir(dirPath);
      const invalidManager = new GrokUserSettingsManager(dirPath);

      await expect(invalidManager.save({ apiKey: 'test' })).rejects.toThrow();
    });
  });

  describe('Atomic Writes', () => {
    it('should not corrupt file if write is interrupted', async () => {
      const settings1 = { apiKey: 'key-1' };
      const settings2 = { apiKey: 'key-2' };

      await manager.save(settings1);

      // Simulate interrupted write by creating temp file
      const tempPath = `${manager.getPath()}.tmp`;
      await fs.promises.writeFile(tempPath, 'corrupted', 'utf-8');

      // Complete the write
      await manager.save(settings2);

      const loaded = await manager.load();

      expect(loaded).toEqual(settings2);
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });
});
