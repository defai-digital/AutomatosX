# Grok Provider Integration: Multi-Phase Action Plan

**Version**: 1.0
**Created**: 2025-11-16
**PRD Reference**: [grok-provider-integration.md](./grok-provider-integration.md)
**Target Release**: AutomatosX v8.3.0
**Estimated Duration**: 25 working days (5 weeks)

---

## Executive Summary

This action plan breaks down the Grok Provider integration into 7 distinct phases, each with clear deliverables, dependencies, and acceptance criteria. The plan follows a risk-based approach: foundation first (YAML loader, provider class), then testing, documentation, and finally advanced features.

**Key Milestones**:
- **Phase 0** (Day 1-2): Foundation & Dependencies
- **Phase 1** (Day 3-7): YAML Configuration System
- **Phase 2** (Day 8-12): Core Provider Implementation
- **Phase 3** (Day 13-17): Testing & Validation
- **Phase 4** (Day 18-20): Documentation & Examples
- **Phase 5** (Day 21-23): Integration & CLI Commands
- **Phase 6** (Day 24-25): Release Preparation & Deployment

---

## Table of Contents

1. [Phase 0: Foundation & Dependencies](#phase-0-foundation--dependencies)
2. [Phase 1: YAML Configuration System](#phase-1-yaml-configuration-system)
3. [Phase 2: Core Provider Implementation](#phase-2-core-provider-implementation)
4. [Phase 3: Testing & Validation](#phase-3-testing--validation)
5. [Phase 4: Documentation & Examples](#phase-4-documentation--examples)
6. [Phase 5: Integration & CLI Commands](#phase-5-integration--cli-commands)
7. [Phase 6: Release Preparation & Deployment](#phase-6-release-preparation--deployment)
8. [Phase 7: Advanced Features (Optional)](#phase-7-advanced-features-optional)
9. [Risk Management](#risk-management)
10. [Success Criteria](#success-criteria)

---

## Phase 0: Foundation & Dependencies

**Duration**: 2 days (Day 1-2)
**Owner**: Core Team
**Blockers**: None

### Objectives

- Set up development environment
- Install and verify all dependencies
- Create project structure for new components
- Establish testing baseline

### Tasks

#### Task 0.1: Environment Setup (4 hours)

**Prerequisites**: Node.js 20+, npm, git

```bash
# 1. Verify Node.js version
node --version  # Should be >= 20.0.0

# 2. Install Grok CLI globally for testing
npm install -g @vibe-kit/grok-cli

# 3. Verify Grok CLI installation
grok --version  # Should output 1.0.1 or higher

# 4. Install js-yaml dependency
npm install js-yaml@^4.1.0
npm install --save-dev @types/js-yaml@^4.0.5

# 5. Create workspace directories
mkdir -p .automatosx/providers
mkdir -p src/core/config-loaders
mkdir -p tests/unit/core/config-loaders
mkdir -p tests/integration/providers
mkdir -p docs/providers
```

**Acceptance Criteria**:
- ✅ `grok --version` returns valid version
- ✅ `js-yaml` installed in `package.json`
- ✅ All directories created successfully
- ✅ Build passes: `npm run build`

#### Task 0.2: Baseline Testing (2 hours)

```bash
# 1. Run all existing tests to establish baseline
npm test

# 2. Verify no failing tests
# Expected: All tests pass

# 3. Check test coverage
npm run test:coverage

# 4. Document baseline metrics
echo "Baseline Coverage: $(npm run test:coverage | grep 'All files')"
```

**Acceptance Criteria**:
- ✅ All existing tests pass
- ✅ Coverage >= 95% (baseline)
- ✅ No TypeScript errors: `npm run typecheck`

#### Task 0.3: Git Branch Setup (1 hour)

```bash
# 1. Create feature branch
git checkout -b feature/grok-provider-integration

# 2. Set up branch protection (if applicable)
# 3. Configure CI/CD for feature branch

# 4. Initial commit
git commit --allow-empty -m "chore: Initialize Grok provider integration

- Create feature branch for v8.3.0
- Set up project structure
- Install dependencies (js-yaml)

Related: PRD grok-provider-integration.md"
```

**Acceptance Criteria**:
- ✅ Feature branch created
- ✅ CI/CD configured
- ✅ Initial commit pushed

#### Task 0.4: Code Review Setup (1 hour)

**Create Review Checklist**:
```markdown
# Grok Provider Code Review Checklist

## Security
- [ ] Provider name in ALLOWED_PROVIDER_NAMES whitelist
- [ ] Shell argument escaping via escapeShellArg()
- [ ] No hardcoded API keys
- [ ] Environment variable validation
- [ ] YAML config validation

## Testing
- [ ] Unit tests >= 95% coverage
- [ ] Integration tests pass (with API key)
- [ ] Mock mode tests pass
- [ ] Error handling tested

## Documentation
- [ ] JSDoc comments on public APIs
- [ ] README updated
- [ ] Configuration examples provided
- [ ] Migration guide included

## TypeScript
- [ ] No `any` types without justification
- [ ] All imports use .js extensions
- [ ] Strict mode enabled
- [ ] No `@ts-ignore` without explanation
```

**Deliverables**:
- ✅ Development environment ready
- ✅ Dependencies installed and verified
- ✅ Baseline metrics documented
- ✅ Git workflow established
- ✅ Code review checklist created

---

## Phase 1: YAML Configuration System

**Duration**: 5 days (Day 3-7)
**Owner**: Backend Team
**Blockers**: Phase 0 complete
**Dependencies**: `js-yaml`, `fs/promises`

### Objectives

- Implement YamlConfigLoader class
- Add environment variable interpolation
- Create configuration validation
- Write comprehensive tests
- Generate template YAML files

### Tasks

#### Task 1.1: YamlConfigLoader Implementation (2 days)

**File**: `src/core/config-loaders/yaml-config-loader.ts`

```typescript
/**
 * YamlConfigLoader - Load and parse YAML provider configurations
 *
 * Features:
 * - YAML parsing via js-yaml
 * - Environment variable interpolation (${VAR_NAME})
 * - Schema validation
 * - Performance caching (60s TTL)
 * - Detailed error messages
 *
 * @example
 * const loader = new YamlConfigLoader();
 * const config = await loader.loadConfig('.automatosx/providers/grok.yaml');
 * console.log(config.provider.model); // 'glm-4.6'
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger.js';
import { ConfigError } from '../../utils/errors.js';

export interface YamlProviderConfig {
  provider: {
    name: string;
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    model: string;
    priority?: number;
    timeout?: number;
    command?: string;

    healthCheck?: {
      enabled: boolean;
      interval: number;
      timeout: number;
    };

    circuitBreaker?: {
      enabled: boolean;
      failureThreshold: number;
      recoveryTimeout: number;
    };

    processManagement?: {
      gracefulShutdownTimeout: number;
      forceKillDelay: number;
    };

    versionDetection?: {
      timeout: number;
      forceKillDelay: number;
      cacheEnabled: boolean;
    };

    limitTracking?: {
      enabled: boolean;
      window: 'daily' | 'weekly' | 'monthly';
      resetHourUtc: number;
    };
  };

  mcp?: {
    enabled: boolean;
    servers: Record<string, {
      transport: 'stdio' | 'http' | 'sse';
      command?: string;
      args?: string[];
      url?: string;
      headers?: Record<string, string>;
      env?: Record<string, string>;
    }>;
  };

  morph?: {
    enabled: boolean;
    apiKey: string;
    maxTokensPerSecond?: number;
    fallbackToStandard?: boolean;
  };

  models?: Record<string, {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }>;

  development?: {
    mockMode: boolean;
    logRequests: boolean;
    logResponses: boolean;
  };
}

export class YamlConfigLoader {
  private cache: Map<string, YamlProviderConfig> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly cacheTTL: number = 60000; // 1 minute

  /**
   * Load YAML config from file with caching and validation
   */
  async loadConfig(filePath: string): Promise<YamlProviderConfig> {
    // Normalize path
    const normalizedPath = path.resolve(filePath);

    // Check cache first
    const cached = this.getFromCache(normalizedPath);
    if (cached) {
      logger.debug('YAML config loaded from cache', { filePath: normalizedPath });
      return cached;
    }

    logger.debug('Loading YAML config from file', { filePath: normalizedPath });

    try {
      // Read file
      const fileContent = await fs.readFile(normalizedPath, 'utf8');

      // Interpolate environment variables
      const interpolated = this.interpolateEnvVars(fileContent, normalizedPath);

      // Parse YAML
      const config = yaml.load(interpolated) as YamlProviderConfig;

      // Validate schema
      this.validateConfig(config, normalizedPath);

      // Cache result
      this.setInCache(normalizedPath, config);

      logger.info('YAML config loaded successfully', {
        filePath: normalizedPath,
        provider: config.provider.name,
        model: config.provider.model
      });

      return config;
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }

      throw new ConfigError(
        `Failed to load YAML config: ${error instanceof Error ? error.message : String(error)}`,
        'CONFIG_LOAD_ERROR',
        { filePath: normalizedPath }
      );
    }
  }

  /**
   * Interpolate environment variables in YAML content
   * Format: ${VAR_NAME} → value from process.env.VAR_NAME
   */
  private interpolateEnvVars(content: string, filePath: string): string {
    const pattern = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
    const missingVars: string[] = [];

    const result = content.replace(pattern, (match, varName) => {
      const value = process.env[varName];

      if (value === undefined) {
        missingVars.push(varName);
        return match; // Keep placeholder for now
      }

      logger.debug('Interpolated environment variable', { varName });
      return value;
    });

    if (missingVars.length > 0) {
      throw new ConfigError(
        `Missing environment variables in YAML config: ${missingVars.join(', ')}`,
        'ENV_VAR_MISSING',
        { filePath, missingVars }
      );
    }

    return result;
  }

  /**
   * Validate YAML config against schema
   */
  private validateConfig(config: YamlProviderConfig, filePath: string): void {
    const errors: string[] = [];

    // Required fields
    if (!config.provider) {
      errors.push('Missing required field: provider');
    } else {
      if (!config.provider.name) {
        errors.push('Missing required field: provider.name');
      }
      if (typeof config.provider.enabled !== 'boolean') {
        errors.push('Missing required field: provider.enabled');
      }
      if (!config.provider.baseUrl) {
        errors.push('Missing required field: provider.baseUrl');
      }
      if (!config.provider.apiKey) {
        errors.push('Missing required field: provider.apiKey');
      }
      if (!config.provider.model) {
        errors.push('Missing required field: provider.model');
      }

      // Validate URL format
      if (config.provider.baseUrl) {
        try {
          new URL(config.provider.baseUrl);
        } catch {
          errors.push(`Invalid URL format: provider.baseUrl = ${config.provider.baseUrl}`);
        }
      }

      // Validate priority range
      if (config.provider.priority !== undefined) {
        if (config.provider.priority < 1 || config.provider.priority > 10) {
          errors.push('provider.priority must be between 1 and 10');
        }
      }

      // Validate timeout
      if (config.provider.timeout !== undefined) {
        if (config.provider.timeout < 1000 || config.provider.timeout > 3600000) {
          errors.push('provider.timeout must be between 1000ms and 3600000ms (1 hour)');
        }
      }
    }

    // Optional MCP validation
    if (config.mcp?.enabled) {
      if (!config.mcp.servers || Object.keys(config.mcp.servers).length === 0) {
        errors.push('mcp.enabled is true but no servers configured');
      }
    }

    if (errors.length > 0) {
      throw new ConfigError(
        `YAML config validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`,
        'CONFIG_VALIDATION_ERROR',
        { filePath, errors }
      );
    }
  }

  /**
   * Check if file exists and is readable
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
    logger.debug('YAML config cache cleared');
  }

  /**
   * Get cache size (for monitoring)
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  // Private cache methods
  private getFromCache(filePath: string): YamlProviderConfig | null {
    const expiry = this.cacheExpiry.get(filePath);

    if (!expiry || Date.now() > expiry) {
      this.cache.delete(filePath);
      this.cacheExpiry.delete(filePath);
      return null;
    }

    return this.cache.get(filePath) || null;
  }

  private setInCache(filePath: string, config: YamlProviderConfig): void {
    this.cache.set(filePath, config);
    this.cacheExpiry.set(filePath, Date.now() + this.cacheTTL);
  }
}

/**
 * Singleton instance for global use
 */
let yamlConfigLoaderInstance: YamlConfigLoader | null = null;

export function getYamlConfigLoader(): YamlConfigLoader {
  if (!yamlConfigLoaderInstance) {
    yamlConfigLoaderInstance = new YamlConfigLoader();
  }
  return yamlConfigLoaderInstance;
}
```

**Acceptance Criteria**:
- ✅ Class compiles without TypeScript errors
- ✅ `loadConfig()` returns valid `YamlProviderConfig`
- ✅ Environment variable interpolation works
- ✅ Missing env vars throw clear errors
- ✅ Invalid YAML throws validation errors
- ✅ Caching reduces file reads

#### Task 1.2: YamlConfigLoader Tests (1 day)

**File**: `tests/unit/core/config-loaders/yaml-config-loader.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YamlConfigLoader } from '../../../../src/core/config-loaders/yaml-config-loader.js';
import * as fs from 'fs/promises';
import { ConfigError } from '../../../../src/utils/errors.js';

describe('YamlConfigLoader', () => {
  let loader: YamlConfigLoader;
  let tempDir: string;

  beforeEach(async () => {
    loader = new YamlConfigLoader();
    tempDir = './tests/fixtures/yaml-configs';
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    loader.clearCache();
  });

  describe('loadConfig', () => {
    it('should load valid YAML config', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-api-key
  model: glm-4.6
  priority: 4
  timeout: 2700000
`;
      const filePath = `${tempDir}/valid-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      const config = await loader.loadConfig(filePath);

      expect(config.provider.name).toBe('grok');
      expect(config.provider.model).toBe('glm-4.6');
      expect(config.provider.baseUrl).toBe('https://api.z.ai/api/coding/paas/v4');
    });

    it('should interpolate environment variables', async () => {
      process.env.TEST_API_KEY = 'interpolated-key-123';
      process.env.TEST_BASE_URL = 'https://test.example.com';

      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: \${TEST_BASE_URL}
  apiKey: \${TEST_API_KEY}
  model: glm-4.6
`;
      const filePath = `${tempDir}/interpolation-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      const config = await loader.loadConfig(filePath);

      expect(config.provider.apiKey).toBe('interpolated-key-123');
      expect(config.provider.baseUrl).toBe('https://test.example.com');

      delete process.env.TEST_API_KEY;
      delete process.env.TEST_BASE_URL;
    });

    it('should throw if required env var is missing', async () => {
      delete process.env.MISSING_VAR;

      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: \${MISSING_VAR}
  model: glm-4.6
`;
      const filePath = `${tempDir}/missing-var-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      await expect(loader.loadConfig(filePath))
        .rejects.toThrow('Missing environment variables');
    });

    it('should throw on missing required fields', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  # Missing: baseUrl, apiKey, model
`;
      const filePath = `${tempDir}/missing-fields-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      await expect(loader.loadConfig(filePath))
        .rejects.toThrow('YAML config validation failed');
    });

    it('should validate URL format', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: not-a-valid-url
  apiKey: test-key
  model: glm-4.6
`;
      const filePath = `${tempDir}/invalid-url-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      await expect(loader.loadConfig(filePath))
        .rejects.toThrow('Invalid URL format');
    });

    it('should validate priority range', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-key
  model: glm-4.6
  priority: 99
`;
      const filePath = `${tempDir}/invalid-priority-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      await expect(loader.loadConfig(filePath))
        .rejects.toThrow('priority must be between 1 and 10');
    });

    it('should cache configs and reduce file reads', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-key
  model: glm-4.6
`;
      const filePath = `${tempDir}/cached-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      // Spy on fs.readFile
      const readFileSpy = vi.spyOn(fs, 'readFile');

      // First load - should read file
      await loader.loadConfig(filePath);
      expect(readFileSpy).toHaveBeenCalledTimes(1);

      // Second load - should use cache
      await loader.loadConfig(filePath);
      expect(readFileSpy).toHaveBeenCalledTimes(1); // No additional read

      readFileSpy.mockRestore();
    });

    it('should handle MCP configuration', async () => {
      process.env.LINEAR_API_KEY = 'linear-key-123';

      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-key
  model: glm-4.6

mcp:
  enabled: true
  servers:
    linear:
      transport: stdio
      command: npx
      args: ["-y", "@linear/mcp-server"]
      env:
        LINEAR_API_KEY: \${LINEAR_API_KEY}
`;
      const filePath = `${tempDir}/mcp-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      const config = await loader.loadConfig(filePath);

      expect(config.mcp?.enabled).toBe(true);
      expect(config.mcp?.servers.linear).toBeDefined();
      expect(config.mcp?.servers.linear.env?.LINEAR_API_KEY).toBe('linear-key-123');

      delete process.env.LINEAR_API_KEY;
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = `${tempDir}/exists.yaml`;
      await fs.writeFile(filePath, 'test: value');

      const exists = await loader.fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await loader.fileExists(`${tempDir}/does-not-exist.yaml`);
      expect(exists).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear cache and force file reload', async () => {
      const yamlContent = `
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: test-key
  model: glm-4.6
`;
      const filePath = `${tempDir}/clear-cache-config.yaml`;
      await fs.writeFile(filePath, yamlContent);

      await loader.loadConfig(filePath);
      expect(loader.getCacheSize()).toBe(1);

      loader.clearCache();
      expect(loader.getCacheSize()).toBe(0);
    });
  });
});
```

**Run Tests**:
```bash
npx vitest run tests/unit/core/config-loaders/yaml-config-loader.test.ts
```

**Acceptance Criteria**:
- ✅ All tests pass
- ✅ Coverage >= 95% for YamlConfigLoader
- ✅ Edge cases covered (missing env vars, invalid YAML, etc.)

#### Task 1.3: YAML Template Generation (1 day)

**Create Template Files**:

**File**: `.automatosx/providers/grok.yaml.template`
```yaml
# Grok Provider Configuration Template
# Copy this file to .automatosx/providers/grok.yaml and customize

provider:
  name: grok
  enabled: true

  # API Configuration
  # Z.AI GLM 4.6 (recommended for cost optimization)
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}  # Set GROK_API_KEY environment variable
  model: glm-4.6

  # Alternative: X.AI Grok Models
  # baseUrl: https://api.x.ai/v1
  # model: grok-4-latest  # Options: grok-4-latest, grok-code-fast-1, grok-3-latest

  # Routing & Performance
  priority: 4              # Lower = higher priority (1-10)
  timeout: 2700000         # 45 minutes (milliseconds)
  command: grok            # CLI command name

  # Health Monitoring
  healthCheck:
    enabled: true
    interval: 300000       # Check every 5 minutes
    timeout: 5000          # 5 second timeout

  # Circuit Breaker (Failover Protection)
  circuitBreaker:
    enabled: true
    failureThreshold: 3    # Open circuit after 3 failures
    recoveryTimeout: 60000 # Wait 1 minute before retry

  # Process Management
  processManagement:
    gracefulShutdownTimeout: 5000
    forceKillDelay: 1000

  # Version Detection & Caching
  versionDetection:
    timeout: 5000
    forceKillDelay: 1000
    cacheEnabled: true

  # Usage Tracking
  limitTracking:
    enabled: true
    window: daily           # Options: daily, weekly, monthly
    resetHourUtc: 0         # Reset at midnight UTC

# Advanced Features (Optional - Future Enhancements)

# MCP Tools Integration
# Uncomment to enable Model Context Protocol servers
# mcp:
#   enabled: false
#   servers:
#     linear:
#       transport: stdio
#       command: npx
#       args: ["-y", "@linear/mcp-server"]
#       env:
#         LINEAR_API_KEY: ${LINEAR_API_KEY}
#
#     github:
#       transport: stdio
#       command: npx
#       args: ["-y", "@github/mcp-server"]
#       env:
#         GITHUB_TOKEN: ${GITHUB_TOKEN}

# Morph Fast Apply (High-Speed Code Editing)
# Uncomment to enable 4,500+ tokens/sec editing
# morph:
#   enabled: false
#   apiKey: ${MORPH_API_KEY}
#   maxTokensPerSecond: 4500
#   fallbackToStandard: true

# Model-Specific Overrides
# Customize parameters per model
# models:
#   glm-4.6:
#     maxTokens: 8192
#     temperature: 0.7
#     topP: 0.95
#
#   grok-4-latest:
#     maxTokens: 32768
#     temperature: 0.8
#     topP: 0.9

# Development & Testing
# development:
#   mockMode: false          # Enable mock responses for testing
#   logRequests: true        # Log all API requests
#   logResponses: false      # Log API responses (verbose)
```

**File**: `.automatosx/providers/grok-minimal.yaml.template`
```yaml
# Minimal Grok Provider Configuration
# For users who want simplest possible setup

provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}
  model: glm-4.6
  priority: 4
  timeout: 2700000
```

**File**: `.automatosx/providers/grok-x-ai.yaml.template`
```yaml
# X.AI Grok Configuration
# For users preferring X.AI's models over Z.AI

provider:
  name: grok
  enabled: true
  baseUrl: https://api.x.ai/v1
  apiKey: ${GROK_API_KEY}
  model: grok-4-latest  # or grok-code-fast-1
  priority: 4
  timeout: 2700000

  healthCheck:
    enabled: true
    interval: 300000

  circuitBreaker:
    enabled: true
    failureThreshold: 3
    recoveryTimeout: 60000
```

**Acceptance Criteria**:
- ✅ Template files created
- ✅ Templates have inline comments explaining each field
- ✅ Minimal template for quick setup
- ✅ Full template with all options
- ✅ X.AI-specific template

#### Task 1.4: ConfigError Enhancement (0.5 days)

**File**: `src/utils/errors.ts`

Add new error class if not exists:

```typescript
export class ConfigError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
    this.context = context;

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigError);
    }
  }
}
```

**Acceptance Criteria**:
- ✅ ConfigError class exists
- ✅ Includes error code and context
- ✅ Integrates with existing error handling

#### Task 1.5: Integration with Existing Config System (0.5 days)

**Update**: `src/types/provider.ts`

Add configFile field:

```typescript
export interface ProviderConfig {
  // ... existing fields
  configFile?: string;  // NEW: Path to YAML config file
}
```

**Update**: `src/types/config.ts`

Add Grok provider config:

```typescript
export interface GrokProviderConfig {
  enabled: boolean;
  configFile?: string;
  // Legacy fallbacks
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}
```

**Acceptance Criteria**:
- ✅ TypeScript types updated
- ✅ No breaking changes to existing configs
- ✅ Backward compatibility maintained

### Phase 1 Deliverables

- ✅ `YamlConfigLoader` class fully implemented
- ✅ Comprehensive unit tests (>= 95% coverage)
- ✅ YAML template files for users
- ✅ ConfigError class integrated
- ✅ TypeScript types updated
- ✅ Documentation for YAML config format

### Phase 1 Success Criteria

- ✅ `npm test` passes with all new tests
- ✅ `npm run typecheck` passes
- ✅ Can load YAML config from file
- ✅ Environment variable interpolation works
- ✅ Validation catches invalid configs
- ✅ Cache reduces file I/O

---

## Phase 2: Core Provider Implementation

**Duration**: 5 days (Day 8-12)
**Owner**: Provider Team
**Blockers**: Phase 1 complete
**Dependencies**: YamlConfigLoader, BaseProvider

### Objectives

- Implement GrokProvider class
- Add security whitelist entry
- Integrate YAML configuration
- Support model selection
- Add mock mode for testing

### Tasks

#### Task 2.1: GrokProvider Class (2 days)

**File**: `src/providers/grok-provider.ts`

```typescript
/**
 * GrokProvider - Pure CLI Wrapper for Grok CLI (v8.3.0)
 *
 * Supports:
 * - Z.AI GLM models (glm-4.6)
 * - X.AI Grok models (grok-4-latest, grok-code-fast-1, etc.)
 * - YAML configuration with environment variable interpolation
 * - Model selection via config or CLI flag
 * - Headless single-prompt execution
 *
 * Configuration Priority:
 * 1. YAML file (.automatosx/providers/grok.yaml)
 * 2. JSON config (automatosx.config.json)
 * 3. Environment variables (GROK_*)
 * 4. Defaults
 *
 * @example
 * const provider = new GrokProvider({
 *   name: 'grok',
 *   enabled: true,
 *   priority: 4,
 *   timeout: 2700000,
 *   command: 'grok',
 *   configFile: '.automatosx/providers/grok.yaml'
 * });
 *
 * const result = await provider.execute({ prompt: 'Hello, world!' });
 * console.log(result.content);
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse } from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findOnPath } from '../core/cli-provider-detector.js';
import { getYamlConfigLoader, type YamlProviderConfig } from '../core/config-loaders/yaml-config-loader.js';
import { ProviderError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

interface GrokConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class GrokProvider extends BaseProvider {
  private grokConfig: GrokConfig;

  constructor(config: ProviderConfig) {
    super(config);

    // Initialize Grok-specific config
    this.grokConfig = {
      baseUrl: 'https://api.x.ai/v1',  // Default
      apiKey: '',
      model: 'grok-code-fast-1'         // Default
    };

    // Load configuration (async initialization in constructor is okay for config)
    this.initializeConfig(config).catch(err => {
      logger.error('Failed to initialize Grok provider config', { error: err.message });
      throw new ProviderError(
        `Grok provider initialization failed: ${err.message}`,
        ErrorCode.CONFIG_INVALID
      );
    });
  }

  /**
   * Initialize configuration from YAML, JSON, or environment variables
   */
  private async initializeConfig(config: ProviderConfig): Promise<void> {
    // Priority 1: YAML file
    if (config.configFile) {
      try {
        const yamlLoader = getYamlConfigLoader();
        const yamlConfig = await yamlLoader.loadConfig(config.configFile);

        this.grokConfig.baseUrl = yamlConfig.provider.baseUrl;
        this.grokConfig.apiKey = yamlConfig.provider.apiKey;
        this.grokConfig.model = yamlConfig.provider.model;

        logger.info('Grok provider loaded from YAML config', {
          configFile: config.configFile,
          model: this.grokConfig.model,
          baseUrl: this.grokConfig.baseUrl
        });
        return;
      } catch (error) {
        logger.error('Failed to load YAML config, falling back to defaults', {
          configFile: config.configFile,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Priority 2: JSON config (automatosx.config.json)
    if ((config as any).baseUrl || (config as any).apiKey || (config as any).model) {
      this.grokConfig.baseUrl = (config as any).baseUrl || this.grokConfig.baseUrl;
      this.grokConfig.apiKey = (config as any).apiKey || this.grokConfig.apiKey;
      this.grokConfig.model = (config as any).model || this.grokConfig.model;

      logger.info('Grok provider loaded from JSON config', {
        model: this.grokConfig.model
      });
      return;
    }

    // Priority 3: Environment variables
    if (process.env.GROK_BASE_URL || process.env.GROK_API_KEY || process.env.GROK_MODEL) {
      this.grokConfig.baseUrl = process.env.GROK_BASE_URL || this.grokConfig.baseUrl;
      this.grokConfig.apiKey = process.env.GROK_API_KEY || this.grokConfig.apiKey;
      this.grokConfig.model = process.env.GROK_MODEL || this.grokConfig.model;

      logger.info('Grok provider loaded from environment variables', {
        model: this.grokConfig.model
      });
      return;
    }

    // Priority 4: Defaults (already set)
    logger.warn('Grok provider using default configuration (no YAML, JSON, or env vars found)');
  }

  /**
   * Execute CLI command: grok --prompt "..." --model "glm-4.6"
   *
   * Environment variables required by Grok CLI:
   * - GROK_API_KEY: API key
   * - GROK_BASE_URL: API endpoint (optional)
   */
  protected async executeCLI(prompt: string): Promise<string> {
    // Mock mode for tests
    if (process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true') {
      logger.debug('Using mock Grok provider');
      return `[Mock Grok Response]\n\nModel: ${this.grokConfig.model}\nReceived: ${prompt.substring(0, 100)}...\n\nThis is a mock response for testing.`;
    }

    try {
      // Validate API key
      if (!this.grokConfig.apiKey && !process.env.GROK_API_KEY) {
        throw new ProviderError(
          'GROK_API_KEY not set. Please set GROK_API_KEY environment variable or configure in YAML.',
          ErrorCode.CONFIG_INVALID
        );
      }

      // Escape prompt for shell safety
      const escapedPrompt = this.escapeShellArg(prompt);

      logger.debug('Executing Grok CLI', {
        command: 'grok',
        model: this.grokConfig.model,
        promptLength: prompt.length,
        baseUrl: this.grokConfig.baseUrl
      });

      // Build command with model flag
      const command = `grok --prompt "${escapedPrompt}" --model "${this.grokConfig.model}"`;

      // Set up environment variables for Grok CLI
      const env = {
        ...process.env,
        GROK_API_KEY: this.grokConfig.apiKey || process.env.GROK_API_KEY,
        GROK_BASE_URL: this.grokConfig.baseUrl
      };

      // Execute CLI command
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.timeout || 120000, // 2 min default
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env
      });

      if (stderr && !stdout) {
        throw new ProviderError(
          `Grok CLI error: ${stderr}`,
          ErrorCode.PROVIDER_ERROR
        );
      }

      const result = stdout.trim();

      logger.debug('Grok CLI execution successful', {
        model: this.grokConfig.model,
        responseLength: result.length
      });

      return result;
    } catch (error) {
      logger.error('Grok CLI execution failed', {
        model: this.grokConfig.model,
        error: error instanceof Error ? error.message : String(error)
      });
      throw this.handleError(error);
    }
  }

  /**
   * Check if grok CLI is available on PATH
   */
  protected async checkCLIAvailable(): Promise<boolean> {
    try {
      const path = await findOnPath('grok');
      const available = path !== null;

      logger.debug('Grok CLI availability check', {
        available,
        path: path || 'not found'
      });

      return available;
    } catch (error) {
      logger.debug('Grok CLI availability check failed', { error });
      return false;
    }
  }

  /**
   * Get current model (useful for logging/debugging)
   */
  getModel(): string {
    return this.grokConfig.model;
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.grokConfig.baseUrl;
  }

  /**
   * Override model for specific requests
   * @param model - Model name (e.g., 'glm-4.6', 'grok-4-latest')
   */
  setModel(model: string): void {
    const oldModel = this.grokConfig.model;
    this.grokConfig.model = model;
    logger.debug('Grok model changed', { oldModel, newModel: model });
  }

  /**
   * Override base URL for specific requests
   * @param baseUrl - API endpoint URL
   */
  setBaseUrl(baseUrl: string): void {
    const oldUrl = this.grokConfig.baseUrl;
    this.grokConfig.baseUrl = baseUrl;
    logger.debug('Grok base URL changed', { oldUrl, newUrl: baseUrl });
  }
}
```

**Acceptance Criteria**:
- ✅ Class compiles without TypeScript errors
- ✅ Extends BaseProvider correctly
- ✅ YAML config loading works
- ✅ Fallback to JSON/env vars works
- ✅ Mock mode for testing works
- ✅ Shell escaping prevents injection

#### Task 2.2: Security Whitelist Update (0.5 days)

**File**: `src/providers/base-provider.ts`

```typescript
// Line ~35
private static readonly ALLOWED_PROVIDER_NAMES = [
  'claude',
  'gemini',
  'codex',
  'grok',        // ADD THIS LINE
  'test-provider'
] as const;
```

**Verification**:
```bash
# Test that 'grok' is allowed
npm run typecheck
npm test
```

**Acceptance Criteria**:
- ✅ 'grok' added to whitelist
- ✅ GrokProvider constructor doesn't throw
- ✅ Invalid names still throw errors

#### Task 2.3: Provider Export (0.5 days)

**File**: `src/providers/index.ts`

Add export:

```typescript
export { GrokProvider } from './grok-provider.js';
```

**Acceptance Criteria**:
- ✅ GrokProvider can be imported from `@defai.digital/automatosx`
- ✅ No circular dependencies

#### Task 2.4: TypeScript Type Updates (0.5 days)

**File**: `src/types/config.ts`

Add Grok config interface:

```typescript
export interface GrokProviderConfig {
  enabled: boolean;
  priority?: number;
  timeout?: number;
  command?: string;
  configFile?: string;  // Path to YAML config

  // Legacy fallbacks (if YAML not used)
  baseUrl?: string;
  apiKey?: string;
  model?: string;

  // Standard provider fields
  healthCheck?: HealthCheckConfig;
  circuitBreaker?: CircuitBreakerConfig;
  processManagement?: ProcessManagementConfig;
  versionDetection?: VersionDetectionConfig;
  limitTracking?: ProviderLimitTrackingConfig;
}
```

**File**: `src/config.generated.ts`

This will be auto-generated, but ensure template includes Grok:

```typescript
export interface Config {
  providers: {
    'claude-code': ClaudeProviderConfig;
    'gemini-cli': GeminiProviderConfig;
    openai: OpenAIProviderConfig;
    grok: GrokProviderConfig;  // ADD THIS
  };
  // ... rest
}
```

**Acceptance Criteria**:
- ✅ Grok types exist in config
- ✅ `npm run typecheck` passes
- ✅ Config generation script works

#### Task 2.5: Manual Testing Script (0.5 days)

**File**: `scripts/test-grok-provider-manual.sh`

```bash
#!/bin/bash
# Manual test script for Grok Provider

set -e

echo "🧪 Grok Provider Manual Test Suite"
echo "==================================="

# Check prerequisites
echo ""
echo "1. Checking prerequisites..."
if ! command -v grok &> /dev/null; then
  echo "❌ grok CLI not found. Install: npm install -g @vibe-kit/grok-cli"
  exit 1
fi
echo "✅ grok CLI found: $(grok --version)"

if [ -z "$GROK_API_KEY" ]; then
  echo "❌ GROK_API_KEY not set"
  exit 1
fi
echo "✅ GROK_API_KEY is set"

# Create test YAML config
echo ""
echo "2. Creating test YAML config..."
mkdir -p .automatosx/providers
cat > .automatosx/providers/grok-test.yaml << 'EOF'
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}
  model: glm-4.6
  priority: 4
  timeout: 120000
EOF
echo "✅ Test YAML config created"

# Test 1: Direct Grok CLI
echo ""
echo "3. Testing direct Grok CLI..."
grok --model glm-4.6 --prompt "What is 2+2?" > /tmp/grok-test-output.txt
if grep -q "4" /tmp/grok-test-output.txt; then
  echo "✅ Direct Grok CLI works"
else
  echo "❌ Direct Grok CLI test failed"
  cat /tmp/grok-test-output.txt
  exit 1
fi

# Test 2: YAML Config Loading
echo ""
echo "4. Testing YAML config loading..."
npm run build
node -e "
const { getYamlConfigLoader } = require('./dist/core/config-loaders/yaml-config-loader.js');
const loader = getYamlConfigLoader();
loader.loadConfig('.automatosx/providers/grok-test.yaml')
  .then(config => {
    console.log('✅ YAML config loaded:', config.provider.model);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ YAML config load failed:', err.message);
    process.exit(1);
  });
"

# Test 3: GrokProvider Instantiation
echo ""
echo "5. Testing GrokProvider instantiation..."
node -e "
const { GrokProvider } = require('./dist/providers/grok-provider.js');
const provider = new GrokProvider({
  name: 'grok',
  enabled: true,
  priority: 4,
  timeout: 120000,
  command: 'grok',
  configFile: '.automatosx/providers/grok-test.yaml'
});
console.log('✅ GrokProvider instantiated');
console.log('  Model:', provider.getModel());
console.log('  Base URL:', provider.getBaseUrl());
"

echo ""
echo "🎉 All manual tests passed!"
echo ""
echo "Next steps:"
echo "  1. Run unit tests: npm test"
echo "  2. Run integration tests: GROK_API_KEY=\$GROK_API_KEY npm run test:integration"
```

Make executable:
```bash
chmod +x scripts/test-grok-provider-manual.sh
```

**Acceptance Criteria**:
- ✅ Script checks prerequisites
- ✅ Tests direct Grok CLI
- ✅ Tests YAML config loading
- ✅ Tests GrokProvider instantiation
- ✅ All tests pass

### Phase 2 Deliverables

- ✅ `GrokProvider` class fully implemented
- ✅ Security whitelist updated
- ✅ YAML config integration working
- ✅ TypeScript types complete
- ✅ Manual testing script created
- ✅ Mock mode for unit tests

### Phase 2 Success Criteria

- ✅ `npm run build` succeeds
- ✅ `npm run typecheck` passes
- ✅ Manual test script passes
- ✅ Can instantiate GrokProvider
- ✅ YAML config loads correctly
- ✅ Mock mode works for testing

---

## Phase 3: Testing & Validation

**Duration**: 5 days (Day 13-17)
**Owner**: QA Team
**Blockers**: Phase 2 complete
**Dependencies**: GrokProvider, YamlConfigLoader

### Objectives

- Write comprehensive unit tests
- Create integration tests (with API key)
- Add smoke tests
- Achieve >= 95% test coverage
- Validate error handling

### Tasks

#### Task 3.1: GrokProvider Unit Tests (2 days)

**File**: `tests/unit/grok-provider.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrokProvider } from '../../src/providers/grok-provider.js';
import type { ProviderConfig } from '../../src/types/provider.js';

describe('GrokProvider', () => {
  let config: ProviderConfig;

  beforeEach(() => {
    // Enable mock mode
    process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';

    config = {
      name: 'grok',
      enabled: true,
      priority: 4,
      timeout: 120000,
      command: 'grok'
    };
  });

  afterEach(() => {
    delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
    delete process.env.GROK_API_KEY;
    delete process.env.GROK_BASE_URL;
    delete process.env.GROK_MODEL;
  });

  describe('Constructor', () => {
    it('should initialize with default model', async () => {
      const provider = new GrokProvider(config);

      // Wait for async config initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(provider.getName()).toBe('grok');
      expect(provider.getModel()).toBe('grok-code-fast-1'); // Default
    });

    it('should load config from YAML file', async () => {
      const yamlConfig = {
        ...config,
        configFile: './tests/fixtures/grok-test-config.yaml'
      };

      const provider = new GrokProvider(yamlConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(provider.getModel()).toBe('glm-4.6');
      expect(provider.getBaseUrl()).toContain('z.ai');
    });

    it('should load config from environment variables', async () => {
      process.env.GROK_MODEL = 'grok-4-latest';
      process.env.GROK_BASE_URL = 'https://api.x.ai/v1';
      process.env.GROK_API_KEY = 'test-key';

      const provider = new GrokProvider(config);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(provider.getModel()).toBe('grok-4-latest');
      expect(provider.getBaseUrl()).toBe('https://api.x.ai/v1');
    });

    it('should throw if provider name is not "grok"', () => {
      const invalidConfig = { ...config, name: 'invalid' };

      expect(() => new GrokProvider(invalidConfig))
        .toThrow('Invalid provider name');
    });
  });

  describe('execute', () => {
    it('should execute in mock mode', async () => {
      const provider = new GrokProvider(config);
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await provider.execute({ prompt: 'test prompt' });

      expect(result.content).toContain('Mock Grok Response');
      expect(result.content).toContain('test prompt');
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.finishReason).toBe('stop');
    });

    it('should handle long prompts', async () => {
      const provider = new GrokProvider(config);
      await new Promise(resolve => setTimeout(resolve, 100));

      const longPrompt = 'a'.repeat(10000);
      const result = await provider.execute({ prompt: longPrompt });

      expect(result.content).toBeDefined();
      expect(result.finishReason).toBe('stop');
    });

    it('should respect timeout', async () => {
      const shortTimeoutConfig = { ...config, timeout: 100 };
      const provider = new GrokProvider(shortTimeoutConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock a slow response
      vi.spyOn(provider as any, 'executeCLI').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'response';
      });

      await expect(provider.execute({ prompt: 'test' }))
        .rejects.toThrow();
    });
  });

  describe('isAvailable', () => {
    it('should return true if grok is on PATH', async () => {
      const provider = new GrokProvider(config);

      // Mock findOnPath
      vi.mock('../../src/core/cli-provider-detector.js', () => ({
        findOnPath: vi.fn().mockResolvedValue('/usr/local/bin/grok')
      }));

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false if grok is not installed', async () => {
      const provider = new GrokProvider(config);

      vi.mock('../../src/core/cli-provider-detector.js', () => ({
        findOnPath: vi.fn().mockResolvedValue(null)
      }));

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('Model Selection', () => {
    it('should allow model override at runtime', async () => {
      const provider = new GrokProvider(config);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(provider.getModel()).toBe('grok-code-fast-1');

      provider.setModel('glm-4.6');
      expect(provider.getModel()).toBe('glm-4.6');
    });

    it('should respect GROK_MODEL env var', async () => {
      process.env.GROK_MODEL = 'grok-3-latest';

      const provider = new GrokProvider(config);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(provider.getModel()).toBe('grok-3-latest');
    });
  });

  describe('Error Handling', () => {
    it('should throw clear error when API key missing', async () => {
      delete process.env.GROK_API_KEY;
      delete process.env.AUTOMATOSX_MOCK_PROVIDERS;

      const provider = new GrokProvider(config);
      await new Promise(resolve => setTimeout(resolve, 100));

      await expect(provider.execute({ prompt: 'test' }))
        .rejects.toThrow('GROK_API_KEY not set');
    });

    it('should handle CLI errors gracefully', async () => {
      const provider = new GrokProvider(config);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock CLI error
      vi.spyOn(provider as any, 'executeCLI').mockRejectedValue(
        new Error('CLI command failed')
      );

      await expect(provider.execute({ prompt: 'test' }))
        .rejects.toThrow();
    });
  });
});
```

**Run Tests**:
```bash
npx vitest run tests/unit/grok-provider.test.ts --coverage
```

**Acceptance Criteria**:
- ✅ All unit tests pass
- ✅ Coverage >= 95% for GrokProvider
- ✅ Mock mode tests work
- ✅ Error cases covered

#### Task 3.2: Integration Tests (1 day)

**File**: `tests/integration/grok-provider.test.ts`

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { GrokProvider } from '../../src/providers/grok-provider.js';

describe('GrokProvider Integration', () => {
  beforeAll(() => {
    // Skip if no API key
    if (!process.env.GROK_API_KEY) {
      console.warn('⚠️  Skipping Grok integration tests - GROK_API_KEY not set');
      return;
    }
  });

  describe('Z.AI GLM 4.6', () => {
    it('should execute simple query', async () => {
      if (!process.env.GROK_API_KEY) {
        vi.skip();
        return;
      }

      const provider = new GrokProvider({
        name: 'grok',
        enabled: true,
        priority: 4,
        timeout: 120000,
        command: 'grok',
        configFile: './tests/fixtures/grok-glm-4.6.yaml'
      });

      const result = await provider.execute({
        prompt: 'What is 2+2? Answer with just the number.'
      });

      expect(result.content).toMatch(/4|four/i);
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should handle code generation', async () => {
      if (!process.env.GROK_API_KEY) {
        vi.skip();
        return;
      }

      const provider = new GrokProvider({
        name: 'grok',
        enabled: true,
        priority: 4,
        timeout: 120000,
        command: 'grok',
        configFile: './tests/fixtures/grok-glm-4.6.yaml'
      });

      const result = await provider.execute({
        prompt: 'Write a simple JavaScript function that adds two numbers.'
      });

      expect(result.content).toContain('function');
      expect(result.content).toMatch(/add|sum/i);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when CLI available', async () => {
      const provider = new GrokProvider({
        name: 'grok',
        enabled: true,
        priority: 4,
        timeout: 120000,
        command: 'grok'
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);

      const health = provider.getHealth();
      expect(health.available).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
    });
  });
});
```

**Fixture File**: `tests/fixtures/grok-glm-4.6.yaml`
```yaml
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}
  model: glm-4.6
  priority: 4
  timeout: 120000
```

**Run Integration Tests**:
```bash
GROK_API_KEY=your-key npm run test:integration
```

**Acceptance Criteria**:
- ✅ Integration tests pass (with API key)
- ✅ Real API calls succeed
- ✅ Response format is correct
- ✅ Health checks work

#### Task 3.3: Smoke Tests (1 day)

**File**: `tests/smoke/grok-provider.sh`

```bash
#!/bin/bash
# Smoke tests for Grok Provider integration

set -e

echo "🔥 Grok Provider Smoke Tests"
echo "============================="

# Check environment
if [ -z "$GROK_API_KEY" ]; then
  echo "⚠️  GROK_API_KEY not set - skipping live tests"
  exit 0
fi

# 1. CLI Available
echo "1. Testing CLI availability..."
if ! command -v grok &> /dev/null; then
  echo "❌ grok CLI not found"
  exit 1
fi
echo "✅ grok CLI found"

# 2. YAML Config Loads
echo "2. Testing YAML config loading..."
mkdir -p .automatosx/providers
cat > .automatosx/providers/grok-smoke.yaml << EOF
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: \${GROK_API_KEY}
  model: glm-4.6
  priority: 4
  timeout: 120000
EOF

node -e "
const { getYamlConfigLoader } = require('./dist/core/config-loaders/yaml-config-loader.js');
getYamlConfigLoader().loadConfig('.automatosx/providers/grok-smoke.yaml')
  .then(() => console.log('✅ YAML config loaded'))
  .catch(err => { console.error('❌', err.message); process.exit(1); });
"

# 3. Provider Instantiation
echo "3. Testing provider instantiation..."
node -e "
const { GrokProvider } = require('./dist/providers/grok-provider.js');
new GrokProvider({
  name: 'grok',
  enabled: true,
  priority: 4,
  timeout: 120000,
  command: 'grok',
  configFile: '.automatosx/providers/grok-smoke.yaml'
});
console.log('✅ Provider instantiated');
"

# 4. Simple Execution (live API call)
echo "4. Testing simple execution..."
node -e "
const { GrokProvider } = require('./dist/providers/grok-provider.js');
const provider = new GrokProvider({
  name: 'grok',
  enabled: true,
  priority: 4,
  timeout: 120000,
  command: 'grok',
  configFile: '.automatosx/providers/grok-smoke.yaml'
});

setTimeout(async () => {
  try {
    const result = await provider.execute({ prompt: 'Say hello' });
    if (result.content) {
      console.log('✅ Execution successful');
      process.exit(0);
    } else {
      console.error('❌ Empty response');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}, 200);
"

echo ""
echo "🎉 All smoke tests passed!"
```

Make executable:
```bash
chmod +x tests/smoke/grok-provider.sh
```

**Run Smoke Tests**:
```bash
npm run build && GROK_API_KEY=your-key ./tests/smoke/grok-provider.sh
```

**Acceptance Criteria**:
- ✅ All smoke tests pass
- ✅ Live API call succeeds
- ✅ Can run without API key (skips live tests)

#### Task 3.4: Coverage Report (0.5 days)

```bash
# Generate coverage report
npm run test:coverage

# Check coverage thresholds
npm run test:coverage -- --reporter=json > coverage/coverage.json

# Verify >= 95% coverage for new code
node -e "
const coverage = require('./coverage/coverage.json');
const total = coverage.total.lines.pct;
if (total < 95) {
  console.error(\`❌ Coverage \${total}% < 95%\`);
  process.exit(1);
}
console.log(\`✅ Coverage \${total}% >= 95%\`);
"
```

**Acceptance Criteria**:
- ✅ Overall coverage >= 95%
- ✅ GrokProvider coverage >= 95%
- ✅ YamlConfigLoader coverage >= 95%
- ✅ No critical paths uncovered

#### Task 3.5: Error Scenario Testing (0.5 days)

**Test Cases**:
1. Missing API key
2. Invalid YAML syntax
3. Missing required fields
4. Network timeouts
5. Invalid model names
6. File not found errors
7. Permission denied errors

**Run Error Tests**:
```bash
npm test -- --grep "Error"
```

**Acceptance Criteria**:
- ✅ All error scenarios tested
- ✅ Clear error messages
- ✅ Proper error codes
- ✅ No uncaught exceptions

### Phase 3 Deliverables

- ✅ Comprehensive unit test suite
- ✅ Integration tests (with API key)
- ✅ Smoke test scripts
- ✅ >= 95% test coverage
- ✅ Error scenario coverage
- ✅ Coverage reports generated

### Phase 3 Success Criteria

- ✅ `npm test` passes all tests
- ✅ Integration tests pass (with API key)
- ✅ Smoke tests pass
- ✅ Coverage >= 95%
- ✅ No critical bugs found

---

## Phase 4: Documentation & Examples

**Duration**: 3 days (Day 18-20)
**Owner**: Documentation Team
**Blockers**: Phase 3 complete

### Objectives

- Write user-facing documentation
- Create setup guides
- Add code examples
- Write API reference
- Create troubleshooting guide

### Tasks

#### Task 4.1: User Documentation (1 day)

**File**: `docs/providers/grok.md`

```markdown
# Grok Provider for AutomatosX

The Grok provider enables AutomatosX to use Z.AI's GLM 4.6 model and X.AI's Grok models for AI agent orchestration.

## Features

- ✅ Z.AI GLM 4.6 support (cost-effective)
- ✅ X.AI Grok models (grok-4-latest, grok-code-fast-1, etc.)
- ✅ YAML configuration with environment variable interpolation
- ✅ Multi-provider fallback and circuit breaker
- ✅ Health monitoring and automatic recovery
- ✅ MCP tools support (future)
- ✅ Morph Fast Apply (future)

## Quick Start

### 1. Install Grok CLI

\`\`\`bash
npm install -g @vibe-kit/grok-cli
\`\`\`

### 2. Set API Key

\`\`\`bash
export GROK_API_KEY="your-z-ai-api-key"
echo 'export GROK_API_KEY="your-api-key"' >> ~/.zshrc
\`\`\`

### 3. Create YAML Configuration

\`\`\`bash
mkdir -p .automatosx/providers
cat > .automatosx/providers/grok.yaml << 'EOF'
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}
  model: glm-4.6
  priority: 4
  timeout: 2700000
EOF
\`\`\`

### 4. Test Setup

\`\`\`bash
ax doctor grok
ax run backend "Write a hello world function" --provider grok
\`\`\`

## Configuration

### YAML Configuration (Recommended)

Location: \`.automatosx/providers/grok.yaml\`

\`\`\`yaml
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}
  model: glm-4.6
  priority: 4
  timeout: 2700000

  healthCheck:
    enabled: true
    interval: 300000

  circuitBreaker:
    enabled: true
    failureThreshold: 3
\`\`\`

### Environment Variables (Legacy)

\`\`\`bash
export GROK_API_KEY="your-api-key"
export GROK_BASE_URL="https://api.z.ai/api/coding/paas/v4"
export GROK_MODEL="glm-4.6"
\`\`\`

## Usage Examples

### Basic Execution

\`\`\`bash
# Use Grok via routing (priority-based)
ax run backend "implement user authentication"

# Force Grok provider
ax run backend "implement user authentication" --provider grok

# Override model
GROK_MODEL=grok-4-latest ax run backend "task"
\`\`\`

### Multi-Provider Fallback

\`\`\`json
{
  "providers": {
    "claude-code": { "enabled": true, "priority": 1 },
    "grok": { "enabled": true, "priority": 2 }
  }
}
\`\`\`

Router tries Claude first, falls back to Grok if unavailable.

## Available Models

### Z.AI Models
- \`glm-4.6\` - Cost-effective, good for code generation

### X.AI Models
- \`grok-4-latest\` - Latest Grok model
- \`grok-code-fast-1\` - Optimized for code
- \`grok-3-latest\` - Previous generation
- \`grok-3-fast\` - Fast inference
- \`grok-3-mini-fast\` - Lightweight model

## Troubleshooting

### "GROK_API_KEY not set"

\`\`\`bash
# Check if set
echo $GROK_API_KEY

# Set permanently
echo 'export GROK_API_KEY="your-key"' >> ~/.zshrc
source ~/.zshrc
\`\`\`

### "grok CLI not found"

\`\`\`bash
# Install globally
npm install -g @vibe-kit/grok-cli

# Verify
grok --version
\`\`\`

### "Invalid YAML config"

\`\`\`bash
# Validate YAML syntax
cat .automatosx/providers/grok.yaml | yq .

# Check for missing fields
ax doctor grok
\`\`\`

## API Reference

See [API Documentation](../api/grok-provider.md) for detailed API reference.

## Support

- GitHub Issues: https://github.com/defai-digital/automatosx/issues
- Documentation: https://github.com/defai-digital/automatosx/tree/main/docs
\`\`\`

**Acceptance Criteria**:
- ✅ Documentation covers all features
- ✅ Quick start guide is clear
- ✅ Configuration examples provided
- ✅ Troubleshooting section helpful

#### Task 4.2: API Reference (0.5 days)

**File**: `docs/api/grok-provider.md`

\`\`\`markdown
# GrokProvider API Reference

## Constructor

\`\`\`typescript
new GrokProvider(config: ProviderConfig)
\`\`\`

### Parameters

- \`config.name\` (string, required): Must be 'grok'
- \`config.enabled\` (boolean, required): Enable/disable provider
- \`config.priority\` (number, optional): Routing priority (1-10, lower = higher)
- \`config.timeout\` (number, optional): Execution timeout in milliseconds
- \`config.command\` (string, optional): CLI command name (default: 'grok')
- \`config.configFile\` (string, optional): Path to YAML config file

## Methods

### execute(request: ExecutionRequest): Promise<ExecutionResponse>

Execute a request using Grok CLI.

**Parameters**:
- \`request.prompt\` (string): The prompt to send to the model
- \`request.systemPrompt\` (string, optional): System prompt/context

**Returns**: ExecutionResponse
- \`content\` (string): Model response
- \`model\` (string): Model used
- \`latencyMs\` (number): Execution time
- \`finishReason\` (string): Completion reason

### isAvailable(): Promise<boolean>

Check if Grok CLI is available.

**Returns**: true if grok is on PATH

### getHealth(): HealthStatus

Get provider health status.

**Returns**: HealthStatus
- \`available\` (boolean): Is provider available
- \`latencyMs\` (number): Average latency
- \`errorRate\` (number): Error rate (0-1)
- \`consecutiveFailures\` (number): Recent failure count

### getModel(): string

Get current model name.

**Returns**: Model name (e.g., 'glm-4.6')

### setModel(model: string): void

Override model for subsequent requests.

**Parameters**:
- \`model\` (string): Model name

### getBaseUrl(): string

Get current API base URL.

**Returns**: Base URL

### setBaseUrl(baseUrl: string): void

Override base URL for subsequent requests.

**Parameters**:
- \`baseUrl\` (string): API endpoint URL

## Example

\`\`\`typescript
import { GrokProvider } from '@defai.digital/automatosx';

const provider = new GrokProvider({
  name: 'grok',
  enabled: true,
  priority: 4,
  timeout: 120000,
  configFile: '.automatosx/providers/grok.yaml'
});

const result = await provider.execute({
  prompt: 'Write a function that adds two numbers'
});

console.log(result.content);
\`\`\`
\`\`\`

**Acceptance Criteria**:
- ✅ All public methods documented
- ✅ Parameters and return types specified
- ✅ Examples provided
- ✅ Clear and concise

#### Task 4.3: Setup Guides (0.5 days)

Create guides for different scenarios:

1. **File**: `docs/guides/grok-setup-z-ai.md` - Z.AI GLM 4.6 setup
2. **File**: `docs/guides/grok-setup-x-ai.md` - X.AI Grok setup
3. **File**: `docs/guides/grok-multi-env.md` - Multi-environment setup
4. **File**: `docs/guides/grok-team-setup.md` - Team collaboration setup

**Acceptance Criteria**:
- ✅ Step-by-step guides created
- ✅ Screenshots/examples included
- ✅ Common pitfalls addressed

#### Task 4.4: README Updates (0.5 days)

**File**: `README.md`

Add Grok section:

\`\`\`markdown
## Supported Providers

AutomatosX supports multiple AI providers:

- ✅ **Claude** (Anthropic) - Best quality, complex reasoning
- ✅ **Gemini** (Google) - Free tier, fast responses
- ✅ **OpenAI** (GPT) - General purpose, reliable
- ✅ **Grok** (Z.AI/X.AI) - Cost-effective, code-optimized  ← NEW

See [Provider Documentation](docs/providers/) for setup guides.
\`\`\`

**Acceptance Criteria**:
- ✅ README updated
- ✅ Grok mentioned in features list
- ✅ Links to documentation added

#### Task 4.5: Code Examples (0.5 days)

**File**: `examples/grok-basic-usage.ts`

\`\`\`typescript
/**
 * Basic Grok Provider Usage Example
 */

import { GrokProvider } from '@defai.digital/automatosx';

async function main() {
  // Initialize provider
  const provider = new GrokProvider({
    name: 'grok',
    enabled: true,
    priority: 4,
    timeout: 120000,
    configFile: '.automatosx/providers/grok.yaml'
  });

  // Check availability
  const available = await provider.isAvailable();
  console.log('Grok available:', available);

  // Execute simple query
  const result = await provider.execute({
    prompt: 'Write a function that calculates factorial'
  });

  console.log('Response:', result.content);
  console.log('Latency:', result.latencyMs, 'ms');
  console.log('Model:', provider.getModel());
}

main().catch(console.error);
\`\`\`

**File**: `examples/grok-multi-provider-fallback.ts`

\`\`\`typescript
/**
 * Multi-Provider Fallback Example
 */

import { Router } from '@defai.digital/automatosx';
import { ClaudeProvider } from '@defai.digital/automatosx';
import { GrokProvider } from '@defai.digital/automatosx';

async function main() {
  const router = new Router({
    providers: [
      new ClaudeProvider({ /* ... */ }),
      new GrokProvider({ /* ... */ })
    ],
    fallbackEnabled: true
  });

  // Router automatically tries Claude, falls back to Grok
  const result = await router.execute({
    prompt: 'Implement user authentication'
  });

  console.log('Provider used:', result.provider);
  console.log('Response:', result.content);
}

main().catch(console.error);
\`\`\`

**Acceptance Criteria**:
- ✅ Examples are runnable
- ✅ Cover common use cases
- ✅ Well-commented
- ✅ TypeScript and JavaScript versions

### Phase 4 Deliverables

- ✅ User documentation complete
- ✅ API reference published
- ✅ Setup guides for different scenarios
- ✅ README updated
- ✅ Code examples created
- ✅ Troubleshooting guide written

### Phase 4 Success Criteria

- ✅ Documentation is clear and comprehensive
- ✅ New users can set up Grok in < 5 minutes
- ✅ All public APIs documented
- ✅ Examples are tested and working

---

## Phase 5: Integration & CLI Commands

**Duration**: 3 days (Day 21-23)
**Owner**: Platform Team
**Blockers**: Phase 4 complete

### Objectives

- Integrate Grok into CLI commands
- Add `ax doctor grok` support
- Update `ax providers` commands
- Add routing integration
- Test end-to-end workflows

### Tasks

#### Task 5.1: CLI Integration in `ax run` (1 day)

**File**: `src/cli/commands/run.ts`

Add Grok provider instantiation:

\`\`\`typescript
// Around line 480-490
import { GrokProvider } from '../../providers/grok-provider.js';

// In createProviders() function:
if (config.providers['grok']?.enabled) {
  providers.push(new GrokProvider({
    name: 'grok',
    enabled: true,
    priority: config.providers['grok'].priority || 4,
    timeout: config.providers['grok'].timeout || 2700000,
    command: 'grok',
    configFile: config.providers['grok'].configFile ||
      '.automatosx/providers/grok.yaml'
  }));
}
\`\`\`

**Test**:
\`\`\`bash
ax run backend "test task" --provider grok
\`\`\`

**Acceptance Criteria**:
- ✅ Grok provider available in `ax run`
- ✅ Can force Grok with `--provider grok`
- ✅ Router includes Grok in priority list

#### Task 5.2: `ax doctor grok` Command (0.5 days)

**File**: `src/cli/commands/doctor.ts`

Add Grok diagnostic checks:

\`\`\`typescript
import { GrokProvider } from '../../providers/grok-provider.js';
import { getYamlConfigLoader } from '../../core/config-loaders/yaml-config-loader.js';

// Add Grok-specific checks
export async function checkGrokProvider(): Promise<DiagnosticResult> {
  const checks = [];

  // 1. CLI availability
  const cliAvailable = await findOnPath('grok');
  checks.push({
    name: 'Grok CLI installed',
    passed: cliAvailable !== null,
    message: cliAvailable ?
      `Found at ${cliAvailable}` :
      'Install: npm install -g @vibe-kit/grok-cli'
  });

  // 2. API key set
  const apiKeySet = !!process.env.GROK_API_KEY;
  checks.push({
    name: 'GROK_API_KEY set',
    passed: apiKeySet,
    message: apiKeySet ?
      'API key is set' :
      'Set GROK_API_KEY environment variable'
  });

  // 3. YAML config exists
  const yamlExists = await getYamlConfigLoader()
    .fileExists('.automatosx/providers/grok.yaml');
  checks.push({
    name: 'YAML config exists',
    passed: yamlExists,
    message: yamlExists ?
      'Config found at .automatosx/providers/grok.yaml' :
      'Create .automatosx/providers/grok.yaml'
  });

  // 4. YAML config loads
  if (yamlExists) {
    try {
      const config = await getYamlConfigLoader()
        .loadConfig('.automatosx/providers/grok.yaml');
      checks.push({
        name: 'YAML config valid',
        passed: true,
        message: `Model: ${config.provider.model}`
      });
    } catch (error) {
      checks.push({
        name: 'YAML config valid',
        passed: false,
        message: error instanceof Error ? error.message : 'Invalid config'
      });
    }
  }

  // 5. Provider instantiation
  try {
    const provider = new GrokProvider({
      name: 'grok',
      enabled: true,
      priority: 4,
      timeout: 120000,
      command: 'grok',
      configFile: '.automatosx/providers/grok.yaml'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    checks.push({
      name: 'Provider initialization',
      passed: true,
      message: `Model: ${provider.getModel()}`
    });
  } catch (error) {
    checks.push({
      name: 'Provider initialization',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed'
    });
  }

  return {
    provider: 'grok',
    checks,
    overallPass: checks.every(c => c.passed)
  };
}
\`\`\`

**Test**:
\`\`\`bash
ax doctor grok
\`\`\`

**Acceptance Criteria**:
- ✅ `ax doctor grok` runs all checks
- ✅ Clear pass/fail messages
- ✅ Actionable error messages

#### Task 5.3: `ax providers` Commands (0.5 days)

**File**: `src/cli/commands/providers.ts`

Add Grok to provider list:

\`\`\`typescript
// In listProviders() function:
const grokConfig = config.providers['grok'];
if (grokConfig) {
  providerList.push({
    name: 'grok',
    enabled: grokConfig.enabled,
    priority: grokConfig.priority,
    model: grokConfig.model || 'glm-4.6',
    configFile: grokConfig.configFile
  });
}
\`\`\`

**Test**:
\`\`\`bash
ax providers list
ax providers show grok
ax providers trace --provider grok
\`\`\`

**Acceptance Criteria**:
- ✅ Grok appears in `ax providers list`
- ✅ `ax providers show grok` works
- ✅ Trace logs include Grok routing decisions

#### Task 5.4: Router Integration (0.5 days)

**File**: `src/core/router.ts`

Ensure Grok is included in multi-provider routing:

\`\`\`typescript
// Verify GrokProvider is imported and available
import { GrokProvider } from '../providers/grok-provider.js';

// Router should automatically handle Grok if in providers array
// No code changes needed if architecture is correct
\`\`\`

**Test**:
\`\`\`bash
# Test priority-based routing
ax run backend "test task"  # Should use highest priority provider

# Test with Grok as priority 1
# Edit automatosx.config.json: providers.grok.priority = 1
ax run backend "test task"  # Should use Grok
\`\`\`

**Acceptance Criteria**:
- ✅ Router includes Grok in provider list
- ✅ Priority-based routing works
- ✅ Fallback to Grok works when other providers fail
- ✅ Circuit breaker isolates failed providers

#### Task 5.5: End-to-End Workflow Tests (0.5 days)

**Test Scenarios**:

1. **Basic Workflow**:
   \`\`\`bash
   # Setup
   ax setup

   # Create Grok config
   mkdir -p .automatosx/providers
   cp .automatosx/providers/grok.yaml.template .automatosx/providers/grok.yaml

   # Edit YAML, set GROK_API_KEY

   # Run task
   ax run backend "implement calculator" --provider grok

   # Check result in memory
   ax memory search "calculator"
   \`\`\`

2. **Multi-Agent Workflow**:
   \`\`\`bash
   # Product designs, backend implements using Grok
   ax run product "Design user auth system"
   ax run backend "Implement auth from product design" --provider grok
   \`\`\`

3. **Provider Fallback**:
   \`\`\`bash
   # Disable Claude, ensure Grok takes over
   ax config set providers.claude-code.enabled false
   ax run backend "test task"  # Should use Grok
   \`\`\`

**Acceptance Criteria**:
- ✅ All workflow scenarios pass
- ✅ No errors or warnings
- ✅ Results are saved to memory
- ✅ Routing decisions logged correctly

### Phase 5 Deliverables

- ✅ Grok integrated into `ax run`
- ✅ `ax doctor grok` command working
- ✅ `ax providers` commands updated
- ✅ Router integration complete
- ✅ End-to-end workflows tested

### Phase 5 Success Criteria

- ✅ Can use Grok in all CLI commands
- ✅ Diagnostics provide clear feedback
- ✅ Provider listing shows Grok correctly
- ✅ Multi-provider routing works
- ✅ All workflows pass end-to-end

---

## Phase 6: Release Preparation & Deployment

**Duration**: 2 days (Day 24-25)
**Owner**: Release Team
**Blockers**: Phase 5 complete

### Objectives

- Finalize changelog
- Update version numbers
- Create release notes
- Tag release
- Publish to npm

### Tasks

#### Task 6.1: Changelog & Version Bump (0.5 days)

**File**: `CHANGELOG.md`

\`\`\`markdown
# Changelog

## [8.3.0] - 2025-11-XX

### Added

- **Grok Provider Integration** 🎉
  - Support for Z.AI GLM 4.6 model
  - Support for X.AI Grok models (grok-4-latest, grok-code-fast-1, etc.)
  - YAML configuration with environment variable interpolation
  - Multi-provider fallback and circuit breaker
  - Comprehensive documentation and examples

- **YAML Configuration System**
  - New `YamlConfigLoader` for provider configurations
  - Environment variable interpolation (\`\${VAR_NAME}\`)
  - Schema validation with clear error messages
  - Performance caching (60s TTL)

- **CLI Enhancements**
  - \`ax doctor grok\` command for diagnostics
  - \`ax providers\` commands include Grok
  - Provider routing with Grok support

### Changed

- Updated BaseProvider to allow 'grok' in provider name whitelist
- Extended provider configuration types for Grok

### Documentation

- Added \`docs/providers/grok.md\` with setup guide
- Added \`docs/api/grok-provider.md\` with API reference
- Added code examples in \`examples/\`
- Updated README with Grok information

### Dependencies

- Added \`js-yaml@^4.1.0\` for YAML parsing
- Added \`@types/js-yaml@^4.0.5\` for TypeScript support

## [8.2.0] - 2025-11-10

...
\`\`\`

**Version Bump**:
\`\`\`bash
# Bump version to 8.3.0
npm version minor  # 8.2.0 → 8.3.0

# This auto-syncs versions via Husky hook
# Verifies: package.json, README.md, CLAUDE.md, config
\`\`\`

**Acceptance Criteria**:
- ✅ Changelog updated with all changes
- ✅ Version bumped to 8.3.0
- ✅ All version references synced

#### Task 6.2: Release Notes (0.5 days)

**File**: `RELEASE_NOTES_8.3.0.md`

\`\`\`markdown
# AutomatosX v8.3.0 Release Notes

## 🎉 Major Feature: Grok Provider Integration

AutomatosX now supports Z.AI's GLM 4.6 and X.AI's Grok models as AI providers!

### What's New

**Grok Provider**:
- ✅ Z.AI GLM 4.6 support (cost-effective, code-optimized)
- ✅ X.AI Grok models (grok-4-latest, grok-code-fast-1, etc.)
- ✅ YAML configuration for better team collaboration
- ✅ Environment variable interpolation for secrets
- ✅ Multi-provider fallback and circuit breaker
- ✅ Comprehensive documentation and examples

**YAML Configuration**:
- ✅ New \`.automatosx/providers/grok.yaml\` config file
- ✅ Environment variable interpolation (\`\${VAR_NAME}\`)
- ✅ Schema validation with clear error messages
- ✅ Performance caching for faster config loads

**CLI Enhancements**:
- ✅ \`ax doctor grok\` for setup diagnostics
- ✅ \`ax providers\` commands show Grok status
- ✅ Provider routing includes Grok in priority list

### Quick Start

\`\`\`bash
# 1. Install Grok CLI
npm install -g @vibe-kit/grok-cli

# 2. Set API key
export GROK_API_KEY="your-z-ai-api-key"

# 3. Create config
mkdir -p .automatosx/providers
cat > .automatosx/providers/grok.yaml << 'EOF'
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: \${GROK_API_KEY}
  model: glm-4.6
EOF

# 4. Test
ax doctor grok
ax run backend "Write hello world" --provider grok
\`\`\`

### Breaking Changes

None - fully backward compatible with v8.2.0.

### Migration Guide

See [MIGRATION.md](MIGRATION.md) for detailed upgrade instructions.

### Documentation

- [Grok Provider Guide](docs/providers/grok.md)
- [API Reference](docs/api/grok-provider.md)
- [Setup Examples](examples/)

### Contributors

Thanks to all contributors who made this release possible!

### What's Next

- v8.4.0: MCP Tools Integration
- v8.5.0: Morph Fast Apply
- v8.6.0: Streaming Responses

---

**Full Changelog**: https://github.com/defai.digital/automatosx/compare/v8.2.0...v8.3.0
\`\`\`

**Acceptance Criteria**:
- ✅ Release notes comprehensive
- ✅ Quick start guide included
- ✅ Breaking changes documented (none)
- ✅ What's next section added

#### Task 6.3: Final Testing (0.5 days)

**Pre-Release Checklist**:

\`\`\`bash
# 1. Clean build
rm -rf dist node_modules
npm install
npm run build

# 2. Run all tests
npm test
npm run test:integration  # With API keys

# 3. Verify TypeScript
npm run typecheck

# 4. Verify linting
npm run lint

# 5. Check coverage
npm run test:coverage

# 6. Smoke tests
./tests/smoke/grok-provider.sh

# 7. Manual verification
ax setup
ax doctor grok
ax run backend "test" --provider grok
ax providers list

# 8. Check documentation
npm run docs:build  # If applicable

# 9. Verify package.json
cat package.json | grep version
cat package.json | grep dependencies

# 10. Test install
npm pack
npm install -g automatosx-8.3.0.tgz
ax --version
\`\`\`

**Acceptance Criteria**:
- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Coverage >= 95%
- ✅ Smoke tests pass
- ✅ Manual verification successful
- ✅ Package installs correctly

#### Task 6.4: Git Tagging & Release (0.5 days)

\`\`\`bash
# 1. Ensure all changes committed
git status

# 2. Create annotated tag
git tag -a v8.3.0 -m "Release v8.3.0: Grok Provider Integration

- Add Grok provider (Z.AI GLM 4.6, X.AI Grok models)
- Add YAML configuration system
- Add environment variable interpolation
- Add comprehensive documentation
- Add CLI integration (ax doctor grok, etc.)

See RELEASE_NOTES_8.3.0.md for details."

# 3. Push tag
git push origin v8.3.0

# 4. Create GitHub release
gh release create v8.3.0 \\
  --title "v8.3.0: Grok Provider Integration" \\
  --notes-file RELEASE_NOTES_8.3.0.md \\
  --latest
\`\`\`

**Acceptance Criteria**:
- ✅ Git tag created (v8.3.0)
- ✅ Tag pushed to remote
- ✅ GitHub release created
- ✅ Release notes attached

#### Task 6.5: NPM Publish (CRITICAL - 0.5 days)

\`\`\`bash
# 1. Verify npm credentials
npm whoami

# 2. Dry run
npm publish --dry-run

# 3. Publish to npm
npm publish --access public

# 4. Verify publication
npm view @defai.digital/automatosx version
npm view @defai.digital/automatosx

# 5. Test installation from npm
npm install -g @defai.digital/automatosx@8.3.0
ax --version
\`\`\`

**Acceptance Criteria**:
- ✅ Published to npm successfully
- ✅ Version 8.3.0 available on npm
- ✅ Can install from npm
- ✅ `ax --version` shows 8.3.0

### Phase 6 Deliverables

- ✅ Changelog updated
- ✅ Version bumped to 8.3.0
- ✅ Release notes created
- ✅ Git tag created and pushed
- ✅ GitHub release published
- ✅ NPM package published

### Phase 6 Success Criteria

- ✅ v8.3.0 available on npm
- ✅ GitHub release published
- ✅ All tests passing
- ✅ Documentation complete
- ✅ No critical bugs

---

## Phase 7: Advanced Features (Optional)

**Duration**: 8+ days
**Owner**: Advanced Features Team
**Blockers**: Phase 6 complete
**Priority**: Low (future releases)

This phase covers stretch goals outlined in the PRD. These can be implemented in future releases (v8.4.0+).

### Features

#### 7.1 MCP Tools Integration (v8.4.0)

**Duration**: 3 days

- [ ] Research Grok CLI MCP configuration
- [ ] Design AutomatosX → Grok MCP bridge
- [ ] Implement MCP server config in YAML
- [ ] Add Linear/GitHub MCP examples
- [ ] Test MCP tool usage
- [ ] Document MCP integration

**Deliverables**:
- MCP tools working with Linear integration
- Documentation for MCP setup
- Examples for common MCP servers

#### 7.2 Morph Fast Apply (v8.5.0)

**Duration**: 3 days

- [ ] Research Morph API integration
- [ ] Design fast code editing interface
- [ ] Implement Morph API key handling
- [ ] Benchmark performance gains
- [ ] Add fallback to standard editing
- [ ] Document Morph setup

**Deliverables**:
- Morph Fast Apply working (4,500+ tokens/sec)
- Performance benchmarks
- Fallback mechanism tested

#### 7.3 Streaming Responses (v8.6.0)

**Duration**: 2 days

- [ ] Investigate Grok CLI streaming capabilities
- [ ] Implement streaming response parser
- [ ] Add `--streaming` flag to `ax run`
- [ ] Update UI for real-time display
- [ ] Test cancellation (Ctrl+C)
- [ ] Document streaming usage

**Deliverables**:
- Real-time token streaming
- Lower perceived latency
- Cancellable requests

---

## Risk Management

### High-Priority Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Z.AI API breaking changes** | Medium | High | Version pin Grok CLI, integration tests, fallback to X.AI |
| **YAML parsing security** | Low | Critical | Use trusted `js-yaml` library, validate all inputs |
| **Environment var not set** | High | Medium | Clear error messages, validation in YAML loader |
| **Grok CLI version incompatibility** | Medium | Medium | Version detection, compatibility matrix in docs |

### Medium-Priority Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Performance degradation** | Low | Medium | Benchmark tests, caching, profiling |
| **Test coverage gaps** | Low | Medium | Strict coverage thresholds (>= 95%), code review |
| **Documentation outdated** | Medium | Low | Version docs with code, automated doc generation |

### Risk Response Plan

**If Z.AI API breaks**:
1. Check Grok CLI release notes
2. Update YAML config if needed
3. Release patch version (v8.3.1)
4. Notify users via GitHub issue

**If security vulnerability found**:
1. Immediately patch and release
2. Update dependencies
3. Run security audit: `npm audit`
4. Notify users

**If tests fail in CI**:
1. Check environment variables
2. Verify Grok CLI version
3. Review recent code changes
4. Fix or revert

---

## Success Criteria

### Phase 0: Foundation
- ✅ Grok CLI installed and working
- ✅ `js-yaml` dependency added
- ✅ Project structure created
- ✅ Baseline tests passing

### Phase 1: YAML Config
- ✅ YamlConfigLoader implemented
- ✅ Environment variable interpolation works
- ✅ Schema validation catches errors
- ✅ >= 95% test coverage

### Phase 2: Provider
- ✅ GrokProvider extends BaseProvider
- ✅ YAML config integration works
- ✅ Mock mode for testing
- ✅ Security whitelist updated

### Phase 3: Testing
- ✅ All unit tests pass
- ✅ Integration tests pass (with API key)
- ✅ >= 95% overall coverage
- ✅ Smoke tests successful

### Phase 4: Documentation
- ✅ User guide complete
- ✅ API reference published
- ✅ Setup guides for all scenarios
- ✅ Examples tested and working

### Phase 5: Integration
- ✅ CLI commands support Grok
- ✅ `ax doctor grok` diagnostic works
- ✅ Provider routing includes Grok
- ✅ End-to-end workflows pass

### Phase 6: Release
- ✅ Version 8.3.0 published to npm
- ✅ GitHub release created
- ✅ Changelog and release notes
- ✅ All tests passing

### Overall Success
- ✅ Users can install and use Grok in < 5 minutes
- ✅ Zero breaking changes from v8.2.0
- ✅ >= 95% test coverage maintained
- ✅ Documentation comprehensive and clear
- ✅ Performance meets or exceeds expectations

---

## Timeline Summary

| Phase | Duration | Days | Start | End |
|-------|----------|------|-------|-----|
| Phase 0: Foundation | 2 days | 1-2 | Day 1 | Day 2 |
| Phase 1: YAML Config | 5 days | 3-7 | Day 3 | Day 7 |
| Phase 2: Provider | 5 days | 8-12 | Day 8 | Day 12 |
| Phase 3: Testing | 5 days | 13-17 | Day 13 | Day 17 |
| Phase 4: Documentation | 3 days | 18-20 | Day 18 | Day 20 |
| Phase 5: Integration | 3 days | 21-23 | Day 21 | Day 23 |
| Phase 6: Release | 2 days | 24-25 | Day 24 | Day 25 |
| **Total (MVP)** | **25 days** | **5 weeks** | | |
| Phase 7: Advanced (Optional) | 8+ days | 26+ | Day 26+ | TBD |

**Critical Path**: Phases 0 → 1 → 2 → 3 → 6

**Parallel Opportunities**:
- Phase 4 (Documentation) can overlap with Phase 3 (Testing)
- Phase 5 (Integration) tasks can be parallelized across team members

---

## Team Assignments

### Phase 0-1 (Foundation & YAML)
- **Backend Team**: YamlConfigLoader implementation
- **QA Team**: Test infrastructure setup

### Phase 2 (Provider)
- **Provider Team**: GrokProvider implementation
- **Security Team**: Whitelist and validation review

### Phase 3 (Testing)
- **QA Team**: Unit and integration tests
- **DevOps Team**: CI/CD integration

### Phase 4 (Documentation)
- **Documentation Team**: User guides and API reference
- **Developer Advocates**: Examples and tutorials

### Phase 5 (Integration)
- **Platform Team**: CLI command integration
- **Backend Team**: Router integration

### Phase 6 (Release)
- **Release Team**: Version management and publishing
- **DevOps Team**: Deployment and monitoring

---

## Monitoring & Metrics

### Development Metrics
- Lines of code added: ~2,500
- Test coverage: >= 95%
- TypeScript errors: 0
- Linting errors: 0

### Performance Metrics
- YAML config load time: < 10ms (cached)
- Provider execution latency: p50 < 2s, p99 < 10s
- Test execution time: < 60s (unit), < 5min (integration)

### Quality Metrics
- Bug count: <= 2 critical bugs in first 30 days
- Time to fix: <= 48 hours for critical issues
- User satisfaction: >= 4.0/5.0 (surveys)

### Adoption Metrics (30 days post-launch)
- Grok enablement rate: >= 15% of active users
- Request volume: >= 5% of total AI requests via Grok
- Retention: >= 70% keep Grok enabled after 1 week

---

## Communication Plan

### Internal
- **Daily Standup**: Progress updates, blockers
- **Weekly Review**: Phase completion, metrics review
- **Slack Channel**: #grok-integration for real-time comms

### External
- **GitHub Discussions**: Feature announcements, Q&A
- **Blog Post**: Release announcement (v8.3.0)
- **Twitter**: Feature highlights, code examples
- **Email**: Notify existing users of new provider

---

## Rollback Plan

If critical issues arise post-release:

1. **Disable Grok Provider**:
   \`\`\`bash
   ax config set providers.grok.enabled false
   \`\`\`

2. **Revert to v8.2.0**:
   \`\`\`bash
   npm install -g @defai.digital/automatosx@8.2.0
   \`\`\`

3. **Hotfix Release** (if possible):
   - Fix critical bug
   - Release v8.3.1 within 24 hours
   - Communicate fix to users

4. **Full Rollback** (if necessary):
   - Unpublish v8.3.0 from npm
   - Tag v8.2.0 as `@latest`
   - Post-mortem analysis

---

## Next Steps

### Immediate (Week 1)
1. ✅ Review and approve this action plan
2. ✅ Assign team members to phases
3. ✅ Set up project tracking (Jira/GitHub Projects)
4. ✅ Begin Phase 0: Foundation & Dependencies

### Short-term (Weeks 2-3)
1. Complete Phases 1-2 (YAML Config + Provider)
2. Begin testing in Phase 3
3. Start documentation in Phase 4

### Medium-term (Weeks 4-5)
1. Complete testing and documentation
2. Integrate into CLI (Phase 5)
3. Prepare for release (Phase 6)

### Long-term (Post-Release)
1. Monitor adoption and error rates
2. Collect user feedback
3. Plan advanced features (Phase 7)
4. Iterate based on learnings

---

**END OF ACTION PLAN**

For questions or clarifications, contact the project owner or refer to the PRD:
[grok-provider-integration.md](./grok-provider-integration.md)
