/**
 * Cost Tracker
 *
 * Real-time cost tracking with budget management
 *
 * Phase 3: Track actual costs per request with budget enforcement
 *
 * Features:
 * - Real-time cost accumulation
 * - Per-provider/model/session/agent tracking
 * - SQLite persistence
 * - Budget warnings (50%, 75%, 90%, 100%)
 * - Daily/weekly/monthly aggregates
 * - Export capabilities (JSON, CSV)
 *
 * @module core/cost-tracker
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type {
  CostEntry,
  CostQuery,
  CostBreakdown,
  BudgetStatus,
  BudgetConfig,
  CostTrackingConfig,
  CostExportFormat
} from '../types/cost.js';
import { logger } from '../utils/logger.js';

/**
 * Cost Tracker
 *
 * Tracks costs with budget management
 */
export class CostTracker extends EventEmitter {
  private db: Database.Database | null = null;
  private dbPath: string;
  private budgets: {
    daily?: BudgetConfig;
    weekly?: BudgetConfig;
    monthly?: BudgetConfig;
  };
  private alertOnBudget: boolean;
  private initialized = false;

  constructor(config: CostTrackingConfig) {
    super();
    this.dbPath = config.persistPath;
    this.budgets = config.budgets || {};
    this.alertOnBudget = config.alertOnBudget ?? true;

    logger.debug('CostTracker created', {
      dbPath: this.dbPath,
      hasDailyBudget: !!this.budgets.daily,
      hasWeeklyBudget: !!this.budgets.weekly,
      hasMonthlyBudget: !!this.budgets.monthly
    });
  }

  /**
   * Initialize database
   * v6.2.4: Bug fix #24 - Wrap in try-catch to prevent memory leaks on error
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // v6.2.4: Bug fix #24 - Wrap in try-catch to prevent memory leaks on error
    // If initialization fails partway through, close database to prevent leaks
    try {
      // Ensure directory exists
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Open database
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');

      // Create schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cost_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          session_id TEXT,
          agent TEXT,
          prompt_tokens INTEGER NOT NULL,
          completion_tokens INTEGER NOT NULL,
          total_tokens INTEGER NOT NULL,
          estimated_cost_usd REAL NOT NULL,
          request_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_entries(timestamp);
        CREATE INDEX IF NOT EXISTS idx_cost_provider ON cost_entries(provider);
        CREATE INDEX IF NOT EXISTS idx_cost_session ON cost_entries(session_id);
        CREATE INDEX IF NOT EXISTS idx_cost_agent ON cost_entries(agent);
      `);

      this.initialized = true;

      logger.info('CostTracker initialized', {
        dbPath: this.dbPath
      });
    } catch (error) {
      // v6.2.4: Bug fix #24 - Clean up database connection on error to prevent memory leaks
      if (this.db) {
        try {
          this.db.close();
        } catch (closeError) {
          // Ignore close errors, we're already handling an error
        }
        this.db = null;
      }
      this.initialized = false;

      logger.error('Failed to initialize CostTracker', {
        error: error instanceof Error ? error.message : String(error),
        dbPath: this.dbPath
      });

      throw error;
    }
  }

  /**
   * Record cost for a request
   * v6.2.4: Bug fix #25 - Added input validation
   */
  async recordCost(entry: CostEntry): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // v6.2.4: Bug fix #25 - Input validation to prevent data corruption
    if (!entry.provider || entry.provider.trim().length === 0) {
      throw new Error('Provider name cannot be empty');
    }
    if (!entry.model || entry.model.trim().length === 0) {
      throw new Error('Model name cannot be empty');
    }
    if (!Number.isFinite(entry.estimatedCostUsd)) {
      throw new Error(`Invalid estimatedCostUsd value: ${entry.estimatedCostUsd}. Must be a finite number.`);
    }
    if (entry.estimatedCostUsd < 0) {
      throw new Error(`Invalid estimatedCostUsd value: ${entry.estimatedCostUsd}. Cannot be negative.`);
    }
    if (!Number.isFinite(entry.promptTokens) || entry.promptTokens < 0) {
      throw new Error(`Invalid promptTokens: ${entry.promptTokens}. Must be a non-negative finite number.`);
    }
    if (!Number.isFinite(entry.completionTokens) || entry.completionTokens < 0) {
      throw new Error(`Invalid completionTokens: ${entry.completionTokens}. Must be a non-negative finite number.`);
    }
    if (!Number.isFinite(entry.totalTokens) || entry.totalTokens < 0) {
      throw new Error(`Invalid totalTokens: ${entry.totalTokens}. Must be a non-negative finite number.`);
    }
    if (!Number.isFinite(entry.timestamp) || entry.timestamp <= 0) {
      throw new Error(`Invalid timestamp: ${entry.timestamp}. Must be a positive finite number.`);
    }

    const stmt = this.db!.prepare(`
      INSERT INTO cost_entries (
        timestamp, provider, model, session_id, agent,
        prompt_tokens, completion_tokens, total_tokens,
        estimated_cost_usd, request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.timestamp,
      entry.provider,
      entry.model,
      entry.sessionId || null,
      entry.agent || null,
      entry.promptTokens,
      entry.completionTokens,
      entry.totalTokens,
      entry.estimatedCostUsd,
      entry.requestId || null
    );

    logger.debug('Cost recorded', {
      provider: entry.provider,
      model: entry.model,
      cost: entry.estimatedCostUsd.toFixed(4),
      tokens: entry.totalTokens
    });

    // Emit cost recorded event
    this.emit('cost-recorded', entry);

    // Check budgets if alerting enabled
    if (this.alertOnBudget) {
      await this.checkBudgets();
    }
  }

  /**
   * Get total cost
   */
  async getTotalCost(query?: CostQuery): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { sql, params } = this.buildQuery('SUM(estimated_cost_usd) as total', query);
    const result = this.db!.prepare(sql).get(...params) as { total: number | null };

    return result.total || 0;
  }

  /**
   * Get cost breakdown
   */
  async getCostBreakdown(query?: CostQuery): Promise<CostBreakdown> {
    if (!this.initialized) {
      await this.initialize();
    }

    const total = await this.getTotalCost(query);

    // By provider
    const byProvider: Record<string, number> = {};
    const providerStmt = this.db!.prepare(this.buildQuery(
      'provider, SUM(estimated_cost_usd) as cost',
      query,
      'GROUP BY provider'
    ).sql);

    for (const row of providerStmt.all(...this.buildQuery('', query).params) as Array<{ provider: string; cost: number }>) {
      byProvider[row.provider] = row.cost;
    }

    // By model
    const byModel: Record<string, number> = {};
    const modelStmt = this.db!.prepare(this.buildQuery(
      'model, SUM(estimated_cost_usd) as cost',
      query,
      'GROUP BY model'
    ).sql);

    for (const row of modelStmt.all(...this.buildQuery('', query).params) as Array<{ model: string; cost: number }>) {
      byModel[row.model] = row.cost;
    }

    // By agent
    const byAgent: Record<string, number> = {};
    const agentStmt = this.db!.prepare(this.buildQuery(
      'agent, SUM(estimated_cost_usd) as cost',
      query,
      'GROUP BY agent HAVING agent IS NOT NULL'
    ).sql);

    for (const row of agentStmt.all(...this.buildQuery('', query).params) as Array<{ agent: string; cost: number }>) {
      byAgent[row.agent] = row.cost;
    }

    // By day
    const byDay: Record<string, number> = {};
    const dayStmt = this.db!.prepare(this.buildQuery(
      "DATE(timestamp / 1000, 'unixepoch') as day, SUM(estimated_cost_usd) as cost",
      query,
      'GROUP BY day'
    ).sql);

    for (const row of dayStmt.all(...this.buildQuery('', query).params) as Array<{ day: string; cost: number }>) {
      byDay[row.day] = row.cost;
    }

    // Entry count
    const countStmt = this.db!.prepare(this.buildQuery('COUNT(*) as count', query).sql);
    const countResult = countStmt.get(...this.buildQuery('', query).params) as { count: number };

    return {
      total,
      byProvider,
      byModel,
      byAgent,
      byDay,
      entries: countResult.count
    };
  }

  /**
   * Check budget status for a window
   */
  async checkBudget(window: 'daily' | 'weekly' | 'monthly'): Promise<BudgetStatus> {
    const budget = this.budgets[window];
    if (!budget) {
      return {
        window,
        limit: 0,
        used: 0,
        remaining: 0,
        percentUsed: 0,
        status: 'ok'
      };
    }

    const now = Date.now();
    let startTime: number;
    let resetAtMs: number;

    // Calculate time range
    const nowDate = new Date(now);
    switch (window) {
      case 'daily':
        startTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
        resetAtMs = startTime + 86400000; // +24 hours
        break;
      case 'weekly':
        const dayOfWeek = nowDate.getDay();
        const startOfWeek = new Date(nowDate);
        startOfWeek.setDate(nowDate.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        startTime = startOfWeek.getTime();
        resetAtMs = startTime + 7 * 86400000; // +7 days
        break;
      case 'monthly':
        startTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
        resetAtMs = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1).getTime();
        break;
    }

    const used = await this.getTotalCost({
      startTime,
      endTime: now
    });

    const remaining = Math.max(0, budget.limit - used);
    const percentUsed = budget.limit > 0 ? used / budget.limit : 0;

    // Determine status
    let status: BudgetStatus['status'];
    if (percentUsed >= 1.0) {
      status = 'exceeded';
    } else if (percentUsed >= 0.90) {
      status = 'critical';
    } else if (percentUsed >= budget.warningThreshold) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      window,
      limit: budget.limit,
      used,
      remaining,
      percentUsed,
      status,
      resetAtMs
    };
  }

  /**
   * Check all budgets and emit alerts
   */
  private async checkBudgets(): Promise<void> {
    for (const window of ['daily', 'weekly', 'monthly'] as const) {
      if (this.budgets[window]) {
        const status = await this.checkBudget(window);

        if (status.status === 'warning' || status.status === 'critical' || status.status === 'exceeded') {
          this.emit('budget-alert', status);

          logger.warn('Budget alert', {
            window,
            status: status.status,
            percentUsed: (status.percentUsed * 100).toFixed(1) + '%',
            used: status.used.toFixed(2),
            limit: status.limit.toFixed(2)
          });
        }
      }
    }
  }

  /**
   * Export costs to JSON or CSV
   */
  async exportCosts(format: CostExportFormat, query?: CostQuery): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { sql, params } = this.buildQuery('*', query);
    const entries = this.db!.prepare(sql).all(...params) as CostEntry[];

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else {
      // CSV format
      const headers = [
        'id', 'timestamp', 'provider', 'model', 'session_id', 'agent',
        'prompt_tokens', 'completion_tokens', 'total_tokens',
        'estimated_cost_usd', 'request_id'
      ];

      const rows = entries.map(entry => [
        entry.id,
        entry.timestamp,
        entry.provider,
        entry.model,
        entry.sessionId || '',
        entry.agent || '',
        entry.promptTokens,
        entry.completionTokens,
        entry.totalTokens,
        entry.estimatedCostUsd,
        entry.requestId || ''
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      return csv;
    }
  }

  /**
   * Build SQL query from CostQuery
   */
  private buildQuery(
    select: string,
    query?: CostQuery,
    suffix: string = ''
  ): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query?.provider) {
      conditions.push('provider = ?');
      params.push(query.provider);
    }

    if (query?.model) {
      conditions.push('model = ?');
      params.push(query.model);
    }

    if (query?.sessionId) {
      conditions.push('session_id = ?');
      params.push(query.sessionId);
    }

    if (query?.agent) {
      conditions.push('agent = ?');
      params.push(query.agent);
    }

    if (query?.startTime) {
      conditions.push('timestamp >= ?');
      params.push(query.startTime);
    }

    if (query?.endTime) {
      conditions.push('timestamp <= ?');
      params.push(query.endTime);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query?.limit ? `LIMIT ${query.limit}` : '';

    const sql = `SELECT ${select} FROM cost_entries ${where} ${suffix} ${limit}`.trim();

    return { sql, params };
  }

  /**
   * Clear all cost data (use with caution)
   */
  async clear(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.db!.prepare('DELETE FROM cost_entries').run();

    logger.warn('All cost data cleared');
  }

  /**
   * Close database connection
   *
   * v6.0.8: Added WAL checkpoint before close for Windows compatibility
   * Ensures WAL file is merged back into main DB to release file locks faster
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        // Checkpoint WAL to reduce lock contention on Windows
        // TRUNCATE mode: checkpoint and delete WAL file
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (err) {
        // Non-fatal: log and continue with close
        logger.debug('WAL checkpoint failed (non-fatal)', { error: (err as Error).message });
      }

      this.db.close();
      this.db = null;
      this.initialized = false;

      logger.debug('CostTracker closed');
    }
  }
}

/**
 * Global singleton instance
 */
let globalCostTracker: CostTracker | null = null;

/**
 * Get or create global cost tracker
 */
export function getCostTracker(config?: CostTrackingConfig): CostTracker {
  if (!globalCostTracker) {
    if (!config) {
      throw new Error('CostTracker not initialized. Call getCostTracker(config) first or provide config.');
    }
    globalCostTracker = new CostTracker(config);
  }
  return globalCostTracker;
}

/**
 * Reset global cost tracker (for testing)
 */
export function resetCostTracker(): void {
  if (globalCostTracker) {
    void globalCostTracker.close();
  }
  globalCostTracker = null;
}
