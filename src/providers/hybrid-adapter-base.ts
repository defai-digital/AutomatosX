/**
 * HybridAdapterBase - Abstract base class for SDK-first provider adapters
 *
 * Provides a unified interface for providers that support both SDK and CLI execution
 * with automatic fallback logic, circuit breaker integration, and metrics collection.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 *
 * @module providers/hybrid-adapter-base
 */

import type { ExecutionRequest, ExecutionResponse } from '../types/provider.js';
import { logger } from '../shared/logging/logger.js';
import { isSDKFirstModeEnabled, isSDKFallbackEnabled } from '../core/feature-flags/flags.js';
import { decideFallback, FallbackDecision, type ErrorClassification } from './fallback-decision.js';
import { getProviderMetrics } from '../core/metrics/provider-metrics.js';
import { sleep } from '../shared/utils/safe-timers.js';

/**
 * Execution mode for hybrid adapter
 */
export type AdapterMode = 'sdk' | 'cli' | 'auto';

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'half-open' | 'open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting to reset */
  resetTimeout: number;
  /** Number of successful calls needed to close circuit from half-open */
  halfOpenSuccessThreshold: number;
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeout: 60000,  // 1 minute
  halfOpenSuccessThreshold: 2
};

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Check if circuit is open (requests should not be attempted)
   */
  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = 'half-open';
        this.successes = 0;
        logger.debug('Circuit breaker transitioning to half-open');
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    // Check for timeout transition
    if (this.state === 'open' &&
        Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
      this.state = 'half-open';
      this.successes = 0;
    }
    return this.state;
  }

  /**
   * Record successful execution
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.halfOpenSuccessThreshold) {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
        logger.debug('Circuit breaker closed after recovery');
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Record failed execution
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Immediately open on failure during half-open
      this.state = 'open';
      logger.warn('Circuit breaker opened after half-open failure');
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened after consecutive failures', {
        failures: this.failures,
        threshold: this.config.failureThreshold
      });
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Hybrid adapter options
 */
export interface HybridAdapterBaseOptions {
  /** Execution mode: 'sdk', 'cli', or 'auto' (default) */
  mode?: AdapterMode;
  /** Provider name for logging and metrics */
  providerName: string;
  /** Circuit breaker configuration for SDK */
  sdkCircuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Circuit breaker configuration for CLI */
  cliCircuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Maximum number of SDK retries before fallback */
  maxRetries?: number;
}

/**
 * Abstract base class for hybrid SDK/CLI adapters
 *
 * Subclasses must implement:
 * - executeViaSDK(): Execute request using SDK
 * - executeViaCLI(): Execute request using CLI
 * - isSDKAvailable(): Check if SDK is available
 * - isCLIAvailable(): Check if CLI is available
 *
 * Features:
 * - SDK-first execution with CLI fallback
 * - Independent circuit breakers for SDK and CLI
 * - Automatic retry for transient errors
 * - Metrics collection for observability
 * - Feature flag integration
 */

/**
 * Compute bounded backoff with jitter to avoid synchronized retries.
 */
function computeBackoffDelay(baseMs: number, attempt: number, maxMs = 15000): number {
  const backoff = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = 0.5 + Math.random(); // 0.5x–1.5x
  return Math.floor(backoff * jitter);
}

export abstract class HybridAdapterBase {
  protected readonly mode: AdapterMode;
  protected activeMode: 'sdk' | 'cli' | null = null;
  protected readonly providerName: string;
  protected readonly sdkCircuitBreaker: CircuitBreaker;
  protected readonly cliCircuitBreaker: CircuitBreaker;
  protected readonly maxRetries: number;

  // Track initialization state
  private sdkInitialized = false;
  private cliInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(options: HybridAdapterBaseOptions) {
    this.mode = options.mode || 'auto';
    this.providerName = options.providerName;
    this.maxRetries = options.maxRetries ?? 1;
    this.sdkCircuitBreaker = new CircuitBreaker(options.sdkCircuitBreaker);
    this.cliCircuitBreaker = new CircuitBreaker(options.cliCircuitBreaker);

    logger.debug('HybridAdapterBase initialized', {
      provider: this.providerName,
      mode: this.mode,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Execute a request using the appropriate mode
   *
   * Mode selection logic:
   * 1. If mode is 'cli' or SDK-first is disabled → use CLI directly
   * 2. If mode is 'sdk' → use SDK only (throw if unavailable)
   * 3. If mode is 'auto' → try SDK first, fallback to CLI
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Ensure adapters are initialized
    await this.ensureInitialized();

    // Check feature flags and mode
    const useSDKFirst = this.shouldUseSDKFirst();

    if (!useSDKFirst || this.mode === 'cli') {
      return this.executeWithCLI(request);
    }

    if (this.mode === 'sdk') {
      return this.executeWithSDK(request);
    }

    // Auto mode: SDK-first with fallback
    return this.executeWithFallback(request);
  }

  /**
   * Execute with SDK-first and CLI fallback
   */
  private async executeWithFallback(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Check if SDK circuit breaker is open
    if (this.sdkCircuitBreaker.isOpen()) {
      logger.debug('SDK circuit breaker is open, using CLI', {
        provider: this.providerName
      });
      return this.executeWithCLI(request);
    }

    const startTime = Date.now();
    let lastError: Error | unknown;

    // Try SDK with retries
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.executeViaSDK(request);

        // Record success
        this.sdkCircuitBreaker.recordSuccess();
        this.recordSDKMetrics(Date.now() - startTime, true);

        return result;
      } catch (error) {
        lastError = error;
        const classification = decideFallback(error, this.providerName);

        logger.debug('SDK execution failed', {
          provider: this.providerName,
          attempt: attempt + 1,
          decision: classification.decision,
          reason: classification.reason
        });

        if (classification.decision === FallbackDecision.RETRY_SDK && attempt < this.maxRetries) {
          // Wait before retry
          const delay = computeBackoffDelay(classification.retryDelayMs || 1000, attempt);
          await sleep(delay);
          continue;
        }

        if (classification.decision === FallbackDecision.USE_CLI ||
            (classification.decision === FallbackDecision.RETRY_SDK && attempt >= this.maxRetries)) {
          // Record SDK failure and fallback
          this.sdkCircuitBreaker.recordFailure();
          this.recordSDKMetrics(Date.now() - startTime, false);
          this.recordFallbackMetrics(classification.reason || 'max retries exceeded');

          // Fallback to CLI if enabled
          if (isSDKFallbackEnabled()) {
            logger.info('Falling back to CLI execution', {
              provider: this.providerName,
              reason: classification.reason || 'max retries exceeded'
            });
            return this.executeWithCLI(request);
          }
        }

        // Propagate error (non-recoverable or fallback disabled)
        this.sdkCircuitBreaker.recordFailure();
        this.recordSDKMetrics(Date.now() - startTime, false);
        throw error;
      }
    }

    // Max retries exceeded
    this.sdkCircuitBreaker.recordFailure();
    this.recordSDKMetrics(Date.now() - startTime, false);

    if (isSDKFallbackEnabled()) {
      this.recordFallbackMetrics('max retries exceeded');
      return this.executeWithCLI(request);
    }

    throw lastError || new Error(`SDK execution failed after ${this.maxRetries + 1} attempts`);
  }

  /**
   * Execute using SDK only
   */
  private async executeWithSDK(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (this.sdkCircuitBreaker.isOpen()) {
      throw new Error(`SDK circuit breaker is open for ${this.providerName}`);
    }

    const startTime = Date.now();

    try {
      const result = await this.executeViaSDK(request);
      this.sdkCircuitBreaker.recordSuccess();
      this.recordSDKMetrics(Date.now() - startTime, true);
      return result;
    } catch (error) {
      this.sdkCircuitBreaker.recordFailure();
      this.recordSDKMetrics(Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Execute using CLI only
   */
  private async executeWithCLI(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (this.cliCircuitBreaker.isOpen()) {
      throw new Error(`CLI circuit breaker is open for ${this.providerName}`);
    }

    const startTime = Date.now();

    try {
      const result = await this.executeViaCLI(request);
      this.cliCircuitBreaker.recordSuccess();
      this.recordCLIMetrics(Date.now() - startTime, true);
      return result;
    } catch (error) {
      this.cliCircuitBreaker.recordFailure();
      this.recordCLIMetrics(Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Check if SDK-first mode should be used
   */
  private shouldUseSDKFirst(): boolean {
    // Feature flag check
    if (!isSDKFirstModeEnabled()) {
      return false;
    }

    // Mode check
    if (this.mode === 'cli') {
      return false;
    }

    return true;
  }

  /**
   * Ensure adapters are initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initialize();
    return this.initPromise;
  }

  /**
   * Initialize adapters based on mode
   */
  private async initialize(): Promise<void> {
    const useSDKFirst = this.shouldUseSDKFirst();

    if (this.mode === 'cli' || !useSDKFirst) {
      // CLI-only mode
      if (!this.cliInitialized) {
        const available = await this.isCLIAvailable();
        if (!available) {
          throw new Error(`CLI not available for ${this.providerName}`);
        }
        await this.initializeCLI();
        this.cliInitialized = true;
        this.activeMode = 'cli';
      }
      return;
    }

    if (this.mode === 'sdk') {
      // SDK-only mode
      if (!this.sdkInitialized) {
        const available = await this.isSDKAvailable();
        if (!available) {
          throw new Error(`SDK not available for ${this.providerName}`);
        }
        await this.initializeSDK();
        this.sdkInitialized = true;
        this.activeMode = 'sdk';
      }
      return;
    }

    // Auto mode: try SDK first, initialize CLI as backup
    if (!this.sdkInitialized) {
      const sdkAvailable = await this.isSDKAvailable();
      if (sdkAvailable) {
        try {
          await this.initializeSDK();
          this.sdkInitialized = true;
          this.activeMode = 'sdk';
        } catch (error) {
          logger.warn('SDK initialization failed, will use CLI', {
            provider: this.providerName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    // Always initialize CLI as fallback in auto mode
    if (!this.cliInitialized) {
      const cliAvailable = await this.isCLIAvailable();
      if (cliAvailable) {
        await this.initializeCLI();
        this.cliInitialized = true;
        if (!this.sdkInitialized) {
          this.activeMode = 'cli';
        }
      } else if (!this.sdkInitialized) {
        throw new Error(`Neither SDK nor CLI available for ${this.providerName}`);
      }
    }
  }

  /**
   * Record SDK execution metrics
   */
  private recordSDKMetrics(latencyMs: number, success: boolean): void {
    try {
      const collector = getProviderMetrics();
      collector.recordSDKExecution(this.providerName, latencyMs, success);
    } catch {
      // Metrics collection is optional, don't fail on errors
    }
  }

  /**
   * Record CLI execution metrics
   */
  private recordCLIMetrics(latencyMs: number, success: boolean): void {
    try {
      const collector = getProviderMetrics();
      collector.recordCLIExecution(this.providerName, latencyMs, success);
    } catch {
      // Metrics collection is optional, don't fail on errors
    }
  }

  /**
   * Record fallback event metrics
   */
  private recordFallbackMetrics(reason: string): void {
    try {
      const collector = getProviderMetrics();
      collector.recordSDKFallback(this.providerName, reason);
    } catch {
      // Metrics collection is optional, don't fail on errors
    }
  }

  /**
   * Get current active mode
   */
  getActiveMode(): 'sdk' | 'cli' | null {
    return this.activeMode;
  }

  /**
   * Get SDK circuit breaker state
   */
  getSDKCircuitBreakerState(): CircuitBreakerState {
    return this.sdkCircuitBreaker.getState();
  }

  /**
   * Get CLI circuit breaker state
   */
  getCLICircuitBreakerState(): CircuitBreakerState {
    return this.cliCircuitBreaker.getState();
  }

  /**
   * Reset both circuit breakers
   */
  resetCircuitBreakers(): void {
    this.sdkCircuitBreaker.reset();
    this.cliCircuitBreaker.reset();
    logger.debug('Circuit breakers reset', { provider: this.providerName });
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.destroySDK();
    await this.destroyCLI();
    this.sdkInitialized = false;
    this.cliInitialized = false;
    this.activeMode = null;
    this.initPromise = null;
  }

  // Abstract methods to be implemented by subclasses

  /**
   * Execute request via SDK
   */
  protected abstract executeViaSDK(request: ExecutionRequest): Promise<ExecutionResponse>;

  /**
   * Execute request via CLI
   */
  protected abstract executeViaCLI(request: ExecutionRequest): Promise<ExecutionResponse>;

  /**
   * Check if SDK is available
   */
  protected abstract isSDKAvailable(): Promise<boolean>;

  /**
   * Check if CLI is available
   */
  protected abstract isCLIAvailable(): Promise<boolean>;

  /**
   * Initialize SDK adapter
   */
  protected abstract initializeSDK(): Promise<void>;

  /**
   * Initialize CLI adapter
   */
  protected abstract initializeCLI(): Promise<void>;

  /**
   * Clean up SDK resources
   */
  protected abstract destroySDK(): Promise<void>;

  /**
   * Clean up CLI resources
   */
  protected abstract destroyCLI(): Promise<void>;
}

// Re-export types for convenience
export type { ExecutionRequest, ExecutionResponse };
export { FallbackDecision };
