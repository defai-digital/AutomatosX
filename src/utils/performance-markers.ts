/**
 * Performance marker utility for consistent performance classification
 *
 * v5.6.24: Three-tier threshold system (INSTANT/FAST/SLOW)
 *
 * **Purpose**: Provide consistent performance classification across all components
 *
 * **Thresholds**:
 * - INSTANT: Operations that feel instantaneous (< 10ms for most types)
 * - FAST: Operations that are quick and acceptable (10-100ms for most types)
 * - SLOW: Operations that are noticeably slow and may need optimization (≥ 100ms)
 *
 * **Usage**:
 * ```typescript
 * import { formatPerformanceInfo } from '../utils/performance-markers.js';
 *
 * const startTime = Date.now();
 * // ... operation ...
 * const duration = Date.now() - startTime;
 *
 * const perfInfo = formatPerformanceInfo(duration, 'database');
 * logger.info('Operation complete', {
 *   duration: perfInfo.duration,
 *   performance: perfInfo.performance
 * });
 * ```
 */

export enum PerformanceMarker {
  INSTANT = 'INSTANT',
  FAST = 'FAST',
  SLOW = 'SLOW'
}

export type OperationType =
  | 'database'    // SQLite operations
  | 'fileIO'      // File read/write
  | 'config'      // Configuration loading
  | 'profile'     // Profile/agent loading
  | 'memory'      // Memory search operations
  | 'network'     // Network requests
  | 'provider';   // LLM provider execution

interface ThresholdConfig {
  instant: number;  // Threshold for INSTANT (ms)
  fast: number;     // Threshold for FAST (ms)
}

/**
 * Performance thresholds for different operation types
 *
 * Designed based on human perception and typical operation characteristics:
 * - Database: Should be extremely fast (< 1ms ideal)
 * - File I/O: Should be very fast (< 5ms ideal)
 * - Config/Profile: Should be fast (< 10ms ideal)
 * - Memory: Depends on search complexity (< 5ms ideal)
 * - Network: Inherently slower (< 100ms good)
 * - Provider: LLM inference is slow (< 1s is excellent)
 */
export const PERFORMANCE_THRESHOLDS: Record<OperationType, ThresholdConfig> = {
  database: { instant: 1, fast: 10 },
  fileIO: { instant: 5, fast: 20 },
  config: { instant: 10, fast: 50 },
  profile: { instant: 5, fast: 20 },
  memory: { instant: 5, fast: 50 },
  network: { instant: 100, fast: 1000 },
  provider: { instant: 1000, fast: 5000 }
};

/**
 * Get performance marker based on duration and operation type
 *
 * @param duration - Duration in milliseconds
 * @param operationType - Type of operation
 * @returns Performance marker (INSTANT/FAST/SLOW)
 */
export function getPerformanceMarker(
  duration: number,
  operationType: OperationType = 'fileIO'
): PerformanceMarker {
  const thresholds = PERFORMANCE_THRESHOLDS[operationType];

  if (duration < thresholds.instant) {
    return PerformanceMarker.INSTANT;
  } else if (duration < thresholds.fast) {
    return PerformanceMarker.FAST;
  } else {
    return PerformanceMarker.SLOW;
  }
}

/**
 * Format performance info for logging
 *
 * **Convenience function** that returns both duration and performance marker
 * in a format suitable for logging.
 *
 * @param duration - Duration in milliseconds
 * @param operationType - Type of operation
 * @returns Object with duration and performance marker
 */
export function formatPerformanceInfo(
  duration: number,
  operationType: OperationType = 'fileIO'
): { duration: number; performance: PerformanceMarker } {
  return {
    duration,
    performance: getPerformanceMarker(duration, operationType)
  };
}

// ============================================================================
// Lifecycle Tracking & Advanced Performance Markers (v5.6.24+)
// ============================================================================

import { logger } from './logger.js';

/**
 * Lifecycle states for components
 */
export enum LifecycleState {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZING = 'INITIALIZING',
  INITIALIZED = 'INITIALIZED',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  RESOLVING = 'RESOLVING',
  RESOLVED = 'RESOLVED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  READY = 'READY',
  PROCESSING = 'PROCESSING'
}

/**
 * Component types for performance tracking
 */
export enum ComponentType {
  MEMORY_MANAGER = 'MemoryManager',
  LAZY_MEMORY_MANAGER = 'LazyMemoryManager',
  PROFILE_LOADER = 'ProfileLoader',
  ROUTER = 'Router',
  CONTEXT_MANAGER = 'ContextManager',
  ABILITIES_MANAGER = 'AbilitiesManager',
  TEAM_MANAGER = 'TeamManager',
  AGENT_EXECUTOR = 'AgentExecutor',
  PROVIDER = 'Provider'
}

/**
 * Mark the start of an operation
 * Returns timestamp for calculating duration
 */
export function markStart(
  component: ComponentType,
  operation: string,
  context?: Record<string, any>
): number {
  logger.debug(`⏱️  ${component}: ${operation} started`, {
    component,
    operation,
    state: LifecycleState.INITIALIZING,
    timestamp: Date.now(),
    ...context
  });
  return Date.now();
}

/**
 * Mark the end of an operation
 * Calculates and logs duration with performance marker
 */
export function markEnd(
  component: ComponentType,
  operation: string,
  startTime: number,
  operationType: OperationType = 'fileIO',
  context?: Record<string, any>
): number {
  const duration = Date.now() - startTime;
  const performance = getPerformanceMarker(duration, operationType);

  logger.debug(`✅ ${component}: ${operation} completed`, {
    component,
    operation,
    state: LifecycleState.COMPLETED,
    duration,
    performance,
    ...context
  });

  return duration;
}

/**
 * Mark a lifecycle state change
 * Uses info level for visibility
 */
export function markState(
  component: ComponentType,
  state: LifecycleState,
  context?: Record<string, any>
): void {
  const emoji = getStateEmoji(state);
  const message = context?.message || state;

  logger.info(`${emoji} ${component}: ${message}`, {
    component,
    state,
    ...context
  });
}

/**
 * Mark an error
 */
export function markError(
  component: ComponentType,
  operation: string,
  error: Error | string,
  context?: Record<string, any>
): void {
  const errorMessage = typeof error === 'string' ? error : error.message;

  logger.error(`❌ ${component}: ${operation} failed`, {
    component,
    operation,
    state: LifecycleState.FAILED,
    error: errorMessage,
    ...context
  });
}

/**
 * Mark a warning
 */
export function markWarning(
  component: ComponentType,
  operation: string,
  message: string,
  context?: Record<string, any>
): void {
  logger.warn(`⚠️  ${component}: ${operation} - ${message}`, {
    component,
    operation,
    warning: message,
    ...context
  });
}

/**
 * Mark a cache hit
 */
export function markCacheHit(
  component: ComponentType,
  operation: string,
  context?: Record<string, any>
): void {
  logger.debug(`💾 ${component}: ${operation} (cache hit)`, {
    component,
    operation,
    cached: true,
    latency: 0,
    ...context
  });
}

/**
 * Mark a cache miss
 */
export function markCacheMiss(
  component: ComponentType,
  operation: string,
  context?: Record<string, any>
): void {
  logger.debug(`🔍 ${component}: ${operation} (cache miss)`, {
    component,
    operation,
    cached: false,
    ...context
  });
}

/**
 * Get emoji for lifecycle state
 */
function getStateEmoji(state: LifecycleState): string {
  switch (state) {
    case LifecycleState.NOT_INITIALIZED:
      return '⚫';
    case LifecycleState.INITIALIZING:
      return '⚡';
    case LifecycleState.INITIALIZED:
      return '✨';
    case LifecycleState.LOADING:
      return '📋';
    case LifecycleState.LOADED:
      return '✅';
    case LifecycleState.RESOLVING:
      return '🔍';
    case LifecycleState.RESOLVED:
      return '✅';
    case LifecycleState.EXECUTING:
      return '🔀';
    case LifecycleState.COMPLETED:
      return '✅';
    case LifecycleState.FAILED:
      return '❌';
    case LifecycleState.CLOSING:
      return '🔄';
    case LifecycleState.CLOSED:
      return '⚫';
    case LifecycleState.READY:
      return '✨';
    case LifecycleState.PROCESSING:
      return '⚙️';
    default:
      return '📌';
  }
}

/**
 * Performance timer utility
 * Usage:
 * ```typescript
 * const timer = new PerformanceTimer(ComponentType.PROFILE_LOADER, 'loadProfile', 'profile', { name: 'backend' });
 * // ... do work ...
 * timer.end({ result: 'success' });
 * ```
 */
export class PerformanceTimer {
  private startTime: number;
  private component: ComponentType;
  private operation: string;
  private operationType: OperationType;
  private context?: Record<string, any>;

  constructor(
    component: ComponentType,
    operation: string,
    operationType: OperationType = 'fileIO',
    context?: Record<string, any>
  ) {
    this.component = component;
    this.operation = operation;
    this.operationType = operationType;
    this.context = context;
    this.startTime = markStart(component, operation, context);
  }

  /**
   * End the timer and log completion
   * Returns duration in milliseconds
   */
  end(additionalContext?: Record<string, any>): number {
    const mergedContext = { ...this.context, ...additionalContext };
    return markEnd(
      this.component,
      this.operation,
      this.startTime,
      this.operationType,
      mergedContext
    );
  }

  /**
   * Get current duration without ending the timer
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Mark a checkpoint during long-running operation
   */
  checkpoint(label: string, context?: Record<string, any>): void {
    const duration = this.getDuration();
    logger.debug(`🔹 ${this.component}: ${this.operation} - ${label}`, {
      component: this.component,
      operation: this.operation,
      checkpoint: label,
      elapsed: duration,
      ...this.context,
      ...context
    });
  }
}

/**
 * Create a scoped performance timer
 * Automatically ends timer when scope exits (via try-finally or Promise chain)
 *
 * Usage:
 * ```typescript
 * const result = await withTimer(
 *   ComponentType.MEMORY_MANAGER,
 *   'search',
 *   'memory',
 *   { query: 'test' },
 *   async () => {
 *     // ... async work ...
 *     return result;
 *   }
 * );
 * ```
 */
export async function withTimer<T>(
  component: ComponentType,
  operation: string,
  operationType: OperationType,
  context: Record<string, any>,
  fn: () => Promise<T>
): Promise<T> {
  const timer = new PerformanceTimer(component, operation, operationType, context);

  try {
    const result = await fn();
    timer.end({ success: true });
    return result;
  } catch (error) {
    markError(component, operation, error as Error, context);
    timer.end({ success: false });
    throw error;
  }
}

/**
 * Synchronous version of withTimer
 */
export function withTimerSync<T>(
  component: ComponentType,
  operation: string,
  operationType: OperationType,
  context: Record<string, any>,
  fn: () => T
): T {
  const timer = new PerformanceTimer(component, operation, operationType, context);

  try {
    const result = fn();
    timer.end({ success: true });
    return result;
  } catch (error) {
    markError(component, operation, error as Error, context);
    timer.end({ success: false });
    throw error;
  }
}
