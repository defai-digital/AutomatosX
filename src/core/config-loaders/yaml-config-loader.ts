/**
 * YamlConfigLoader - YAML Configuration System for Providers
 *
 * Loads provider configurations from YAML files with:
 * - Environment variable interpolation (${VAR_NAME})
 * - Schema validation with detailed error messages
 * - Performance caching with configurable TTL (default 60s)
 * - Type-safe configuration objects
 * - Backward compatibility with environment variables
 *
 * @example
 * ```typescript
 * const loader = getYamlConfigLoader();
 * const config = await loader.loadConfig('.automatosx/providers/grok.yaml');
 * console.log(config.provider.model); // "glm-4.6"
 * ```
 *
 * @version 8.3.0
 * @since Phase 1 - Grok Provider Integration
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ConfigError, ErrorCode } from '../../shared/errors/errors.js';
import { TIMEOUTS } from '../validation-limits.js';

/**
 * YAML Provider Configuration Schema
 *
 * Defines the structure of provider YAML configuration files.
 * Environment variables can be referenced using ${VAR_NAME} syntax.
 */
export interface YamlProviderConfig {
  /** Provider configuration section */
  provider: {
    /** Provider name (must match ALLOWED_PROVIDER_NAMES whitelist) */
    name: string;
    /** Whether provider is enabled */
    enabled: boolean;
    /** Priority for multi-provider routing (1 = highest) */
    priority?: number;
    /** Base URL for API endpoint (e.g., https://api.z.ai/api/coding/paas/v4) */
    baseUrl: string;
    /** API key (can be ${ENV_VAR} or direct value) */
    apiKey: string;
    /** Model to use (e.g., "glm-4.6", "grok-beta") */
    model: string;
    /** Timeout in milliseconds (default: 120000) */
    timeout?: number;
    /** Maximum retries on failure (default: 3) */
    maxRetries?: number;
    /** Custom CLI path override (optional) */
    customPath?: string;
  };

  /** Rate limit configuration (optional) */
  rateLimits?: {
    /** Maximum requests per minute */
    maxRequestsPerMinute: number;
    /** Maximum tokens per minute */
    maxTokensPerMinute: number;
    /** Maximum concurrent requests */
    maxConcurrentRequests: number;
  };

  /** Circuit breaker configuration (optional) */
  circuitBreaker?: {
    /** Consecutive failures before opening circuit */
    failureThreshold: number;
    /** Time to wait before retry (ms) */
    resetTimeout: number;
    /** Half-open state timeout (ms) */
    halfOpenTimeout?: number;
  };

  /** MCP (Model Context Protocol) tools configuration (optional) */
  mcp?: {
    /** Enable MCP tools support */
    enabled: boolean;
    /** MCP server configuration */
    servers?: Array<{
      /** Server name */
      name: string;
      /** Server command */
      command: string;
      /** Server arguments */
      args?: string[];
      /** Environment variables */
      env?: Record<string, string>;
    }>;
  };

  /** Morph custom agents configuration (optional) */
  morph?: {
    /** Enable Morph agents */
    enabled: boolean;
    /** Custom agents directory */
    agentsDir?: string;
    /** Agent definitions */
    agents?: Array<{
      /** Agent name */
      name: string;
      /** Agent prompt/instructions */
      prompt: string;
      /** Agent capabilities */
      capabilities?: string[];
    }>;
  };

  /** Additional metadata (optional) */
  metadata?: {
    /** Configuration version */
    version?: string;
    /** Description */
    description?: string;
    /** Tags for organization */
    tags?: string[];
    /** Last updated timestamp */
    lastUpdated?: string;
  };
}

/**
 * Cache entry with TTL tracking
 */
interface CacheEntry {
  config: YamlProviderConfig;
  timestamp: number;
  filePath: string;
}

/**
 * Validation result with detailed error information
 */
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

/**
 * YamlConfigLoader - Singleton configuration loader
 *
 * Implements lazy loading, caching, and validation for YAML provider configs.
 */
export class YamlConfigLoader {
  /** Cache of loaded configurations */
  private cache: Map<string, CacheEntry> = new Map();

  /** Cache TTL in milliseconds (default: 60s) */
  private cacheTTL: number = TIMEOUTS.CONFIG_CACHE_TTL;

  /** Singleton instance */
  private static instance: YamlConfigLoader | null = null;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Private - use getYamlConfigLoader() instead
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): YamlConfigLoader {
    if (!YamlConfigLoader.instance) {
      YamlConfigLoader.instance = new YamlConfigLoader();
    }
    return YamlConfigLoader.instance;
  }

  /**
   * Set cache TTL for testing and configuration
   *
   * @param ttlMs - Time-to-live in milliseconds
   */
  public setCacheTTL(ttlMs: number): void {
    if (ttlMs < 0) {
      throw new Error('Cache TTL must be non-negative');
    }
    this.cacheTTL = ttlMs;
  }

  /**
   * Load and parse YAML configuration file
   *
   * Features:
   * - Environment variable interpolation
   * - Schema validation
   * - Caching with TTL
   * - Detailed error messages
   *
   * @param filePath - Absolute or relative path to YAML config file
   * @returns Parsed and validated configuration object
   * @throws {ConfigError} If file not found, parse error, or validation fails
   */
  public async loadConfig(filePath: string): Promise<YamlProviderConfig> {
    // Resolve to absolute path
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    // Check cache first
    const cached = this.getFromCache(absolutePath);
    if (cached) {
      return cached;
    }

    try {
      // Read file content
      const fileContent = await fs.readFile(absolutePath, 'utf8');

      // Interpolate environment variables
      const interpolated = this.interpolateEnvVars(fileContent, absolutePath);

      // Parse YAML
      let parsed: any;
      try {
        parsed = yaml.load(interpolated);
      } catch (error) {
        throw ConfigError.parseError(
          error instanceof Error ? error : new Error(String(error)),
          absolutePath
        );
      }

      // Validate structure
      const validationResult = this.validateConfig(parsed, absolutePath);
      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .map(e => `  - ${e.field}: ${e.message}`)
          .join('\n');
        throw new ConfigError(
          `YAML configuration validation failed:\n${errorMessages}`,
          ErrorCode.CONFIG_VALIDATION_ERROR,
          [
            'Check required fields: provider.name, provider.baseUrl, provider.apiKey, provider.model',
            'Verify all referenced environment variables are set',
            'See documentation for full YAML schema',
            'Use example template: .automatosx/providers/grok.yaml.template'
          ],
          {
            filePath: absolutePath,
            errors: validationResult.errors
          }
        );
      }

      const config = parsed as YamlProviderConfig;

      // Cache the result
      this.setInCache(absolutePath, config);

      return config;
    } catch (error) {
      // Re-throw ConfigError as-is
      if (error instanceof ConfigError) {
        throw error;
      }

      // Handle file not found
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new ConfigError(
          `YAML configuration file not found: ${absolutePath}`,
          ErrorCode.CONFIG_NOT_FOUND,
          [
            'Check that the file path is correct',
            'Create configuration from template: cp .automatosx/providers/grok.yaml.template .automatosx/providers/grok.yaml',
            'Run "ax setup" to initialize the project structure',
            'Verify file permissions allow read access'
          ],
          { filePath: absolutePath }
        );
      }

      // Handle permission errors
      if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
        throw new ConfigError(
          `Permission denied reading YAML configuration: ${absolutePath}`,
          ErrorCode.CONFIG_PARSE_ERROR,
          [
            'Check file permissions with: ls -la',
            'Grant read permission: chmod 644 <file>',
            'Verify you own the file or have access rights'
          ],
          { filePath: absolutePath }
        );
      }

      // Wrap other errors
      throw new ConfigError(
        `Failed to load YAML configuration: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.CONFIG_PARSE_ERROR,
        [
          'Check the error message for details',
          'Verify file format is valid YAML',
          'Try validating with: yamllint <file>'
        ],
        {
          filePath: absolutePath,
          originalError: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Interpolate environment variables in YAML content
   *
   * Supports ${VAR_NAME} syntax. Variables must be uppercase with underscores.
   * Throws ConfigError if referenced variable is not set.
   *
   * @param content - Raw YAML file content
   * @param filePath - File path for error context
   * @returns Content with environment variables replaced
   * @throws {ConfigError} If required environment variable is not set
   */
  private interpolateEnvVars(content: string, filePath: string): string {
    const envVarPattern = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
    const missingVars: string[] = [];

    const interpolated = content.replace(envVarPattern, (match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        missingVars.push(varName);
        return match; // Keep original for error reporting
      }
      return value;
    });

    if (missingVars.length > 0) {
      throw new ConfigError(
        `Missing required environment variables: ${missingVars.join(', ')}`,
        ErrorCode.CONFIG_VALIDATION_ERROR,
        [
          `Set missing variables: export ${missingVars[0]}="your-value"`,
          'Check .env file if using environment variable management',
          'Use direct values in YAML instead of ${VAR} references',
          'See documentation for required environment variables'
        ],
        {
          filePath,
          missingVars,
          hint: `Example: export ${missingVars[0]}="..."`
        }
      );
    }

    return interpolated;
  }

  /**
   * Validate YAML configuration against schema
   *
   * Checks:
   * - Required fields present
   * - Field types correct
   * - Values within valid ranges
   * - Provider name format valid
   *
   * @param config - Parsed configuration object
   * @param filePath - File path for error context
   * @returns Validation result with errors if any
   */
  private validateConfig(config: any, filePath: string): ValidationResult {
    const errors: Array<{ field: string; message: string; value?: any }> = [];

    // Check top-level structure
    if (!config || typeof config !== 'object') {
      errors.push({
        field: 'root',
        message: 'Configuration must be an object',
        value: typeof config
      });
      return { valid: false, errors };
    }

    // Validate provider section (required)
    if (!config.provider) {
      errors.push({
        field: 'provider',
        message: 'Missing required "provider" section'
      });
    } else {
      const p = config.provider;

      // Required fields
      if (!p.name || typeof p.name !== 'string') {
        errors.push({
          field: 'provider.name',
          message: 'Required field "name" must be a non-empty string',
          value: p.name
        });
      } else if (!/^[a-z][a-z0-9-]*$/.test(p.name)) {
        errors.push({
          field: 'provider.name',
          message: 'Provider name must be lowercase alphanumeric with hyphens (e.g., "grok", "claude-code")',
          value: p.name
        });
      }

      if (p.enabled !== true && p.enabled !== false) {
        errors.push({
          field: 'provider.enabled',
          message: 'Required field "enabled" must be a boolean (true or false)',
          value: p.enabled
        });
      }

      if (!p.baseUrl || typeof p.baseUrl !== 'string') {
        errors.push({
          field: 'provider.baseUrl',
          message: 'Required field "baseUrl" must be a non-empty string',
          value: p.baseUrl
        });
      } else if (!/^https?:\/\/.+/.test(p.baseUrl)) {
        errors.push({
          field: 'provider.baseUrl',
          message: 'Field "baseUrl" must be a valid HTTP/HTTPS URL',
          value: p.baseUrl
        });
      }

      if (!p.apiKey || typeof p.apiKey !== 'string') {
        errors.push({
          field: 'provider.apiKey',
          message: 'Required field "apiKey" must be a non-empty string',
          value: p.apiKey ? '<redacted>' : p.apiKey
        });
      }

      if (!p.model || typeof p.model !== 'string') {
        errors.push({
          field: 'provider.model',
          message: 'Required field "model" must be a non-empty string',
          value: p.model
        });
      }

      // Optional fields with type checks
      if (p.priority !== undefined) {
        if (typeof p.priority !== 'number' || p.priority < 1) {
          errors.push({
            field: 'provider.priority',
            message: 'Field "priority" must be a number >= 1',
            value: p.priority
          });
        }
      }

      if (p.timeout !== undefined) {
        if (typeof p.timeout !== 'number' || p.timeout < 1000) {
          errors.push({
            field: 'provider.timeout',
            message: 'Field "timeout" must be a number >= 1000 (milliseconds)',
            value: p.timeout
          });
        }
      }

      if (p.maxRetries !== undefined) {
        if (typeof p.maxRetries !== 'number' || p.maxRetries < 0) {
          errors.push({
            field: 'provider.maxRetries',
            message: 'Field "maxRetries" must be a number >= 0',
            value: p.maxRetries
          });
        }
      }

      if (p.customPath !== undefined) {
        if (typeof p.customPath !== 'string') {
          errors.push({
            field: 'provider.customPath',
            message: 'Field "customPath" must be a string',
            value: p.customPath
          });
        }
      }
    }

    // Validate rateLimits (optional)
    if (config.rateLimits) {
      const rl = config.rateLimits;
      if (typeof rl.maxRequestsPerMinute !== 'number' || rl.maxRequestsPerMinute < 1) {
        errors.push({
          field: 'rateLimits.maxRequestsPerMinute',
          message: 'Must be a number >= 1',
          value: rl.maxRequestsPerMinute
        });
      }
      if (typeof rl.maxTokensPerMinute !== 'number' || rl.maxTokensPerMinute < 1) {
        errors.push({
          field: 'rateLimits.maxTokensPerMinute',
          message: 'Must be a number >= 1',
          value: rl.maxTokensPerMinute
        });
      }
      if (typeof rl.maxConcurrentRequests !== 'number' || rl.maxConcurrentRequests < 1) {
        errors.push({
          field: 'rateLimits.maxConcurrentRequests',
          message: 'Must be a number >= 1',
          value: rl.maxConcurrentRequests
        });
      }
    }

    // Validate circuitBreaker (optional)
    if (config.circuitBreaker) {
      const cb = config.circuitBreaker;
      if (typeof cb.failureThreshold !== 'number' || cb.failureThreshold < 1) {
        errors.push({
          field: 'circuitBreaker.failureThreshold',
          message: 'Must be a number >= 1',
          value: cb.failureThreshold
        });
      }
      if (typeof cb.resetTimeout !== 'number' || cb.resetTimeout < 1000) {
        errors.push({
          field: 'circuitBreaker.resetTimeout',
          message: 'Must be a number >= 1000 (milliseconds)',
          value: cb.resetTimeout
        });
      }
    }

    // Validate MCP (optional)
    if (config.mcp) {
      if (typeof config.mcp.enabled !== 'boolean') {
        errors.push({
          field: 'mcp.enabled',
          message: 'Must be a boolean',
          value: config.mcp.enabled
        });
      }
    }

    // Validate Morph (optional)
    if (config.morph) {
      if (typeof config.morph.enabled !== 'boolean') {
        errors.push({
          field: 'morph.enabled',
          message: 'Must be a boolean',
          value: config.morph.enabled
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration from cache if valid
   *
   * @param filePath - Absolute file path
   * @returns Cached config if still valid, undefined otherwise
   */
  private getFromCache(filePath: string): YamlProviderConfig | undefined {
    const entry = this.cache.get(filePath);
    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.cacheTTL) {
      // Cache expired
      this.cache.delete(filePath);
      return undefined;
    }

    return entry.config;
  }

  /**
   * Store configuration in cache
   *
   * @param filePath - Absolute file path
   * @param config - Validated configuration object
   */
  private setInCache(filePath: string, config: YamlProviderConfig): void {
    this.cache.set(filePath, {
      config,
      timestamp: Date.now(),
      filePath
    });
  }

  /**
   * Clear all cached configurations
   *
   * Useful for testing and forcing reload.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear specific configuration from cache
   *
   * @param filePath - Absolute or relative path to YAML config file
   */
  public clearCacheEntry(filePath: string): void {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    this.cache.delete(absolutePath);
  }

  /**
   * Get cache statistics for monitoring
   *
   * @returns Cache metrics including size, hit rate, etc.
   */
  public getCacheStats(): {
    size: number;
    entries: Array<{ filePath: string; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([filePath, entry]) => ({
      filePath,
      age: Date.now() - entry.timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

/**
 * Get singleton YamlConfigLoader instance
 *
 * Convenience function for accessing the loader.
 *
 * @example
 * ```typescript
 * const loader = getYamlConfigLoader();
 * const config = await loader.loadConfig('.automatosx/providers/grok.yaml');
 * ```
 */
export function getYamlConfigLoader(): YamlConfigLoader {
  return YamlConfigLoader.getInstance();
}

/**
 * Load YAML configuration (convenience function)
 *
 * Shorthand for getYamlConfigLoader().loadConfig(filePath)
 *
 * @param filePath - Path to YAML config file
 * @returns Parsed and validated configuration
 *
 * @example
 * ```typescript
 * const config = await loadYamlConfig('.automatosx/providers/grok.yaml');
 * console.log(config.provider.model); // "glm-4.6"
 * ```
 */
export async function loadYamlConfig(filePath: string): Promise<YamlProviderConfig> {
  return getYamlConfigLoader().loadConfig(filePath);
}
