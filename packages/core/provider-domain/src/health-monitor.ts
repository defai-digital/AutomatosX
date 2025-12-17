/**
 * Health Monitor Implementation
 *
 * Tracks provider health through latency, error rates, and availability.
 * Enables intelligent routing based on provider health status.
 *
 * Invariants:
 * - INV-HM-001: Latency samples bounded by configured size
 * - INV-HM-002: Error rate calculated over sliding window
 * - INV-HM-003: Availability derived from circuit and error state
 */

import {
  type HealthCheckConfig,
  type HealthStatus,
  type HealthCheckResult,
  type HealthEvent,
  type HealthEventType,
  type HealthLevel,
  type CircuitState,
  type RateLimitStateEnum,
  createDefaultHealthCheckConfig,
  calculatePercentile,
  HealthErrorCodes,
} from '@automatosx/contracts';

/**
 * Health monitor instance for a single provider
 */
export interface HealthMonitor {
  /** Get current health status */
  getStatus(): HealthStatus;

  /** Record a successful request */
  recordSuccess(latencyMs: number): void;

  /** Record a failed request */
  recordFailure(error: string, errorCode?: string): void;

  /** Update circuit breaker state */
  updateCircuitState(state: CircuitState): void;

  /** Update rate limit state */
  updateRateLimitState(state: RateLimitStateEnum): void;

  /** Perform active health check */
  performHealthCheck(): Promise<HealthCheckResult>;

  /** Get event history */
  getEvents(): HealthEvent[];

  /** Reset the health monitor */
  reset(): void;
}

/**
 * Health event listener
 */
export type HealthEventListener = (event: HealthEvent) => void;

/**
 * Health check function type
 */
export type HealthCheckFn = () => Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}>;

/**
 * Creates a health monitor for a provider
 */
export function createHealthMonitor(
  providerId: string,
  config: Partial<HealthCheckConfig> = {},
  healthCheckFn?: HealthCheckFn
): HealthMonitor {
  const cfg = { ...createDefaultHealthCheckConfig(), ...config };

  // Latency tracking (INV-HM-001)
  const latencySamples: number[] = [];

  // Request tracking (INV-HM-002)
  let totalRequests = 0;
  let totalErrors = 0;
  let consecutiveFailures = 0;
  let consecutiveSuccesses = 0;

  // Timestamps
  let lastCheckTime = new Date();
  let lastSuccessTime: Date | undefined;
  let lastErrorTime: Date | undefined;
  let lastError: string | undefined;
  let lastErrorCode: string | undefined;

  // External state
  let circuitState: CircuitState = 'closed';
  let rateLimitState: RateLimitStateEnum = 'normal';

  // Current health level
  let currentLevel: HealthLevel = 'unknown';

  const events: HealthEvent[] = [];
  const listeners: HealthEventListener[] = [];

  function emitEvent(
    type: HealthEventType,
    details?: Record<string, unknown>
  ): void {
    const previousLevel = currentLevel;
    updateHealthLevel();

    const event: HealthEvent = {
      eventId: crypto.randomUUID(),
      type,
      providerId,
      timestamp: new Date().toISOString(),
      previousLevel,
      currentLevel,
      details,
    };
    events.push(event);
    listeners.forEach((listener) => listener(event));
  }

  // INV-HM-001: Maintain bounded latency samples
  function addLatencySample(latencyMs: number): void {
    latencySamples.push(latencyMs);
    if (latencySamples.length > cfg.latencySampleSize) {
      latencySamples.shift();
    }
  }

  function calculateAverageLatency(): number {
    if (latencySamples.length === 0) return 0;
    const sum = latencySamples.reduce((a, b) => a + b, 0);
    return sum / latencySamples.length;
  }

  // INV-HM-002: Calculate error rate over window
  function calculateErrorRate(): number {
    if (totalRequests === 0) return 0;
    return totalErrors / totalRequests;
  }

  // INV-HM-003: Derive availability from state
  function updateHealthLevel(): void {
    const errorRate = calculateErrorRate();
    const previousLevel = currentLevel;

    // Circuit open = unhealthy
    if (circuitState === 'open') {
      currentLevel = 'unhealthy';
    }
    // High error rate = unhealthy
    else if (errorRate >= cfg.unhealthyErrorRate) {
      currentLevel = 'unhealthy';
    }
    // Degraded conditions
    else if (
      circuitState === 'halfOpen' ||
      rateLimitState === 'throttled' ||
      rateLimitState === 'blocked' ||
      consecutiveFailures >= cfg.degradedThreshold
    ) {
      currentLevel = 'degraded';
    }
    // No data yet
    else if (totalRequests === 0) {
      currentLevel = 'unknown';
    }
    // All good
    else {
      currentLevel = 'healthy';
    }

    // Emit level change events
    if (previousLevel !== currentLevel) {
      if (currentLevel === 'unhealthy') {
        emitEvent('health.unhealthy');
      } else if (currentLevel === 'degraded') {
        emitEvent('health.degraded');
      } else if (
        currentLevel === 'healthy' &&
        (previousLevel === 'degraded' || previousLevel === 'unhealthy')
      ) {
        emitEvent('health.recovered');
      }
    }
  }

  function isAvailable(): boolean {
    return currentLevel === 'healthy' || currentLevel === 'degraded';
  }

  return {
    getStatus(): HealthStatus {
      updateHealthLevel();
      const sortedLatencies = [...latencySamples].sort((a, b) => a - b);

      return {
        providerId,
        available: isAvailable(),
        level: currentLevel,
        latencyMs: calculateAverageLatency(),
        latencyP50Ms:
          sortedLatencies.length > 0
            ? calculatePercentile(sortedLatencies, 50)
            : undefined,
        latencyP95Ms:
          sortedLatencies.length > 0
            ? calculatePercentile(sortedLatencies, 95)
            : undefined,
        latencyP99Ms:
          sortedLatencies.length > 0
            ? calculatePercentile(sortedLatencies, 99)
            : undefined,
        errorRate: calculateErrorRate(),
        consecutiveFailures,
        consecutiveSuccesses,
        lastCheckTime: lastCheckTime.toISOString(),
        lastSuccessTime: lastSuccessTime?.toISOString(),
        lastErrorTime: lastErrorTime?.toISOString(),
        lastError,
        lastErrorCode,
        circuitState,
        rateLimitState,
        totalRequests,
        totalErrors,
        uptimePercent:
          totalRequests > 0
            ? ((totalRequests - totalErrors) / totalRequests) * 100
            : undefined,
      };
    },

    recordSuccess(latencyMs: number): void {
      totalRequests++;
      consecutiveSuccesses++;
      consecutiveFailures = 0;
      lastSuccessTime = new Date();
      lastCheckTime = new Date();

      addLatencySample(latencyMs);
      emitEvent('health.check.passed', { latencyMs });
    },

    recordFailure(error: string, errorCode?: string): void {
      totalRequests++;
      totalErrors++;
      consecutiveFailures++;
      consecutiveSuccesses = 0;
      lastErrorTime = new Date();
      lastCheckTime = new Date();
      lastError = error;
      lastErrorCode = errorCode;

      emitEvent('health.check.failed', { error, errorCode });
    },

    updateCircuitState(state: CircuitState): void {
      const previous = circuitState;
      circuitState = state;
      if (previous !== state) {
        updateHealthLevel();
        emitEvent('health.status.changed', {
          circuitState: state,
          previousCircuitState: previous,
        });
      }
    },

    updateRateLimitState(state: RateLimitStateEnum): void {
      const previous = rateLimitState;
      rateLimitState = state;
      if (previous !== state) {
        updateHealthLevel();
        emitEvent('health.status.changed', {
          rateLimitState: state,
          previousRateLimitState: previous,
        });
      }
    },

    async performHealthCheck(): Promise<HealthCheckResult> {
      const checkId = crypto.randomUUID();
      const startTime = Date.now();

      emitEvent('health.check.started', { checkId });

      if (!healthCheckFn) {
        // No health check function provided, return unknown
        return {
          checkId,
          providerId,
          success: false,
          latencyMs: 0,
          timestamp: new Date().toISOString(),
          error: 'No health check function configured',
          errorCode: HealthErrorCodes.CHECK_FAILED,
          checkType: 'active',
        };
      }

      try {
        const result = await Promise.race([
          healthCheckFn(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Health check timeout')),
              cfg.timeoutMs
            )
          ),
        ]);

        const latencyMs = Date.now() - startTime;

        if (result.success) {
          this.recordSuccess(latencyMs);
        } else {
          this.recordFailure(
            result.error ?? 'Health check failed',
            HealthErrorCodes.CHECK_FAILED
          );
        }

        return {
          checkId,
          providerId,
          success: result.success,
          latencyMs,
          timestamp: new Date().toISOString(),
          error: result.error,
          checkType: 'active',
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        this.recordFailure(errorMessage, HealthErrorCodes.CHECK_TIMEOUT);

        return {
          checkId,
          providerId,
          success: false,
          latencyMs,
          timestamp: new Date().toISOString(),
          error: errorMessage,
          errorCode: HealthErrorCodes.CHECK_TIMEOUT,
          checkType: 'active',
        };
      }
    },

    getEvents(): HealthEvent[] {
      return [...events];
    },

    reset(): void {
      latencySamples.length = 0;
      totalRequests = 0;
      totalErrors = 0;
      consecutiveFailures = 0;
      consecutiveSuccesses = 0;
      lastCheckTime = new Date();
      lastSuccessTime = undefined;
      lastErrorTime = undefined;
      lastError = undefined;
      lastErrorCode = undefined;
      circuitState = 'closed';
      rateLimitState = 'normal';
      currentLevel = 'unknown';
      events.length = 0;
    },
  };
}

/**
 * Health monitor error
 */
export class HealthMonitorError extends Error {
  constructor(
    public readonly code: string,
    public readonly providerId: string,
    message: string
  ) {
    super(message);
    this.name = 'HealthMonitorError';
  }

  static checkTimeout(providerId: string): HealthMonitorError {
    return new HealthMonitorError(
      HealthErrorCodes.CHECK_TIMEOUT,
      providerId,
      `Health check timed out for provider ${providerId}`
    );
  }

  static providerUnavailable(providerId: string): HealthMonitorError {
    return new HealthMonitorError(
      HealthErrorCodes.PROVIDER_UNAVAILABLE,
      providerId,
      `Provider ${providerId} is unavailable`
    );
  }
}
