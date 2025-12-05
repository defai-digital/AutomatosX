/**
 * Analytics Command - View usage analytics and optimization recommendations
 *
 * Phase 4 (v6.1.0): Observability, Analytics & Optimization
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { getTelemetryCollector } from '../../core/telemetry/TelemetryCollector.js';
import { getAnalyticsAggregator } from '../../core/analytics/AnalyticsAggregator.js';
import { getOptimizationAnalyzer } from '../../core/analytics/OptimizationAnalyzer.js';
import { loadConfig } from '../../core/config/loader.js';
import { logger } from '../../shared/logging/logger.js';
import { printError } from '../../shared/errors/error-formatter.js';
import type { TimePeriod } from '../../types/telemetry.js';
import type { TelemetryCollector } from '../../core/telemetry/TelemetryCollector.js';

interface AnalyticsOptions {
  period?: TimePeriod;
  provider?: string;
  format?: 'text' | 'json';
  verbose?: boolean;
}

export const analyticsCommand: CommandModule<Record<string, unknown>, any> = {
  command: 'analytics <subcommand>',
  describe: 'View usage analytics and optimization recommendations (v6.1.0)',

  builder: (yargs) => {
    return yargs
      .command('summary', 'Show analytics summary', {}, summaryHandler as any)
      .command('optimize', 'Show cost optimization recommendations', {}, optimizeHandler as any)
      .command('clear', 'Clear all telemetry data', {}, clearHandler as any)
      .command('status', 'Show telemetry status', {}, statusHandler as any)
      .option('period', {
        describe: 'Time period',
        type: 'string',
        default: '7d' as TimePeriod,
        choices: ['24h', '7d', '30d', 'all']
      })
      .option('provider', {
        describe: 'Filter by provider',
        type: 'string'
      })
      .option('format', {
        describe: 'Output format',
        type: 'string',
        default: 'text',
        choices: ['text', 'json']
      })
      .demandCommand(1, 'Please specify a subcommand (summary, optimize, clear, status)')
      .example('$0 analytics summary', 'Show 7-day analytics summary')
      .example('$0 analytics summary --period 30d', 'Show 30-day summary')
      .example('$0 analytics optimize', 'Show optimization recommendations')
      .example('$0 analytics clear', 'Clear all telemetry data');
  },

  handler: async () => {
    // Subcommand will handle
  }
};

/**
 * Summary subcommand handler
 */
async function summaryHandler(argv: AnalyticsOptions) {
  let telemetry: TelemetryCollector | undefined;
  try {
    // Load config and get telemetry settings
    const config = await loadConfig(process.cwd());
    const telemetryConfig = config.telemetry || { enabled: false };

    // Override enabled to true for analytics commands
    // (users explicitly requesting analytics need telemetry enabled)
    telemetry = getTelemetryCollector({
      ...telemetryConfig,
      enabled: true
    });
    const analytics = getAnalyticsAggregator(telemetry);

    const timeRange = parseTimePeriod(argv.period || '7d');
    const summary = await analytics.generateSummary({
      startDate: timeRange.startDate,
      endDate: timeRange.endDate,
      provider: argv.provider
    });

    if (argv.format === 'json') {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    // Text format
    console.log(chalk.bold.cyan('\n📊 AutomatosX Analytics Summary\n'));
    console.log(chalk.dim(`Period: ${formatPeriod(argv.period || '7d')}`));
    if (argv.provider) {
      console.log(chalk.dim(`Provider filter: ${argv.provider}`));
    }
    console.log();

    // Executions
    console.log(chalk.bold('Executions'));
    console.log(`  Total: ${summary.executions.total}`);
    console.log(`  Successful: ${chalk.green(summary.executions.successful)}`);
    console.log(`  Failed: ${chalk.red(summary.executions.failed)}`);
    console.log(`  Success Rate: ${formatPercentage(summary.executions.successRate)}\n`);

    // Performance
    console.log(chalk.bold('Performance'));
    console.log(`  Avg Latency: ${formatDuration(summary.performance.avgLatencyMs)}`);
    console.log(`  P50 Latency: ${formatDuration(summary.performance.p50LatencyMs)}`);
    console.log(`  P95 Latency: ${formatDuration(summary.performance.p95LatencyMs)}`);
    console.log(`  P99 Latency: ${formatDuration(summary.performance.p99LatencyMs)}\n`);

    // Costs
    console.log(chalk.bold('Costs'));
    console.log(`  Total: ${formatCost(summary.costs.totalUsd)}`);
    console.log(`  Avg per Request: ${formatCost(summary.costs.avgCostPerRequest)}\n`);

    if (Object.keys(summary.costs.byProvider).length > 0) {
      console.log(chalk.bold('  By Provider:'));
      for (const [provider, cost] of Object.entries(summary.costs.byProvider)) {
        const percentage = summary.costs.totalUsd > 0 ? (cost / summary.costs.totalUsd) * 100 : 0;
        console.log(`    ${provider}: ${formatCost(cost)} (${formatPercentage(percentage)})`);
      }
      console.log();
    }

    // Top Agents
    if (summary.topAgents.length > 0) {
      console.log(chalk.bold('Top Agents'));
      for (const agent of summary.topAgents.slice(0, 5)) {
        console.log(`  ${agent.name}:`);
        console.log(`    Executions: ${agent.executionCount}`);
        console.log(`    Total Cost: ${formatCost(agent.totalCost)}`);
        console.log(`    Avg Latency: ${formatDuration(agent.avgLatency)}`);
      }
      console.log();
    }

  } catch (error) {
    printError(error, {
      verbose: argv.verbose || false,
      showCode: true,
      showSuggestions: true,
      colors: true
    });
    logger.error('Analytics summary failed', { error: (error as Error).message });
    process.exit(1);
  } finally {
    await telemetry?.close();
  }
}

/**
 * Optimize subcommand handler
 */
async function optimizeHandler(argv: AnalyticsOptions) {
  let telemetry: TelemetryCollector | undefined;
  try {
    // Load config and get telemetry settings
    const config = await loadConfig(process.cwd());
    const telemetryConfig = config.telemetry || { enabled: false };

    telemetry = getTelemetryCollector({
      ...telemetryConfig,
      enabled: true
    });
    const analytics = getAnalyticsAggregator(telemetry);
    const optimizer = getOptimizationAnalyzer(analytics, telemetry);

    const timeRange = parseTimePeriod(argv.period || '7d');
    const recommendations = await optimizer.analyze({
      start: timeRange.startDate,
      end: timeRange.endDate,
      provider: argv.provider
    });

    if (argv.format === 'json') {
      console.log(JSON.stringify(recommendations, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n💡 Optimization Recommendations\n'));
    console.log(chalk.dim(`Period: ${formatPeriod(argv.period || '7d')}`));
    if (argv.provider) {
      console.log(chalk.dim(`Provider filter: ${argv.provider}`));
    }
    console.log();

    if (recommendations.length === 0) {
      console.log(chalk.green('✅ No optimization opportunities found. You\'re doing great!\n'));
      return;
    }

    const TYPE_ICONS: Record<string, string> = { cost_saving: '💰', performance: '⚡', security: '🔒' };
    const SEVERITY_COLORS: Record<string, typeof chalk.red> = { high: chalk.red, medium: chalk.yellow, low: chalk.gray };
    for (const rec of recommendations) {
      const icon = TYPE_ICONS[rec.type] ?? '🔒';
      const severityColor = SEVERITY_COLORS[rec.severity] ?? chalk.gray;

      console.log(`${icon} ${severityColor(rec.severity.toUpperCase())}: ${chalk.bold(rec.title)}`);
      console.log(`   ${rec.description}`);

      if (rec.estimatedSavings) {
        console.log(chalk.green(`   💵 Potential Savings: ${formatCost(rec.estimatedSavings.costUsd)} (${rec.estimatedSavings.percentageReduction}% reduction)`));
      }

      if (rec.estimatedImprovement) {
        console.log(chalk.cyan(`   📈 Estimated Improvement: ${rec.estimatedImprovement.improvement}${rec.estimatedImprovement.unit} ${rec.estimatedImprovement.metric}`));
      }

      console.log(chalk.dim('   Actions:'));
      for (const action of rec.actions) {
        console.log(chalk.dim(`     • ${action}`));
      }
      console.log();
    }

  } catch (error) {
    printError(error, {
      verbose: argv.verbose || false,
      showCode: true,
      showSuggestions: true,
      colors: true
    });
    logger.error('Optimization analysis failed', { error: (error as Error).message });
    process.exit(1);
  } finally {
    await telemetry?.close();
  }
}

/**
 * Clear subcommand handler
 */
async function clearHandler(argv: AnalyticsOptions) {
  let telemetry: TelemetryCollector | undefined;
  try {
    // Load config and get telemetry settings
    const config = await loadConfig(process.cwd());
    const telemetryConfig = config.telemetry || { enabled: false };

    telemetry = getTelemetryCollector({
      ...telemetryConfig,
      enabled: true
    });

    console.log(chalk.yellow('\n⚠️  This will delete all telemetry data.\n'));

    const { default: inquirer } = await import('inquirer');
    const answers = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to clear all analytics data?',
      default: false
    }]);

    if (!answers.confirm) {
      console.log(chalk.yellow('❌ Cancelled\n'));
      return;
    }

    await telemetry.clear();
    console.log(chalk.green('✅ All telemetry data cleared\n'));

  } catch (error) {
    printError(error, {
      verbose: argv.verbose || false,
      showCode: true,
      showSuggestions: true,
      colors: true
    });
    logger.error('Clear telemetry failed', { error: (error as Error).message });
    process.exit(1);
  } finally {
    await telemetry?.close();
  }
}

/**
 * Status subcommand handler
 */
async function statusHandler(argv: AnalyticsOptions) {
  let telemetry: TelemetryCollector | undefined;
  try {
    // Load config and get telemetry settings
    const config = await loadConfig(process.cwd());
    const telemetryConfig = config.telemetry || { enabled: false };

    telemetry = getTelemetryCollector({
      ...telemetryConfig,
      enabled: true
    });
    const stats = telemetry.getStats();

    console.log(chalk.bold.cyan('\n📊 Telemetry Status\n'));

    console.log(chalk.bold('Database'));
    console.log(`  Total Events: ${stats.totalEvents.toLocaleString()}`);
    console.log(`  Database Size: ${formatBytes(stats.databaseSizeBytes)}`);

    if (stats.oldestEvent) {
      const oldest = new Date(stats.oldestEvent);
      console.log(`  Oldest Event: ${oldest.toLocaleDateString()} ${oldest.toLocaleTimeString()}`);
    }

    if (stats.newestEvent) {
      const newest = new Date(stats.newestEvent);
      console.log(`  Newest Event: ${newest.toLocaleDateString()} ${newest.toLocaleTimeString()}`);
    }

    console.log();

  } catch (error) {
    printError(error, {
      verbose: argv.verbose || false,
      showCode: true,
      showSuggestions: true,
      colors: true
    });
    logger.error('Telemetry status failed', { error: (error as Error).message });
    process.exit(1);
  } finally {
    await telemetry?.close();
  }
}

/**
 * Parse time period into timestamp range
 */
function parseTimePeriod(period: TimePeriod): { startDate: number; endDate: number } {
  const now = Date.now();
  let startDate: number;

  switch (period) {
    case '24h':
      startDate = now - (24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = now - (7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = now - (30 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      startDate = 0;
      break;
    default:
      startDate = now - (7 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate: now };
}

/**
 * Format time period for display
 */
function formatPeriod(period: TimePeriod): string {
  switch (period) {
    case '24h': return 'Last 24 hours';
    case '7d': return 'Last 7 days';
    case '30d': return 'Last 30 days';
    case 'all': return 'All time';
    default: return 'Last 7 days';
  }
}

/**
 * Format cost in USD
 */
function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

/**
 * Format percentage
 */
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
