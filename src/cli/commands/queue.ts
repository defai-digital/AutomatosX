/**
 * queue.ts
 *
 * CLI commands for workflow queue management
 * Phase 5 Week 2: Distributed Execution
 */

import { Command } from 'commander';
import { WorkflowQueue } from '../../queue/WorkflowQueue.js';
import { WorkflowWorker } from '../../workers/WorkflowWorker.js';
import { WorkerPool } from '../../workers/WorkerPool.js';
import { WorkflowEngine } from '../../services/WorkflowEngine.js';
import { WorkflowCache } from '../../cache/WorkflowCache.js';
import chalk from 'chalk';

/**
 * Create queue command with subcommands
 */
export function createQueueCommand(): Command {
  const queue = new Command('queue')
    .description('Manage workflow execution queue and workers');

  // Subcommands
  queue.addCommand(createStatsCommand());
  queue.addCommand(createListCommand());
  queue.addCommand(createCleanupCommand());
  queue.addCommand(createWorkerCommand());

  return queue;
}

/**
 * Get queue statistics
 */
function createStatsCommand(): Command {
  return new Command('stats')
    .description('Show queue statistics')
    .action(async () => {
      try {
        const queue = new WorkflowQueue();
        const stats = queue.getStats();

        console.log(chalk.blue('\nWorkflow Queue Statistics:\n'));
        console.log(chalk.gray('Total Items:'), stats.totalItems);
        console.log(chalk.yellow('Pending:'), stats.pendingItems);
        console.log(chalk.blue('Processing:'), stats.processingItems);
        console.log(chalk.green('Completed:'), stats.completedItems);
        console.log(chalk.red('Failed:'), stats.failedItems);
        console.log(chalk.gray('Avg Processing Time:'), `${stats.averageProcessingTimeMs.toFixed(2)}ms`);
        console.log(chalk.gray('Throughput:'), `${stats.throughput} items/min`);

        // Queue health
        const health = queue.getHealth();
        console.log(chalk.gray('\nHealth:'), health.healthy ? chalk.green('Healthy') : chalk.red('Issues detected'));

        if (health.issues.length > 0) {
          console.log(chalk.yellow('\nIssues:'));
          health.issues.forEach(issue => console.log(chalk.yellow(`  - ${issue}`)));
        }

      } catch (error) {
        console.error(chalk.red('Error getting queue stats:'), error);
        process.exit(1);
      }
    });
}

/**
 * List queue items
 */
function createListCommand(): Command {
  return new Command('list')
    .description('List queue items')
    .option('--status <status>', 'Filter by status (pending|processing|completed|failed)')
    .option('--limit <number>', 'Maximum number of items to show', parseInt, 20)
    .action(async (options: any) => {
      try {
        const queue = new WorkflowQueue();
        const status = options.status || 'pending';
        const items = queue.getItemsByStatus(status, options.limit);

        console.log(chalk.blue(`\nQueue Items (${status}):\n`));

        if (items.length === 0) {
          console.log(chalk.gray('No items found'));
          return;
        }

        items.forEach((item, index) => {
          console.log(chalk.bold(`${index + 1}. ${item.workflowDefinition.name}`));
          console.log(chalk.gray(`   ID: ${item.id.substring(0, 8)}...`));
          console.log(chalk.gray(`   Priority: ${item.priority}`));
          console.log(chalk.gray(`   Attempts: ${item.attempts}/${item.maxAttempts}`));

          if (item.startedAt) {
            const duration = item.completedAt ?
              item.completedAt - item.startedAt :
              Date.now() - item.startedAt;
            console.log(chalk.gray(`   Duration: ${duration}ms`));
          }

          if (item.error) {
            console.log(chalk.red(`   Error: ${item.error}`));
          }

          console.log();
        });

      } catch (error) {
        console.error(chalk.red('Error listing queue items:'), error);
        process.exit(1);
      }
    });
}

/**
 * Cleanup old items
 */
function createCleanupCommand(): Command {
  return new Command('cleanup')
    .description('Clean up old completed/failed items')
    .option('--retention <days>', 'Retention period in days', parseInt, 7)
    .action(async (options: any) => {
      try {
        const queue = new WorkflowQueue();
        const removed = queue.cleanup(options.retention);

        console.log(chalk.green(`\n✓ Cleaned up ${removed} old items (retention: ${options.retention} days)`));

      } catch (error) {
        console.error(chalk.red('Error cleaning up queue:'), error);
        process.exit(1);
      }
    });
}

/**
 * Worker management
 */
function createWorkerCommand(): Command {
  const worker = new Command('worker')
    .description('Manage workflow workers');

  worker
    .command('start')
    .description('Start worker pool')
    .option('--min-workers <number>', 'Minimum workers', parseInt, 2)
    .option('--max-workers <number>', 'Maximum workers', parseInt, 10)
    .action(async (options: any) => {
      try {
        console.log(chalk.blue('\nStarting worker pool...\n'));

        const queue = new WorkflowQueue();
        const engine = new WorkflowEngine();
        const cache = engine.getCache();

        const pool = new WorkerPool(queue, engine, cache, {
          minWorkers: options.minWorkers,
          maxWorkers: options.maxWorkers,
        });

        await pool.start();

        console.log(chalk.green('✓ Worker pool started'));
        console.log(chalk.gray(`Min workers: ${options.minWorkers}`));
        console.log(chalk.gray(`Max workers: ${options.maxWorkers}`));

        // Show stats periodically
        setInterval(() => {
          const stats = pool.getStats();
          console.log(chalk.blue(`\n[${new Date().toISOString()}] Pool Stats:`));
          console.log(chalk.gray(`Workers: ${stats.totalWorkers} (${stats.busyWorkers} busy, ${stats.idleWorkers} idle)`));
          console.log(chalk.gray(`Queue: ${stats.queueLength} pending`));
          console.log(chalk.gray(`Processed: ${stats.totalTasksProcessed} (${stats.totalTasksFailed} failed)`));
          console.log(chalk.gray(`Utilization: ${(stats.utilization * 100).toFixed(1)}%`));
        }, 10000);

        // Handle shutdown
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\n\nShutting down worker pool...'));
          await pool.stop();
          console.log(chalk.green('✓ Worker pool stopped'));
          process.exit(0);
        });

      } catch (error) {
        console.error(chalk.red('Error starting workers:'), error);
        process.exit(1);
      }
    });

  worker
    .command('stats')
    .description('Show worker pool statistics')
    .action(async () => {
      try {
        // Note: This would require persistent worker pool state
        console.log(chalk.yellow('Worker stats require running worker pool'));
        console.log(chalk.gray('Use "ax queue worker start" to start the worker pool'));

      } catch (error) {
        console.error(chalk.red('Error getting worker stats:'), error);
        process.exit(1);
      }
    });

  return worker;
}
