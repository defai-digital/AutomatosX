/**
 * AutomatosX v8.0.0 - Iterate Mode Handler
 *
 * Orchestrates iterate mode execution with all strategies, telemetry, and reporting
 */

import chalk from 'chalk';
import type { Database } from 'better-sqlite3';
import { StrategySelector } from '../../iterate/StrategySelector.js';
import { StrategyTelemetry } from '../../iterate/StrategyTelemetry.js';
import { ProgressMonitor } from '../../iterate/ProgressMonitor.js';
import { IterationReporter, type ExecutionSummary, type IterationResult } from '../../iterate/IterationReporter.js';
import type { Task, FailurePattern } from '../../iterate/IterateStrategy.js';

/**
 * Iterate execution options
 */
export interface IterateOptions {
  maxIterations?: number;
  timeout?: number;
  safetyLevel?: 'low' | 'medium' | 'high';
  verbose?: boolean;
}

/**
 * Execution result
 */
interface ExecutionResult {
  success: boolean;
  status: string;
  error?: string;
  duration: number;
}

/**
 * Iterate Mode Handler
 *
 * Handles autonomous task execution with adaptive retry strategies
 */
export class IterateModeHandler {
  private strategySelector: StrategySelector;
  private telemetry: StrategyTelemetry;
  private reporter: IterationReporter;

  constructor(private db: Database) {
    this.strategySelector = new StrategySelector();
    this.telemetry = new StrategyTelemetry(db);
    this.reporter = new IterationReporter();
  }

  /**
   * Execute task with iterate mode
   */
  async execute(taskDescription: string, options: IterateOptions = {}): Promise<void> {
    const {
      maxIterations = 10,
      timeout = 120000,
      safetyLevel = 'medium',
      verbose = false
    } = options;

    console.log(chalk.bold.cyan('\n╔═══ Iterate Mode ═══╗\n'));
    console.log(chalk.white(`Task: ${taskDescription}`));
    console.log(chalk.gray(`Max Iterations: ${maxIterations}`));
    console.log(chalk.gray(`Timeout: ${this.formatDuration(timeout)}`));
    console.log(chalk.gray(`Safety Level: ${safetyLevel}`));
    console.log('');

    // Create task
    const task: Task = {
      id: `task-${Date.now()}`,
      description: taskDescription,
      complexity: this.estimateComplexity(taskDescription),
      timeout
    };

    // Initialize progress monitor
    const monitor = new ProgressMonitor(maxIterations);
    monitor.start();

    const iterations: IterationResult[] = [];
    let currentStrategy = this.strategySelector.selectInitial(task);
    let success = false;
    const overallStartTime = Date.now();

    try {
      for (let i = 1; i <= maxIterations; i++) {
        // Check overall timeout
        if (Date.now() - overallStartTime > timeout) {
          monitor.stop(false, 'Overall timeout exceeded');
          throw new Error('Iterate mode timeout exceeded');
        }

        if (verbose) {
          console.log(chalk.blue(`\n🔄 Iteration ${i}: ${currentStrategy.name}...`));
        }

        // Execute iteration
        const result = await this.executeIteration(task, currentStrategy);

        // Record telemetry
        this.telemetry.recordExecution(
          currentStrategy.name,
          task.id,
          result.success ? 'none' : 'execution-error',
          result.success,
          result.duration
        );

        // Update progress
        monitor.update(i, currentStrategy.name, result.success, result.status);

        // Record iteration
        iterations.push({
          iteration: i,
          strategy: currentStrategy.name,
          success: result.success,
          executionTime: result.duration,
          timestamp: Date.now(),
          error: result.error
        });

        // Check if successful
        if (result.success) {
          success = true;
          if (verbose) {
            console.log(chalk.green(`\n✓ Iteration ${i} successful!`));
          }
          break;
        }

        // Failed - select next strategy
        if (verbose) {
          console.log(chalk.red(`\n✖ Iteration ${i} failed: ${result.error}`));
        }

        const pattern: FailurePattern = {
          type: this.classifyFailureType(result.error),
          count: i,
          consecutiveFailures: this.countConsecutiveFailures(iterations),
          lastError: result.error,
          averageLatency: this.calculateAverageLatency(iterations)
        };

        const selection = this.strategySelector.select(pattern, task, currentStrategy);

        if (verbose) {
          this.strategySelector.displaySelection(selection);
        }

        currentStrategy = selection.strategy;
      }

      // Stop progress monitor
      monitor.stop(success, success ? 'Task completed successfully' : 'Max iterations reached');

      // Generate execution summary
      const summary: ExecutionSummary = {
        taskId: task.id,
        totalIterations: iterations.length,
        successfulIterations: iterations.filter(i => i.success).length,
        failedIterations: iterations.filter(i => !i.success).length,
        totalExecutionTime: Date.now() - overallStartTime,
        averageIterationTime: iterations.reduce((sum, i) => sum + i.executionTime, 0) / iterations.length,
        finalStatus: success ? 'success' : 'failure',
        strategiesUsed: [...new Set(iterations.map(i => i.strategy))],
        mostEffectiveStrategy: this.findMostEffectiveStrategy(iterations),
        iterations
      };

      // Display report
      const report = this.reporter.generateReport(summary);
      console.log(report);

    } catch (error) {
      monitor.stop(false, (error as Error).message);
      console.error(chalk.red('\n❌ Iterate mode failed:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Execute single iteration
   */
  private async executeIteration(task: Task, strategy: any): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Apply strategy to modify task
      const modifiedTask = strategy.apply(task, {
        type: 'unknown',
        count: 1,
        consecutiveFailures: 0
      });

      // Simulate execution (in production, call actual workflow engine)
      const result = await this.simulateTaskExecution(modifiedTask);

      const duration = Date.now() - startTime;

      return {
        success: result.success,
        status: result.status,
        error: result.error,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        status: 'Error',
        error: (error as Error).message,
        duration
      };
    }
  }

  /**
   * Simulate task execution (placeholder for actual workflow execution)
   */
  private async simulateTaskExecution(task: Task): Promise<{ success: boolean; status: string; error?: string }> {
    // Simulate execution time
    const executionTime = 300 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, executionTime));

    // Simulate success/failure based on complexity
    const successProbability = task.complexity === 'low' ? 0.8 : task.complexity === 'medium' ? 0.6 : 0.4;
    const success = Math.random() < successProbability;

    if (success) {
      return {
        success: true,
        status: 'Completed'
      };
    } else {
      const errors = [
        'Timeout exceeded',
        'Permission denied',
        'Task too complex',
        'Resource unavailable',
        'API rate limit reached'
      ];

      return {
        success: false,
        status: 'Failed',
        error: errors[Math.floor(Math.random() * errors.length)]
      };
    }
  }

  /**
   * Estimate task complexity from description
   */
  private estimateComplexity(description: string): 'low' | 'medium' | 'high' {
    const words = description.split(/\s+/).length;

    // Check for complexity indicators
    const highComplexityKeywords = ['integrate', 'refactor', 'migrate', 'complex', 'entire', 'full'];
    const mediumComplexityKeywords = ['update', 'modify', 'improve', 'enhance'];

    const lowerDesc = description.toLowerCase();

    if (highComplexityKeywords.some(keyword => lowerDesc.includes(keyword))) {
      return 'high';
    }

    if (mediumComplexityKeywords.some(keyword => lowerDesc.includes(keyword))) {
      return 'medium';
    }

    if (words < 10) return 'low';
    if (words < 30) return 'medium';
    return 'high';
  }

  /**
   * Classify failure type from error message
   */
  private classifyFailureType(error?: string): FailurePattern['type'] {
    if (!error) return 'unknown';

    const errorLower = error.toLowerCase();

    if (errorLower.includes('timeout')) return 'timeout';
    if (errorLower.includes('permission') || errorLower.includes('denied')) return 'permission';
    if (errorLower.includes('complex')) return 'complexity';
    if (errorLower.includes('rate limit')) return 'rate-limit';
    if (errorLower.includes('api') || errorLower.includes('service')) return 'api-error';

    return 'unknown';
  }

  /**
   * Count consecutive failures
   */
  private countConsecutiveFailures(iterations: IterationResult[]): number {
    let count = 0;
    for (let i = iterations.length - 1; i >= 0; i--) {
      if (!iterations[i].success) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(iterations: IterationResult[]): number {
    if (iterations.length === 0) return 0;
    return iterations.reduce((sum, i) => sum + i.executionTime, 0) / iterations.length;
  }

  /**
   * Find most effective strategy
   */
  private findMostEffectiveStrategy(iterations: IterationResult[]): string | undefined {
    const strategyStats = new Map<string, { total: number; successful: number }>();

    for (const iteration of iterations) {
      const stats = strategyStats.get(iteration.strategy) || { total: 0, successful: 0 };
      stats.total++;
      if (iteration.success) stats.successful++;
      strategyStats.set(iteration.strategy, stats);
    }

    let bestStrategy: string | undefined;
    let bestRate = 0;

    for (const [strategy, stats] of strategyStats) {
      const rate = stats.successful / stats.total;
      if (rate > bestRate) {
        bestRate = rate;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Display telemetry report
   */
  displayTelemetry(): void {
    this.telemetry.displayReport();
  }

  /**
   * Display strategy statistics
   */
  displayStrategyStats(strategyName: string): void {
    this.telemetry.displayStrategyStats(strategyName);
  }

  /**
   * List all strategies
   */
  listStrategies(): void {
    const strategies = this.strategySelector.getAllStrategies();

    console.log(chalk.bold.cyan('\n╔═══ Available Iterate Strategies ═══╗\n'));

    for (const strategy of strategies) {
      console.log(chalk.yellow(`${strategy.name.padEnd(25)} `) + chalk.gray(`(Priority: ${strategy.priority})`));
      console.log(chalk.gray(`  ${strategy.description}`));
      console.log('');
    }

    console.log(chalk.gray('─'.repeat(60)));
    console.log('');
  }
}
