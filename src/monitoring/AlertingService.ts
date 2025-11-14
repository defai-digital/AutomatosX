/**
 * AlertingService.ts
 *
 * Threshold-based alerting with rule evaluation and notifications
 * Phase 6 Week 2: Advanced Monitoring & Observability
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  Alert,
  AlertRule,
  AlertSeverity,
  AlertStatus,
  AlertCondition,
  MetricType,
  AlertRuleError,
} from '../types/monitoring.types.js';
import { getDatabase } from '../database/connection.js';
import { MetricsCollector } from './MetricsCollector.js';

/**
 * AlertingService - Threshold-based alerting system
 *
 * Features:
 * - Rule-based alert evaluation
 * - Threshold monitoring with configurable operators
 * - Alert lifecycle management (active → acknowledged → resolved)
 * - Cooldown periods to prevent alert storms
 * - Multi-tenant support
 * - Real-time notifications via EventEmitter
 */
export class AlertingService extends EventEmitter {
  private db: Database.Database;
  private metricsCollector: MetricsCollector;
  private evaluationInterval: NodeJS.Timeout | null = null;
  private lastAlertTimes: Map<string, number> = new Map();

  constructor(db?: Database.Database, metricsCollector?: MetricsCollector) {
    super();
    this.db = db || getDatabase();
    this.metricsCollector = metricsCollector || new MetricsCollector(this.db);
    this.initializeSchema();
  }

  /**
   * Initialize alerting schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        metric_type TEXT NOT NULL,
        condition_operator TEXT NOT NULL,
        condition_threshold REAL NOT NULL,
        condition_window_ms INTEGER NOT NULL,
        condition_aggregation TEXT NOT NULL,
        severity TEXT NOT NULL,
        labels TEXT NOT NULL,
        cooldown_ms INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL,
        labels TEXT NOT NULL,
        tenant_id TEXT,
        acknowledged_by TEXT,
        acknowledged_at INTEGER,
        resolved_at INTEGER,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric_type);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);
    `);
  }

  // ============================================================================
  // Alert Rule Management
  // ============================================================================

  /**
   * Create a new alert rule
   */
  createRule(
    name: string,
    description: string,
    metricType: MetricType,
    condition: AlertCondition,
    severity: AlertSeverity,
    options?: {
      labels?: Record<string, string>;
      cooldownMs?: number;
      enabled?: boolean;
    }
  ): string {
    this.validateCondition(condition);

    const id = randomUUID();
    const now = Date.now();

    const rule: AlertRule = {
      id,
      name,
      description,
      enabled: options?.enabled !== false,
      metricType,
      condition,
      severity,
      labels: options?.labels || {},
      cooldownMs: options?.cooldownMs || 300000, // 5 minutes default
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO alert_rules (
        id, name, description, enabled, metric_type,
        condition_operator, condition_threshold, condition_window_ms, condition_aggregation,
        severity, labels, cooldown_ms, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description,
      rule.enabled ? 1 : 0,
      metricType,
      condition.operator,
      condition.threshold,
      condition.windowMs,
      condition.aggregation,
      severity,
      JSON.stringify(rule.labels),
      rule.cooldownMs,
      now,
      now
    );

    this.emit('rule.created', rule);

    return id;
  }

  /**
   * Update an alert rule
   */
  updateRule(
    ruleId: string,
    updates: Partial<Pick<AlertRule, 'name' | 'description' | 'enabled' | 'condition' | 'severity' | 'cooldownMs'>>
  ): void {
    const rule = this.getRule(ruleId);
    if (!rule) {
      throw new AlertRuleError(`Alert rule not found: ${ruleId}`);
    }

    if (updates.condition) {
      this.validateCondition(updates.condition);
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description);
    }
    if (updates.enabled !== undefined) {
      setClauses.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.condition) {
      setClauses.push('condition_operator = ?, condition_threshold = ?, condition_window_ms = ?, condition_aggregation = ?');
      values.push(
        updates.condition.operator,
        updates.condition.threshold,
        updates.condition.windowMs,
        updates.condition.aggregation
      );
    }
    if (updates.severity !== undefined) {
      setClauses.push('severity = ?');
      values.push(updates.severity);
    }
    if (updates.cooldownMs !== undefined) {
      setClauses.push('cooldown_ms = ?');
      values.push(updates.cooldownMs);
    }

    setClauses.push('updated_at = ?');
    values.push(Date.now());

    values.push(ruleId);

    this.db.prepare(`
      UPDATE alert_rules
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `).run(...values);

    this.emit('rule.updated', ruleId);
  }

  /**
   * Delete an alert rule
   */
  deleteRule(ruleId: string): void {
    const result = this.db.prepare(`DELETE FROM alert_rules WHERE id = ?`).run(ruleId);

    if (result.changes === 0) {
      throw new AlertRuleError(`Alert rule not found: ${ruleId}`);
    }

    this.emit('rule.deleted', ruleId);
  }

  /**
   * Get alert rule by ID
   */
  getRule(ruleId: string): AlertRule | null {
    const row = this.db.prepare(`SELECT * FROM alert_rules WHERE id = ?`).get(ruleId) as any;

    if (!row) return null;

    return this.rowToRule(row);
  }

  /**
   * List all alert rules
   */
  listRules(options?: { enabled?: boolean; metricType?: MetricType }): AlertRule[] {
    let query = `SELECT * FROM alert_rules`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.enabled !== undefined) {
      conditions.push('enabled = ?');
      params.push(options.enabled ? 1 : 0);
    }

    if (options?.metricType) {
      conditions.push('metric_type = ?');
      params.push(options.metricType);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC`;

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => this.rowToRule(row));
  }

  // ============================================================================
  // Alert Evaluation
  // ============================================================================

  /**
   * Start periodic alert evaluation
   */
  startEvaluation(intervalMs: number = 60000): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    this.evaluationInterval = setInterval(() => {
      this.evaluateAllRules();
    }, intervalMs);

    // Initial evaluation
    this.evaluateAllRules();
  }

  /**
   * Stop periodic alert evaluation
   */
  stopEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
  }

  /**
   * Evaluate all enabled alert rules
   */
  private evaluateAllRules(): void {
    const rules = this.listRules({ enabled: true });

    for (const rule of rules) {
      try {
        this.evaluateRule(rule);
      } catch (error) {
        this.emit('evaluation.error', { rule, error });
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private evaluateRule(rule: AlertRule): void {
    // Check cooldown
    const lastAlertTime = this.lastAlertTimes.get(rule.id);
    if (lastAlertTime && Date.now() - lastAlertTime < rule.cooldownMs) {
      return;
    }

    const now = Date.now();
    const startTime = now - rule.condition.windowMs;

    // Get metric aggregation
    const aggregation = this.metricsCollector.getAggregation(
      rule.metricType,
      startTime,
      now
    );

    if (!aggregation) {
      return; // No data to evaluate
    }

    // Get the aggregated value
    const value = this.getAggregationValue(aggregation, rule.condition.aggregation);

    // Check if condition is met
    const conditionMet = this.evaluateCondition(value, rule.condition);

    if (conditionMet) {
      this.triggerAlert(rule, value);
      this.lastAlertTimes.set(rule.id, now);
    }
  }

  /**
   * Get aggregation value based on aggregation type
   */
  private getAggregationValue(aggregation: any, type: string): number {
    switch (type) {
      case 'avg':
        return aggregation.avg;
      case 'sum':
        return aggregation.sum;
      case 'min':
        return aggregation.min;
      case 'max':
        return aggregation.max;
      case 'count':
        return aggregation.count;
      default:
        return aggregation.avg;
    }
  }

  /**
   * Evaluate condition operator
   */
  private evaluateCondition(value: number, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'gte':
        return value >= condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'lte':
        return value <= condition.threshold;
      case 'eq':
        return value === condition.threshold;
      case 'neq':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, value: number): void {
    const alert: Alert = {
      id: randomUUID(),
      timestamp: Date.now(),
      severity: rule.severity,
      status: 'active',
      title: rule.name,
      description: `${rule.description} (current value: ${value.toFixed(2)}, threshold: ${rule.condition.threshold})`,
      source: 'alerting-service',
      labels: rule.labels,
      metadata: {
        ruleId: rule.id,
        metricType: rule.metricType,
        value,
        threshold: rule.condition.threshold,
        operator: rule.condition.operator,
      },
    };

    this.db.prepare(`
      INSERT INTO alerts (
        id, timestamp, severity, status, title, description, source,
        labels, tenant_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alert.id,
      alert.timestamp,
      alert.severity,
      alert.status,
      alert.title,
      alert.description,
      alert.source,
      JSON.stringify(alert.labels),
      null,
      JSON.stringify(alert.metadata)
    );

    this.emit('alert.triggered', alert);
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId: string): void {
    const now = Date.now();

    const result = this.db.prepare(`
      UPDATE alerts
      SET status = 'acknowledged',
          acknowledged_by = ?,
          acknowledged_at = ?
      WHERE id = ? AND status = 'active'
    `).run(userId, now, alertId);

    if (result.changes > 0) {
      this.emit('alert.acknowledged', { alertId, userId });
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const now = Date.now();

    const result = this.db.prepare(`
      UPDATE alerts
      SET status = 'resolved',
          resolved_at = ?
      WHERE id = ? AND status IN ('active', 'acknowledged')
    `).run(now, alertId);

    if (result.changes > 0) {
      this.emit('alert.resolved', alertId);
    }
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | null {
    const row = this.db.prepare(`SELECT * FROM alerts WHERE id = ?`).get(alertId) as any;

    if (!row) return null;

    return this.rowToAlert(row);
  }

  /**
   * List alerts with filters
   */
  listAlerts(options?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    tenantId?: string;
    limit?: number;
  }): Alert[] {
    let query = `SELECT * FROM alerts`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options?.severity) {
      conditions.push('severity = ?');
      params.push(options.severity);
    }

    if (options?.tenantId) {
      conditions.push('tenant_id = ?');
      params.push(options.tenantId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY timestamp DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => this.rowToAlert(row));
  }

  /**
   * Get active alert count
   */
  getActiveAlertCount(severity?: AlertSeverity): number {
    let query = `SELECT COUNT(*) as count FROM alerts WHERE status = 'active'`;
    const params: any[] = [];

    if (severity) {
      query += ` AND severity = ?`;
      params.push(severity);
    }

    const row = this.db.prepare(query).get(...params) as any;
    return row.count;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Validate alert condition
   */
  private validateCondition(condition: AlertCondition): void {
    const validOperators = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];
    if (!validOperators.includes(condition.operator)) {
      throw new AlertRuleError(`Invalid operator: ${condition.operator}`);
    }

    const validAggregations = ['avg', 'sum', 'min', 'max', 'count'];
    if (!validAggregations.includes(condition.aggregation)) {
      throw new AlertRuleError(`Invalid aggregation: ${condition.aggregation}`);
    }

    if (condition.windowMs <= 0) {
      throw new AlertRuleError('Window must be greater than 0');
    }
  }

  /**
   * Convert database row to AlertRule
   */
  private rowToRule(row: any): AlertRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled === 1,
      metricType: row.metric_type,
      condition: {
        operator: row.condition_operator,
        threshold: row.condition_threshold,
        windowMs: row.condition_window_ms,
        aggregation: row.condition_aggregation,
      },
      severity: row.severity,
      labels: JSON.parse(row.labels),
      cooldownMs: row.cooldown_ms,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to Alert
   */
  private rowToAlert(row: any): Alert {
    return {
      id: row.id,
      timestamp: row.timestamp,
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      source: row.source,
      labels: JSON.parse(row.labels),
      tenantId: row.tenant_id,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Cleanup old resolved alerts
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const result = this.db.prepare(`
      DELETE FROM alerts
      WHERE status = 'resolved' AND resolved_at < ?
    `).run(cutoff);

    return result.changes;
  }
}
