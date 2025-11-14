/**
 * AutomatosX v8.0.0 - Strategy Selector
 *
 * Selects and adapts execution strategies based on failure patterns
 */

import type {
  Strategy,
  StrategyConfig,
  FailureAnalysis,
  IterationResult
} from '../types/iterate.types.js';

/**
 * Built-in retry strategies
 */
export const BUILTIN_STRATEGIES: Strategy[] = [
  {
    name: 'default',
    description: 'Standard execution with exponential backoff retries',
    config: {
      timeout: 300000, // 5 minutes
      retryBackoff: 'exponential',
      parallelism: 5,
      useCache: true,
      fallbackProviders: false,
      skipOptionalSteps: false
    },
    priority: 10,
    applicableErrors: []
  },
  {
    name: 'aggressive-timeout',
    description: 'Increase timeouts for slow operations and network issues',
    config: {
      timeout: 600000, // 10 minutes
      retryBackoff: 'exponential',
      parallelism: 5,
      useCache: true,
      fallbackProviders: false,
      skipOptionalSteps: false
    },
    priority: 8,
    applicableErrors: ['timeout', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'network']
  },
  {
    name: 'fallback-providers',
    description: 'Switch to alternative AI providers on rate limits or API errors',
    config: {
      timeout: 300000,
      retryBackoff: 'exponential',
      parallelism: 5,
      fallbackProviders: true,
      useCache: false, // Force fresh attempt
      skipOptionalSteps: false
    },
    priority: 7,
    applicableErrors: ['rate_limit', 'api_error', '429', '503', '502', 'overloaded']
  },
  {
    name: 'reduced-parallelism',
    description: 'Execute steps sequentially to avoid resource contention',
    config: {
      timeout: 300000,
      retryBackoff: 'linear',
      parallelism: 1,
      useCache: true,
      fallbackProviders: false,
      skipOptionalSteps: false
    },
    priority: 6,
    applicableErrors: ['resource_exhausted', 'EMFILE', 'ENOMEM', 'EAGAIN', 'memory']
  },
  {
    name: 'skip-optional',
    description: 'Skip optional steps to reach workflow completion faster',
    config: {
      timeout: 300000,
      retryBackoff: 'exponential',
      parallelism: 5,
      skipOptionalSteps: true,
      useCache: true,
      fallbackProviders: false
    },
    priority: 5,
    applicableErrors: ['partial_failure', 'non_critical_error', 'optional_step_failed']
  }
];

/**
 * Strategy Selector
 *
 * Intelligently selects execution strategies based on:
 * - Failure patterns
 * - Historical success rates
 * - Error types
 * - Strategy priority
 */
export class StrategySelector {
  private strategyHistory: Map<string, number> = new Map();
  private mode: 'auto' | 'conservative' | 'aggressive';

  constructor(mode: 'auto' | 'conservative' | 'aggressive' = 'auto') {
    this.mode = mode;
  }

  /**
   * Select initial strategy for first iteration
   */
  async selectInitial(): Promise<Strategy> {
    // Always start with default strategy
    const defaultStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default');

    if (!defaultStrategy) {
      throw new Error('Default strategy not found');
    }

    return defaultStrategy;
  }

  /**
   * Select next strategy based on failure analysis
   */
  async selectNext(
    previousStrategy: Strategy,
    failureAnalysis: FailureAnalysis,
    iterationHistory: IterationResult[]
  ): Promise<Strategy> {
    // If error is permanent, don't bother with strategy change
    if (failureAnalysis.isPermanent) {
      return previousStrategy; // Will fail safety check anyway
    }

    // Find strategies applicable to the error type
    const candidates = this.findApplicableStrategies(
      failureAnalysis.errorType,
      previousStrategy
    );

    // If no specific strategy found, try fallback logic
    if (candidates.length === 0) {
      return this.selectFallbackStrategy(previousStrategy, iterationHistory);
    }

    // Sort candidates by success history and priority
    const sortedCandidates = this.sortCandidates(candidates);

    // Apply mode-specific selection
    return this.applyModeSelection(sortedCandidates, failureAnalysis);
  }

  /**
   * Record successful strategy for learning
   */
  recordSuccess(strategy: Strategy): void {
    const count = this.strategyHistory.get(strategy.name) || 0;
    this.strategyHistory.set(strategy.name, count + 1);
  }

  /**
   * Get strategy history
   */
  getHistory(): Map<string, number> {
    return new Map(this.strategyHistory);
  }

  /**
   * Reset strategy history
   */
  resetHistory(): void {
    this.strategyHistory.clear();
  }

  /**
   * Find strategies applicable to error type
   */
  private findApplicableStrategies(
    errorType: string,
    previousStrategy: Strategy
  ): Strategy[] {
    // Don't retry same strategy immediately
    const candidates = BUILTIN_STRATEGIES.filter(strategy => {
      if (strategy.name === previousStrategy.name) {
        return false;
      }

      // Check if strategy handles this error type
      return strategy.applicableErrors.some(applicableError =>
        errorType.toLowerCase().includes(applicableError.toLowerCase()) ||
        applicableError.toLowerCase().includes(errorType.toLowerCase())
      );
    });

    return candidates;
  }

  /**
   * Select fallback strategy when no specific match
   */
  private selectFallbackStrategy(
    previousStrategy: Strategy,
    iterationHistory: IterationResult[]
  ): Strategy {
    // Try next highest priority strategy
    const nextStrategy = BUILTIN_STRATEGIES
      .filter(s => s.priority < previousStrategy.priority && s.name !== previousStrategy.name)
      .sort((a, b) => b.priority - a.priority)[0];

    // If no lower priority strategy, cycle back to high priority
    if (!nextStrategy) {
      const highestPriority = BUILTIN_STRATEGIES
        .filter(s => s.name !== previousStrategy.name)
        .sort((a, b) => b.priority - a.priority)[0];

      return highestPriority || previousStrategy;
    }

    return nextStrategy;
  }

  /**
   * Sort candidates by success history and priority
   */
  private sortCandidates(candidates: Strategy[]): Strategy[] {
    return candidates.sort((a, b) => {
      const aSuccesses = this.strategyHistory.get(a.name) || 0;
      const bSuccesses = this.strategyHistory.get(b.name) || 0;

      // More successes first
      if (aSuccesses !== bSuccesses) {
        return bSuccesses - aSuccesses;
      }

      // Higher priority first
      return b.priority - a.priority;
    });
  }

  /**
   * Apply mode-specific selection logic
   */
  private applyModeSelection(
    sortedCandidates: Strategy[],
    failureAnalysis: FailureAnalysis
  ): Strategy {
    switch (this.mode) {
      case 'conservative':
        // Pick highest priority (most conservative)
        return sortedCandidates.sort((a, b) => b.priority - a.priority)[0];

      case 'aggressive':
        // Pick strategy with most successes
        return sortedCandidates[0];

      case 'auto':
      default:
        // Balance between success history and priority
        // High severity errors -> higher priority (conservative)
        if (failureAnalysis.severity === 'critical' || failureAnalysis.severity === 'high') {
          return sortedCandidates.sort((a, b) => b.priority - a.priority)[0];
        }

        // Low severity -> try most successful
        return sortedCandidates[0];
    }
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): Strategy | undefined {
    return BUILTIN_STRATEGIES.find(s => s.name === name);
  }

  /**
   * List all available strategies
   */
  listStrategies(): Strategy[] {
    return [...BUILTIN_STRATEGIES];
  }
}
