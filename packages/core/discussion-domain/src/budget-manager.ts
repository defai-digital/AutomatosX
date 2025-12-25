/**
 * Discussion Budget Manager
 *
 * Manages timeout budgets across recursive discussions using configurable strategies.
 * Supports fixed, cascade, and budget allocation strategies.
 *
 * Invariants:
 * - INV-DISC-610: Child timeout ≤ parent remaining budget
 * - INV-DISC-611: Minimum time reserved for synthesis
 * - INV-DISC-612: Total timeout includes all nested calls
 * - INV-DISC-613: Strategy applied consistently
 */

import {
  type TimeoutConfig,
  type TimeoutStrategy,
  getTimeoutForLevel,
  DEFAULT_TOTAL_BUDGET_MS,
  MIN_SYNTHESIS_TIME_MS,
  MAX_DISCUSSION_DEPTH,
} from '@defai.digital/contracts';

/**
 * Budget allocation result for a discussion level
 */
export interface BudgetAllocation {
  /** Timeout for provider calls at this level */
  providerTimeoutMs: number;

  /** Time reserved for synthesis at this level */
  synthesisTimeMs: number;

  /** Total budget for this level */
  totalLevelBudgetMs: number;

  /** Budget available for sub-discussions */
  subDiscussionBudgetMs: number;
}

/**
 * Budget status snapshot
 */
export interface BudgetStatus {
  /** Total budget configured */
  totalBudgetMs: number;

  /** Time elapsed since start */
  elapsedMs: number;

  /** Remaining budget */
  remainingMs: number;

  /** Current depth */
  currentDepth: number;

  /** Budget used per level */
  usageByLevel: Map<number, number>;

  /** Whether budget is exhausted */
  exhausted: boolean;

  /** Utilization percentage */
  utilizationPercent: number;
}

/**
 * Discussion budget manager interface
 */
export interface DiscussionBudgetManager {
  /** Get budget allocation for a specific depth */
  getAllocation(depth: number): BudgetAllocation;

  /** Get current budget status */
  getStatus(): BudgetStatus;

  /** Record time spent at a level */
  recordUsage(depth: number, elapsedMs: number): void;

  /** Get remaining budget for a depth */
  getRemainingBudget(depth: number): number;

  /** Check if budget allows sub-discussion at depth */
  canAllocateSubDiscussion(depth: number): boolean;

  /** Get timeout for provider call at depth */
  getProviderTimeout(depth: number): number;

  /** Get the configured strategy */
  getStrategy(): TimeoutStrategy;

  /** Create a child budget manager for sub-discussion */
  createChildManager(startingBudgetMs: number): DiscussionBudgetManager;
}

/**
 * Creates a discussion budget manager
 */
export function createBudgetManager(
  config: Partial<TimeoutConfig> = {},
  maxDepth = MAX_DISCUSSION_DEPTH
): DiscussionBudgetManager {
  // Apply defaults
  const timeoutConfig: TimeoutConfig = {
    strategy: config.strategy ?? 'cascade',
    totalBudgetMs: config.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS,
    minSynthesisMs: config.minSynthesisMs ?? MIN_SYNTHESIS_TIME_MS,
    levelTimeouts: config.levelTimeouts,
  };

  const startTime = Date.now();
  const usageByLevel = new Map<number, number>();

  // Pre-calculate allocations for each level
  const allocations = new Map<number, BudgetAllocation>();

  for (let depth = 0; depth <= maxDepth; depth++) {
    const levelTimeout = getTimeoutForLevel(timeoutConfig, depth, maxDepth);
    const synthesisTime = timeoutConfig.minSynthesisMs;
    const providerTime = Math.max(synthesisTime, levelTimeout - synthesisTime);

    // Calculate sub-discussion budget (for next level)
    let subBudget = 0;
    if (depth < maxDepth) {
      subBudget = getTimeoutForLevel(timeoutConfig, depth + 1, maxDepth);
    }

    allocations.set(depth, {
      providerTimeoutMs: providerTime,
      synthesisTimeMs: synthesisTime,
      totalLevelBudgetMs: levelTimeout,
      subDiscussionBudgetMs: subBudget,
    });
  }

  return {
    getAllocation(depth: number): BudgetAllocation {
      const allocation = allocations.get(Math.min(depth, maxDepth));
      if (!allocation) {
        // Fallback for unexpected depth
        return {
          providerTimeoutMs: timeoutConfig.minSynthesisMs,
          synthesisTimeMs: timeoutConfig.minSynthesisMs,
          totalLevelBudgetMs: timeoutConfig.minSynthesisMs * 2,
          subDiscussionBudgetMs: 0,
        };
      }
      return { ...allocation };
    },

    getStatus(): BudgetStatus {
      const elapsedMs = Date.now() - startTime;
      const remainingMs = Math.max(0, timeoutConfig.totalBudgetMs - elapsedMs);

      // Find current depth (highest level with usage)
      let currentDepth = 0;
      for (const [depth] of usageByLevel) {
        if (depth > currentDepth) {
          currentDepth = depth;
        }
      }

      return {
        totalBudgetMs: timeoutConfig.totalBudgetMs,
        elapsedMs,
        remainingMs,
        currentDepth,
        usageByLevel: new Map(usageByLevel),
        exhausted: remainingMs <= 0,
        utilizationPercent: (elapsedMs / timeoutConfig.totalBudgetMs) * 100,
      };
    },

    recordUsage(depth: number, elapsedMs: number): void {
      const current = usageByLevel.get(depth) ?? 0;
      usageByLevel.set(depth, current + elapsedMs);
    },

    getRemainingBudget(depth: number): number {
      const elapsedMs = Date.now() - startTime;
      const totalRemaining = Math.max(0, timeoutConfig.totalBudgetMs - elapsedMs);

      // Get level allocation
      const allocation = allocations.get(depth);
      if (!allocation) {
        return 0;
      }

      // Usage at this level
      const levelUsage = usageByLevel.get(depth) ?? 0;
      const levelRemaining = Math.max(0, allocation.totalLevelBudgetMs - levelUsage);

      // Return minimum of total remaining and level remaining
      return Math.min(totalRemaining, levelRemaining);
    },

    canAllocateSubDiscussion(depth: number): boolean {
      // Check if we can go deeper
      if (depth >= maxDepth) {
        return false;
      }

      // Check remaining budget
      const remaining = this.getRemainingBudget(depth);
      const minRequired = timeoutConfig.minSynthesisMs * 2; // Min for sub-discussion

      return remaining >= minRequired;
    },

    getProviderTimeout(depth: number): number {
      const allocation = this.getAllocation(depth);
      const remaining = this.getRemainingBudget(depth);

      // Don't exceed remaining budget
      return Math.min(allocation.providerTimeoutMs, remaining);
    },

    getStrategy(): TimeoutStrategy {
      return timeoutConfig.strategy;
    },

    createChildManager(startingBudgetMs: number): DiscussionBudgetManager {
      // Create a new manager with reduced budget
      return createBudgetManager(
        {
          ...timeoutConfig,
          totalBudgetMs: startingBudgetMs,
        },
        maxDepth
      );
    },
  };
}

/**
 * Utility to format budget status for logging
 */
export function formatBudgetStatus(status: BudgetStatus): string {
  const lines = [
    `Budget Status:`,
    `  Total: ${status.totalBudgetMs}ms`,
    `  Elapsed: ${status.elapsedMs}ms`,
    `  Remaining: ${status.remainingMs}ms`,
    `  Utilization: ${status.utilizationPercent.toFixed(1)}%`,
    `  Current Depth: ${status.currentDepth}`,
    `  Exhausted: ${status.exhausted}`,
  ];

  if (status.usageByLevel.size > 0) {
    lines.push(`  Usage by Level:`);
    for (const [depth, usage] of status.usageByLevel) {
      lines.push(`    Level ${depth}: ${usage}ms`);
    }
  }

  return lines.join('\n');
}

/**
 * Calculate recommended providers based on remaining budget
 */
export function recommendProvidersForBudget(
  remainingMs: number,
  perProviderEstimateMs: number,
  minProviders = 2,
  maxProviders = 6
): number {
  // Calculate how many providers we can fit
  const possibleProviders = Math.floor(remainingMs / perProviderEstimateMs);

  // Clamp to valid range
  return Math.max(minProviders, Math.min(maxProviders, possibleProviders));
}
