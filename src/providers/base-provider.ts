/**
 * BaseProvider - Abstract base class for all AI providers
 *
 * Provides common functionality:
 * - Rate limiting with token bucket algorithm
 * - Exponential backoff retry logic
 * - Health monitoring and circuit breaker
 * - Cost tracking and estimation
 * - Error categorization
 */

import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ExecutionRequest,
  ExecutionResponse,
  HealthStatus,
  RateLimitStatus,
  Cost,
  UsageStats,
  EmbeddingOptions,
  RetryConfig,
  StreamingOptions
} from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { ProviderResponseCache } from '../core/cache.js';
import { shouldRetryError } from './retry-errors.js';
import { existsSync } from 'fs';
import { findOnPath } from '../core/cli-provider-detector.js';
import { shouldAutoEnableMockProviders } from '../utils/environment.js';

/**
 * Cache entry for availability check results
 */
interface AvailabilityCacheEntry {
  available: boolean;
  timestamp: number;
  path?: string;
}

/**
 * Cache entry for version detection results
 */
interface VersionCacheEntry {
  version: string | null;
  timestamp: number;
}

/**
 * Aggregated token bucket for rate limiting
 */
interface TokenBucket {
  timestamp: number;
  count: number;
}

export abstract class BaseProvider implements Provider {
  protected config: ProviderConfig;
  protected health: HealthStatus;
  protected usageStats: UsageStats;
  protected rateLimitState: {
    requests: number[];  // timestamps of recent requests
    tokens: number[];    // DEPRECATED: Use tokenBuckets instead
    tokenBuckets: TokenBucket[]; // NEW: Aggregated token tracking
    concurrentRequests: number;
  };
  protected responseCache: ProviderResponseCache;

  // NEW: Availability caching
  private availabilityCache?: AvailabilityCacheEntry;
  private readonly AVAILABILITY_CACHE_TTL = 60000; // 60 seconds (baseline)
  private readonly ADAPTIVE_CACHE_ENABLED = true; // Phase 3: Enable adaptive TTL

  // NEW: Version detection caching
  private versionCache = new Map<string, VersionCacheEntry>();
  private readonly VERSION_CACHE_TTL = 300000; // 5 minutes

  // NEW: Cache metrics for observability
  private cacheMetrics = {
    availabilityHits: 0,
    availabilityMisses: 0,
    versionHits: 0,
    versionMisses: 0
  };

  // Phase 3: Enhanced cache metrics tracking
  private availabilityCacheMetrics = {
    lastHit: 0,
    lastMiss: 0,
    totalAge: 0,
    hitCount: 0
  };

  // Phase 3: Health tracking for uptime calculation
  private consecutiveSuccesses = 0;
  private lastCheckDuration = 0;
  private healthHistory: Array<{ timestamp: number; available: boolean }> = [];

  constructor(config: ProviderConfig) {
    this.config = config;
    this.health = {
      available: true,
      latencyMs: 0,
      errorRate: 0,
      consecutiveFailures: 0
    };
    this.usageStats = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageLatencyMs: 0,
      errorCount: 0
    };
    this.rateLimitState = {
      requests: [],
      tokens: [], // DEPRECATED: Kept for backward compatibility
      tokenBuckets: [], // NEW: Aggregated token tracking
      concurrentRequests: 0
    };
    // Initialize response cache with 5 minute TTL
    this.responseCache = new ProviderResponseCache({
      maxEntries: 100,
      ttl: 300000, // 5 minutes
      maxSize: 10 * 1024 * 1024, // 10MB
      debug: false
    });
  }

  // Abstract methods to be implemented by concrete providers
  abstract get version(): string;
  abstract get capabilities(): ProviderCapabilities;

  // Name and priority from config
  get name(): string {
    return this.config.name;
  }

  get priority(): number {
    return this.config.priority;
  }

  protected abstract executeRequest(request: ExecutionRequest): Promise<ExecutionResponse>;
  protected abstract generateEmbeddingInternal(text: string, options?: EmbeddingOptions): Promise<number[]>;

  /**
   * Build CLI arguments for execution
   * @param request Execution request containing parameters
   * @returns Array of CLI arguments
   */
  protected abstract buildCLIArgs(request: ExecutionRequest): string[];

  /**
   * Check if provider supports streaming
   * @returns true if provider supports streaming
   */
  abstract supportsStreaming(): boolean;

  /**
   * Execute with streaming (if supported)
   * @param request Execution request
   * @param options Streaming options
   * @returns Execution response
   */
  async executeStreaming?(
    request: ExecutionRequest,
    options: StreamingOptions
  ): Promise<ExecutionResponse>;

  /**
   * Check if provider supports a specific parameter
   * @param param Parameter name to check
   * @returns true if parameter is supported
   */
  protected abstract supportsParameter(
    param: 'maxTokens' | 'temperature' | 'topP'
  ): boolean;

  // Health & Availability
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled || !this.health.available) {
      return false;
    }

    // Check if mock mode should be enabled (explicit or auto-detected)
    if (shouldAutoEnableMockProviders()) {
      logger.debug(`Mock providers enabled for ${this.config.name}`, {
        provider: this.config.name,
        reason: 'Auto-detected AI IDE environment or explicit AUTOMATOSX_MOCK_PROVIDERS=true'
      });
      return true;
    }

    // Phase 3 (v5.6.3): Graceful Cache Degradation
    // Wrap cache read in try-catch to handle corrupted cache gracefully
    try {
      // NEW: Check availability cache first
      if (this.availabilityCache) {
        const age = Date.now() - this.availabilityCache.timestamp;
        // Phase 3: Use adaptive TTL instead of fixed TTL
        const ttl = this.calculateAdaptiveTTL();

        if (age < ttl) {
          this.cacheMetrics.availabilityHits++;
          // Phase 3: Track hit metrics
          this.availabilityCacheMetrics.lastHit = Date.now();
          this.availabilityCacheMetrics.totalAge += age;
          this.availabilityCacheMetrics.hitCount++;
          logger.debug(`Using cached availability for ${this.config.name}`, {
            provider: this.config.name,
            available: this.availabilityCache.available,
            cacheAge: age,
            cacheTTL: ttl, // Phase 3: Log adaptive TTL
            uptime: this.calculateUptime().toFixed(1) + '%',
            cacheHits: this.cacheMetrics.availabilityHits
          });
          return this.availabilityCache.available;
        }
      }
    } catch (error) {
      // Phase 3 (v5.6.3): Graceful Cache Degradation
      // If cache read fails, log and continue to fresh check
      logger.warn(`Failed to read availability cache for ${this.config.name}`, {
        provider: this.config.name,
        error: (error as Error).message,
        fallback: 'Fresh availability check'
      });
      // Clear corrupted cache
      this.availabilityCache = undefined;
    }

    // Cache miss - perform check
    const checkStartTime = Date.now();
    this.cacheMetrics.availabilityMisses++;
    // Phase 3: Track miss metrics
    this.availabilityCacheMetrics.lastMiss = Date.now();
    logger.debug(`Availability cache miss for ${this.config.name}`, {
      provider: this.config.name,
      cacheMisses: this.cacheMetrics.availabilityMisses
    });

    // Check if CLI command actually exists (with enhanced detection)
    const available = await this.checkCLIAvailabilityEnhanced();

    // Phase 3: Track check duration
    this.lastCheckDuration = Date.now() - checkStartTime;

    // Phase 3: Track last check timestamp
    this.health.lastCheckTime = checkStartTime;

    // Phase 3: Update health history for uptime calculation
    this.healthHistory.push({
      timestamp: Date.now(),
      available
    });
    // Keep only last 100 checks
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }

    // Phase 3: Update consecutive counters
    if (available) {
      this.consecutiveSuccesses++;
    } else {
      this.consecutiveSuccesses = 0;
    }

    // Phase 3 (v5.6.3): Cache Poisoning Prevention
    // Only cache successful availability checks to prevent caching failures
    if (available) {
      try {
        this.availabilityCache = {
          available,
          timestamp: Date.now()
        };
      } catch (error) {
        // Phase 3 (v5.6.3): Graceful Cache Degradation
        // Log cache write failures but don't fail the check
        logger.warn(`Failed to write availability cache for ${this.config.name}`, {
          provider: this.config.name,
          error: (error as Error).message
        });
      }
    } else {
      logger.debug(`Not caching unavailable status for ${this.config.name}`, {
        provider: this.config.name,
        reason: 'Cache poisoning prevention'
      });
    }

    return available;
  }

  /**
   * Enhanced CLI availability check with ENV variable and config path support.
   * Falls back to standard PATH detection if no overrides configured.
   * Also validates minimum version requirement if configured.
   *
   * Priority:
   * 1. ENV variable (e.g., CLAUDE_CLI, GEMINI_CLI, CODEX_CLI)
   * 2. Config customPath
   * 3. Standard PATH detection
   * 4. Version validation (if minVersion configured)
   *
   * @returns true if CLI is available and meets version requirement
   */
  private async checkCLIAvailabilityEnhanced(): Promise<boolean> {
    let detectedPath: string | null = null;

    // 1. Check ENV variable override (highest priority)
    const envVarName = `${this.config.name.toUpperCase().replace(/-/g, '_')}_CLI`;
    const envPath = process.env[envVarName];

    if (envPath) {
      logger.debug(`Checking ENV variable ${envVarName}`, { path: envPath });

      if (this.checkPathExists(envPath)) {
        logger.debug(`Provider ${this.config.name} found via ENV variable`, {
          envVar: envVarName,
          path: envPath
        });
        detectedPath = envPath;
      } else {
        logger.warn(`ENV variable ${envVarName} points to non-existent path`, {
          path: envPath
        });
        // Continue to next detection method
      }
    }

    // 2. Check config customPath (second priority)
    if (!detectedPath && this.config.customPath) {
      logger.debug(`Checking config customPath`, { path: this.config.customPath });

      if (this.checkPathExists(this.config.customPath)) {
        logger.debug(`Provider ${this.config.name} found via config customPath`, {
          path: this.config.customPath
        });
        detectedPath = this.config.customPath;
      } else {
        logger.warn(`Config customPath points to non-existent path`, {
          path: this.config.customPath
        });
        // Continue to fallback
      }
    }

    // 3. Fall back to standard PATH detection (lowest priority)
    if (!detectedPath) {
      logger.debug(`Using standard PATH detection for ${this.config.name}`);
      const available = await this.checkCLIAvailability();
      if (!available) {
        return false;
      }
      detectedPath = this.config.command; // Use command name for version check
    }

    // 4. Validate minimum version if configured
    if (this.config.minVersion && detectedPath) {
      logger.debug('Checking minimum version requirement', {
        provider: this.config.name,
        minVersion: this.config.minVersion
      });

      const actualVersion = await this.getProviderVersion(detectedPath);
      if (!actualVersion) {
        logger.warn('Could not detect provider version, allowing by default', {
          provider: this.config.name,
          path: detectedPath
        });
        return true; // Permissive: allow if version check fails
      }

      const meetsRequirement = this.compareVersions(actualVersion, this.config.minVersion);
      if (!meetsRequirement) {
        logger.warn('Provider version too old', {
          provider: this.config.name,
          actualVersion,
          minVersion: this.config.minVersion
        });
        return false;
      }

      logger.debug('Provider version meets requirement', {
        provider: this.config.name,
        actualVersion,
        minVersion: this.config.minVersion
      });
    }

    return true;
  }

  /**
   * Check if a file path exists and is accessible.
   * Validates path to prevent path traversal attacks.
   *
   * @param path File path to check
   * @returns true if path exists and is valid
   */
  private checkPathExists(path: string): boolean {
    try {
      // Security: Reject suspicious path patterns
      if (path.includes('..')) {
        logger.warn('Path traversal pattern detected (..)', { path });
        return false;
      }

      if (path.startsWith('~') || path.includes('~')) {
        logger.warn('Home directory shortcut detected (~)', { path });
        return false;
      }

      // Check if path exists
      return existsSync(path);
    } catch (error) {
      logger.debug(`Error checking path existence`, {
        path,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Parse semantic version string into comparable parts.
   * Supports formats: "1.2.3", "v1.2.3", "1.2", "1"
   *
   * @param versionStr Version string to parse
   * @returns Parsed version parts [major, minor, patch] or null if invalid
   */
  private parseVersion(versionStr: string): number[] | null {
    try {
      // Remove 'v' prefix if present
      const cleaned = versionStr.trim().replace(/^v/i, '');

      // Extract version numbers (handle formats like "1.2.3-beta" -> "1.2.3")
      const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
      if (!match) {
        return null;
      }

      const major = parseInt(match[1] || '0', 10);
      const minor = parseInt(match[2] || '0', 10);
      const patch = parseInt(match[3] || '0', 10);

      return [major, minor, patch];
    } catch (error) {
      logger.debug('Failed to parse version', { versionStr, error });
      return null;
    }
  }

  /**
   * Compare two semantic versions.
   *
   * @param version Version to check
   * @param minVersion Minimum required version
   * @returns true if version >= minVersion
   */
  private compareVersions(version: string, minVersion: string): boolean {
    const v1 = this.parseVersion(version);
    const v2 = this.parseVersion(minVersion);

    if (!v1 || !v2) {
      // If parsing fails, allow the version (permissive)
      logger.debug('Version parsing failed, allowing by default', { version, minVersion });
      return true;
    }

    // Compare major.minor.patch
    for (let i = 0; i < 3; i++) {
      if ((v1[i] ?? 0) > (v2[i] ?? 0)) return true;
      if ((v1[i] ?? 0) < (v2[i] ?? 0)) return false;
    }

    return true; // Versions are equal
  }

  /**
   * Get CLI version by executing --version command.
   * Uses async spawn with caching to avoid blocking the event loop.
   *
   * @param command CLI command to check
   * @returns Version string or null if detection fails
   */
  private async getProviderVersion(command: string): Promise<string | null> {
    // Phase 3 (v5.6.3): Graceful Cache Degradation
    // Wrap cache read in try-catch to handle corrupted cache gracefully
    try {
      // NEW: Check version cache first
      const cached = this.versionCache.get(command);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < this.VERSION_CACHE_TTL) {
          this.cacheMetrics.versionHits++;
          logger.debug(`Using cached version for ${command}`, {
            command,
            version: cached.version,
            cacheAge: age,
            cacheHits: this.cacheMetrics.versionHits
          });
          return cached.version;
        }
      }
    } catch (error) {
      // Phase 3 (v5.6.3): Graceful Cache Degradation
      // If cache read fails, log and continue to fresh version check
      logger.warn(`Failed to read version cache for ${command}`, {
        command,
        error: (error as Error).message,
        fallback: 'Fresh version detection'
      });
      // Clear corrupted cache entry
      try {
        this.versionCache.delete(command);
      } catch (deleteError) {
        // Ignore delete errors
      }
    }

    // Cache miss - perform detection
    this.cacheMetrics.versionMisses++;
    logger.debug(`Version cache miss for ${command}`, {
      command,
      cacheMisses: this.cacheMetrics.versionMisses
    });

    try {
      // NEW: Use async spawn instead of spawnSync to avoid blocking
      const { spawn } = await import('child_process');
      const { processManager } = await import('../utils/process-manager.js');

      const version = await new Promise<string | null>((resolve) => {
        const versionArg = this.config.versionArg || '--version';
        const proc = spawn(command, [versionArg], {
          timeout: 5000,
          stdio: 'pipe',
        });

        processManager.register(proc, `${command}-version-check`);

        let output = '';
        let errorOutput = '';

        proc.stdout?.on('data', (data) => {
          output += data.toString();
        });

        proc.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        proc.on('close', (code) => {
          if (code === 0 && output) {
            // Extract version from output (usually first line)
            const cleanOutput = output.trim();
            const match = cleanOutput.match(/\d+\.\d+\.\d+/);
            const detectedVersion = match ? match[0] : (cleanOutput.split('\n')[0] || null);

            logger.debug('Version detection successful', {
              command,
              version: detectedVersion,
              output: cleanOutput.substring(0, 100)
            });

            resolve(detectedVersion);
          } else {
            logger.debug('Version detection failed', {
              command,
              code,
              output,
              errorOutput
            });
            resolve(null);
          }
        });

        proc.on('error', (error) => {
          logger.debug('Version detection spawn error', {
            command,
            error: error.message
          });
          resolve(null);
        });
      });

      // Phase 3 (v5.6.3): Cache Poisoning Prevention
      // Only cache successful version detection (non-null results)
      if (version) {
        try {
          this.versionCache.set(command, {
            version,
            timestamp: Date.now()
          });
        } catch (error) {
          // Phase 3 (v5.6.3): Graceful Cache Degradation
          // Log cache write failures but don't fail the version check
          logger.warn(`Failed to write version cache for ${command}`, {
            command,
            error: (error as Error).message
          });
        }
      } else {
        logger.debug(`Not caching null version for ${command}`, {
          command,
          reason: 'Cache poisoning prevention'
        });
      }

      return version;

    } catch (error) {
      logger.debug('Failed to get provider version', {
        command,
        error: (error as Error).message
      });

      // Phase 3 (v5.6.3): Cache Poisoning Prevention
      // Don't cache exceptions - let the next check retry
      logger.debug(`Not caching version exception for ${command}`, {
        command,
        reason: 'Cache poisoning prevention'
      });

      return null;
    }
  }

  /**
   * Check if the CLI command is available in the system (standard PATH detection)
   * Uses cross-platform detection from cli-provider-detector for Windows compatibility
   */
  private async checkCLIAvailability(): Promise<boolean> {
    try {
      // v5.3.4: Use cross-platform detection logic (Windows: where.exe + PATHEXT, Unix: which)
      const result = findOnPath(this.config.command);

      if (!result.found) {
        logger.warn(`CLI command not found: ${this.config.command}`);
        return false;
      }

      logger.debug(`Provider ${this.config.name} found on PATH`, {
        command: this.config.command,
        path: result.path
      });

      return true;
    } catch (error) {
      logger.error(`Error checking CLI availability: ${(error as Error).message}`);
      return false;
    }
  }

  async getHealth(): Promise<HealthStatus> {
    return { ...this.health };
  }

  // Execution with retry logic
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (!await this.isAvailable()) {
      throw new Error(`Provider ${this.name} is not available`);
    }

    // Check rate limits
    await this.waitForCapacity();

    // Check cache before executing
    const messages = this.requestToMessages(request);
    const cacheOptions = {
      temperature: request.temperature,
      maxTokens: request.maxTokens
    };
    const cached = this.responseCache.get(
      this.name,
      request.model || 'default',
      messages,
      cacheOptions
    );

    if (cached) {
      logger.debug('Provider cache hit', {
        provider: this.name,
        model: request.model
      });

      // Return cached response (reconstruct ExecutionResponse)
      return {
        content: cached.response,
        model: request.model || 'default',
        tokensUsed: cached.usage || {
          prompt: this.estimateTokens(request.prompt),
          completion: this.estimateTokens(cached.response),
          total: this.estimateTokens(request.prompt) + this.estimateTokens(cached.response)
        },
        latencyMs: 0, // Cached response has no latency
        finishReason: 'stop'
      };
    }

    const retryPolicy = this.config.retryPolicy ?? this.getDefaultRetryPolicy();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        // Track concurrent requests
        this.rateLimitState.concurrentRequests++;
        const startTime = Date.now();

        const response = await this.executeWithTimeout(request);

        // Update metrics
        const latency = Date.now() - startTime;
        this.updateMetrics(response, latency);
        this.health.consecutiveFailures = 0;

        // Cache successful response
        this.responseCache.set(
          this.name,
          request.model || 'default',
          messages,
          response.content,
          cacheOptions,
          response.tokensUsed
        );

        return response;

      } catch (error) {
        lastError = error as Error;
        this.health.consecutiveFailures++;
        this.usageStats.errorCount++;

        logger.error(`Provider ${this.name} execution failed (attempt ${attempt})`, {
          error: lastError.message,
          attempt,
          maxAttempts: retryPolicy.maxAttempts
        });

        // Check if we should retry
        if (attempt < retryPolicy.maxAttempts && this.shouldRetry(lastError)) {
          const delay = this.getRetryDelay(attempt);
          logger.info(`Retrying after ${delay}ms...`);
          await this.sleep(delay);
        } else {
          break;
        }
      } finally {
        this.rateLimitState.concurrentRequests--;
      }
    }

    // All retries failed
    this.updateHealthAfterFailure();
    throw lastError || new Error('Execution failed');
  }

  // Embeddings
  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    if (!this.capabilities.supportsEmbedding) {
      throw new Error(`Provider ${this.name} does not support embeddings`);
    }

    return this.generateEmbeddingInternal(text, options);
  }

  // Rate Limiting - Token Bucket Algorithm
  async checkRateLimit(): Promise<RateLimitStatus> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    this.rateLimitState.requests = this.rateLimitState.requests.filter(t => t > oneMinuteAgo);

    // NEW: Use aggregated token buckets instead of individual token timestamps
    this.rateLimitState.tokenBuckets = this.rateLimitState.tokenBuckets.filter(
      bucket => bucket.timestamp > oneMinuteAgo
    );

    const limits = this.config.rateLimits;
    if (!limits) {
      return {
        hasCapacity: true,
        requestsRemaining: Infinity,
        tokensRemaining: Infinity,
        resetAtMs: now + 60000
      };
    }

    const requestsRemaining = limits.maxRequestsPerMinute - this.rateLimitState.requests.length;

    // NEW: Calculate tokens from aggregated buckets
    const tokensUsed = this.rateLimitState.tokenBuckets.reduce(
      (sum, bucket) => sum + bucket.count,
      0
    );
    const tokensRemaining = limits.maxTokensPerMinute - tokensUsed;

    const concurrentOk = this.rateLimitState.concurrentRequests < limits.maxConcurrentRequests;

    logger.debug('Rate limit check', {
      provider: this.config.name,
      requestsRemaining,
      tokensUsed,
      tokensRemaining,
      concurrentRequests: this.rateLimitState.concurrentRequests,
      bucketsCount: this.rateLimitState.tokenBuckets.length
    });

    return {
      hasCapacity: requestsRemaining > 0 && tokensRemaining > 0 && concurrentOk,
      requestsRemaining,
      tokensRemaining,
      resetAtMs: now + 60000
    };
  }

  async waitForCapacity(): Promise<void> {
    const maxWaitMs = 60000; // 1 minute max wait
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkRateLimit();

      if (status.hasCapacity) {
        // Reserve capacity
        this.rateLimitState.requests.push(Date.now());
        return;
      }

      // Wait until reset time
      const waitMs = Math.min(status.resetAtMs - Date.now(), 1000);
      await this.sleep(waitMs);
    }

    throw new Error(`Rate limit exceeded for provider ${this.name}`);
  }

  // Cost Management (to be overridden by providers with specific pricing)
  async estimateCost(request: ExecutionRequest): Promise<Cost> {
    // Default implementation - providers should override with actual pricing
    const estimatedTokens = this.estimateTokens(request.prompt);
    return {
      estimatedUsd: 0,
      tokensUsed: estimatedTokens
    };
  }

  async getUsageStats(): Promise<UsageStats> {
    return { ...this.usageStats };
  }

  /**
   * Get cache metrics for observability.
   * Phase 1: Basic metrics (hits, misses, hit rates)
   * Phase 3: Enhanced metrics (age, timestamps, uptime, health)
   *
   * @returns Comprehensive cache and health metrics
   */
  getCacheMetrics(): {
    availability: {
      hits: number;
      misses: number;
      hitRate: number;
      avgAge: number;
      maxAge: number;
      lastHit?: number;
      lastMiss?: number;
    };
    version: {
      hits: number;
      misses: number;
      hitRate: number;
      size: number;
      avgAge: number;
      maxAge: number;
    };
    health: {
      consecutiveFailures: number;
      consecutiveSuccesses: number;
      lastCheckTime?: number;
      lastCheckDuration: number;
      uptime: number;
    };
  } {
    const availabilityTotal = this.cacheMetrics.availabilityHits + this.cacheMetrics.availabilityMisses;
    const versionTotal = this.cacheMetrics.versionHits + this.cacheMetrics.versionMisses;

    return {
      availability: {
        hits: this.cacheMetrics.availabilityHits,
        misses: this.cacheMetrics.availabilityMisses,
        hitRate: availabilityTotal > 0
          ? this.cacheMetrics.availabilityHits / availabilityTotal
          : 0,
        avgAge: this.availabilityCacheMetrics.hitCount > 0
          ? this.availabilityCacheMetrics.totalAge / this.availabilityCacheMetrics.hitCount
          : 0,
        maxAge: this.AVAILABILITY_CACHE_TTL,
        lastHit: this.availabilityCacheMetrics.lastHit || undefined,
        lastMiss: this.availabilityCacheMetrics.lastMiss || undefined
      },
      version: {
        hits: this.cacheMetrics.versionHits,
        misses: this.cacheMetrics.versionMisses,
        hitRate: versionTotal > 0
          ? this.cacheMetrics.versionHits / versionTotal
          : 0,
        size: this.versionCache.size,
        avgAge: this.calculateAverageVersionCacheAge(),
        maxAge: this.VERSION_CACHE_TTL
      },
      health: {
        consecutiveFailures: this.health.consecutiveFailures,
        consecutiveSuccesses: this.consecutiveSuccesses,
        lastCheckTime: this.health.lastCheckTime,
        lastCheckDuration: this.lastCheckDuration,
        uptime: this.calculateUptime()
      }
    };
  }

  /**
   * Calculate average age of version cache entries.
   * Phase 3: New helper method for enhanced metrics.
   */
  private calculateAverageVersionCacheAge(): number {
    if (this.versionCache.size === 0) {
      return 0;
    }

    const now = Date.now();
    let totalAge = 0;

    for (const entry of this.versionCache.values()) {
      totalAge += now - entry.timestamp;
    }

    return totalAge / this.versionCache.size;
  }

  /**
   * Calculate provider uptime percentage based on health history.
   * Phase 3: New helper method for enhanced metrics.
   *
   * @returns Uptime percentage (0-100)
   */
  private calculateUptime(): number {
    if (this.healthHistory.length === 0) {
      // No history yet, assume 100% if currently available
      return this.health.available ? 100 : 0;
    }

    const availableCount = this.healthHistory.filter(h => h.available).length;
    return (availableCount / this.healthHistory.length) * 100;
  }

  /**
   * Calculate adaptive cache TTL based on provider stability.
   * Phase 3 (v5.6.3): Dynamic TTL adjustment.
   *
   * Strategy:
   * - Highly stable providers (uptime > 99%) → Longer TTL (120s) to reduce checks
   * - Unstable providers (uptime < 90%) → Shorter TTL (30s) to detect failures faster
   * - Normal providers → Baseline TTL (60s)
   *
   * @returns TTL in milliseconds
   */
  private calculateAdaptiveTTL(): number {
    if (!this.ADAPTIVE_CACHE_ENABLED) {
      return this.AVAILABILITY_CACHE_TTL;
    }

    // Need at least 10 checks for meaningful statistics
    if (this.healthHistory.length < 10) {
      return this.AVAILABILITY_CACHE_TTL;
    }

    const uptime = this.calculateUptime();
    const baselineTTL = this.AVAILABILITY_CACHE_TTL;

    // Very stable provider → Increase TTL by 2x
    if (uptime > 99) {
      return baselineTTL * 2; // 120 seconds
    }

    // Unstable provider → Decrease TTL by 2x
    if (uptime < 90) {
      return baselineTTL / 2; // 30 seconds
    }

    // Normal provider → Use baseline TTL
    return baselineTTL;
  }

  /**
   * Clear all caches (for testing or manual refresh).
   * NEW: Added in Phase 1 optimization.
   */
  clearCaches(): void {
    this.availabilityCache = undefined;
    this.versionCache.clear();
    logger.info(`Caches cleared for provider ${this.config.name}`);
  }

  // Error Handling
  shouldRetry(error: Error): boolean {
    // Use centralized retry logic for consistency
    return shouldRetryError(error, 'base');
  }

  getRetryDelay(attempt: number): number {
    const policy = this.config.retryPolicy ?? this.getDefaultRetryPolicy();
    const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    return Math.min(delay, policy.maxDelayMs);
  }

  // Protected helper methods
  protected async executeWithTimeout(request: ExecutionRequest): Promise<ExecutionResponse> {
    const timeout = this.config.timeout;

    return Promise.race([
      this.executeRequest(request),
      this.createTimeoutPromise(timeout)
    ]);
  }

  protected createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
    });
  }

  protected updateMetrics(response: ExecutionResponse, latency: number): void {
    this.usageStats.totalRequests++;
    this.usageStats.totalTokens += response.tokensUsed.total;

    // Update average latency (running average)
    const totalLatency = this.usageStats.averageLatencyMs * (this.usageStats.totalRequests - 1);
    this.usageStats.averageLatencyMs = (totalLatency + latency) / this.usageStats.totalRequests;

    // Update health
    this.health.latencyMs = latency;
    this.health.errorRate = this.usageStats.errorCount / this.usageStats.totalRequests;

    // NEW: Track tokens using aggregated buckets (much more efficient)
    const now = Date.now();
    this.rateLimitState.tokenBuckets.push({
      timestamp: now,
      count: response.tokensUsed.total
    });

    // Clean up old buckets (> 1 minute)
    const oneMinuteAgo = now - 60000;
    this.rateLimitState.tokenBuckets = this.rateLimitState.tokenBuckets.filter(
      bucket => bucket.timestamp > oneMinuteAgo
    );

    // DEPRECATED: Keep old array for backward compatibility, but limit size
    // This prevents memory issues with large responses while maintaining compatibility
    const tokensToAdd = Math.min(response.tokensUsed.total, 1000); // Cap at 1000 entries
    for (let i = 0; i < tokensToAdd; i++) {
      this.rateLimitState.tokens.push(now);
    }
  }

  protected updateHealthAfterFailure(): void {
    // Circuit breaker: disable provider after too many consecutive failures
    if (this.health.consecutiveFailures >= 5) {
      this.health.available = false;
      logger.error(`Provider ${this.name} circuit breaker triggered (5 consecutive failures)`);

      // Auto-recover after 60 seconds
      setTimeout(() => {
        this.health.available = true;
        this.health.consecutiveFailures = 0;
        logger.info(`Provider ${this.name} circuit breaker reset`);
      }, 60000);
    }
  }

  protected estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert ExecutionRequest to messages array for cache key generation
   */
  protected requestToMessages(request: ExecutionRequest): any[] {
    const messages: any[] = [];

    // Add system message if present
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      });
    }

    // Add user message
    messages.push({
      role: 'user',
      content: request.prompt
    });

    // Include context if present
    if (request.context && Object.keys(request.context).length > 0) {
      messages.push({
        role: 'context',
        content: request.context
      });
    }

    return messages;
  }

  protected getDefaultRetryPolicy(): RetryConfig {
    return {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2
    };
  }
}
