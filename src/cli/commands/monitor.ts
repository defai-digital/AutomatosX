/**
 * Monitoring CLI Commands
 *
 * Provides real-time monitoring, metrics visualization, alert management,
 * and cost analytics through the command line.
 *
 * Commands:
 * - ax monitor status: System health dashboard
 * - ax monitor metrics: Query and visualize metrics
 * - ax monitor alerts: Manage alerts and alert rules
 * - ax monitor costs: Cost analytics and budget tracking
 *
 * @module MonitorCommands
 */

import { Command } from 'commander';
import { MetricsCollector } from '../../services/MetricsCollector.js';
import { AlertManager } from '../../services/AlertManager.js';
import { CostAnalytics } from '../../services/CostAnalytics.js';
import { ChartRenderer } from '../utils/ChartRenderer.js';

// ============================================================================
// Main Monitor Command
// ============================================================================

export function createMonitorCommand(): Command {
  const monitor = new Command('monitor')
    .description('Monitor system health, metrics, alerts, and costs');

  // Subcommands
  registerStatusCommand(monitor);
  registerMetricsCommand(monitor);
  registerAlertsCommand(monitor);
  registerCostsCommand(monitor);

  return monitor;
}

export function registerMonitorCommands(program: Command): void {
  program.addCommand(createMonitorCommand());
}

// ============================================================================
// Status Command (ax monitor status)
// ============================================================================

function registerStatusCommand(monitor: Command): void {
  monitor
    .command('status')
    .description('Show real-time system health status')
    .option('-p, --provider <provider>', 'Filter by provider')
    .option('-v, --verbose', 'Show detailed metrics')
    .option('-j, --json', 'Output as JSON')
    .option('-w, --watch', 'Watch mode (refresh every 5s)')
    .action(async (options) => {
      try {
        if (options.watch) {
          await watchStatus(options);
        } else {
          await showStatus(options);
        }
      } catch (error: any) {
        console.error('Error showing status:', error.message);
        process.exit(1);
      }
    });
}

async function showStatus(options: any): Promise<void> {
  const collector = new MetricsCollector();
  const alertManager = new AlertManager(collector);

  // Get provider health
  const health = await collector.getProviderHealth();

  // Get active alerts
  const alerts = await alertManager.getAlerts({ state: 'firing' });

  // Get cache metrics
  const cacheStats = await collector.getAggregated({
    startTime: Date.now() - 60 * 60 * 1000, // Last hour
    metricType: 'cache',
  });

  // Get rate limit metrics
  const rateLimitStats = await collector.getAggregated({
    startTime: Date.now() - 60 * 60 * 1000,
    metricType: 'rate_limit',
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          providers: health,
          alerts: alerts.map((a) => ({
            id: a.id,
            severity: a.severity,
            message: `${a.ruleName}: ${a.currentValue} ${a.rule.operator} ${a.rule.threshold}`,
            startedAt: a.startedAt,
          })),
          cache: {
            hitRate: cacheStats.cacheHitRate || 0,
            savedCost: cacheStats.cacheSavedCost || 0,
          },
          rateLimit: {
            status: 'OK',
          },
        },
        null,
        2
      )
    );
    return;
  }

  // Render dashboard
  console.log(ChartRenderer.divider(60));
  console.log(
    ChartRenderer.box('Provider Health Status', { title: 'System Health' })
  );
  console.log(ChartRenderer.divider(60));
  console.log('');

  // Provider health
  for (const provider of health) {
    const statusIcon =
      provider.status === 'healthy'
        ? ChartRenderer.statusIndicator('ok', 'Healthy')
        : provider.status === 'degraded'
          ? ChartRenderer.statusIndicator('warning', 'Degraded')
          : ChartRenderer.statusIndicator('error', 'Down');

    console.log(`  ${provider.provider.padEnd(15)} ${statusIcon}`);

    if (options.verbose) {
      console.log(
        ChartRenderer.keyValue([
          {
            key: '    Latency (P95)',
            value: ChartRenderer.formatDuration(provider.p95Latency),
          },
          {
            key: '    Success Rate',
            value: ChartRenderer.formatPercentage(provider.successRate * 100),
          },
          {
            key: '    Cost (Today)',
            value: ChartRenderer.formatCurrency(provider.costToday),
          },
          {
            key: '    Requests (1h)',
            value: provider.requestsLastHour.toString(),
          },
        ])
      );
    } else {
      console.log(
        `    Latency: ${ChartRenderer.formatDuration(provider.p95Latency)} (p95)`
      );
      console.log(
        `    Success: ${ChartRenderer.formatPercentage(provider.successRate * 100)}`
      );
      console.log(
        `    Cost: ${ChartRenderer.formatCurrency(provider.costToday)} today`
      );
    }

    console.log('');
  }

  // Active alerts
  if (alerts.length > 0) {
    console.log(ChartRenderer.divider(60));
    console.log(`Active Alerts: ${alerts.length}`);
    for (const alert of alerts.slice(0, 5)) {
      const icon =
        alert.severity === 'critical'
          ? '🔴'
          : alert.severity === 'warning'
            ? '⚠️'
            : 'ℹ️';
      const duration = Math.floor((Date.now() - alert.startedAt) / 60000);
      console.log(
        `  ${icon} ${alert.severity.toUpperCase()}  ${alert.ruleName} (${duration}m ago)`
      );
      console.log(
        `    Condition: ${alert.rule.metric} ${alert.rule.operator} ${alert.rule.threshold}`
      );
      console.log(`    Current: ${alert.currentValue}`);
    }
    console.log('');
  }

  // Cache stats
  console.log(ChartRenderer.divider(60));
  console.log(
    `Cache Hit Rate: ${ChartRenderer.formatPercentage(cacheStats.cacheHitRate * 100 || 0)}`
  );

  if (cacheStats.cacheSavedCost > 0) {
    console.log(
      `Cache Savings: ${ChartRenderer.formatCurrency(cacheStats.cacheSavedCost)} (1h)`
    );
  }

  // Rate limit status
  console.log('Rate Limit Status: OK');
  console.log('');
}

async function watchStatus(options: any): Promise<void> {
  console.log('Watch mode enabled. Press Ctrl+C to exit.\n');

  const refresh = async () => {
    // Clear screen
    process.stdout.write('\x1Bc');

    await showStatus(options);

    console.log(`\nLast updated: ${new Date().toLocaleTimeString()}`);
  };

  // Initial refresh
  await refresh();

  // Refresh every 5 seconds
  setInterval(refresh, 5000);
}

// ============================================================================
// Metrics Command (ax monitor metrics)
// ============================================================================

function registerMetricsCommand(monitor: Command): void {
  monitor
    .command('metrics [metric]')
    .description('Query and visualize metrics')
    .option('-p, --provider <provider>', 'Filter by provider')
    .option('-m, --model <model>', 'Filter by model')
    .option('-r, --range <range>', 'Time range (e.g., 1h, 24h, 7d)', '1h')
    .option('-g, --group-by <field>', 'Group by field (provider, model)')
    .option('-f, --format <format>', 'Output format (table, chart, json)', 'table')
    .option('-q, --query <query>', 'Query expression (e.g., latency{provider="claude"} [1h] p95)')
    .action(async (metric, options) => {
      try {
        await showMetrics(metric, options);
      } catch (error: any) {
        console.error('Error showing metrics:', error.message);
        process.exit(1);
      }
    });
}

async function showMetrics(metric: string, options: any): Promise<void> {
  const collector = new MetricsCollector();

  // Parse time range
  const range = parseTimeRange(options.range);
  const startTime = Date.now() - range;
  const endTime = Date.now();

  // Get aggregated metrics
  const stats = await collector.getAggregated({
    startTime,
    endTime,
    provider: options.provider,
    model: options.model,
  });

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  // Display based on metric type
  if (!metric || metric === 'latency') {
    await showLatencyMetrics(collector, startTime, endTime, options);
  } else if (metric === 'cost') {
    await showCostMetrics(collector, startTime, endTime, options);
  } else if (metric === 'error_rate') {
    await showErrorMetrics(collector, startTime, endTime, options);
  } else {
    // Show all metrics
    console.log(ChartRenderer.divider(80));
    console.log('Metrics Summary\n');

    console.log(
      ChartRenderer.keyValue([
        {
          key: 'Total Requests',
          value: stats.totalRequests?.toString() || '0',
        },
        {
          key: 'Success Rate',
          value: ChartRenderer.formatPercentage((stats.successRate || 0) * 100),
        },
        {
          key: 'Avg Latency',
          value: ChartRenderer.formatDuration(stats.avgLatency || 0),
        },
        {
          key: 'P95 Latency',
          value: ChartRenderer.formatDuration(stats.p95Latency || 0),
        },
        {
          key: 'P99 Latency',
          value: ChartRenderer.formatDuration(stats.p99Latency || 0),
        },
        {
          key: 'Total Cost',
          value: ChartRenderer.formatCurrency(stats.totalCost || 0),
        },
        {
          key: 'Cache Hit Rate',
          value: ChartRenderer.formatPercentage((stats.cacheHitRate || 0) * 100),
        },
      ])
    );
  }
}

async function showLatencyMetrics(
  collector: MetricsCollector,
  startTime: number,
  endTime: number,
  options: any
): Promise<void> {
  // Get time series data
  const buckets = await collector.getTimeSeries('5min', {
    startTime,
    endTime,
    provider: options.provider,
    model: options.model,
  });

  const latencyData = buckets.map((b) => b.avgLatency || 0);

  if (options.format === 'chart') {
    console.log(
      ChartRenderer.lineChart(latencyData, {
        title: `Latency - Last ${options.range}${options.provider ? ` (${options.provider})` : ''}`,
        height: 12,
        width: 60,
        yLabel: 'Latency (ms)',
        xLabel: 'Time',
      })
    );

    // Summary stats
    const stats = await collector.getAggregated({
      startTime,
      endTime,
      provider: options.provider,
    });

    console.log('\nSummary:');
    console.log(
      ChartRenderer.keyValue([
        { key: 'P50', value: ChartRenderer.formatDuration(stats.p50Latency || 0) },
        { key: 'P95', value: ChartRenderer.formatDuration(stats.p95Latency || 0) },
        { key: 'P99', value: ChartRenderer.formatDuration(stats.p99Latency || 0) },
        { key: 'Avg', value: ChartRenderer.formatDuration(stats.avgLatency || 0) },
        { key: 'Min', value: ChartRenderer.formatDuration(stats.minLatency || 0) },
        { key: 'Max', value: ChartRenderer.formatDuration(stats.maxLatency || 0) },
      ])
    );
  } else {
    // Show sparkline
    console.log(`Latency Trend: ${ChartRenderer.sparkline(latencyData)}`);
  }
}

async function showCostMetrics(
  collector: MetricsCollector,
  startTime: number,
  endTime: number,
  options: any
): Promise<void> {
  const stats = await collector.getAggregated({
    startTime,
    endTime,
    provider: options.provider,
  });

  console.log(ChartRenderer.divider(80));
  console.log(`Cost Metrics - Last ${options.range}\n`);

  console.log(
    ChartRenderer.keyValue([
      {
        key: 'Total Cost',
        value: ChartRenderer.formatCurrency(stats.totalCost || 0),
      },
      {
        key: 'Avg Cost/Request',
        value: ChartRenderer.formatCurrency(stats.avgCostPerRequest || 0),
      },
      {
        key: 'Total Tokens',
        value: (stats.totalTokens || 0).toLocaleString(),
      },
    ])
  );
}

async function showErrorMetrics(
  collector: MetricsCollector,
  startTime: number,
  endTime: number,
  options: any
): Promise<void> {
  const stats = await collector.getAggregated({
    startTime,
    endTime,
    provider: options.provider,
  });

  const errorRate = 1 - (stats.successRate || 1);

  console.log(ChartRenderer.divider(80));
  console.log(`Error Metrics - Last ${options.range}\n`);

  console.log(
    ChartRenderer.keyValue([
      {
        key: 'Total Requests',
        value: (stats.totalRequests || 0).toString(),
      },
      {
        key: 'Successful',
        value: (stats.successfulRequests || 0).toString(),
      },
      {
        key: 'Failed',
        value: (stats.failedRequests || 0).toString(),
      },
      {
        key: 'Error Rate',
        value: ChartRenderer.formatPercentage(errorRate * 100),
      },
    ])
  );
}

// ============================================================================
// Alerts Command (ax monitor alerts)
// ============================================================================

function registerAlertsCommand(monitor: Command): void {
  const alerts = monitor
    .command('alerts')
    .description('Manage alerts and alert rules');

  // Subcommands
  alerts
    .command('list')
    .description('List active alerts')
    .option('-r, --resolved', 'Show resolved alerts')
    .option('-s, --severity <severity>', 'Filter by severity')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        await listAlerts(options);
      } catch (error: any) {
        console.error('Error listing alerts:', error.message);
        process.exit(1);
      }
    });

  alerts
    .command('rules')
    .description('List alert rules')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        await listAlertRules(options);
      } catch (error: any) {
        console.error('Error listing alert rules:', error.message);
        process.exit(1);
      }
    });

  alerts
    .command('ack <alertId>')
    .description('Acknowledge an alert')
    .option('-u, --user <user>', 'Acknowledging user')
    .action(async (alertId, options) => {
      try {
        await acknowledgeAlert(alertId, options);
      } catch (error: any) {
        console.error('Error acknowledging alert:', error.message);
        process.exit(1);
      }
    });

  alerts
    .command('disable <ruleId>')
    .description('Disable an alert rule')
    .action(async (ruleId) => {
      try {
        await disableAlertRule(ruleId);
      } catch (error: any) {
        console.error('Error disabling alert rule:', error.message);
        process.exit(1);
      }
    });
}

async function listAlerts(options: any): Promise<void> {
  const collector = new MetricsCollector();
  const alertManager = new AlertManager(collector);

  const state = options.resolved ? 'resolved' : 'firing';
  const alerts = await alertManager.getAlerts({
    state,
    severity: options.severity,
  });

  if (options.json) {
    console.log(JSON.stringify(alerts, null, 2));
    return;
  }

  if (alerts.length === 0) {
    console.log(`No ${state} alerts found.`);
    return;
  }

  console.log(ChartRenderer.divider(80));
  console.log(`${state.charAt(0).toUpperCase() + state.slice(1)} Alerts (${alerts.length}):\n`);

  for (const alert of alerts) {
    const icon =
      alert.severity === 'critical'
        ? '🔴'
        : alert.severity === 'warning'
          ? '⚠️'
          : 'ℹ️';
    const duration = Math.floor((Date.now() - alert.startedAt) / 60000);

    console.log(
      `  ${icon} ${alert.severity.toUpperCase()}  ${alert.ruleName}`
    );
    console.log(`    ID: ${alert.id}`);
    console.log(`    Started: ${duration}m ago`);
    console.log(
      `    Condition: ${alert.rule.metric} ${alert.rule.operator} ${alert.rule.threshold}`
    );
    console.log(`    Current: ${alert.currentValue}`);

    if (alert.state === 'acknowledged') {
      console.log(
        `    Acknowledged: ${alert.acknowledgedBy || 'unknown'} at ${new Date(alert.acknowledgedAt!).toLocaleString()}`
      );
    }

    console.log('');
  }
}

async function listAlertRules(options: any): Promise<void> {
  const collector = new MetricsCollector();
  const alertManager = new AlertManager(collector);

  const rules = await alertManager.getRules();

  if (options.json) {
    console.log(JSON.stringify(rules, null, 2));
    return;
  }

  console.log(ChartRenderer.divider(80));
  console.log(`Alert Rules (${rules.length}):\n`);

  for (const rule of rules) {
    const status = rule.enabled
      ? ChartRenderer.statusIndicator('ok', 'enabled')
      : ChartRenderer.statusIndicator('info', 'disabled');

    console.log(`  ${status}  ${rule.name}`);
    console.log(`    ID: ${rule.id}`);
    console.log(`    Description: ${rule.description || 'N/A'}`);
    console.log(
      `    Condition: ${rule.metric} ${rule.operator} ${rule.threshold} for ${rule.durationSeconds}s`
    );
    console.log(`    Severity: ${rule.severity}`);
    console.log('');
  }
}

async function acknowledgeAlert(alertId: string, options: any): Promise<void> {
  const collector = new MetricsCollector();
  const alertManager = new AlertManager(collector);

  await alertManager.acknowledgeAlert(alertId, options.user);

  console.log(
    ChartRenderer.statusIndicator('ok', `Alert ${alertId} acknowledged`)
  );
}

async function disableAlertRule(ruleId: string): Promise<void> {
  const collector = new MetricsCollector();
  const alertManager = new AlertManager(collector);

  const rule = await alertManager.getRule(ruleId);
  if (!rule) {
    console.error(`Alert rule not found: ${ruleId}`);
    process.exit(1);
  }

  await alertManager.saveRule({ ...rule, enabled: false });

  console.log(
    ChartRenderer.statusIndicator('ok', `Alert rule ${rule.name} disabled`)
  );
}

// ============================================================================
// Costs Command (ax monitor costs)
// ============================================================================

function registerCostsCommand(monitor: Command): void {
  monitor
    .command('costs')
    .description('Cost analytics and budget tracking')
    .option('-r, --range <range>', 'Time range (e.g., 30d, 7d)', '30d')
    .option('-b, --by <field>', 'Group by field (provider, model)', 'provider')
    .option('-p, --projection', 'Show cost projections')
    .option('-B, --budget', 'Compare to budget')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        await showCosts(options);
      } catch (error: any) {
        console.error('Error showing costs:', error.message);
        process.exit(1);
      }
    });
}

async function showCosts(options: any): Promise<void> {
  const analytics = new CostAnalytics();

  // Parse time range
  const range = parseTimeRange(options.range);
  const startTime = Date.now() - range;
  const endTime = Date.now();

  // Get cost summary
  const summary = await analytics.getSummary({
    startTime,
    endTime,
  });

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Display header
  console.log(ChartRenderer.divider(80));
  console.log(
    ChartRenderer.box('Cost Analytics', {
      title: `Last ${options.range}`,
    })
  );
  console.log(ChartRenderer.divider(80));
  console.log('');

  // Summary
  console.log(
    ChartRenderer.keyValue([
      {
        key: 'Total Spend',
        value: ChartRenderer.formatCurrency(summary.totalCost),
      },
      {
        key: 'Total Requests',
        value: summary.totalRequests.toLocaleString(),
      },
      {
        key: 'Avg Cost/Request',
        value: ChartRenderer.formatCurrency(summary.avgCostPerRequest),
      },
      {
        key: 'Total Tokens',
        value: summary.totalTokens.toLocaleString(),
      },
    ])
  );
  console.log('');

  // Breakdown by provider or model
  const breakdown = options.by === 'model' ? summary.byModel : summary.byProvider;

  if (breakdown.length > 0) {
    console.log(`By ${options.by.charAt(0).toUpperCase() + options.by.slice(1)}:\n`);

    console.log(
      ChartRenderer.barChart(
        breakdown.map((item) => ({
          label: (item.provider || item.model || 'unknown').substring(0, 20),
          value: item.cost,
          color: 'cyan',
        })),
        {
          width: 80,
          maxBarWidth: 40,
          showPercentage: true,
          showValue: true,
        }
      )
    );
    console.log('');
  }

  // Show cost projection if requested
  if (options.projection) {
    console.log(ChartRenderer.divider(80));
    console.log('Cost Projection:\n');

    const projection = await analytics.getProjection('monthly');

    console.log(
      ChartRenderer.keyValue([
        {
          key: 'Current Spend',
          value: ChartRenderer.formatCurrency(projection.currentSpend),
        },
        {
          key: 'Projected (Monthly)',
          value: ChartRenderer.formatCurrency(projection.estimate),
        },
        {
          key: 'Low Estimate',
          value: ChartRenderer.formatCurrency(projection.lowEstimate),
        },
        {
          key: 'High Estimate',
          value: ChartRenderer.formatCurrency(projection.highEstimate),
        },
        {
          key: 'Confidence',
          value: ChartRenderer.formatPercentage(projection.confidence * 100),
        },
        {
          key: 'Days Remaining',
          value: projection.daysRemaining.toString(),
        },
      ])
    );
    console.log('');
  }

  // Show budget comparison if requested
  if (options.budget) {
    const budgets = await analytics.getBudgets(true);

    if (budgets.length > 0) {
      console.log(ChartRenderer.divider(80));
      console.log('Budget Status:\n');

      for (const budget of budgets) {
        const status = await analytics.getBudgetStatus(budget.id);

        console.log(`  ${budget.name}:`);
        console.log(
          `    ${ChartRenderer.progressBar(status.currentSpend, budget.limitAmount, { width: 40, showPercentage: true })}`
        );
        console.log(
          `    ${ChartRenderer.formatCurrency(status.currentSpend)} / ${ChartRenderer.formatCurrency(budget.limitAmount)} (${status.percentUsed.toFixed(1)}%)`
        );

        if (status.projectedOverage > 0) {
          console.log(
            `    ${ChartRenderer.statusIndicator('warning', `Projected to exceed by ${ChartRenderer.formatCurrency(status.projectedOverage)}`)}`
          );
        }

        console.log('');
      }
    }
  }

  // Show optimization recommendations
  const recommendations = await analytics.getOptimizationRecommendations();

  if (recommendations.length > 0) {
    console.log(ChartRenderer.divider(80));
    console.log('Recommendations:\n');

    for (const rec of recommendations.slice(0, 3)) {
      console.log(
        `  • ${rec.title} (save ${ChartRenderer.formatCurrency(rec.estimatedSavings)}/month)`
      );
      console.log(`    ${rec.description}`);
      console.log(`    Effort: ${rec.effort}, Priority: ${rec.priority}`);
      console.log('');
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseTimeRange(range: string): number {
  const match = range.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time range: ${range}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}
