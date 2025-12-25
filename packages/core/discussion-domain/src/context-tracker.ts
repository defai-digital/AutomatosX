/**
 * Discussion Context Tracker
 *
 * Tracks recursive discussion state including depth, budget, and call counts.
 * Prevents infinite recursion and enforces resource limits.
 *
 * Invariants:
 * - INV-DISC-600: Depth never exceeds maxDepth
 * - INV-DISC-601: No circular discussions
 * - INV-DISC-610: Child timeout ≤ parent remaining budget
 * - INV-DISC-620: Total calls ≤ maxTotalCalls
 */

import {
  type DiscussionContext,
  type TimeoutConfig,
  type RecursiveConfig,
  type CostControlConfig,
  DiscussionErrorCodes,
  createRootDiscussionContext,
  createChildDiscussionContext,
  canSpawnSubDiscussion,
  getTimeoutForLevel,
  DEFAULT_DISCUSSION_DEPTH,
  DEFAULT_TOTAL_BUDGET_MS,
  DEFAULT_MAX_TOTAL_CALLS,
  MIN_SYNTHESIS_TIME_MS,
} from '@defai.digital/contracts';

/**
 * Result of checking if sub-discussion can be spawned
 */
export interface SubDiscussionCheck {
  allowed: boolean;
  reason?: string;
  errorCode?: string;
  availableBudgetMs?: number;
  remainingCalls?: number;
}

/**
 * Configuration for the context tracker
 */
export interface ContextTrackerConfig {
  recursive: RecursiveConfig;
  timeout: TimeoutConfig;
  cost: CostControlConfig;
}

/**
 * Discussion context tracker for managing recursive discussion state
 */
export interface DiscussionContextTracker {
  /** Get current context */
  getContext(): DiscussionContext;

  /** Check if sub-discussion can be spawned */
  canSpawnSubDiscussion(estimatedDurationMs?: number): SubDiscussionCheck;

  /** Create child context for sub-discussion */
  createChildContext(childDiscussionId: string): DiscussionContext;

  /** Record provider calls made */
  recordCalls(count: number): void;

  /** Record time elapsed */
  recordElapsed(elapsedMs: number): void;

  /** Get timeout for current depth level */
  getTimeoutForCurrentLevel(): number;

  /** Get timeout for a specific depth level */
  getTimeoutForLevel(depth: number): number;

  /** Check if at root level */
  isRoot(): boolean;

  /** Get remaining depth capacity */
  getRemainingDepth(): number;

  /** Get remaining call capacity */
  getRemainingCalls(): number;

  /** Get remaining budget in milliseconds */
  getRemainingBudgetMs(): number;

  /** Get elapsed time since start */
  getElapsedMs(): number;
}

/**
 * Creates a discussion context tracker
 */
export function createContextTracker(
  discussionId: string,
  config: Partial<ContextTrackerConfig> = {},
  parentContext?: DiscussionContext
): DiscussionContextTracker {
  // Merge config with defaults
  const recursiveConfig: RecursiveConfig = {
    enabled: config.recursive?.enabled ?? false,
    maxDepth: config.recursive?.maxDepth ?? DEFAULT_DISCUSSION_DEPTH,
    allowedProviders: config.recursive?.allowedProviders,
    allowSubDiscussions: config.recursive?.allowSubDiscussions ?? true,
  };

  const timeoutConfig: TimeoutConfig = {
    strategy: config.timeout?.strategy ?? 'cascade',
    totalBudgetMs: config.timeout?.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS,
    minSynthesisMs: config.timeout?.minSynthesisMs ?? MIN_SYNTHESIS_TIME_MS,
    levelTimeouts: config.timeout?.levelTimeouts,
  };

  const costConfig: CostControlConfig = {
    maxTotalCalls: config.cost?.maxTotalCalls ?? DEFAULT_MAX_TOTAL_CALLS,
    budgetUsd: config.cost?.budgetUsd,
    cascadingConfidence: {
      enabled: config.cost?.cascadingConfidence?.enabled ?? true,
      threshold: config.cost?.cascadingConfidence?.threshold ?? 0.9,
      minProviders: config.cost?.cascadingConfidence?.minProviders ?? 2,
    },
  };

  // Initialize context
  let context: DiscussionContext;

  if (parentContext) {
    // Create child context
    const elapsed = Date.now() - new Date(parentContext.startedAt).getTime();
    context = createChildDiscussionContext(parentContext, discussionId, elapsed, 0);
  } else {
    // Create root context
    context = createRootDiscussionContext(discussionId, {
      maxDepth: recursiveConfig.maxDepth,
      totalBudgetMs: timeoutConfig.totalBudgetMs,
      maxTotalCalls: costConfig.maxTotalCalls,
    });
  }

  // Track mutable state
  let totalCalls = context.totalCalls;
  let elapsedSinceContextCreation = 0;

  return {
    getContext(): DiscussionContext {
      return {
        ...context,
        totalCalls,
        remainingBudgetMs: Math.max(0, context.remainingBudgetMs - elapsedSinceContextCreation),
      };
    },

    canSpawnSubDiscussion(estimatedDurationMs?: number): SubDiscussionCheck {
      // Check if recursion is enabled
      if (!recursiveConfig.enabled) {
        return {
          allowed: false,
          reason: 'Recursive discussions not enabled',
          errorCode: DiscussionErrorCodes.INVALID_CONFIG,
        };
      }

      // Check if sub-discussions allowed
      if (!recursiveConfig.allowSubDiscussions) {
        return {
          allowed: false,
          reason: 'Sub-discussions not allowed in configuration',
          errorCode: DiscussionErrorCodes.INVALID_CONFIG,
        };
      }

      // Use contract function for basic checks
      const remainingBudget = context.remainingBudgetMs - elapsedSinceContextCreation;
      const minBudget = estimatedDurationMs ?? timeoutConfig.minSynthesisMs * 2;

      const checkContext: DiscussionContext = {
        ...context,
        totalCalls,
        remainingBudgetMs: remainingBudget,
      };

      const check = canSpawnSubDiscussion(checkContext, minBudget);

      if (!check.allowed) {
        // Determine error code based on reason
        const reason = check.reason ?? 'Sub-discussion not allowed';
        let errorCode: string = DiscussionErrorCodes.INVALID_CONFIG;
        if (reason.includes('depth')) {
          errorCode = DiscussionErrorCodes.MAX_DEPTH_EXCEEDED;
        } else if (reason.includes('budget')) {
          errorCode = DiscussionErrorCodes.BUDGET_EXHAUSTED;
        } else if (reason.includes('calls')) {
          errorCode = DiscussionErrorCodes.MAX_CALLS_EXCEEDED;
        }

        return {
          allowed: false,
          reason,
          errorCode,
          availableBudgetMs: remainingBudget,
          remainingCalls: context.maxTotalCalls - totalCalls,
        };
      }

      return {
        allowed: true,
        availableBudgetMs: remainingBudget,
        remainingCalls: context.maxTotalCalls - totalCalls,
      };
    },

    createChildContext(childDiscussionId: string): DiscussionContext {
      const elapsed = Date.now() - new Date(context.startedAt).getTime();
      return createChildDiscussionContext(
        { ...context, totalCalls },
        childDiscussionId,
        elapsed,
        0
      );
    },

    recordCalls(count: number): void {
      totalCalls += count;
    },

    recordElapsed(elapsedMs: number): void {
      elapsedSinceContextCreation += elapsedMs;
    },

    getTimeoutForCurrentLevel(): number {
      return getTimeoutForLevel(timeoutConfig, context.depth, context.maxDepth);
    },

    getTimeoutForLevel(depth: number): number {
      return getTimeoutForLevel(timeoutConfig, depth, context.maxDepth);
    },

    isRoot(): boolean {
      return context.depth === 0;
    },

    getRemainingDepth(): number {
      return context.maxDepth - context.depth;
    },

    getRemainingCalls(): number {
      return Math.max(0, context.maxTotalCalls - totalCalls);
    },

    getRemainingBudgetMs(): number {
      return Math.max(0, context.remainingBudgetMs - elapsedSinceContextCreation);
    },

    getElapsedMs(): number {
      return Date.now() - new Date(context.startedAt).getTime();
    },
  };
}

/**
 * Discussion context error
 */
export class DiscussionContextError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: DiscussionContext
  ) {
    super(message);
    this.name = 'DiscussionContextError';
  }

  static maxDepthExceeded(context: DiscussionContext): DiscussionContextError {
    return new DiscussionContextError(
      DiscussionErrorCodes.MAX_DEPTH_EXCEEDED,
      `Maximum discussion depth ${context.maxDepth} exceeded at depth ${context.depth}`,
      context
    );
  }

  static circularDiscussion(
    discussionId: string,
    context: DiscussionContext
  ): DiscussionContextError {
    return new DiscussionContextError(
      DiscussionErrorCodes.CIRCULAR_DISCUSSION,
      `Circular discussion detected: ${discussionId} already in chain`,
      context
    );
  }

  static budgetExhausted(context: DiscussionContext): DiscussionContextError {
    return new DiscussionContextError(
      DiscussionErrorCodes.BUDGET_EXHAUSTED,
      `Timeout budget exhausted: ${context.remainingBudgetMs}ms remaining`,
      context
    );
  }

  static maxCallsExceeded(context: DiscussionContext): DiscussionContextError {
    return new DiscussionContextError(
      DiscussionErrorCodes.MAX_CALLS_EXCEEDED,
      `Maximum calls ${context.maxTotalCalls} exceeded`,
      context
    );
  }
}
