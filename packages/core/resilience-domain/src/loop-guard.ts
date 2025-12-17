/**
 * Loop Guard Implementation
 *
 * Prevents infinite loops and runaway execution.
 */

import {
  type LoopGuardConfig,
  type LoopGuardContext,
  type LoopGuardResult,
  LoopGuardErrorCodes,
  createDefaultLoopGuardConfig,
  createLoopGuardContext,
} from './_contracts.js';

/**
 * Loop guard error
 */
export class LoopGuardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: LoopGuardContext
  ) {
    super(message);
    this.name = 'LoopGuardError';
  }

  static maxIterations(context: LoopGuardContext): LoopGuardError {
    return new LoopGuardError(
      LoopGuardErrorCodes.MAX_ITERATIONS,
      `Maximum iterations (${context.iterations}) exceeded`,
      context
    );
  }

  static maxDuration(context: LoopGuardContext): LoopGuardError {
    return new LoopGuardError(
      LoopGuardErrorCodes.MAX_DURATION,
      `Maximum duration (${context.elapsedMs}ms) exceeded`,
      context
    );
  }

  static contextNotFound(contextId: string): LoopGuardError {
    return new LoopGuardError(
      LoopGuardErrorCodes.CONTEXT_NOT_FOUND,
      `Loop guard context not found: ${contextId}`
    );
  }
}

/**
 * Loop guard warning listener
 */
export type LoopGuardWarningListener = (
  contextId: string,
  result: LoopGuardResult & { status: 'warning' }
) => void;

/**
 * Loop guard interface
 */
export interface LoopGuard {
  /** Start a new execution context */
  startContext(contextId: string, metadata?: Record<string, unknown>): void;

  /** Check iteration and get result */
  checkIteration(contextId: string): LoopGuardResult;

  /** End an execution context */
  endContext(contextId: string): LoopGuardContext | undefined;

  /** Get context info */
  getContext(contextId: string): LoopGuardContext | undefined;

  /** Add warning listener */
  onWarning(listener: LoopGuardWarningListener): () => void;
}

/**
 * Creates a loop guard
 */
export function createLoopGuard(
  config?: Partial<LoopGuardConfig>
): LoopGuard {
  const cfg = { ...createDefaultLoopGuardConfig(), ...config };
  const contexts = new Map<string, LoopGuardContext & { startTime: number }>();
  const listeners = new Set<LoopGuardWarningListener>();

  function emitWarning(
    contextId: string,
    result: LoopGuardResult & { status: 'warning' }
  ): void {
    for (const listener of listeners) {
      try {
        listener(contextId, result);
      } catch {
        // Ignore listener errors
      }
    }
  }

  return {
    startContext(contextId: string, metadata?: Record<string, unknown>): void {
      const context = createLoopGuardContext(contextId);
      contexts.set(contextId, {
        ...context,
        metadata,
        startTime: Date.now(),
      });
    },

    checkIteration(contextId: string): LoopGuardResult {
      const context = contexts.get(contextId);

      if (!context) {
        throw LoopGuardError.contextNotFound(contextId);
      }

      // Update iteration and elapsed time
      context.iterations++;
      context.elapsedMs = Date.now() - context.startTime;

      // Check max iterations
      if (context.iterations >= cfg.maxIterations) {
        return {
          status: 'blocked',
          iteration: context.iterations,
          elapsedMs: context.elapsedMs,
          reason: `Maximum iterations (${cfg.maxIterations}) exceeded`,
          blockType: 'max-iterations',
        };
      }

      // Check max duration
      if (context.elapsedMs >= cfg.maxDurationMs) {
        return {
          status: 'blocked',
          iteration: context.iterations,
          elapsedMs: context.elapsedMs,
          reason: `Maximum duration (${cfg.maxDurationMs}ms) exceeded`,
          blockType: 'max-duration',
        };
      }

      // Check iteration warning
      if (!context.warningIssued && context.iterations >= cfg.warnAtIterations) {
        context.warningIssued = true;
        const result: LoopGuardResult & { status: 'warning' } = {
          status: 'warning',
          iteration: context.iterations,
          elapsedMs: context.elapsedMs,
          message: `Approaching iteration limit (${context.iterations}/${cfg.maxIterations})`,
          warningType: 'iteration',
        };
        emitWarning(contextId, result);
        return result;
      }

      // Check duration warning
      if (!context.warningIssued && context.elapsedMs >= cfg.warnAtDurationMs) {
        context.warningIssued = true;
        const result: LoopGuardResult & { status: 'warning' } = {
          status: 'warning',
          iteration: context.iterations,
          elapsedMs: context.elapsedMs,
          message: `Approaching duration limit (${context.elapsedMs}ms/${cfg.maxDurationMs}ms)`,
          warningType: 'duration',
        };
        emitWarning(contextId, result);
        return result;
      }

      return {
        status: 'ok',
        iteration: context.iterations,
        elapsedMs: context.elapsedMs,
      };
    },

    endContext(contextId: string): LoopGuardContext | undefined {
      const context = contexts.get(contextId);
      if (context) {
        context.elapsedMs = Date.now() - context.startTime;
        contexts.delete(contextId);
        // Return without internal startTime property
        const { startTime: _startTime, ...result } = context;
        return result;
      }
      return undefined;
    },

    getContext(contextId: string): LoopGuardContext | undefined {
      const context = contexts.get(contextId);
      if (context) {
        const { startTime: _startTime, ...result } = context;
        return {
          ...result,
          elapsedMs: Date.now() - context.startTime,
        };
      }
      return undefined;
    },

    onWarning(listener: LoopGuardWarningListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Creates a loop guard that throws on blocked
 */
export function createStrictLoopGuard(
  config?: Partial<LoopGuardConfig>
): LoopGuard {
  const guard = createLoopGuard(config);
  const originalCheck = guard.checkIteration.bind(guard);

  guard.checkIteration = (contextId: string): LoopGuardResult => {
    const result = originalCheck(contextId);

    if (result.status === 'blocked') {
      const context = guard.getContext(contextId);
      if (result.blockType === 'max-iterations') {
        throw LoopGuardError.maxIterations(context!);
      } else {
        throw LoopGuardError.maxDuration(context!);
      }
    }

    return result;
  };

  return guard;
}
