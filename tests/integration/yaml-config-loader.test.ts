/**
 * YamlConfigLoader Integration Tests
 *
 * End-to-end tests for YAML configuration loading with:
 * - Real file system operations
 * - Environment variable integration
 * - Template usage workflows
 * - Error scenarios with actual files
 * - Multi-provider configurations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  getYamlConfigLoader,
  loadYamlConfig,
  type YamlProviderConfig
} from '../../src/core/config-loaders/yaml-config-loader.js';
import { ConfigError } from '../../src/utils/errors.js';

describe('YamlConfigLoader Integration Tests', () => {
  let testDir: string;
  let loader: ReturnType<typeof getYamlConfigLoader>;

  beforeEach(async () => {
    vi.useRealTimers();
    loader = getYamlConfigLoader();
    loader.clearCache();

    // Create temporary test directory
    testDir = path.join(process.cwd(), '.test-integration-yaml-loader');
    await fs.mkdir(testDir, { recursive: true });

    // Clear test environment variables
    delete process.env.GROK_API_KEY;
    delete process.env.TEST_BASE_URL;
    delete process.env.TEST_MODEL;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    loader.clearCache();
  });

  describe('Template-Based Workflows', () => {
    it('should load configuration from minimal template', async () => {
      // Set environment variable
      process.env.GROK_API_KEY = 'test-api-key-12345';

      // Copy minimal template content
      const configPath = path.join(testDir, 'grok.yaml');
      const minimalConfig = `
provider:
  name: grok
  enabled: true
  priority: 2
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: \${GROK_API_KEY}
  model: glm-4.6
  timeout: 120000
  maxRetries: 3
`;
      await fs.writeFile(configPath, minimalConfig, 'utf8');

      // Load configuration
      const config = await loadYamlConfig(configPath);

      // Verify configuration loaded correctly
      expect(config.provider.name).toBe('grok');
      expect(config.provider.enabled).toBe(true);
      expect(config.provider.priority).toBe(2);
      expect(config.provider.baseUrl).toBe('https://api.z.ai/api/coding/paas/v4');
      expect(config.provider.apiKey).toBe('test-api-key-12345');
      expect(config.provider.model).toBe('glm-4.6');
      expect(config.provider.timeout).toBe(120000);
      expect(config.provider.maxRetries).toBe(3);
    });

    it('should load configuration from full template with all sections', async () => {
      process.env.GROK_API_KEY = 'full-test-key';
      process.env.GITHUB_TOKEN = 'github-token-123';

      const configPath = path.join(testDir, 'grok-full.yaml');
      const fullConfig = `
provider:
  name: grok
  enabled: true
  priority: 1
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: \${GROK_API_KEY}
  model: glm-4.6
  timeout: 180000
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
        - "/allowed/directory"
      env:
        LOG_LEVEL: info

    - name: github
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-github"
      env:
        GITHUB_TOKEN: \${GITHUB_TOKEN}

morph:
  enabled: true
  agentsDir: ./.automatosx/morph-agents
  agents:
    - name: code-reviewer
      prompt: "Review code for quality and security"
      capabilities:
        - code-review
        - security-audit

metadata:
  version: "1.0.0"
  description: "Full Grok provider configuration"
  tags:
    - grok
    - z-ai
    - glm-4.6
  lastUpdated: "2025-11-16T00:00:00Z"
`;
      await fs.writeFile(configPath, fullConfig, 'utf8');

      const config = await loadYamlConfig(configPath);

      // Verify all sections loaded
      expect(config.provider.customPath).toBe('/usr/local/bin/grok');
      expect(config.rateLimits).toBeDefined();
      expect(config.rateLimits?.maxRequestsPerMinute).toBe(60);
      expect(config.circuitBreaker).toBeDefined();
      expect(config.circuitBreaker?.failureThreshold).toBe(3);
      expect(config.mcp).toBeDefined();
      expect(config.mcp?.enabled).toBe(true);
      expect(config.mcp?.servers).toHaveLength(2);
      expect(config.mcp?.servers?.[0]?.env?.LOG_LEVEL).toBe('info');
      expect(config.mcp?.servers?.[1]?.env?.GITHUB_TOKEN).toBe('github-token-123');
      expect(config.morph).toBeDefined();
      expect(config.morph?.enabled).toBe(true);
      expect(config.metadata).toBeDefined();
      expect(config.metadata?.version).toBe('1.0.0');
    });

    it('should load X.AI variant configuration', async () => {
      process.env.GROK_API_KEY = 'xai-test-key';

      const configPath = path.join(testDir, 'grok-xai.yaml');
      const xaiConfig = `
provider:
  name: grok
  enabled: true
  priority: 2
  baseUrl: https://api.x.ai/v1
  apiKey: \${GROK_API_KEY}
  model: grok-beta
  timeout: 180000
  maxRetries: 3

rateLimits:
  maxRequestsPerMinute: 60
  maxTokensPerMinute: 200000
  maxConcurrentRequests: 5

metadata:
  version: "1.0.0"
  description: "X.AI Grok configuration"
  tags:
    - grok
    - x-ai
`;
      await fs.writeFile(configPath, xaiConfig, 'utf8');

      const config = await loadYamlConfig(configPath);

      expect(config.provider.baseUrl).toBe('https://api.x.ai/v1');
      expect(config.provider.model).toBe('grok-beta');
      expect(config.provider.timeout).toBe(180000);
      expect(config.rateLimits?.maxTokensPerMinute).toBe(200000);
    });
  });

  describe('Multi-Provider Scenarios', () => {
    it('should load multiple provider configurations independently', async () => {
      // Set up multiple environment variables
      process.env.GROK_API_KEY = 'grok-key';
      process.env.CLAUDE_API_KEY = 'claude-key';
      process.env.GEMINI_API_KEY = 'gemini-key';

      // Create configs for different providers
      const grokPath = path.join(testDir, 'grok.yaml');
      const claudePath = path.join(testDir, 'claude.yaml');
      const geminiPath = path.join(testDir, 'gemini.yaml');

      await fs.writeFile(grokPath, `
provider:
  name: grok
  enabled: true
  priority: 3
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: \${GROK_API_KEY}
  model: glm-4.6
`, 'utf8');

      await fs.writeFile(claudePath, `
provider:
  name: claude-code
  enabled: true
  priority: 1
  baseUrl: https://api.anthropic.com/v1
  apiKey: \${CLAUDE_API_KEY}
  model: claude-sonnet-4
`, 'utf8');

      await fs.writeFile(geminiPath, `
provider:
  name: gemini-cli
  enabled: true
  priority: 2
  baseUrl: https://generativelanguage.googleapis.com/v1
  apiKey: \${GEMINI_API_KEY}
  model: gemini-pro
`, 'utf8');

      // Load all configs
      const grokConfig = await loadYamlConfig(grokPath);
      const claudeConfig = await loadYamlConfig(claudePath);
      const geminiConfig = await loadYamlConfig(geminiPath);

      // Verify each loaded correctly
      expect(grokConfig.provider.name).toBe('grok');
      expect(grokConfig.provider.priority).toBe(3);
      expect(grokConfig.provider.apiKey).toBe('grok-key');

      expect(claudeConfig.provider.name).toBe('claude-code');
      expect(claudeConfig.provider.priority).toBe(1);
      expect(claudeConfig.provider.apiKey).toBe('claude-key');

      expect(geminiConfig.provider.name).toBe('gemini-cli');
      expect(geminiConfig.provider.priority).toBe(2);
      expect(geminiConfig.provider.apiKey).toBe('gemini-key');

      // Verify cache has all three entries
      const stats = loader.getCacheStats();
      expect(stats.size).toBe(3);
    });

    it('should handle provider priority comparison across configs', async () => {
      process.env.API_KEY = 'test-key';

      const highPriorityPath = path.join(testDir, 'high-priority.yaml');
      const lowPriorityPath = path.join(testDir, 'low-priority.yaml');

      await fs.writeFile(highPriorityPath, `
provider:
  name: grok
  enabled: true
  priority: 1
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: test-model
`, 'utf8');

      await fs.writeFile(lowPriorityPath, `
provider:
  name: grok
  enabled: true
  priority: 5
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: test-model
`, 'utf8');

      const highConfig = await loadYamlConfig(highPriorityPath);
      const lowConfig = await loadYamlConfig(lowPriorityPath);

      // Lower priority number = higher priority
      expect(highConfig.provider.priority).toBeLessThan(lowConfig.provider.priority!);
    });
  });

  describe('Environment Variable Integration', () => {
    it('should interpolate multiple environment variables in single config', async () => {
      process.env.API_KEY = 'secret-key-123';
      process.env.API_HOST = 'api.example.com';
      process.env.API_PORT = '8080';
      process.env.MODEL_NAME = 'custom-model-v2';

      const configPath = path.join(testDir, 'multi-env.yaml');
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  baseUrl: https://\${API_HOST}:\${API_PORT}/v1
  apiKey: \${API_KEY}
  model: \${MODEL_NAME}
`, 'utf8');

      const config = await loadYamlConfig(configPath);

      expect(config.provider.baseUrl).toBe('https://api.example.com:8080/v1');
      expect(config.provider.apiKey).toBe('secret-key-123');
      expect(config.provider.model).toBe('custom-model-v2');
    });

    it('should handle environment variables with special characters', async () => {
      process.env.API_KEY = 'key-with-special-!@#$%^&*()_+-=[]{}|;:,.<>?';

      const configPath = path.join(testDir, 'special-chars.yaml');
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: test-model
`, 'utf8');

      const config = await loadYamlConfig(configPath);

      expect(config.provider.apiKey).toBe('key-with-special-!@#$%^&*()_+-=[]{}|;:,.<>?');
    });

    it('should provide clear error when environment variable is missing', async () => {
      const configPath = path.join(testDir, 'missing-env.yaml');
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${MISSING_VARIABLE}
  model: test-model
`, 'utf8');

      await expect(loadYamlConfig(configPath)).rejects.toThrow(ConfigError);
      await expect(loadYamlConfig(configPath)).rejects.toThrow('MISSING_VARIABLE');

      try {
        await loadYamlConfig(configPath);
        expect.fail('Should have thrown ConfigError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.suggestions).toContain('Set missing variables: export MISSING_VARIABLE="your-value"');
        expect(configError.context?.missingVars).toContain('MISSING_VARIABLE');
      }
    });
  });

  describe('File System Operations', () => {
    it('should handle deeply nested directory structures', async () => {
      process.env.API_KEY = 'test-key';

      const deepPath = path.join(testDir, 'level1/level2/level3/level4/config.yaml');
      await fs.mkdir(path.dirname(deepPath), { recursive: true });

      await fs.writeFile(deepPath, `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: test-model
`, 'utf8');

      const config = await loadYamlConfig(deepPath);
      expect(config.provider.name).toBe('grok');
    });

    it('should handle files with different extensions', async () => {
      process.env.API_KEY = 'test-key';

      const yamlPath = path.join(testDir, 'config.yaml');
      const ymlPath = path.join(testDir, 'config.yml');

      const content = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: test-model
`;

      await fs.writeFile(yamlPath, content, 'utf8');
      await fs.writeFile(ymlPath, content, 'utf8');

      const yamlConfig = await loadYamlConfig(yamlPath);
      const ymlConfig = await loadYamlConfig(ymlPath);

      expect(yamlConfig.provider.name).toBe('grok');
      expect(ymlConfig.provider.name).toBe('grok');
    });

    it('should reload configuration when file is modified and cache expires', async () => {
      process.env.API_KEY = 'initial-key';

      const configPath = path.join(testDir, 'mutable-config.yaml');
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: initial-model
`, 'utf8');

      // Set short cache TTL
      loader.setCacheTTL(100);

      // First load
      const config1 = await loadYamlConfig(configPath);
      expect(config1.provider.model).toBe('initial-model');

      // Modify environment and file
      process.env.API_KEY = 'updated-key';
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: updated-model
`, 'utf8');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second load should get updated config
      const config2 = await loadYamlConfig(configPath);
      expect(config2.provider.model).toBe('updated-model');
      expect(config2.provider.apiKey).toBe('updated-key');
    });
  });

  describe('Error Handling', () => {
    it('should provide helpful error for non-existent file', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist.yaml');

      await expect(loadYamlConfig(nonExistentPath)).rejects.toThrow(ConfigError);

      try {
        await loadYamlConfig(nonExistentPath);
        expect.fail('Should have thrown ConfigError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.message).toContain('not found');
        expect(configError.suggestions).toContain('Check that the file path is correct');
      }
    });

    it('should handle malformed YAML gracefully', async () => {
      const malformedPath = path.join(testDir, 'malformed.yaml');
      await fs.writeFile(malformedPath, `
provider:
  name: grok
  enabled: true
  baseUrl: [unclosed array
`, 'utf8');

      await expect(loadYamlConfig(malformedPath)).rejects.toThrow(ConfigError);
    });

    it('should validate required fields and provide specific errors', async () => {
      const invalidPath = path.join(testDir, 'invalid.yaml');
      await fs.writeFile(invalidPath, `
provider:
  name: grok
  enabled: true
  # Missing baseUrl, apiKey, model
`, 'utf8');

      try {
        await loadYamlConfig(invalidPath);
        expect.fail('Should have thrown ConfigError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.message).toContain('validation failed');
        expect(configError.message).toContain('baseUrl');
        expect(configError.message).toContain('apiKey');
        expect(configError.message).toContain('model');
      }
    });
  });

  describe('Performance and Caching', () => {
    it('should cache configurations and avoid re-parsing', async () => {
      process.env.API_KEY = 'test-key';

      const configPath = path.join(testDir, 'cached.yaml');
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: test-model
`, 'utf8');

      // First load
      const startTime1 = Date.now();
      await loadYamlConfig(configPath);
      const duration1 = Date.now() - startTime1;

      // Second load (should be cached)
      const startTime2 = Date.now();
      await loadYamlConfig(configPath);
      const duration2 = Date.now() - startTime2;

      // Cached load should be faster (or at least not significantly slower)
      // This is a rough check - exact timing varies
      expect(duration2).toBeLessThanOrEqual(duration1 + 10);

      // Verify cache hit
      const stats = loader.getCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should handle concurrent loads of same file', async () => {
      process.env.API_KEY = 'test-key';

      const configPath = path.join(testDir, 'concurrent.yaml');
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: test-model
`, 'utf8');

      // Load same file concurrently
      const results = await Promise.all([
        loadYamlConfig(configPath),
        loadYamlConfig(configPath),
        loadYamlConfig(configPath)
      ]);

      // All should succeed and return same data
      results.forEach(config => {
        expect(config.provider.name).toBe('grok');
      });
    });

    it('should handle cache statistics correctly', async () => {
      process.env.API_KEY = 'test-key';

      const config1Path = path.join(testDir, 'config1.yaml');
      const config2Path = path.join(testDir, 'config2.yaml');

      const content = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.test.com
  apiKey: \${API_KEY}
  model: test-model
`;

      await fs.writeFile(config1Path, content, 'utf8');
      await fs.writeFile(config2Path, content, 'utf8');

      // Load both
      await loadYamlConfig(config1Path);
      await loadYamlConfig(config2Path);

      // Check stats
      const stats = loader.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      stats.entries.forEach(entry => {
        expect(entry.age).toBeGreaterThanOrEqual(0);
        expect(entry.filePath).toBeTruthy();
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support complete Z.AI setup workflow', async () => {
      // User sets environment variable
      process.env.GROK_API_KEY = 'zai-production-key-123';

      // Copy minimal template and customize
      const configPath = path.join(testDir, 'grok.yaml');
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  priority: 2
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: \${GROK_API_KEY}
  model: glm-4.6
  timeout: 120000
  maxRetries: 3

rateLimits:
  maxRequestsPerMinute: 60
  maxTokensPerMinute: 100000
  maxConcurrentRequests: 5
`, 'utf8');

      // Load configuration
      const config = await loadYamlConfig(configPath);

      // Verify production settings
      expect(config.provider.enabled).toBe(true);
      expect(config.provider.baseUrl).toBe('https://api.z.ai/api/coding/paas/v4');
      expect(config.provider.model).toBe('glm-4.6');
      expect(config.provider.apiKey).toBe('zai-production-key-123');
      expect(config.rateLimits?.maxRequestsPerMinute).toBe(60);
    });

    it('should support configuration migration from env vars to YAML', async () => {
      // Old style: environment variables
      process.env.GROK_API_KEY = 'migrated-key';
      process.env.GROK_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';
      process.env.GROK_MODEL = 'glm-4.6';

      // New style: YAML with env var references
      const configPath = path.join(testDir, 'migrated.yaml');
      await fs.writeFile(configPath, `
provider:
  name: grok
  enabled: true
  baseUrl: \${GROK_BASE_URL}
  apiKey: \${GROK_API_KEY}
  model: \${GROK_MODEL}
`, 'utf8');

      const config = await loadYamlConfig(configPath);

      // Configuration works with existing environment setup
      expect(config.provider.baseUrl).toBe('https://api.z.ai/api/coding/paas/v4');
      expect(config.provider.apiKey).toBe('migrated-key');
      expect(config.provider.model).toBe('glm-4.6');
    });
  });
});
