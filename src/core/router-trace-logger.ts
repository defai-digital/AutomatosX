/**
 * Router Trace Logger - Phase 2.3
 *
 * Provides structured logging of routing decisions for debugging and analysis.
 * Logs trace events to JSONL format for easy parsing and analysis.
 *
 * @module core/router-trace-logger
 */

import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'fs';
import { join, dirname } from 'path';
import { logger } from '@/utils/logger.js';

/**
 * Trace event phases
 */
export type TracePhase = 'selection' | 'execution' | 'degradation' | 'error' | 'policy';

/**
 * Trace event structure
 */
export interface TraceEvent {
  timestamp: string;
  phase: TracePhase;
  provider?: string;
  data: Record<string, any>;
}

/**
 * Trace logger options
 */
export interface TraceLoggerOptions {
  workspacePath: string;
  enabled?: boolean;
  autoFlush?: boolean;
}

/**
 * RouterTraceLogger - Logs routing decisions and events to JSONL file
 *
 * Usage:
 * ```typescript
 * const tracer = new RouterTraceLogger({ workspacePath: '/path/to/workspace' });
 * tracer.logSelection(['openai', 'gemini'], 'openai', 'lowest cost');
 * tracer.logExecution('openai', true, 1234, 0.005);
 * tracer.close();
 * ```
 */
export class RouterTraceLogger {
  private traceFile: string;
  private stream?: WriteStream;
  private enabled: boolean;
  private autoFlush: boolean;
  private streamInitializing: boolean = false;

  constructor(options: TraceLoggerOptions) {
    this.traceFile = join(options.workspacePath, '.automatosx/logs/router.trace.jsonl');
    this.enabled = options.enabled ?? true;
    this.autoFlush = options.autoFlush ?? true;

    // Ensure log directory exists
    if (this.enabled) {
      const logDir = dirname(this.traceFile);
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
    }

    // FIXED (v6.5.11): Add cleanup on process exit
    process.on('exit', () => this.close());
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  /**
   * Log a trace event
   */
  log(event: TraceEvent): void {
    if (!this.enabled) return;

    try {
      // Lazy stream initialization with race condition guard
      if (!this.stream && !this.streamInitializing) {
        this.streamInitializing = true;
        this.stream = createWriteStream(this.traceFile, { flags: 'a' });

        // FIXED (v6.5.11): Add error handler to stream to prevent uncaught errors
        this.stream.on('error', (err) => {
          logger.error('Trace stream error', { error: err });
          this.stream = undefined;
        });

        this.streamInitializing = false;
      }

      // Skip write if stream is still initializing
      if (!this.stream) {
        logger.warn('Trace stream not ready, skipping event', { phase: event.phase });
        return;
      }

      // Write event as JSONL (one JSON object per line)
      this.stream.write(JSON.stringify(event) + '\n');

      // Auto-flush if enabled
      if (this.autoFlush) {
        this.stream.write('', 'utf-8', () => {
          // Flush complete
        });
      }
    } catch (error) {
      // Log error but don't throw (tracing should not break routing)
      logger.error('Failed to write trace event', { error, event });
    }
  }

  /**
   * Log provider selection decision
   *
   * @param candidates - List of candidate providers
   * @param selected - Selected provider
   * @param reason - Reason for selection (e.g., "lowest cost", "policy match")
   * @param scores - Optional provider scores
   * @param specContext - Optional spec context (specId, taskId) for spec-driven workflows
   */
  logSelection(
    candidates: string[],
    selected: string,
    reason: string,
    scores?: Record<string, number>,
    specContext?: { specId?: string; taskId?: string }
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      phase: 'selection',
      provider: selected,
      data: {
        candidates,
        reason,
        scores: scores || {},
        candidateCount: candidates.length,
        specContext: specContext || null
      }
    });

    logger.info('Provider selected', {
      selected,
      reason,
      candidates: candidates.length,
      scores,
      specContext
    });
  }

  /**
   * Log policy-based selection
   *
   * @param policy - Policy used for selection
   * @param filtered - Filtered providers after constraint check
   * @param selected - Selected provider
   */
  logPolicySelection(
    policy: any,
    filtered: { passed: string[]; filtered: Array<{ provider: string; reason: string }> },
    selected: string | null
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      phase: 'policy',
      provider: selected || undefined,
      data: {
        goal: policy.goal,
        constraintsApplied: Object.keys(policy.constraints || {}),
        providersBeforeFilter: filtered.passed.length + filtered.filtered.length,
        providersAfterFilter: filtered.passed.length,
        filtered: filtered.filtered,
        selected
      }
    });

    logger.info('Policy-based selection', {
      goal: policy.goal,
      passed: filtered.passed.length,
      filtered: filtered.filtered.length,
      selected
    });
  }

  /**
   * Log provider execution result
   *
   * @param provider - Provider name
   * @param success - Whether execution succeeded
   * @param durationMs - Execution duration in milliseconds
   * @param cost - Estimated cost
   * @param tokensUsed - Optional token usage
   */
  logExecution(
    provider: string,
    success: boolean,
    durationMs: number,
    cost: number,
    tokensUsed?: { prompt: number; completion: number; total: number }
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      phase: 'execution',
      provider,
      data: {
        success,
        durationMs,
        cost,
        tokensUsed: tokensUsed || null,
        latencyBucket: this.getLatencyBucket(durationMs)
      }
    });

    logger.info('Provider execution complete', {
      provider,
      success,
      durationMs,
      cost: `$${cost.toFixed(6)}`
    });
  }

  /**
   * Log provider degradation (switch or fallback)
   *
   * @param reason - Reason for degradation (e.g., "rate limit", "error", "timeout")
   * @param action - Action taken (e.g., "switched", "retry", "failed")
   * @param fromProvider - Original provider
   * @param toProvider - New provider (if switched)
   */
  logDegradation(
    reason: string,
    action: string,
    fromProvider: string,
    toProvider?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      phase: 'degradation',
      provider: fromProvider,
      data: {
        reason,
        action,
        fromProvider,
        toProvider: toProvider || null
      }
    });

    logger.warn('Provider degradation', {
      reason,
      action,
      from: fromProvider,
      to: toProvider
    });
  }

  /**
   * Log routing error
   *
   * @param error - Error object or message
   * @param provider - Provider that encountered error (if known)
   * @param context - Additional context
   */
  logError(
    error: Error | string,
    provider?: string,
    context?: Record<string, any>
  ): void {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    this.log({
      timestamp: new Date().toISOString(),
      phase: 'error',
      provider,
      data: {
        error: errorMessage,
        stack: errorStack,
        context: context || {}
      }
    });

    logger.error('Router error', {
      error: errorMessage,
      provider,
      context
    });
  }

  /**
   * Get latency bucket for metrics
   */
  private getLatencyBucket(durationMs: number): string {
    if (durationMs < 500) return '<500ms';
    if (durationMs < 1000) return '500ms-1s';
    if (durationMs < 2000) return '1s-2s';
    if (durationMs < 5000) return '2s-5s';
    return '>5s';
  }

  /**
   * Flush and close the trace file
   */
  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = undefined;
    }
  }

  /**
   * Enable or disable tracing
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.stream) {
      this.close();
    }
  }

  /**
   * Get trace file path
   */
  getTraceFile(): string {
    return this.traceFile;
  }
}

/**
 * Create a RouterTraceLogger instance
 *
 * @param workspacePath - Workspace path
 * @param enabled - Whether tracing is enabled
 * @returns RouterTraceLogger instance
 */
export function createTraceLogger(
  workspacePath: string,
  enabled: boolean = true
): RouterTraceLogger {
  return new RouterTraceLogger({
    workspacePath,
    enabled,
    autoFlush: true
  });
}

/**
 * Singleton instance (optional - for global access)
 */
let globalTracer: RouterTraceLogger | null = null;

/**
 * Get or create global tracer instance
 *
 * @param workspacePath - Workspace path (required on first call)
 * @returns Global RouterTraceLogger instance
 */
export function getGlobalTracer(workspacePath?: string): RouterTraceLogger {
  if (!globalTracer && workspacePath) {
    globalTracer = createTraceLogger(workspacePath, true);
  }

  if (!globalTracer) {
    throw new Error('Global tracer not initialized. Call getGlobalTracer(workspacePath) first.');
  }

  return globalTracer;
}

/**
 * Close global tracer
 */
export function closeGlobalTracer(): void {
  if (globalTracer) {
    globalTracer.close();
    globalTracer = null;
  }
}
