/**
 * Timeout Configuration Validator
 *
 * Validates timeout configuration and provides backward compatibility
 * for legacy `execution.defaultTimeout` configuration.
 *
 * @module timeout-validator
 * @since 5.4.0
 */

import { TimeoutConfig } from '../../types/timeout.js';
import { ExecutionConfig } from '../../types/config.js';
import { ConfigError, ErrorCode } from '../errors/errors.js';

/**
 * Minimum warning threshold (50% of timeout)
 */
const MIN_WARNING_THRESHOLD = 0.5;

/**
 * Maximum warning threshold (95% of timeout)
 */
const MAX_WARNING_THRESHOLD = 0.95;

/**
 * Validate timeout configuration
 *
 * Ensures all timeout values and thresholds are valid.
 *
 * @param config - Timeout configuration to validate
 * @throws ConfigError if validation fails
 *
 * @example
 * ```typescript
 * validateTimeoutConfig({
 *   global: 1500000,
 *   warningThreshold: 0.8
 * }); // OK
 *
 * validateTimeoutConfig({
 *   global: -1000  // Throws: Timeout values must be positive
 * });
 * ```
 */
export function validateTimeoutConfig(config: TimeoutConfig): void {
  // Validate warning threshold
  if (config.warningThreshold !== undefined) {
    if (
      config.warningThreshold < MIN_WARNING_THRESHOLD ||
      config.warningThreshold > MAX_WARNING_THRESHOLD
    ) {
      throw new ConfigError(
        `Timeout warning threshold must be between ${MIN_WARNING_THRESHOLD} and ${MAX_WARNING_THRESHOLD}`,
        ErrorCode.CONFIG_VALIDATION_ERROR,
        [],
        { warningThreshold: config.warningThreshold }
      );
    }
  }

  // Validate global timeout
  if (config.global !== undefined) {
    if (!isPositiveInteger(config.global)) {
      throw new ConfigError(
        'Global timeout must be a positive integer',
        ErrorCode.CONFIG_VALIDATION_ERROR,
        [],
        { global: config.global }
      );
    }
  }

  // Validate team timeouts
  if (config.teams) {
    for (const [team, timeout] of Object.entries(config.teams)) {
      if (!isPositiveInteger(timeout)) {
        throw new ConfigError(
          `Team timeout for '${team}' must be a positive integer`,
          ErrorCode.CONFIG_VALIDATION_ERROR,
          [],
          { team, timeout }
        );
      }
    }
  }

  // Validate agent timeouts
  if (config.agents) {
    for (const [agent, timeout] of Object.entries(config.agents)) {
      if (!isPositiveInteger(timeout)) {
        throw new ConfigError(
          `Agent timeout for '${agent}' must be a positive integer`,
          ErrorCode.CONFIG_VALIDATION_ERROR,
          [],
          { agent, timeout }
        );
      }
    }
  }
}

/**
 * Check if value is a positive integer
 *
 * @param value - Value to check
 * @returns True if value is a positive integer
 * @private
 */
function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Build timeout config with backward compatibility
 *
 * Creates a TimeoutConfig from ExecutionConfig, applying backward
 * compatibility logic for legacy `defaultTimeout` field.
 *
 * Priority:
 * 1. If `execution.timeouts` is defined, use it
 * 2. If `execution.defaultTimeout` is defined, use it as `global` timeout
 * 3. Otherwise, return empty config (TimeoutManager will use default)
 *
 * @param executionConfig - Execution configuration
 * @returns Timeout configuration
 *
 * @example
 * ```typescript
 * // New config format
 * const config1 = buildTimeoutConfig({
 *   defaultTimeout: 1500000,
 *   timeouts: {
 *     global: 1800000,
 *     teams: { engineering: 2000000 }
 *   }
 * });
 * // Result: { global: 1800000, teams: { engineering: 2000000 } }
 *
 * // Legacy config format
 * const config2 = buildTimeoutConfig({
 *   defaultTimeout: 1500000
 * });
 * // Result: { global: 1500000 }
 *
 * // No timeout config
 * const config3 = buildTimeoutConfig({});
 * // Result: {}
 * ```
 */
export function buildTimeoutConfig(
  executionConfig: Partial<ExecutionConfig>
): TimeoutConfig {
  // Priority 1: Use new timeouts config if defined
  if (executionConfig.timeouts) {
    return executionConfig.timeouts;
  }

  // Priority 2: Backward compatibility - use defaultTimeout as global
  if (executionConfig.defaultTimeout !== undefined) {
    return {
      global: executionConfig.defaultTimeout,
    };
  }

  // Priority 3: Return empty config (TimeoutManager will use hardcoded default)
  return {};
}

/**
 * Validate and build timeout config
 *
 * Convenience function that combines validation and building.
 *
 * @param executionConfig - Execution configuration
 * @returns Validated timeout configuration
 * @throws ConfigError if validation fails
 *
 * @example
 * ```typescript
 * const timeoutConfig = validateAndBuildTimeoutConfig({
 *   defaultTimeout: 1500000,
 *   timeouts: {
 *     global: 1800000,
 *     warningThreshold: 0.8
 *   }
 * });
 * ```
 */
export function validateAndBuildTimeoutConfig(
  executionConfig: Partial<ExecutionConfig>
): TimeoutConfig {
  const config = buildTimeoutConfig(executionConfig);

  // Only validate if config is not empty
  if (Object.keys(config).length > 0) {
    validateTimeoutConfig(config);
  }

  return config;
}

/**
 * Get timeout configuration summary
 *
 * Returns a human-readable summary of the timeout configuration.
 *
 * @param config - Timeout configuration
 * @returns Configuration summary
 *
 * @example
 * ```typescript
 * const summary = getTimeoutConfigSummary({
 *   global: 1500000,
 *   teams: { engineering: 1800000 },
 *   agents: { backend: 1200000 },
 *   warningThreshold: 0.8
 * });
 *
 * console.log(summary);
 * // {
 * //   global: '25m 0s',
 * //   teamsCount: 1,
 * //   agentsCount: 1,
 * //   warningThreshold: '80%'
 * // }
 * ```
 */
export interface TimeoutConfigSummary {
  global?: string;
  teamsCount: number;
  agentsCount: number;
  warningThreshold: string;
}

export function getTimeoutConfigSummary(
  config: TimeoutConfig
): TimeoutConfigSummary {
  return {
    global: config.global ? formatMilliseconds(config.global) : undefined,
    teamsCount: config.teams ? Object.keys(config.teams).length : 0,
    agentsCount: config.agents ? Object.keys(config.agents).length : 0,
    warningThreshold: `${((config.warningThreshold ?? 0.8) * 100).toFixed(0)}%`,
  };
}

/**
 * Format milliseconds to human-readable time
 *
 * @param ms - Milliseconds
 * @returns Formatted time string (e.g., "5m 30s", "1h 15m")
 * @private
 */
function formatMilliseconds(ms: number): string {
  const seconds = Math.floor(ms / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}
