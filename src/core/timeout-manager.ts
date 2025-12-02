/**
 * Timeout Manager
 *
 * Core timeout management system with layered configuration support.
 * Resolves final timeout values based on priority chain and manages timeout monitoring.
 *
 * @module timeout-manager
 * @since 5.4.0
 */

import {
  TimeoutConfig,
  ResolvedTimeout,
  TimeoutResolutionContext,
  TimeoutWarningEvent,
} from '../types/timeout.js';
import { WarningEmitter } from './warning-emitter.js';
import { logger } from '../utils/logger.js';

/**
 * Default timeout value in milliseconds (25 minutes)
 */
const DEFAULT_TIMEOUT = 1500000;

/**
 * Default warning threshold (80% of timeout)
 */
const DEFAULT_WARNING_THRESHOLD = 0.8;

/**
 * Minimum warning threshold (50% of timeout)
 */
const MIN_WARNING_THRESHOLD = 0.5;

/**
 * Maximum warning threshold (95% of timeout)
 */
const MAX_WARNING_THRESHOLD = 0.95;

/**
 * Timeout monitor handle
 *
 * Represents an active timeout monitoring session.
 */
export interface TimeoutMonitor {
  /**
   * Resolved timeout configuration
   */
  resolved: ResolvedTimeout;

  /**
   * Warning timer ID (if warnings are enabled)
   */
  warningTimer?: NodeJS.Timeout;

  /**
   * Start time in milliseconds
   */
  startTime: number;

  /**
   * Stop monitoring
   *
   * Cancels the warning timer if active.
   */
  stop: () => void;
}

/**
 * Timeout manager
 *
 * Manages timeout configuration resolution and monitoring.
 *
 * @example
 * ```typescript
 * const config = {
 *   global: 1500000,
 *   teams: { engineering: 1800000 },
 *   agents: { backend: 1200000 },
 *   warningThreshold: 0.8
 * };
 *
 * const manager = new TimeoutManager(config);
 *
 * const resolved = manager.resolve({
 *   agentName: 'backend',
 *   teamName: 'engineering',
 *   runtimeTimeout: undefined
 * });
 *
 * console.log(resolved);
 * // {
 * //   value: 1200000,
 * //   source: 'agent',
 * //   warningAt: 960000,
 * //   warningsEnabled: true
 * // }
 * ```
 */
export class TimeoutManager {
  private config: TimeoutConfig;
  private warningEmitter: WarningEmitter;

  /**
   * Create a timeout manager
   *
   * @param config - Timeout configuration
   */
  constructor(config: TimeoutConfig) {
    this.config = this.validateConfig(config);
    this.warningEmitter = new WarningEmitter();
  }

  /**
   * Validate timeout configuration
   *
   * Ensures configuration values are valid and within acceptable ranges.
   *
   * @param config - Timeout configuration to validate
   * @returns Validated configuration
   * @throws Error if configuration is invalid
   * @private
   */
  private validateConfig(config: TimeoutConfig): TimeoutConfig {
    // Validate warning threshold
    if (config.warningThreshold !== undefined) {
      if (
        config.warningThreshold < MIN_WARNING_THRESHOLD ||
        config.warningThreshold > MAX_WARNING_THRESHOLD
      ) {
        throw new Error(
          `Warning threshold must be between ${MIN_WARNING_THRESHOLD} and ${MAX_WARNING_THRESHOLD}`
        );
      }
    }

    // Validate timeout values (must be positive)
    if (config.global !== undefined && config.global <= 0) {
      throw new Error('Global timeout must be positive');
    }

    if (config.teams) {
      for (const [team, timeout] of Object.entries(config.teams)) {
        if (timeout <= 0) {
          throw new Error(`Team timeout for '${team}' must be positive`);
        }
      }
    }

    if (config.agents) {
      for (const [agent, timeout] of Object.entries(config.agents)) {
        if (timeout <= 0) {
          throw new Error(`Agent timeout for '${agent}' must be positive`);
        }
      }
    }

    return config;
  }

  /**
   * Resolve final timeout value
   *
   * Resolves the final timeout value based on the priority chain:
   * 1. Runtime override (CLI flag)
   * 2. Agent-level config (agent YAML)
   * 3. Team-level config (team config)
   * 4. Global config (config file)
   * 5. Default value (hardcoded)
   *
   * @param context - Timeout resolution context
   * @returns Resolved timeout configuration
   *
   * @example
   * ```typescript
   * const resolved = manager.resolve({
   *   agentName: 'backend',
   *   teamName: 'engineering',
   *   runtimeTimeout: 1800000
   * });
   * ```
   */
  resolve(context: TimeoutResolutionContext): ResolvedTimeout {
    // Priority 1: Runtime override
    if (context.runtimeTimeout !== undefined) {
      logger.debug('Timeout resolved from runtime override', {
        value: context.runtimeTimeout,
        source: 'runtime',
      });
      return this.buildResolved(context.runtimeTimeout, 'runtime');
    }

    // Priority 2: Agent-level config
    const agentTimeout = this.config.agents?.[context.agentName];
    if (agentTimeout !== undefined) {
      logger.debug('Timeout resolved from agent config', {
        agent: context.agentName,
        value: agentTimeout,
        source: 'agent',
      });
      return this.buildResolved(agentTimeout, 'agent');
    }

    // Priority 3: Team-level config
    const teamTimeout = this.config.teams?.[context.teamName];
    if (teamTimeout !== undefined) {
      logger.debug('Timeout resolved from team config', {
        team: context.teamName,
        value: teamTimeout,
        source: 'team',
      });
      return this.buildResolved(teamTimeout, 'team');
    }

    // Priority 4: Global config
    if (this.config.global !== undefined) {
      logger.debug('Timeout resolved from global config', {
        value: this.config.global,
        source: 'global',
      });
      return this.buildResolved(this.config.global, 'global');
    }

    // Priority 5: Hard default
    logger.debug('Timeout resolved from default', {
      value: DEFAULT_TIMEOUT,
      source: 'default',
    });
    return this.buildResolved(DEFAULT_TIMEOUT, 'default');
  }

  /**
   * Build resolved timeout configuration
   *
   * Constructs a resolved timeout configuration object with warning threshold.
   *
   * @param value - Timeout value in milliseconds
   * @param source - Configuration source
   * @returns Resolved timeout configuration
   * @private
   */
  private buildResolved(
    value: number,
    source: ResolvedTimeout['source']
  ): ResolvedTimeout {
    const threshold = this.config.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
    return {
      value,
      source,
      warningAt: Math.floor(value * threshold),
      warningsEnabled: true,
    };
  }

  /**
   * Start timeout monitoring
   *
   * Starts monitoring an execution with the resolved timeout configuration.
   * Emits a warning event when the threshold is reached.
   *
   * @param resolved - Resolved timeout configuration
   * @param context - Execution context
   * @returns Timeout monitor handle
   *
   * @example
   * ```typescript
   * const monitor = manager.startMonitoring(resolved, {
   *   agentName: 'backend',
   *   taskDescription: 'Implement feature X'
   * });
   *
   * // Later, stop monitoring
   * monitor.stop();
   * ```
   */
  startMonitoring(
    resolved: ResolvedTimeout,
    context: { agentName: string; taskDescription: string }
  ): TimeoutMonitor {
    const startTime = Date.now();
    let warningTimer: NodeJS.Timeout | undefined;

    // Schedule warning if enabled
    if (resolved.warningsEnabled) {
      warningTimer = setTimeout(() => {
        const event: TimeoutWarningEvent = {
          agentName: context.agentName,
          taskDescription: context.taskDescription,
          elapsedMs: resolved.warningAt,
          remainingMs: resolved.value - resolved.warningAt,
          timeoutMs: resolved.value,
        };

        this.warningEmitter.emitWarning(event);
      }, resolved.warningAt);
    }

    // Return monitor handle
    return {
      resolved,
      warningTimer,
      startTime,
      stop: () => {
        if (warningTimer) {
          clearTimeout(warningTimer);
        }
      },
    };
  }

  /**
   * Get warning emitter
   *
   * Returns the warning emitter instance for custom event handling.
   *
   * @returns Warning emitter instance
   */
  getWarningEmitter(): WarningEmitter {
    return this.warningEmitter;
  }

  /**
   * Get configuration
   *
   * Returns the current timeout configuration.
   *
   * @returns Timeout configuration
   */
  getConfig(): TimeoutConfig {
    return { ...this.config };
  }

  /**
   * Destroy timeout manager
   *
   * CRITICAL FIX (v5.6.18): Clean up warning emitter to prevent memory leak.
   * Must be called when TimeoutManager instance is no longer needed.
   *
   * @since 5.6.18
   */
  destroy(): void {
    this.warningEmitter.destroy();
  }
}
