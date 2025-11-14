/**
 * AutomatosX v8.0.0 - Strategy Selector
 *
 * Intelligently selects the best retry strategy based on failure patterns
 * Uses priority-based selection with success probability estimation
 */

import chalk from 'chalk';
import type { Strategy, FailurePattern, Task } from './IterateStrategy.js';
import {
  SimpleRetryStrategy,
  ExponentialBackoffStrategy,
  DifferentProviderStrategy,
  DifferentAgentStrategy,
  SimplifyTaskStrategy,
  IncrementalRetryStrategy,
  AdaptiveParallelismStrategy,
  CircuitBreakerStrategy,
  GradualRelaxationStrategy,
  HybridApproachStrategy
} from './IterateStrategy.js';

/**
 * Strategy selection result
 */
export interface StrategySelection {
  strategy: Strategy;
  confidence: number;
  reason: string;
  alternatives: Array<{
    strategy: Strategy;
    confidence: number;
  }>;
}

/**
 * Strategy Selector
 *
 * Analyzes failure patterns and selects optimal recovery strategy
 */
export class StrategySelector {
  private strategies: Strategy[];

  constructor() {
    // Register all available strategies (sorted by priority)
    this.strategies = [
      new HybridApproachStrategy(),
      new CircuitBreakerStrategy(),
      new SimplifyTaskStrategy(),
      new IncrementalRetryStrategy(),
      new ExponentialBackoffStrategy(),
      new DifferentProviderStrategy(),
      new DifferentAgentStrategy(),
      new AdaptiveParallelismStrategy(),
      new GradualRelaxationStrategy(),
      new SimpleRetryStrategy()
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Select best strategy for given failure pattern and task
   */
  select(pattern: FailurePattern, task: Task, currentStrategy?: Strategy): StrategySelection {
    // Filter applicable strategies
    const applicable = this.strategies.filter(s =>
      s.isApplicable(pattern, task) && s.name !== currentStrategy?.name
    );

    if (applicable.length === 0) {
      // Fallback to simple retry if nothing else applies
      const fallback = this.strategies.find(s => s.name === 'simple-retry')!;
      return {
        strategy: fallback,
        confidence: 0.2,
        reason: 'No better strategy available - using fallback',
        alternatives: []
      };
    }

    // Score each applicable strategy
    const scored = applicable.map(strategy => ({
      strategy,
      score: this.scoreStrategy(strategy, pattern, task)
    }));

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    // Best strategy
    const best = scored[0];

    // Alternative strategies (top 3)
    const alternatives = scored.slice(1, 4).map(s => ({
      strategy: s.strategy,
      confidence: s.score
    }));

    return {
      strategy: best.strategy,
      confidence: best.score,
      reason: this.getSelectionReason(best.strategy, pattern),
      alternatives
    };
  }

  /**
   * Select initial strategy (before any failures)
   */
  selectInitial(task: Task): Strategy {
    // For high complexity tasks, start with incremental approach
    if (task.complexity === 'high') {
      return this.strategies.find(s => s.name === 'incremental-retry')!;
    }

    // Default to simple retry
    return this.strategies.find(s => s.name === 'simple-retry')!;
  }

  /**
   * Score a strategy based on multiple factors
   */
  private scoreStrategy(strategy: Strategy, pattern: FailurePattern, task: Task): number {
    let score = 0;

    // Base score from strategy's own estimation
    const successProbability = strategy.estimateSuccess(pattern);
    score += successProbability * 50; // Weight: 50%

    // Priority bonus (higher priority = higher score)
    score += (strategy.priority / 10) * 20; // Weight: 20%

    // Pattern match bonus
    if (this.isPatternMatch(strategy, pattern)) {
      score += 20; // Weight: 20%
    }

    // Task complexity consideration
    if (this.isComplexityMatch(strategy, task)) {
      score += 10; // Weight: 10%
    }

    // Normalize to 0-1 range
    return Math.min(score / 100, 1.0);
  }

  /**
   * Check if strategy matches failure pattern
   */
  private isPatternMatch(strategy: Strategy, pattern: FailurePattern): boolean {
    const matches: Record<string, string[]> = {
      'timeout': ['exponential-backoff', 'adaptive-parallelism', 'gradual-relaxation'],
      'rate-limit': ['exponential-backoff', 'different-provider', 'adaptive-parallelism'],
      'complexity': ['simplify-task', 'incremental-retry', 'hybrid-approach'],
      'permission': ['different-agent'],
      'api-error': ['different-provider', 'exponential-backoff']
    };

    const matchingStrategies = matches[pattern.type] || [];
    return matchingStrategies.includes(strategy.name);
  }

  /**
   * Check if strategy matches task complexity
   */
  private isComplexityMatch(strategy: Strategy, task: Task): boolean {
    const complexityStrategies: Record<string, string[]> = {
      'high': ['simplify-task', 'incremental-retry', 'hybrid-approach'],
      'medium': ['different-provider', 'exponential-backoff'],
      'low': ['simple-retry']
    };

    const matchingStrategies = complexityStrategies[task.complexity] || [];
    return matchingStrategies.includes(strategy.name);
  }

  /**
   * Get human-readable reason for strategy selection
   */
  private getSelectionReason(strategy: Strategy, pattern: FailurePattern): string {
    const reasons: Record<string, string> = {
      'simple-retry': 'Transient error - simple retry should work',
      'exponential-backoff': `${pattern.type === 'timeout' ? 'Timeout' : 'Rate limit'} detected - adding backoff delays`,
      'different-provider': 'API errors - trying different provider',
      'different-agent': 'Permission issues - switching to different agent',
      'simplify-task': 'Task complexity too high - breaking into smaller steps',
      'incremental-retry': 'Large task - processing incrementally',
      'adaptive-parallelism': 'Adjusting concurrency to optimize throughput',
      'circuit-breaker': 'Multiple consecutive failures - enabling circuit breaker',
      'gradual-relaxation': 'Constraints too strict - relaxing timeouts',
      'hybrid-approach': 'Complex failure pattern - combining multiple strategies'
    };

    return reasons[strategy.name] || strategy.description;
  }

  /**
   * Get all available strategies
   */
  getAllStrategies(): Strategy[] {
    return [...this.strategies];
  }

  /**
   * Display strategy selection
   */
  displaySelection(selection: StrategySelection): void {
    console.log(chalk.cyan(`\n⚡ Selected Strategy: ${chalk.bold(selection.strategy.name)}`));
    console.log(chalk.gray(`   Confidence: ${this.formatConfidence(selection.confidence)}`));
    console.log(chalk.gray(`   Reason: ${selection.reason}`));

    if (selection.alternatives.length > 0) {
      console.log(chalk.gray('\n   Alternatives:'));
      for (const alt of selection.alternatives) {
        console.log(chalk.gray(`     • ${alt.strategy.name} (${this.formatConfidence(alt.confidence)})`));
      }
    }

    console.log('');
  }

  /**
   * Format confidence percentage
   */
  private formatConfidence(confidence: number): string {
    const percent = (confidence * 100).toFixed(0);
    const num = parseInt(percent);

    if (num >= 70) {
      return chalk.green(`${percent}%`);
    } else if (num >= 50) {
      return chalk.yellow(`${percent}%`);
    } else {
      return chalk.red(`${percent}%`);
    }
  }
}
