/**
 * Cache CLI Commands
 *
 * Manage provider response cache (v5.5.3+)
 */

import type { CommandModule } from 'yargs';
import { resolve } from 'path';
import { ResponseCache } from '../../core/cache/response-cache.js';
import { loadConfig } from '../../core/config/loader.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import { printSuccess } from '../../shared/logging/message-formatter.js';

const DEFAULT_CACHE_DB_PATH = '.automatosx/cache/responses.db';

/**
 * Get response cache instance
 */
async function getResponseCache(dbPath?: string): Promise<ResponseCache> {
  const config = await loadConfig(process.cwd());
  const cachePath = dbPath || config.performance?.responseCache?.dbPath || DEFAULT_CACHE_DB_PATH;

  return new ResponseCache({
    enabled: true, // Force enable for CLI commands
    ttl: config.performance?.responseCache?.ttl || 86400,
    maxSize: config.performance?.responseCache?.maxSize || 1000,
    maxMemorySize: config.performance?.responseCache?.maxMemorySize || 100,
    dbPath: resolve(cachePath)
  });
}

/**
 * Cache status command
 * Shows current cache configuration and basic stats
 */
export const statusCommand: CommandModule = {
  command: 'status',
  describe: 'Show response cache status and configuration',
  builder: (yargs) => {
    return (yargs as any)
      .option('output', {
        alias: 'o',
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      })
      .option('db', {
        describe: 'Cache database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const cache = await getResponseCache(argv.db);
      const stats = cache.getStats();
      const config = await loadConfig(process.cwd());

      if (argv.output === 'json') {
        console.log(JSON.stringify({
          config: config.performance?.responseCache,
          stats
        }, null, 2));
      } else {
        // Configuration table
        console.log(chalk.bold('\n📊 Response Cache Configuration:\n'));
        const configTable = new Table({
          head: [chalk.cyan('Setting'), chalk.cyan('Value')],
          colWidths: [30, 50]
        });

        const cacheConfig = config.performance?.responseCache;
        configTable.push(
          ['Enabled', cacheConfig?.enabled ? chalk.green('Yes') : chalk.red('No')],
          ['TTL (Time-to-Live)', `${cacheConfig?.ttl || 86400} seconds (${Math.round((cacheConfig?.ttl || 86400) / 3600)} hours)`],
          ['Max SQLite Entries', `${cacheConfig?.maxSize || 1000}`],
          ['Max Memory Entries', `${cacheConfig?.maxMemorySize || 100}`],
          ['Database Path', cacheConfig?.dbPath || DEFAULT_CACHE_DB_PATH]
        );

        console.log(configTable.toString());

        // Statistics table
        console.log(chalk.bold('\n📈 Cache Statistics:\n'));
        const statsTable = new Table({
          head: [chalk.cyan('Metric'), chalk.cyan('Value')],
          colWidths: [30, 50]
        });

        const hitRate = (stats.hitRate * 100).toFixed(2);
        const hitRateColor = stats.hitRate > 0.5 ? chalk.green : (stats.hitRate > 0.2 ? chalk.yellow : chalk.red);

        statsTable.push(
          ['Total Entries', `${stats.totalEntries}`],
          ['L1 (Memory) Entries', `${stats.l1Entries}`],
          ['L2 (SQLite) Entries', `${stats.l2Entries}`],
          ['Total Hits', chalk.green(`${stats.totalHits}`)],
          ['Total Misses', chalk.yellow(`${stats.totalMisses}`)],
          ['Hit Rate', hitRateColor(`${hitRate}%`)],
          ['Total Size', `${(stats.size / 1024 / 1024).toFixed(2)} MB`],
          ['Oldest Entry', stats.oldestEntry ? new Date(stats.oldestEntry).toLocaleString() : 'N/A'],
          ['Newest Entry', stats.newestEntry ? new Date(stats.newestEntry).toLocaleString() : 'N/A']
        );

        console.log(statsTable.toString());

        if (!stats.enabled) {
          console.log(chalk.yellow('\n⚠ Note: Cache is currently disabled in configuration.'));
          console.log(chalk.gray('To enable: ax config set performance.responseCache.enabled true\n'));
        } else if (stats.totalEntries === 0) {
          console.log(chalk.gray('\n💡 Tip: Cache is empty. Run some tasks to populate it.\n'));
        }
      }

      cache.close();
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to get cache status:'));
      console.error(chalk.gray((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Cache stats command (detailed statistics)
 * Phase 3 (v5.6.3): Enhanced with provider cache metrics
 */
export const statsCommand: CommandModule = {
  command: 'stats',
  describe: 'Show detailed cache statistics including provider caches',
  builder: (yargs) => {
    return (yargs as any)
      .option('output', {
        alias: 'o',
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      })
      .option('db', {
        describe: 'Cache database path',
        type: 'string'
      })
      .option('providers', {
        alias: 'p',
        describe: 'Show provider cache metrics',
        type: 'boolean',
        default: true
      });
  },
  handler: async (argv: any) => {
    try {
      const cache = await getResponseCache(argv.db);
      const stats = cache.getStats();

      // Phase 3: Provider cache metrics
      // Note: Provider cache metrics are available through the Router API at runtime
      // This command shows response cache only. For provider cache, use runtime monitoring.
      const providerMetrics: any = null;

      if (argv.output === 'json') {
        console.log(JSON.stringify({
          responseCache: stats,
          providerCache: providerMetrics
        }, null, 2));
      } else {
        console.log(chalk.bold('\n📊 Cache Statistics:\n'));

        const table = new Table({
          head: [chalk.cyan('Metric'), chalk.cyan('Value')],
          colWidths: [35, 50]
        });

        const hitRate = (stats.hitRate * 100).toFixed(2);
        const totalRequests = stats.totalHits + stats.totalMisses;
        const avgEntrySize = stats.totalEntries > 0 ? stats.size / stats.totalEntries : 0;

        table.push(
          [chalk.bold('Status'), stats.enabled ? chalk.green('Enabled') : chalk.red('Disabled')],
          [''],
          [chalk.bold('Entries'), ''],
          ['  Total Entries', `${stats.totalEntries}`],
          ['  L1 (Memory)', `${stats.l1Entries}`],
          ['  L2 (SQLite)', `${stats.l2Entries}`],
          [''],
          [chalk.bold('Performance'), ''],
          ['  Total Requests', `${totalRequests}`],
          ['  Cache Hits', chalk.green(`${stats.totalHits}`)],
          ['  Cache Misses', chalk.yellow(`${stats.totalMisses}`)],
          ['  Hit Rate', `${hitRate}%`],
          [''],
          [chalk.bold('Storage'), ''],
          ['  Total Size', `${(stats.size / 1024 / 1024).toFixed(2)} MB`],
          ['  Average Entry Size', `${(avgEntrySize / 1024).toFixed(2)} KB`],
          [''],
          [chalk.bold('Timeline'), ''],
          ['  Oldest Entry', stats.oldestEntry ? new Date(stats.oldestEntry).toLocaleString() : 'N/A'],
          ['  Newest Entry', stats.newestEntry ? new Date(stats.newestEntry).toLocaleString() : 'N/A']
        );

        console.log(table.toString());

        // Performance insights
        console.log(chalk.bold('\n💡 Insights:\n'));
        if (stats.totalEntries === 0) {
          console.log(chalk.gray('  • Cache is empty. Run some tasks to see performance benefits.'));
        } else {
          if (stats.hitRate > 0.5) {
            console.log(chalk.green('  • Excellent hit rate! Cache is working well.'));
          } else if (stats.hitRate > 0.2) {
            console.log(chalk.yellow('  • Moderate hit rate. Consider increasing TTL for better performance.'));
          } else if (totalRequests > 10) {
            console.log(chalk.red('  • Low hit rate. Tasks may be too unique for caching.'));
          }

          if (stats.l1Entries === stats.totalEntries && stats.totalEntries < 50) {
            console.log(chalk.gray('  • All entries in memory (L1). Fast access guaranteed.'));
          }

          if (stats.size > 50 * 1024 * 1024) {
            console.log(chalk.yellow('  • Cache is large. Consider reducing maxSize or TTL.'));
          }
        }

        console.log();

        // Phase 3: Provider cache info
        if (argv.providers) {
          console.log(chalk.bold('\n🔧 Provider Cache Information:\n'));
          console.log(chalk.gray('  Provider cache metrics (availability checks, version detection) are tracked'));
          console.log(chalk.gray('  at runtime and available through the Router.getHealthCheckStatus() API.'));
          console.log(chalk.gray('  \n  To monitor provider cache performance:'));
          console.log(chalk.gray('    • Enable health checks in automatosx.config.json'));
          console.log(chalk.gray('    • Check logs for "Health check completed" messages'));
          console.log(chalk.gray('    • Use router.getHealthCheckStatus() in your code\n'));
        }

        // Phase 3: Provider cache metrics (if available from runtime)
        if (providerMetrics && argv.providers) {
          console.log(chalk.bold('\n🔧 Provider Cache Metrics:\n'));

          // Health Check Status
          const healthTable = new Table({
            head: [chalk.cyan('Setting'), chalk.cyan('Value')],
            colWidths: [35, 50]
          });

          healthTable.push(
            [chalk.bold('Health Checks'), providerMetrics.enabled ? chalk.green('Enabled') : chalk.gray('Disabled')],
            ['Interval', providerMetrics.interval ? `${providerMetrics.interval}ms (${(providerMetrics.interval / 1000).toFixed(0)}s)` : 'N/A'],
            ['Checks Performed', `${providerMetrics.checksPerformed}`],
            ['Average Duration', `${Math.round(providerMetrics.avgDuration)}ms`],
            ['Success Rate', `${providerMetrics.successRate.toFixed(1)}%`],
            ['Providers Monitored', `${providerMetrics.providersMonitored}`]
          );

          console.log(healthTable.toString());

          // Per-provider metrics
          if (providerMetrics.providers && providerMetrics.providers.length > 0) {
            console.log(chalk.bold('\n📦 Per-Provider Cache Statistics:\n'));

            const providerTable = new Table({
              head: [
                chalk.cyan('Provider'),
                chalk.cyan('Cache Hit Rate'),
                chalk.cyan('Avg Cache Age'),
                chalk.cyan('Uptime')
              ],
              colWidths: [20, 20, 20, 15]
            });

            for (const provider of providerMetrics.providers) {
              const hitRatePercent = (provider.cacheHitRate * 100).toFixed(1);
              const hitRateColor = provider.cacheHitRate > 0.8 ? chalk.green :
                                   provider.cacheHitRate > 0.5 ? chalk.yellow :
                                   chalk.red;

              providerTable.push([
                provider.name,
                hitRateColor(`${hitRatePercent}%`),
                `${Math.round(provider.avgCacheAge)}ms`,
                `${provider.uptime.toFixed(1)}%`
              ]);
            }

            console.log(providerTable.toString());
          }

          console.log(chalk.bold('\n💡 Provider Cache Insights:\n'));

          if (!providerMetrics.enabled) {
            console.log(chalk.gray('  • Health checks disabled. Enable in config for automatic cache warmup.'));
          } else {
            const totalHitRate = providerMetrics.providers.reduce((sum: number, p: any) =>
              sum + p.cacheHitRate, 0) / (providerMetrics.providers.length || 1);

            if (totalHitRate > 0.8) {
              console.log(chalk.green('  • Excellent cache performance! Most checks hit cache.'));
            } else if (totalHitRate > 0.5) {
              console.log(chalk.yellow('  • Moderate cache performance. Consider reducing check frequency.'));
            } else if (providerMetrics.checksPerformed > 5) {
              console.log(chalk.red('  • Low cache hit rate. Caches may be expiring too quickly.'));
            }

            if (providerMetrics.checksPerformed > 0) {
              console.log(chalk.gray(`  • ${providerMetrics.checksPerformed} health checks performed, averaging ${Math.round(providerMetrics.avgDuration)}ms each.`));
            }
          }

          console.log();
        } else if (argv.providers) {
          console.log(chalk.gray('\n💡 Tip: Provider cache metrics available after running tasks with health checks enabled.\n'));
        }
      }

      cache.close();
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to get cache stats:'));
      console.error(chalk.gray((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Cache clear command
 */
export const clearCommand: CommandModule = {
  command: 'clear',
  describe: 'Clear all cache entries',
  builder: (yargs) => {
    return (yargs as any)
      .option('confirm', {
        alias: 'y',
        describe: 'Skip confirmation prompt',
        type: 'boolean',
        default: false
      })
      .option('db', {
        describe: 'Cache database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const cache = await getResponseCache(argv.db);
      const stats = cache.getStats();

      if (stats.totalEntries === 0) {
        console.log(chalk.yellow('\n⚠ Cache is already empty.\n'));
        cache.close();
        return;
      }

      // Confirm before clearing (unless --confirm flag is used)
      if (!argv.confirm) {
        console.log(chalk.yellow(`\n⚠ This will delete ${stats.totalEntries} cache entries (${(stats.size / 1024 / 1024).toFixed(2)} MB).\n`));
        console.log(chalk.gray('To confirm, run: ax cache clear --confirm\n'));
        cache.close();
        return;
      }

      cache.clear();
      printSuccess(`Cache cleared successfully. Deleted ${stats.totalEntries} entries.`);

      cache.close();
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to clear cache:'));
      console.error(chalk.gray((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Cache parent command
 */
export const cacheCommand: CommandModule = {
  command: 'cache <command>',
  describe: 'Manage provider response cache',
  builder: (yargs) => {
    return yargs
      .command(statusCommand)
      .command(statsCommand)
      .command(clearCommand)
      .demandCommand(1, 'Please specify a cache command')
      .help();
  },
  handler: () => {
    // Parent command, subcommands handle execution
  }
};
