/**
 * status.ts
 *
 * CLI command to show indexing status and cache statistics
 */

import { Command } from 'commander';
import { FileService } from '../../services/FileService.js';
import Table from 'cli-table3';
import chalk from 'chalk';

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Create status command
 */
export function createStatusCommand(): Command {
  const command = new Command('status')
    .description('Show indexing status and cache statistics')
    .option('-v, --verbose', 'Show detailed statistics')
    .action(async (options) => {
      try {
        const fileService = new FileService();

        // Get index statistics
        const stats = fileService.getStats();
        const cacheStats = fileService.getCacheStats();

        console.log(chalk.bold('\n📊 AutomatosX Status\n'));

        // Index Status Table
        const indexTable = new Table({
          head: [chalk.cyan('Index Metric'), chalk.cyan('Value')],
          colWidths: [25, 20],
        });

        indexTable.push(
          ['Files Indexed', chalk.green(stats.totalFiles.toLocaleString())],
          ['Symbols Extracted', chalk.yellow(stats.totalSymbols.toLocaleString())],
          ['Search Chunks', chalk.blue(stats.totalChunks.toLocaleString())],
          [
            'Avg Symbols/File',
            stats.totalFiles > 0
              ? chalk.gray((stats.totalSymbols / stats.totalFiles).toFixed(1))
              : chalk.gray('N/A')
          ]
        );

        console.log(chalk.bold('Index Status:'));
        console.log(indexTable.toString());

        // Symbols by Kind
        if (options.verbose && Object.keys(stats.symbolsByKind).length > 0) {
          console.log(chalk.bold('\nSymbols by Kind:'));
          const symbolTable = new Table({
            head: [chalk.cyan('Kind'), chalk.cyan('Count')],
            colWidths: [20, 15],
          });

          Object.entries(stats.symbolsByKind)
            .sort((a, b) => b[1] - a[1])
            .forEach(([kind, count]) => {
              symbolTable.push([kind, chalk.yellow(count.toLocaleString())]);
            });

          console.log(symbolTable.toString());
        }

        // Chunks by Type
        if (options.verbose && Object.keys(stats.chunksByType).length > 0) {
          console.log(chalk.bold('\nChunks by Type:'));
          const chunkTable = new Table({
            head: [chalk.cyan('Type'), chalk.cyan('Count')],
            colWidths: [20, 15],
          });

          Object.entries(stats.chunksByType)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
              chunkTable.push([type, chalk.blue(count.toLocaleString())]);
            });

          console.log(chunkTable.toString());
        }

        // Cache Statistics
        console.log(chalk.bold('\n⚡ Query Cache:'));
        const cacheTable = new Table({
          head: [chalk.cyan('Cache Metric'), chalk.cyan('Value')],
          colWidths: [25, 20],
        });

        const hitRateColor = cacheStats.hitRate > 0.5 ? chalk.green :
                            cacheStats.hitRate > 0.25 ? chalk.yellow :
                            chalk.red;

        cacheTable.push(
          ['Entries Cached', chalk.blue(cacheStats.size.toLocaleString())],
          ['Max Size', chalk.gray(cacheStats.maxSize.toLocaleString())],
          ['Utilization', chalk.gray(formatPercent(cacheStats.size / cacheStats.maxSize))],
          ['Cache Hits', chalk.green(cacheStats.hits.toLocaleString())],
          ['Cache Misses', chalk.red(cacheStats.misses.toLocaleString())],
          ['Hit Rate', hitRateColor(formatPercent(cacheStats.hitRate))],
          ['Evictions', chalk.yellow(cacheStats.evictions.toLocaleString())]
        );

        console.log(cacheTable.toString());

        // Performance insights
        if (cacheStats.hits + cacheStats.misses > 0) {
          console.log(chalk.bold('\n💡 Performance Insights:'));

          const totalQueries = cacheStats.hits + cacheStats.misses;
          const avgSpeedup = cacheStats.hitRate * 10; // Assume cache is ~10x faster

          console.log(chalk.gray(`  • Total queries: ${totalQueries.toLocaleString()}`));
          console.log(chalk.gray(`  • Estimated speedup: ${avgSpeedup.toFixed(1)}x faster with cache`));

          if (cacheStats.hitRate < 0.5) {
            console.log(chalk.yellow('  ⚠ Low hit rate - consider increasing cache size or TTL'));
          } else if (cacheStats.hitRate > 0.8) {
            console.log(chalk.green('  ✓ Excellent hit rate - cache is working well!'));
          } else {
            console.log(chalk.blue('  ℹ Good hit rate - cache is effective'));
          }

          if (cacheStats.evictions > 10) {
            console.log(chalk.yellow('  ⚠ High evictions - consider increasing cache maxSize'));
          }
        }

        // Recommendations
        if (stats.totalFiles === 0) {
          console.log(chalk.bold('\n📝 Quick Start:'));
          console.log(chalk.gray('  Run: ax index <directory>  to index your code'));
          console.log(chalk.gray('  Then: ax find <query>      to search'));
        } else if (stats.totalFiles < 10) {
          console.log(chalk.bold('\n📝 Tip:'));
          console.log(chalk.gray('  Index more files for better search coverage'));
        }

        console.log(); // Empty line for spacing
      } catch (error) {
        console.error(chalk.red('Error getting status:'), error);
        process.exit(1);
      }
    });

  return command;
}
