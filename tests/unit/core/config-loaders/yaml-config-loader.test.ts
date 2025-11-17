/**
 * YamlConfigLoader Tests
 *
 * Comprehensive test suite covering:
 * - Configuration loading and parsing
 * - Environment variable interpolation
 * - Schema validation
 * - Caching behavior
 * - Error handling
 * - Edge cases
 *
 * Target: >= 95% code coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  YamlConfigLoader,
  getYamlConfigLoader,
  loadYamlConfig,
  type YamlProviderConfig
} from '../../../../src/core/config-loaders/yaml-config-loader.js';
import { ConfigError, ErrorCode } from '../../../../src/utils/errors.js';

describe('YamlConfigLoader', () => {
  let loader: YamlConfigLoader;
  let testDir: string;
  let testFilePath: string;

  // Valid configuration for testing
  const validConfig: YamlProviderConfig = {
    provider: {
      name: 'grok',
      enabled: true,
      priority: 2,
      baseUrl: 'https://api.z.ai/api/coding/paas/v4',
      apiKey: 'test-api-key-123',
      model: 'glm-4.6',
      timeout: 120000,
      maxRetries: 3
    }
  };

  beforeEach(async () => {
    // Use real timers for file I/O
    vi.useRealTimers();

    // Get fresh singleton instance
    loader = getYamlConfigLoader();
    loader.clearCache();

    // Create temporary test directory
    testDir = path.join(process.cwd(), '.test-tmp-yaml-loader');
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = path.join(testDir, 'test-config.yaml');

    // Clear environment variables
    delete process.env.TEST_API_KEY;
    delete process.env.GROK_API_KEY;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clear cache
    loader.clearCache();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getYamlConfigLoader();
      const instance2 = getYamlConfigLoader();
      expect(instance1).toBe(instance2);
    });

    it('should return instance from getInstance()', () => {
      const instance1 = YamlConfigLoader.getInstance();
      const instance2 = getYamlConfigLoader();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration Loading', () => {
    it('should load valid YAML configuration', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  priority: 2
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-api-key-123
  model: glm-4.6
  timeout: 120000
  maxRetries: 3
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loader.loadConfig(testFilePath);

      expect(config.provider.name).toBe('grok');
      expect(config.provider.enabled).toBe(true);
      expect(config.provider.priority).toBe(2);
      expect(config.provider.baseUrl).toBe('https://api.z.ai/api/coding/paas/v4');
      expect(config.provider.apiKey).toBe('test-api-key-123');
      expect(config.provider.model).toBe('glm-4.6');
      expect(config.provider.timeout).toBe(120000);
      expect(config.provider.maxRetries).toBe(3);
    });

    it('should load configuration with all optional fields', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  priority: 1
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-key
  model: glm-4.6
  timeout: 60000
  maxRetries: 5
  customPath: /usr/local/bin/grok

rateLimits:
  maxRequestsPerMinute: 60
  maxTokensPerMinute: 100000
  maxConcurrentRequests: 5

circuitBreaker:
  failureThreshold: 3
  resetTimeout: 60000
  halfOpenTimeout: 30000

mcp:
  enabled: true
  servers:
    - name: filesystem
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-filesystem"
      env:
        LOG_LEVEL: info

morph:
  enabled: true
  agentsDir: ./.automatosx/morph-agents
  agents:
    - name: code-reviewer
      prompt: "Review code for quality"
      capabilities:
        - code-review

metadata:
  version: "1.0.0"
  description: "Test configuration"
  tags:
    - test
    - grok
  lastUpdated: "2025-11-16T00:00:00Z"
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loader.loadConfig(testFilePath);

      expect(config.provider.customPath).toBe('/usr/local/bin/grok');
      expect(config.rateLimits).toBeDefined();
      expect(config.rateLimits?.maxRequestsPerMinute).toBe(60);
      expect(config.circuitBreaker).toBeDefined();
      expect(config.circuitBreaker?.failureThreshold).toBe(3);
      expect(config.mcp).toBeDefined();
      expect(config.mcp?.enabled).toBe(true);
      expect(config.morph).toBeDefined();
      expect(config.morph?.enabled).toBe(true);
      expect(config.metadata).toBeDefined();
      expect(config.metadata?.version).toBe('1.0.0');
    });

    it('should work with relative paths', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const relativePath = path.relative(process.cwd(), testFilePath);
      const config = await loader.loadConfig(relativePath);

      expect(config.provider.name).toBe('grok');
    });

    it('should work with absolute paths', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loader.loadConfig(testFilePath);

      expect(config.provider.name).toBe('grok');
    });
  });

  describe('Environment Variable Interpolation', () => {
    it('should interpolate environment variables with ${VAR} syntax', async () => {
      process.env.TEST_API_KEY = 'secret-key-from-env';
      process.env.TEST_BASE_URL = 'https://api.test.com';

      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: \${TEST_BASE_URL}
  apiKey: \${TEST_API_KEY}
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loader.loadConfig(testFilePath);

      expect(config.provider.baseUrl).toBe('https://api.test.com');
      expect(config.provider.apiKey).toBe('secret-key-from-env');
    });

    it('should support multiple environment variable references', async () => {
      process.env.VAR1 = 'value1';
      process.env.VAR2 = 'value2';
      process.env.VAR3 = 'value3';

      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://\${VAR1}.com
  apiKey: \${VAR2}-\${VAR3}
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loader.loadConfig(testFilePath);

      expect(config.provider.baseUrl).toBe('https://value1.com');
      expect(config.provider.apiKey).toBe('value2-value3');
    });

    it('should throw ConfigError for missing environment variables', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: \${MISSING_API_KEY}
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('MISSING_API_KEY');

      try {
        await loader.loadConfig(testFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as ConfigError).suggestions.length).toBeGreaterThan(0);
      }
    });

    it('should provide helpful error context for missing env vars', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: \${GROK_API_KEY}
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      try {
        await loader.loadConfig(testFilePath);
        expect.fail('Should have thrown ConfigError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.context?.missingVars).toContain('GROK_API_KEY');
        expect(configError.suggestions).toContain(`Set missing variables: export GROK_API_KEY="your-value"`);
      }
    });

    it('should not interpolate invalid variable names', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: \${lowercase_var}
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loader.loadConfig(testFilePath);

      // Invalid variable names are not interpolated (left as-is)
      expect(config.provider.apiKey).toBe('${lowercase_var}');
    });
  });

  describe('Schema Validation', () => {
    it('should reject missing provider section', async () => {
      const yamlContent = `
rateLimits:
  maxRequestsPerMinute: 60
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('provider');
    });

    it('should reject missing required provider.name', async () => {
      const yamlContent = `
provider:
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('provider.name');
    });

    it('should reject invalid provider name format', async () => {
      const yamlContent = `
provider:
  name: Invalid_Name_123
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('lowercase');
    });

    it('should accept valid provider names', async () => {
      const validNames = ['grok', 'claude-code', 'gemini-cli', 'openai'];

      for (const name of validNames) {
        const yamlContent = `
provider:
  name: ${name}
  enabled: true
  baseUrl: https://api.test.com
  apiKey: test-key
  model: test-model
`;
        await fs.writeFile(testFilePath, yamlContent, 'utf8');
        loader.clearCache();

        const config = await loader.loadConfig(testFilePath);
        expect(config.provider.name).toBe(name);
      }
    });

    it('should reject missing provider.enabled', async () => {
      const yamlContent = `
provider:
  name: grok
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('provider.enabled');
    });

    it('should reject non-boolean provider.enabled', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: "yes"
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('boolean');
    });

    it('should reject missing provider.baseUrl', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('provider.baseUrl');
    });

    it('should reject invalid URL format for provider.baseUrl', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: not-a-url
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('HTTP/HTTPS');
    });

    it('should reject missing provider.apiKey', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('provider.apiKey');
    });

    it('should reject missing provider.model', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('provider.model');
    });

    it('should validate optional provider.priority', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
  priority: 0
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('priority');
    });

    it('should validate optional provider.timeout', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
  timeout: 500
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('timeout');
    });

    it('should validate optional provider.maxRetries', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
  maxRetries: -1
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('maxRetries');
    });

    it('should validate rateLimits fields', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6

rateLimits:
  maxRequestsPerMinute: 0
  maxTokensPerMinute: 100000
  maxConcurrentRequests: 5
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('maxRequestsPerMinute');
    });

    it('should validate circuitBreaker fields', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6

circuitBreaker:
  failureThreshold: 0
  resetTimeout: 60000
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('failureThreshold');
    });

    it('should validate MCP enabled field', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6

mcp:
  enabled: "yes"
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('mcp.enabled');
    });

    it('should validate Morph enabled field', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6

morph:
  enabled: 1
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig(testFilePath)).rejects.toThrow('morph.enabled');
    });
  });

  describe('Caching', () => {
    it('should cache loaded configurations', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key-1
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      // First load
      const config1 = await loader.loadConfig(testFilePath);
      expect(config1.provider.apiKey).toBe('test-key-1');

      // Modify file
      const modifiedContent = yamlContent.replace('test-key-1', 'test-key-2');
      await fs.writeFile(testFilePath, modifiedContent, 'utf8');

      // Second load should return cached value
      const config2 = await loader.loadConfig(testFilePath);
      expect(config2.provider.apiKey).toBe('test-key-1'); // Still cached

      // Should be same object reference
      expect(config1).toBe(config2);
    });

    it('should expire cache after TTL', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key-1
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      // Set short TTL for testing
      loader.setCacheTTL(100); // 100ms

      // First load
      const config1 = await loader.loadConfig(testFilePath);
      expect(config1.provider.apiKey).toBe('test-key-1');

      // Modify file
      const modifiedContent = yamlContent.replace('test-key-1', 'test-key-2');
      await fs.writeFile(testFilePath, modifiedContent, 'utf8');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should load fresh configuration
      const config2 = await loader.loadConfig(testFilePath);
      expect(config2.provider.apiKey).toBe('test-key-2');
    });

    it('should allow manual cache clearing', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key-1
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      // Load and cache
      const config1 = await loader.loadConfig(testFilePath);
      expect(config1.provider.apiKey).toBe('test-key-1');

      // Modify file
      const modifiedContent = yamlContent.replace('test-key-1', 'test-key-2');
      await fs.writeFile(testFilePath, modifiedContent, 'utf8');

      // Clear cache
      loader.clearCache();

      // Should load fresh configuration
      const config2 = await loader.loadConfig(testFilePath);
      expect(config2.provider.apiKey).toBe('test-key-2');
    });

    it('should allow clearing specific cache entry', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key-1
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      // Load and cache
      await loader.loadConfig(testFilePath);

      // Clear specific entry
      loader.clearCacheEntry(testFilePath);

      // Cache should be empty for this file
      const stats = loader.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should provide cache statistics', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await loader.loadConfig(testFilePath);

      const stats = loader.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0]?.filePath).toBe(path.resolve(testFilePath));
      expect(stats.entries[0]?.age).toBeGreaterThanOrEqual(0);
    });

    it('should reject negative TTL values', () => {
      expect(() => loader.setCacheTTL(-100)).toThrow('non-negative');
    });

    it('should accept zero TTL (immediate expiration)', () => {
      expect(() => loader.setCacheTTL(0)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw ConfigError for non-existent file', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist.yaml');

      await expect(loader.loadConfig(nonExistentPath)).rejects.toThrow(ConfigError);

      try {
        await loader.loadConfig(nonExistentPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ErrorCode.CONFIG_NOT_FOUND);
        expect((error as ConfigError).suggestions).toContain('Check that the file path is correct');
      }
    });

    it('should throw ConfigError for invalid YAML syntax', async () => {
      const invalidYaml = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: [unclosed array
`;
      await fs.writeFile(testFilePath, invalidYaml, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);

      try {
        await loader.loadConfig(testFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ErrorCode.CONFIG_PARSE_ERROR);
      }
    });

    it('should provide detailed validation errors', async () => {
      const yamlContent = `
provider:
  name: Invalid_Name
  enabled: "not-boolean"
  baseUrl: not-a-url
  apiKey: ""
  model: ""
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      try {
        await loader.loadConfig(testFilePath);
        expect.fail('Should have thrown ConfigError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect(configError.context?.errors).toBeDefined();
        const errors = configError.context?.errors as Array<any>;
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific and may not work on all systems
      // Skip on Windows or if running as root
      if (process.platform === 'win32' || process.getuid?.() === 0) {
        return;
      }

      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');
      await fs.chmod(testFilePath, 0o000); // Remove all permissions

      try {
        await loader.loadConfig(testFilePath);
        expect.fail('Should have thrown ConfigError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.suggestions.some(s => s.includes('permission'))).toBe(true);
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(testFilePath, 0o644);
      }
    });

    it('should handle non-object root configuration', async () => {
      const yamlContent = `just a string`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
    });

    it('should handle null configuration', async () => {
      const yamlContent = `null`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
    });

    it('should handle empty file', async () => {
      await fs.writeFile(testFilePath, '', 'utf8');

      await expect(loader.loadConfig(testFilePath)).rejects.toThrow(ConfigError);
    });
  });

  describe('Convenience Functions', () => {
    it('should support loadYamlConfig shorthand', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loadYamlConfig(testFilePath);

      expect(config.provider.name).toBe('grok');
      expect(config.provider.model).toBe('glm-4.6');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long file paths', async () => {
      const longDirName = 'a'.repeat(100);
      const longPath = path.join(testDir, longDirName, 'config.yaml');
      await fs.mkdir(path.dirname(longPath), { recursive: true });

      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6
`;
      await fs.writeFile(longPath, yamlContent, 'utf8');

      const config = await loader.loadConfig(longPath);
      expect(config.provider.name).toBe('grok');
    });

    it('should handle special characters in values', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/v1?param=value&other=123
  apiKey: "key-with-special-chars-!@#$%^&*()"
  model: glm-4.6
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loader.loadConfig(testFilePath);
      expect(config.provider.baseUrl).toContain('?param=value&other=123');
      expect(config.provider.apiKey).toBe('key-with-special-chars-!@#$%^&*()');
    });

    it('should handle unicode characters', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai
  apiKey: test-key
  model: glm-4.6

metadata:
  description: "测试配置 with émojis 🚀"
`;
      await fs.writeFile(testFilePath, yamlContent, 'utf8');

      const config = await loader.loadConfig(testFilePath);
      expect(config.metadata?.description).toBe('测试配置 with émojis 🚀');
    });

    it('should handle large configuration files', async () => {
      const largeConfig = {
        provider: {
          name: 'grok',
          enabled: true,
          baseUrl: 'https://api.z.ai',
          apiKey: 'test-key',
          model: 'glm-4.6'
        },
        mcp: {
          enabled: true,
          servers: Array.from({ length: 100 }, (_, i) => ({
            name: `server-${i}`,
            command: 'npx',
            args: [`arg-${i}`]
          }))
        }
      };

      const yaml = require('js-yaml');
      await fs.writeFile(testFilePath, yaml.dump(largeConfig), 'utf8');

      const config = await loader.loadConfig(testFilePath);
      expect(config.mcp?.servers).toHaveLength(100);
    });
  });
});
