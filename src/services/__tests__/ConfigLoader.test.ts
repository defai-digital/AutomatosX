/**
 * ConfigLoader.test.ts
 *
 * Comprehensive tests for ConfigLoader service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../ConfigLoader.js';
import { ConfigSource } from '../../types/Config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader;
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    configLoader = new ConfigLoader();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // Restore environment
    process.env = originalEnv;
  });

  describe('Default Configuration', () => {
    it('should load default configuration', () => {
      const { config } = configLoader.load();

      expect(config.version).toBe('1.0.0');
      expect(config.search.defaultLimit).toBe(10);
      expect(config.indexing.chunkSize).toBe(512);
      expect(config.database.wal).toBe(true);
      expect(config.performance.enableCache).toBe(true);
      expect(config.logging.level).toBe('info');
    });

    it('should have typescript and javascript enabled by default', () => {
      const { config } = configLoader.load();

      expect(config.languages.typescript?.enabled).toBe(true);
      expect(config.languages.javascript?.enabled).toBe(true);
      expect(config.languages.python?.enabled).toBe(true);
    });

    it('should mark all fields as DEFAULT source', () => {
      const { sources } = configLoader.load();

      expect(sources.get('version')).toBe(ConfigSource.DEFAULT);
      expect(sources.get('search.defaultLimit')).toBe(ConfigSource.DEFAULT);
      expect(sources.get('database.wal')).toBe(ConfigSource.DEFAULT);
    });
  });

  describe('Project Configuration', () => {
    it('should load project configuration from automatosx.config.json', () => {
      const projectConfig = {
        search: {
          defaultLimit: 20,
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'automatosx.config.json'),
        JSON.stringify(projectConfig)
      );

      const { config } = configLoader.load(tempDir);

      expect(config.search.defaultLimit).toBe(20);
      expect(config.search.maxLimit).toBe(100); // Default still applies
    });

    it('should load project configuration from .automatosx.json', () => {
      const projectConfig = {
        indexing: {
          chunkSize: 1024,
        },
      };

      fs.writeFileSync(
        path.join(tempDir, '.automatosx.json'),
        JSON.stringify(projectConfig)
      );

      const { config } = configLoader.load(tempDir);

      expect(config.indexing.chunkSize).toBe(1024);
    });

    it('should mark project config fields as PROJECT source', () => {
      const projectConfig = {
        search: {
          defaultLimit: 20,
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'automatosx.config.json'),
        JSON.stringify(projectConfig)
      );

      const { sources } = configLoader.load(tempDir);

      expect(sources.get('search.defaultLimit')).toBe(ConfigSource.PROJECT);
      expect(sources.get('search.maxLimit')).toBe(ConfigSource.DEFAULT);
    });
  });

  describe('Environment Variables', () => {
    it('should load configuration from environment variables', () => {
      process.env.AUTOMATOSX_SEARCH_DEFAULT_LIMIT = '25';
      process.env.AUTOMATOSX_DATABASE_WAL = 'false';

      const { config } = configLoader.load();

      expect(config.search.defaultLimit).toBe(25);
      expect(config.database.wal).toBe(false);
    });

    it('should parse boolean environment variables', () => {
      process.env.AUTOMATOSX_PERFORMANCE_ENABLE_CACHE = 'false';
      process.env.AUTOMATOSX_DATABASE_IN_MEMORY = 'true';

      const { config } = configLoader.load();

      expect(config.performance.enableCache).toBe(false);
      expect(config.database.inMemory).toBe(true);
    });

    it('should parse numeric environment variables', () => {
      process.env.AUTOMATOSX_SEARCH_MAX_LIMIT = '200';
      process.env.AUTOMATOSX_INDEXING_CHUNK_SIZE = '256';

      const { config } = configLoader.load();

      expect(config.search.maxLimit).toBe(200);
      expect(config.indexing.chunkSize).toBe(256);
    });

    it('should parse JSON array environment variables', () => {
      process.env.AUTOMATOSX_INDEXING_EXCLUDE_PATTERNS =
        '["**/test/**", "**/tmp/**"]';

      const { config } = configLoader.load();

      expect(config.indexing.excludePatterns).toContain('**/test/**');
      expect(config.indexing.excludePatterns).toContain('**/tmp/**');
    });

    it('should mark env config fields as ENV source', () => {
      process.env.AUTOMATOSX_SEARCH_DEFAULT_LIMIT = '25';

      const { sources } = configLoader.load();

      expect(sources.get('search.defaultLimit')).toBe(ConfigSource.ENV);
    });
  });

  describe('Configuration Hierarchy', () => {
    it('should apply hierarchy: env > project > default', () => {
      // Project config
      const projectConfig = {
        search: {
          defaultLimit: 20,
        },
      };
      fs.writeFileSync(
        path.join(tempDir, 'automatosx.config.json'),
        JSON.stringify(projectConfig)
      );

      // Environment overrides project
      process.env.AUTOMATOSX_SEARCH_DEFAULT_LIMIT = '30';

      const { config } = configLoader.load(tempDir);

      expect(config.search.defaultLimit).toBe(30); // Env wins
    });

    it('should track which sources were merged', () => {
      const projectConfig = { search: { defaultLimit: 20 } };
      fs.writeFileSync(
        path.join(tempDir, 'automatosx.config.json'),
        JSON.stringify(projectConfig)
      );

      process.env.AUTOMATOSX_DATABASE_WAL = 'false';

      const { mergedFrom } = configLoader.load(tempDir);

      expect(mergedFrom).toContain(ConfigSource.DEFAULT);
      expect(mergedFrom).toContain(ConfigSource.PROJECT);
      expect(mergedFrom).toContain(ConfigSource.ENV);
    });
  });

  describe('Validation', () => {
    it('should validate correct configuration', () => {
      const validConfig = {
        version: '1.0.0',
        search: {
          defaultLimit: 10,
        },
      };

      const result = configLoader.validate(validConfig);

      expect(result.valid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        search: {
          defaultLimit: -5, // Negative not allowed
        },
      };

      const result = configLoader.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.config).toBeUndefined();
    });

    it('should reject invalid logging level', () => {
      const invalidConfig = {
        logging: {
          level: 'trace', // Not a valid level
        },
      };

      const result = configLoader.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Saving Configuration', () => {
    it('should save configuration to file', () => {
      const config = {
        version: '1.0.0',
        search: {
          defaultLimit: 15,
        },
      };

      const filePath = path.join(tempDir, 'saved-config.json');
      configLoader.save(config, filePath);

      expect(fs.existsSync(filePath)).toBe(true);
      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(loaded.search.defaultLimit).toBe(15);
    });

    it('should create directories if they do not exist', () => {
      const config = { version: '1.0.0' };
      const filePath = path.join(tempDir, 'nested', 'dir', 'config.json');

      configLoader.save(config, filePath);

      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize project config', () => {
      const configPath = configLoader.initProjectConfig(tempDir);

      expect(fs.existsSync(configPath)).toBe(true);
      expect(configPath).toContain('automatosx.config.json');

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.version).toBe('1.0.0');
      expect(config.languages.typescript.enabled).toBe(true);
    });

    it('should throw if config already exists', () => {
      fs.writeFileSync(
        path.join(tempDir, 'automatosx.config.json'),
        JSON.stringify({ version: '1.0.0' })
      );

      expect(() => configLoader.initProjectConfig(tempDir)).toThrow(
        'Configuration file already exists'
      );
    });
  });

  describe('Deep Merging', () => {
    it('should deep merge nested objects', () => {
      const projectConfig = {
        languages: {
          typescript: {
            enabled: false,
          },
          go: {
            enabled: true,
          },
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'automatosx.config.json'),
        JSON.stringify(projectConfig)
      );

      const { config } = configLoader.load(tempDir);

      // TypeScript should be disabled (override)
      expect(config.languages.typescript?.enabled).toBe(false);
      // Go should be enabled (new)
      expect(config.languages.go?.enabled).toBe(true);
      // JavaScript should still be enabled (default)
      expect(config.languages.javascript?.enabled).toBe(true);
    });

    it('should not mutate original objects during merge', () => {
      const defaultConfig = configLoader.getDefault();
      const originalLimit = defaultConfig.search.defaultLimit;

      const projectConfig = {
        search: {
          defaultLimit: 999,
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'automatosx.config.json'),
        JSON.stringify(projectConfig)
      );

      configLoader.load(tempDir);

      // Default config should not be mutated
      const checkDefault = configLoader.getDefault();
      expect(checkDefault.search.defaultLimit).toBe(originalLimit);
    });
  });
});
