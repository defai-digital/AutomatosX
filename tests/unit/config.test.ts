/**
 * Config Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, validateConfig, clearConfigCache } from '../../src/core/config.js';
import type { AutomatosXConfig } from '../../src/types/config.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';

describe('Config Management', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(tmpdir(), `automatosx-config-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Clear config cache to ensure fresh loading
    clearConfigCache();
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Clear cache after each test
    clearConfigCache();
  });

  describe('loadConfig', () => {
    it('should load project config when it exists', async () => {
      const projectConfig: Partial<AutomatosXConfig> = {
        providers: {
          'test-provider': {
            enabled: true,
            priority: 1,
            timeout: 60000,
            command: 'test'
          }
        }
      };

      const configPath = join(testDir, 'automatosx.config.json');
      await writeFile(configPath, JSON.stringify(projectConfig), 'utf-8');

      const config = await loadConfig(testDir);

      expect(config.providers['test-provider']).toBeDefined();
      expect(config.providers['test-provider']?.command).toBe('test');
    });

    it('should return default config when no config file exists', async () => {
      const config = await loadConfig(testDir);

      // Should return default config
      expect(config).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.workspace).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should merge user config with defaults', async () => {
      const userConfig: Partial<AutomatosXConfig> = {
        memory: {
          maxEntries: 5000,
          persistPath: '.custom/memory',
          autoCleanup: false,
          cleanupDays: 60
        }
      };

      const configPath = join(testDir, 'automatosx.config.json');
      await writeFile(configPath, JSON.stringify(userConfig), 'utf-8');

      const config = await loadConfig(testDir);

      // Should have user values
      expect(config.memory.maxEntries).toBe(5000);
      expect(config.memory.cleanupDays).toBe(60);

      // Should still have other default sections
      expect(config.workspace).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should handle partial config sections', async () => {
      const partialConfig = {
        logging: {
          level: 'debug'
        }
      };

      const configPath = join(testDir, 'automatosx.config.json');
      await writeFile(configPath, JSON.stringify(partialConfig), 'utf-8');

      const config = await loadConfig(testDir);

      // Should have user's logging level
      expect(config.logging.level).toBe('debug');

      // Should have default values for other sections
      expect(config.memory).toBeDefined();
      expect(config.workspace).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate a correct config', () => {
      const config: AutomatosXConfig = {
        providers: {
          'claude-code': {
            enabled: true,
            priority: 1,
            timeout: 120000,
            command: 'claude'
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
          console: true
        }
      };

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing provider command', () => {
      const config: AutomatosXConfig = {
        providers: {
          'bad-provider': {
            enabled: true,
            priority: 1,
            timeout: 120000,
            command: '' // Invalid: empty command
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
          console: true
        }
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('command is required'))).toBe(true);
    });

    it('should detect invalid provider priority', () => {
      const config: AutomatosXConfig = {
        providers: {
          'bad-provider': {
            enabled: true,
            priority: 0, // Invalid: must be >= 1
            timeout: 120000,
            command: 'test'
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
          console: true
        }
      };

      const errors = validateConfig(config);
      // v5.0: Enhanced validation with type checking
      expect(errors.some(e => e.includes('priority must be a positive integer'))).toBe(true);
    });

    it('should detect invalid provider timeout', () => {
      const config: AutomatosXConfig = {
        providers: {
          'bad-provider': {
            enabled: true,
            priority: 1,
            timeout: 500, // Invalid: must be >= 1000ms
            command: 'test'
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
          console: true
        }
      };

      const errors = validateConfig(config);
      expect(errors.some(e => e.includes('timeout must be >= 1000ms'))).toBe(true);
    });

    it('should detect invalid memory.maxEntries', () => {
      const config: AutomatosXConfig = {
        providers: {},
        memory: {
          maxEntries: 0, // Invalid: must be >= 1
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
          console: true
        }
      };

      const errors = validateConfig(config);
      // v5.0: Enhanced validation with type checking
      expect(errors.some(e => e.includes('maxEntries must be a positive integer'))).toBe(true);
    });

    it('should detect invalid memory.cleanupDays', () => {
      const config: AutomatosXConfig = {
        providers: {},
        memory: {
          maxEntries: 10000,
          persistPath: '.automatosx/memory',
          autoCleanup: true,
          cleanupDays: 0 // Invalid: must be >= 1
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
          console: true
        }
      };

      const errors = validateConfig(config);
      // v5.0: Enhanced validation with type checking
      expect(errors.some(e => e.includes('cleanupDays must be a positive integer'))).toBe(true);
    });

    it('should detect invalid workspace.tmpCleanupDays', () => {
      const config: AutomatosXConfig = {
        providers: {},
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
          tmpCleanupDays: 0 // Invalid: must be >= 1
        },
        logging: {
          level: 'info',
          path: '.automatosx/logs',
          console: true
        }
      };

      const errors = validateConfig(config);
      // v5.2.0: Check tmpCleanupDays validation
      expect(errors.some(e => e.includes('tmpCleanupDays must be a positive integer'))).toBe(true);
    });

    it('should detect invalid workspace.maxFiles', () => {
      const config: AutomatosXConfig = {
        providers: {},
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
          // v5.2.0: maxFiles validation removed (no longer in WorkspaceConfig)
        },
        logging: {
          level: 'info',
          path: '.automatosx/logs',
          console: true
        }
      };

      const errors = validateConfig(config);
      // v5.2.0: maxFiles no longer exists, config should be valid
      expect(errors).toHaveLength(0);
    });

    it('should detect multiple validation errors', () => {
      const config: AutomatosXConfig = {
        providers: {
          'bad1': {
            enabled: true,
            priority: 0, // Invalid
            timeout: 500, // Invalid
            command: '' // Invalid
          }
        },
        memory: {
          maxEntries: 0, // Invalid
          persistPath: '.automatosx/memory',
          autoCleanup: true,
          cleanupDays: 0 // Invalid
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
          console: true
        }
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(3); // Multiple errors detected
    });

    it('should detect invalid execution.maxConcurrentAgents', () => {
      const config: AutomatosXConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      config.execution!.maxConcurrentAgents = 0;

      const errors = validateConfig(config);
      expect(errors.some(error => error.includes('maxConcurrentAgents'))).toBe(true);
    });
  });
});
