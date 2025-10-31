/**
 * Provider Analytics System
 *
 * Tracks provider executions, costs, performance, and routing decisions.
 * Enables cost optimization analysis and routing validation.
 *
 * @module core/analytics/provider-analytics
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { logger } from '@/utils/logger.js';

export interface ProviderExecutionEvent {
  provider: string;
  operation: 'execute' | 'stream' | 'embed';
  request: {
    prompt: string;
    model?: string;
    streaming?: boolean;
    parameters?: Record<string, any>;
  };
  response: {
    success: boolean;
    latencyMs: number;
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
    };
    costUsd: number;
    error?: string;
  };
  routing: {
    reason: string;
    alternatives: Array<{ provider: string; reason: string }>;
    optimal: boolean;
  };
  featureFlags?: Record<string, boolean>;
  timestamp: number;
}

export interface CostReport {
  totalSpent: number;
  optimalSpend: number;
  wastedUsd: number;
  wastedPercentage: number;
  breakdown: Array<{
    category: string;
    spent: number;
    optimal: number;
    wasted: number;
    topWasteReasons: Array<{ reason: string; cost: number }>;
  }>;
}

export interface RoutingAudit {
  totalRequests: number;
  optimalRoutes: number;
  suboptimalRoutes: number;
  issues: Array<{
    pattern: string;
    occurrences: number;
    costImpact: number;
    recommendation: string;
  }>;
}

export interface ProviderMetrics {
  totalRequests: number;
  successRate: number;
  errorRate: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalCost: number;
  avgCost: number;
}

/**
 * Provider Analytics Manager
 *
 * Centralized system for tracking and analyzing provider usage.
 */
export class ProviderAnalytics {
  private db: Database.Database;
  private dbPath: string;

  constructor(workspacePath: string = process.cwd()) {
    const analyticsDir = join(workspacePath, '.automatosx', 'analytics');
    mkdirSync(analyticsDir, { recursive: true });

    this.dbPath = join(analyticsDir, 'provider-metrics.db');
    this.db = new Database(this.dbPath);
    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        operation TEXT NOT NULL,
        streaming INTEGER,
        success INTEGER,
        latency_ms INTEGER,
        tokens_prompt INTEGER,
        tokens_completion INTEGER,
        tokens_total INTEGER,
        cost_usd REAL,
        error TEXT,
        routing_reason TEXT,
        routing_optimal INTEGER,
        feature_flags TEXT,
        timestamp INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_executions_provider ON executions(provider);
      CREATE INDEX IF NOT EXISTS idx_executions_timestamp ON executions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_executions_feature_flags ON executions(feature_flags);
    `);

    // Bug #12: Register shutdown handler to close database
    import('../../utils/process-manager.js').then(({ processManager }) => {
      processManager.onShutdown(async () => {
        this.close();
      });
    }).catch(() => {
      logger.debug('ProviderAnalytics: process-manager not available for shutdown handler');
    });

    logger.info('Provider analytics initialized', { dbPath: this.dbPath });
  }

  /**
   * Track a provider execution
   */
  trackExecution(event: ProviderExecutionEvent): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO executions (
          provider, operation, streaming, success, latency_ms,
          tokens_prompt, tokens_completion, tokens_total, cost_usd,
          error, routing_reason, routing_optimal, feature_flags, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        event.provider,
        event.operation,
        event.request.streaming ? 1 : 0,
        event.response.success ? 1 : 0,
        event.response.latencyMs,
        event.response.tokensUsed.prompt,
        event.response.tokensUsed.completion,
        event.response.tokensUsed.total,
        event.response.costUsd,
        event.response.error || null,
        event.routing.reason,
        event.routing.optimal ? 1 : 0,
        JSON.stringify(event.featureFlags || {}),
        event.timestamp
      );
    } catch (error) {
      logger.error('Failed to track execution', {
        error: (error as Error).message,
        provider: event.provider
      });
    }
  }

  /**
   * Get metrics for a provider
   */
  async getMetrics(options: {
    provider?: string;
    flagName?: string;
    flagValue?: boolean;
    days?: number;
    hours?: number;
    minutes?: number;
  } = {}): Promise<ProviderMetrics> {
    const timeAgo = this.calculateTimeAgo(options);

    let query = `
      SELECT
        COUNT(*) as total_requests,
        AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as success_rate,
        AVG(CASE WHEN success = 0 THEN 1.0 ELSE 0.0 END) as error_rate,
        AVG(latency_ms) as avg_latency,
        SUM(cost_usd) as total_cost,
        AVG(cost_usd) as avg_cost
      FROM executions
      WHERE timestamp > ?
    `;

    const params: any[] = [timeAgo];

    if (options.provider) {
      query += ' AND provider = ?';
      params.push(options.provider);
    }

    if (options.flagName && options.flagValue !== undefined) {
      query += ` AND json_extract(feature_flags, '$.${options.flagName}') = ?`;
      params.push(options.flagValue ? 1 : 0);
    }

    const result = this.db.prepare(query).get(...params) as any;

    // Get percentiles separately
    const percentileQuery = query.replace('SELECT COUNT(*)', 'SELECT latency_ms');
    const latencies = this.db.prepare(percentileQuery).all(...params) as any[];
    const sortedLatencies = latencies
      .map(r => r.latency_ms)
      .filter(l => l !== null)
      .sort((a, b) => a - b);

    const p50 = this.percentile(sortedLatencies, 50);
    const p95 = this.percentile(sortedLatencies, 95);
    const p99 = this.percentile(sortedLatencies, 99);

    return {
      totalRequests: result.total_requests || 0,
      successRate: result.success_rate || 0,
      errorRate: result.error_rate || 0,
      avgLatency: result.avg_latency || 0,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
      totalCost: result.total_cost || 0,
      avgCost: result.avg_cost || 0
    };
  }

  /**
   * Generate cost report
   */
  async getCostReport(options: {
    startDate: Date;
    endDate: Date;
    groupBy?: 'provider' | 'operation' | 'day';
  }): Promise<CostReport> {
    const startTs = options.startDate.getTime();
    const endTs = options.endDate.getTime();

    const query = `
      SELECT
        provider,
        streaming,
        SUM(cost_usd) as actual_cost,
        COUNT(*) as request_count,
        routing_optimal
      FROM executions
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY provider, streaming, routing_optimal
    `;

    const results = this.db.prepare(query).all(startTs, endTs) as any[];

    let totalSpent = 0;
    let optimalSpend = 0;
    const breakdown: CostReport['breakdown'] = [];

    for (const row of results) {
      totalSpent += row.actual_cost;

      // If route was optimal, add to optimal spend
      if (row.routing_optimal === 1) {
        optimalSpend += row.actual_cost;
      } else {
        // Calculate what optimal cost would have been
        // (In production, this would query cheapest provider for that workload)
        const optimalCostPerReq = row.streaming ? 0.0005 : 0.002; // Gemini prices
        optimalSpend += optimalCostPerReq * row.request_count;
      }
    }

    const wastedUsd = totalSpent - optimalSpend;
    const wastedPercentage = totalSpent > 0 ? (wastedUsd / totalSpent) * 100 : 0;

    return {
      totalSpent,
      optimalSpend,
      wastedUsd,
      wastedPercentage,
      breakdown
    };
  }

  /**
   * Get routing audit
   */
  async getRoutingAudit(): Promise<RoutingAudit> {
    const query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN routing_optimal = 1 THEN 1 ELSE 0 END) as optimal,
        routing_reason,
        AVG(cost_usd) as avg_cost
      FROM executions
      WHERE timestamp > ?
      GROUP BY routing_reason
    `;

    const timeAgo = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const results = this.db.prepare(query).all(timeAgo) as any[];

    const totalRequests = results.reduce((sum, r) => sum + r.total, 0);
    const optimalRoutes = results.reduce((sum, r) => sum + r.optimal, 0);
    const suboptimalRoutes = totalRequests - optimalRoutes;

    const issues: RoutingAudit['issues'] = [];

    for (const row of results) {
      if (row.optimal < row.total) {
        const suboptimalCount = row.total - row.optimal;
        issues.push({
          pattern: row.routing_reason,
          occurrences: suboptimalCount,
          costImpact: row.avg_cost * suboptimalCount,
          recommendation: `Review routing logic for: ${row.routing_reason}`
        });
      }
    }

    return {
      totalRequests,
      optimalRoutes,
      suboptimalRoutes,
      issues: issues.sort((a, b) => b.costImpact - a.costImpact)
    };
  }

  /**
   * Calculate time threshold
   */
  private calculateTimeAgo(options: {
    days?: number;
    hours?: number;
    minutes?: number;
  }): number {
    const now = Date.now();
    const ms = (options.days || 0) * 24 * 60 * 60 * 1000 +
               (options.hours || 0) * 60 * 60 * 1000 +
               (options.minutes || 0) * 60 * 1000;
    return now - (ms || 7 * 24 * 60 * 60 * 1000); // Default 7 days
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
