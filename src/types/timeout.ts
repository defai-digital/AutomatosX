/**
 * Timeout Configuration Types
 *
 * This module defines types for the layered timeout configuration system.
 *
 * @module timeout
 * @since 5.4.0
 */

/**
 * Timeout configuration layers
 *
 * Supports hierarchical timeout configuration with the following priority:
 * 1. Runtime (CLI flag)
 * 2. Agent-level (agent YAML)
 * 3. Team-level (team config)
 * 4. Global (config file)
 * 5. Default (hardcoded)
 *
 * @example
 * ```json
 * {
 *   "global": 1500000,
 *   "teams": {
 *     "engineering": 1800000,
 *     "research": 3600000
 *   },
 *   "agents": {
 *     "backend": 1200000,
 *     "researcher": 3600000
 *   },
 *   "warningThreshold": 0.8
 * }
 * ```
 */
export interface TimeoutConfig {
  /**
   * Global default timeout in milliseconds
   *
   * Applied when no team or agent-specific timeout is configured.
   *
   * @default 1500000 (25 minutes)
   * @example 1500000 // 25 minutes
   */
  global?: number;

  /**
   * Team-level timeout overrides
   *
   * Map of team names to timeout values in milliseconds.
   *
   * @example { "engineering": 1800000, "research": 3600000 }
   */
  teams?: Record<string, number>;

  /**
   * Agent-level timeout overrides
   *
   * Map of agent names to timeout values in milliseconds.
   *
   * @example { "backend": 1200000, "researcher": 3600000 }
   */
  agents?: Record<string, number>;

  /**
   * Warning threshold as a percentage of total timeout
   *
   * When execution time exceeds this threshold, a warning is emitted.
   *
   * @default 0.8 (80% of timeout)
   * @min 0.5
   * @max 0.95
   * @example 0.8 // Warn at 80% of timeout
   */
  warningThreshold?: number;
}

/**
 * Runtime timeout override options
 *
 * Options for overriding timeout configuration at runtime.
 *
 * @example
 * ```typescript
 * {
 *   timeout: 1800000,  // 30 minutes
 *   disableWarnings: false
 * }
 * ```
 */
export interface RuntimeTimeoutOptions {
  /**
   * Explicit timeout value in milliseconds
   *
   * When provided, this value takes precedence over all other timeout configurations.
   *
   * @example 1800000 // 30 minutes
   */
  timeout?: number;

  /**
   * Disable timeout warnings
   *
   * When true, warnings will not be emitted even if the threshold is reached.
   *
   * @default false
   */
  disableWarnings?: boolean;
}

/**
 * Resolved timeout configuration
 *
 * The final, computed timeout configuration after applying all layers.
 *
 * @example
 * ```typescript
 * {
 *   value: 1800000,
 *   source: 'team',
 *   warningAt: 1440000,
 *   warningsEnabled: true
 * }
 * ```
 */
export interface ResolvedTimeout {
  /**
   * Final timeout value in milliseconds
   *
   * The actual timeout that will be applied to the execution.
   */
  value: number;

  /**
   * Configuration source
   *
   * Indicates where the timeout value came from in the priority chain.
   */
  source: 'global' | 'team' | 'agent' | 'runtime' | 'default';

  /**
   * Warning trigger time in milliseconds
   *
   * Absolute time when the warning should be emitted.
   *
   * @example 1440000 // 80% of 1800000ms timeout
   */
  warningAt: number;

  /**
   * Warnings enabled flag
   *
   * Whether timeout warnings are enabled for this execution.
   */
  warningsEnabled: boolean;
}

/**
 * Timeout warning event data
 *
 * Event data emitted when a timeout warning is triggered.
 *
 * @example
 * ```typescript
 * {
 *   agentName: 'backend',
 *   taskDescription: 'Implement timeout system',
 *   elapsedMs: 1440000,
 *   remainingMs: 360000,
 *   timeoutMs: 1800000
 * }
 * ```
 */
export interface TimeoutWarningEvent {
  /**
   * Name of the agent being executed
   */
  agentName: string;

  /**
   * Description of the task being executed
   */
  taskDescription: string;

  /**
   * Elapsed execution time in milliseconds
   *
   * Time since execution started.
   */
  elapsedMs: number;

  /**
   * Remaining time in milliseconds
   *
   * Time until timeout is reached.
   */
  remainingMs: number;

  /**
   * Total timeout in milliseconds
   *
   * The configured timeout value.
   */
  timeoutMs: number;
}

/**
 * Timeout resolution context
 *
 * Context information needed to resolve the final timeout value.
 *
 * @example
 * ```typescript
 * {
 *   agentName: 'backend',
 *   teamName: 'engineering',
 *   runtimeTimeout: 1800000
 * }
 * ```
 */
export interface TimeoutResolutionContext {
  /**
   * Name of the agent being executed
   */
  agentName: string;

  /**
   * Name of the agent's team
   */
  teamName: string;

  /**
   * Runtime timeout override in milliseconds
   *
   * Optional timeout value provided at runtime (e.g., via CLI flag).
   */
  runtimeTimeout?: number;
}
