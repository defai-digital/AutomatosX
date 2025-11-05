/**
 * Provider Transparency
 *
 * Shows routing decisions and provider selection inline
 * to help users understand cost and performance trade-offs.
 *
 * Phase 5 P2: Provider transparency
 */

import chalk from 'chalk';

export interface ProviderRoute {
  selectedProvider: string;
  reason: string;
  alternatives: AlternativeProvider[];
  estimatedCost?: number;
  estimatedLatency?: number;
  policyMode?: string;
  constraints?: string[];
}

export interface AlternativeProvider {
  provider: string;
  reason: string;
  costDiff?: number;
  latencyDiff?: number;
  available: boolean;
}

export interface ProviderMetrics {
  provider: string;
  requestCount: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  lastUsed: Date;
}

/**
 * Render provider routing decision
 */
export function renderProviderRoute(route: ProviderRoute, options: { compact?: boolean } = {}): string {
  const { compact = false } = options;

  const lines: string[] = [];

  if (compact) {
    // Compact inline format
    const icon = getProviderIcon(route.selectedProvider);
    const provider = chalk.cyan(route.selectedProvider);
    const reason = chalk.dim(`(${route.reason})`);
    const cost = route.estimatedCost
      ? chalk.green(` $${route.estimatedCost.toFixed(4)}`)
      : '';

    lines.push(`${icon} ${provider} ${reason}${cost}`);
  } else {
    // Detailed format
    lines.push('');
    lines.push(chalk.bold.cyan('Provider Routing Decision'));
    lines.push('');

    // Selected provider
    const icon = getProviderIcon(route.selectedProvider);
    lines.push(`${icon} ${chalk.bold.green('Selected:')} ${chalk.white(route.selectedProvider)}`);
    lines.push(`   ${chalk.dim('Reason:')} ${chalk.white(route.reason)}`);

    if (route.estimatedCost !== undefined) {
      lines.push(`   ${chalk.dim('Est. Cost:')} ${chalk.green(`$${route.estimatedCost.toFixed(4)}`)}`);
    }

    if (route.estimatedLatency !== undefined) {
      lines.push(`   ${chalk.dim('Est. Latency:')} ${chalk.yellow(`${route.estimatedLatency}ms`)}`);
    }

    if (route.policyMode) {
      lines.push(`   ${chalk.dim('Policy:')} ${chalk.cyan(route.policyMode)}`);
    }

    if (route.constraints && route.constraints.length > 0) {
      lines.push(`   ${chalk.dim('Constraints:')} ${route.constraints.map(c => chalk.yellow(c)).join(', ')}`);
    }

    // Alternatives
    if (route.alternatives.length > 0) {
      lines.push('');
      lines.push(chalk.bold.yellow('Alternatives:'));

      route.alternatives.forEach(alt => {
        const altIcon = getProviderIcon(alt.provider);
        const status = alt.available ? chalk.green('✓') : chalk.red('✗');

        lines.push(`  ${status} ${altIcon} ${chalk.white(alt.provider)}`);
        lines.push(`     ${chalk.dim(alt.reason)}`);

        if (alt.costDiff !== undefined) {
          const sign = alt.costDiff > 0 ? '+' : '';
          const color = alt.costDiff > 0 ? chalk.red : chalk.green;
          lines.push(`     ${chalk.dim('Cost:')} ${color(`${sign}$${Math.abs(alt.costDiff).toFixed(4)}`)}`);
        }

        if (alt.latencyDiff !== undefined) {
          const sign = alt.latencyDiff > 0 ? '+' : '';
          const color = alt.latencyDiff > 0 ? chalk.red : chalk.green;
          lines.push(`     ${chalk.dim('Latency:')} ${color(`${sign}${Math.abs(alt.latencyDiff)}ms`)}`);
        }
      });
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render provider metrics summary
 */
export function renderProviderMetrics(metrics: ProviderMetrics[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Provider Usage Summary'));
  lines.push('');

  if (metrics.length === 0) {
    lines.push(chalk.dim('No provider usage data'));
    lines.push('');
    return lines.join('\n');
  }

  // Header
  lines.push(chalk.dim('Provider         Requests  Cost      Avg Latency  Success  Last Used'));
  lines.push(chalk.dim('─'.repeat(75)));

  // Metrics
  metrics.forEach(metric => {
    const icon = getProviderIcon(metric.provider);
    const provider = metric.provider.padEnd(15);
    const requests = metric.requestCount.toString().padStart(8);
    const cost = `$${metric.totalCost.toFixed(2)}`.padStart(9);
    const latency = `${metric.avgLatency.toFixed(0)}ms`.padStart(11);
    const success = `${(metric.successRate * 100).toFixed(0)}%`.padStart(7);
    const lastUsed = formatRelativeTime(metric.lastUsed).padStart(10);

    lines.push(
      `${icon} ${chalk.white(provider)} ${chalk.cyan(requests)} ${chalk.green(cost)} ${chalk.yellow(latency)} ${chalk.green(success)} ${chalk.dim(lastUsed)}`
    );
  });

  // Totals
  const totalRequests = metrics.reduce((sum, m) => sum + m.requestCount, 0);
  const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);
  const avgSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length;

  lines.push(chalk.dim('─'.repeat(75)));
  lines.push(
    `${chalk.bold.white('Total')}            ${chalk.cyan(totalRequests.toString().padStart(8))} ${chalk.green(`$${totalCost.toFixed(2)}`.padStart(9))}                   ${chalk.green(`${(avgSuccessRate * 100).toFixed(0)}%`.padStart(7))}`
  );

  lines.push('');
  return lines.join('\n');
}

/**
 * Render inline routing notification
 */
export function renderInlineRoutingNotification(route: ProviderRoute): string {
  const icon = getProviderIcon(route.selectedProvider);
  const provider = chalk.cyan(route.selectedProvider);
  const reason = chalk.dim(route.reason);

  return `${icon} Routing to ${provider} ${reason}`;
}

/**
 * Render cost comparison
 */
export function renderCostComparison(routes: Array<{ provider: string; cost: number; reason?: string }>): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.yellow('Cost Comparison'));
  lines.push('');

  // Sort by cost
  const sorted = [...routes].sort((a, b) => a.cost - b.cost);

  sorted.forEach((route, idx) => {
    const icon = getProviderIcon(route.provider);
    const rank = idx === 0 ? chalk.green('★') : chalk.dim(`${idx + 1}.`);
    const provider = chalk.white(route.provider);
    const cost = chalk.green(`$${route.cost.toFixed(4)}`);
    const reason = route.reason ? chalk.dim(` - ${route.reason}`) : '';

    lines.push(`  ${rank} ${icon} ${provider}: ${cost}${reason}`);
  });

  // Savings
  if (sorted.length > 1) {
    const lastItem = sorted[sorted.length - 1];
    const firstItem = sorted[0];
    if (lastItem && firstItem) {
      const savings = lastItem.cost - firstItem.cost;
      lines.push('');
      lines.push(`  ${chalk.dim('Potential savings:')} ${chalk.green(`$${savings.toFixed(4)}`)} ${chalk.dim(`(${((savings / lastItem.cost) * 100).toFixed(0)}%)`)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Render provider health status
 */
export function renderProviderHealth(providers: Array<{ provider: string; available: boolean; latency?: number; errorRate?: number }>): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Provider Health Status'));
  lines.push('');

  providers.forEach(p => {
    const icon = getProviderIcon(p.provider);
    const status = p.available ? chalk.green('● Online') : chalk.red('● Offline');
    const latency = p.latency ? chalk.dim(` ${p.latency}ms`) : '';
    const errorRate = p.errorRate !== undefined
      ? chalk.dim(` (${(p.errorRate * 100).toFixed(1)}% errors)`)
      : '';

    lines.push(`  ${icon} ${chalk.white(p.provider.padEnd(15))} ${status}${latency}${errorRate}`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Get provider icon
 */
function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    'claude': '🤖',
    'claude-code': '💻',
    'gemini': '✨',
    'gemini-cli': '🔷',
    'openai': '🟢',
    'codex': '📝',
    'gpt-4': '🧠'
  };

  return icons[provider.toLowerCase()] || '🔌';
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'now';
}

/**
 * Create routing decision from router trace
 */
export function createRouteFromTrace(trace: {
  selectedProvider: string;
  reason: string;
  candidates?: Array<{ provider: string; score: number; available: boolean }>;
  estimatedCost?: number;
  estimatedLatency?: number;
  policyMode?: string;
}): ProviderRoute {
  const alternatives: AlternativeProvider[] = [];

  if (trace.candidates) {
    trace.candidates
      .filter(c => c.provider !== trace.selectedProvider)
      .forEach(c => {
        alternatives.push({
          provider: c.provider,
          reason: c.available ? `Score: ${c.score.toFixed(2)}` : 'Unavailable',
          available: c.available
        });
      });
  }

  return {
    selectedProvider: trace.selectedProvider,
    reason: trace.reason,
    alternatives,
    estimatedCost: trace.estimatedCost,
    estimatedLatency: trace.estimatedLatency,
    policyMode: trace.policyMode
  };
}

/**
 * Track provider usage
 */
export class ProviderUsageTracker {
  private metrics: Map<string, ProviderMetrics> = new Map();

  /**
   * Record provider usage
   */
  recordUsage(provider: string, cost: number, latency: number, success: boolean): void {
    const existing = this.metrics.get(provider);

    if (existing) {
      existing.requestCount++;
      existing.totalCost += cost;
      existing.avgLatency = (existing.avgLatency * (existing.requestCount - 1) + latency) / existing.requestCount;
      existing.successRate = (existing.successRate * (existing.requestCount - 1) + (success ? 1 : 0)) / existing.requestCount;
      existing.lastUsed = new Date();
    } else {
      this.metrics.set(provider, {
        provider,
        requestCount: 1,
        totalCost: cost,
        avgLatency: latency,
        successRate: success ? 1 : 0,
        lastUsed: new Date()
      });
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics for specific provider
   */
  getProviderMetrics(provider: string): ProviderMetrics | undefined {
    return this.metrics.get(provider);
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}
