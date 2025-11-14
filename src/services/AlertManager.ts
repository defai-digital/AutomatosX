/**
 * AlertManager.ts
 *
 * Alert management service for monitoring provider performance,
 * evaluating alert rules, and managing alert lifecycle.
 *
 * Phase 3 Week 3 Day 13: Alert System
 */

import { getDatabase } from '../database/connection.js';
import { MetricsCollector } from './MetricsCollector.js';
import { v4 as uuidv4 } from 'uuid';
import type { ProviderType } from '../types/schemas/provider.schema.js';

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  durationSeconds: number;
  provider?: ProviderType;
  model?: string;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Alert instance
 */
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  rule: AlertRule; // Embedded rule for easy access
  state: 'firing' | 'resolved' | 'acknowledged';
  severity: 'info' | 'warning' | 'critical';
  startedAt: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  currentValue?: number;
  thresholdValue?: number;
  provider?: ProviderType;
  model?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  notified: boolean;
  notificationTime?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Alert evaluation result
 */
interface AlertEvaluation {
  rule: AlertRule;
  triggered: boolean;
  currentValue: number;
  message: string;
}

/**
 * AlertManager - Proactive monitoring and alerting
 *
 * Features:
 * - Rule-based alert evaluation
 * - Alert state management (firing, resolved, acknowledged)
 * - Multi-severity alerts (info, warning, critical)
 * - Alert history tracking
 * - Notification management
 */
export class AlertManager {
  private db: any;
  private metricsCollector: MetricsCollector;
  private evaluationTimer?: NodeJS.Timeout;
  private readonly evaluationInterval = 60000; // 1 minute

  constructor(metricsCollector?: MetricsCollector) {
    this.db = getDatabase();
    this.metricsCollector = metricsCollector || new MetricsCollector();
  }

  /**
   * Start automatic alert evaluation
   */
  start(): void {
    this.evaluationTimer = setInterval(async () => {
      await this.evaluateAllRules();
    }, this.evaluationInterval);
  }

  /**
   * Stop automatic alert evaluation
   */
  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
  }

  /**
   * Evaluate all enabled alert rules
   */
  async evaluateAllRules(): Promise<void> {
    const rules = this.getEnabledRules();

    for (const rule of rules) {
      try {
        await this.evaluateRule(rule);
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  async evaluateRule(rule: AlertRule): Promise<AlertEvaluation> {
    const currentValue = await this.getMetricValue(rule);
    const triggered = this.checkThreshold(currentValue, rule.operator, rule.threshold);

    if (triggered) {
      await this.handleTriggeredAlert(rule, currentValue);
    } else {
      await this.handleResolvedAlert(rule);
    }

    return {
      rule,
      triggered,
      currentValue,
      message: triggered
        ? `Alert triggered: ${rule.metric} ${rule.operator} ${rule.threshold} (current: ${currentValue})`
        : `Alert not triggered: ${rule.metric} = ${currentValue}`,
    };
  }

  /**
   * Get current value for alert metric
   */
  private async getMetricValue(rule: AlertRule): Promise<number> {
    const endTime = Date.now();
    const startTime = endTime - rule.durationSeconds * 1000;

    const stats = await this.metricsCollector.getAggregated({
      startTime,
      endTime,
      provider: rule.provider,
      model: rule.model,
    });

    switch (rule.metric) {
      case 'latency':
      case 'avg_latency':
        return stats.avgLatency;
      case 'p95_latency':
        return stats.p95Latency;
      case 'p99_latency':
        return stats.p99Latency;
      case 'error_rate':
        return 1 - stats.successRate;
      case 'success_rate':
        return stats.successRate;
      case 'cache_hit_rate':
        return stats.cacheHitRate;
      case 'hourly_cost':
        return stats.totalCost;
      case 'rate_limit_denial_rate':
        const total = stats.rateLimitAllowed + stats.rateLimitDenied;
        return total > 0 ? stats.rateLimitDenied / total : 0;
      default:
        return 0;
    }
  }

  /**
   * Check if threshold is exceeded
   */
  private checkThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return Math.abs(value - threshold) < 0.0001;
      case '!=':
        return Math.abs(value - threshold) >= 0.0001;
      default:
        return false;
    }
  }

  /**
   * Handle triggered alert
   */
  private async handleTriggeredAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const existingAlert = this.getActiveAlertForRule(rule.id);

    if (existingAlert) {
      // Update existing alert
      await this.updateAlert(existingAlert.id, {
        currentValue,
        updatedAt: Date.now(),
      });
    } else {
      // Create new alert
      await this.createAlert({
        ruleId: rule.id,
        ruleName: rule.name,
        state: 'firing',
        severity: rule.severity,
        currentValue,
        thresholdValue: rule.threshold,
        provider: rule.provider,
        model: rule.model,
        labels: rule.labels,
        annotations: rule.annotations,
      });
    }
  }

  /**
   * Handle resolved alert
   */
  private async handleResolvedAlert(rule: AlertRule): Promise<void> {
    const existingAlert = this.getActiveAlertForRule(rule.id);

    if (existingAlert && existingAlert.state === 'firing') {
      await this.resolveAlert(existingAlert.id);
    }
  }

  /**
   * Create a new alert
   */
  async createAlert(alert: Partial<Alert>): Promise<Alert> {
    const now = Date.now();

    // Fetch the rule to embed it
    const rule = this.getRule(alert.ruleId!);
    if (!rule) {
      throw new Error(`Cannot create alert: rule ${alert.ruleId} not found`);
    }

    const newAlert: Alert = {
      id: uuidv4(),
      ruleId: alert.ruleId!,
      ruleName: alert.ruleName!,
      rule, // Embed the rule
      state: alert.state || 'firing',
      severity: alert.severity || 'warning',
      startedAt: now,
      currentValue: alert.currentValue,
      thresholdValue: alert.thresholdValue,
      provider: alert.provider,
      model: alert.model,
      labels: alert.labels,
      annotations: alert.annotations,
      notified: false,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO alerts (
          id, rule_id, rule_name, state, severity, started_at,
          current_value, threshold_value, provider, model,
          labels, annotations, notified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newAlert.id,
        newAlert.ruleId,
        newAlert.ruleName,
        newAlert.state,
        newAlert.severity,
        newAlert.startedAt,
        newAlert.currentValue,
        newAlert.thresholdValue,
        newAlert.provider || null,
        newAlert.model || null,
        newAlert.labels ? JSON.stringify(newAlert.labels) : null,
        newAlert.annotations ? JSON.stringify(newAlert.annotations) : null,
        newAlert.notified ? 1 : 0,
        newAlert.createdAt,
        newAlert.updatedAt
      );

    return newAlert;
  }

  /**
   * Update an alert
   */
  private async updateAlert(alertId: string, updates: Partial<Alert>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.state !== undefined) {
      fields.push('state = ?');
      values.push(updates.state);
    }
    if (updates.currentValue !== undefined) {
      fields.push('current_value = ?');
      values.push(updates.currentValue);
    }
    if (updates.resolvedAt !== undefined) {
      fields.push('resolved_at = ?');
      values.push(updates.resolvedAt);
    }
    if (updates.acknowledgedAt !== undefined) {
      fields.push('acknowledged_at = ?');
      values.push(updates.acknowledgedAt);
    }
    if (updates.acknowledgedBy !== undefined) {
      fields.push('acknowledged_by = ?');
      values.push(updates.acknowledgedBy);
    }
    if (updates.notified !== undefined) {
      fields.push('notified = ?');
      values.push(updates.notified ? 1 : 0);
    }
    if (updates.notificationTime !== undefined) {
      fields.push('notification_time = ?');
      values.push(updates.notificationTime);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());

    values.push(alertId);

    this.db
      .prepare(`UPDATE alerts SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    await this.updateAlert(alertId, {
      state: 'resolved',
      resolvedAt: Date.now(),
    });
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy?: string): Promise<void> {
    await this.updateAlert(alertId, {
      state: 'acknowledged',
      acknowledgedAt: Date.now(),
      acknowledgedBy,
    });
  }

  /**
   * Get active alert for a rule
   */
  private getActiveAlertForRule(ruleId: string): Alert | null {
    const result = this.db
      .prepare(
        `SELECT * FROM alerts
         WHERE rule_id = ? AND state IN ('firing', 'acknowledged')
         ORDER BY started_at DESC
         LIMIT 1`
      )
      .get(ruleId);

    return result ? this.rowToAlert(result) : null;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(severity?: 'info' | 'warning' | 'critical'): Alert[] {
    let query = `SELECT * FROM alerts WHERE state = 'firing'`;
    const params: any[] = [];

    if (severity) {
      query += ' AND severity = ?';
      params.push(severity);
    }

    query += ' ORDER BY started_at DESC';

    const results = this.db.prepare(query).all(...params);
    return results.map((row: any) => this.rowToAlert(row));
  }

  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts(limit: number = 100): Alert[] {
    const results = this.db
      .prepare('SELECT * FROM alerts ORDER BY started_at DESC LIMIT ?')
      .all(limit);

    return results.map((row: any) => this.rowToAlert(row));
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | null {
    const result = this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
    return result ? this.rowToAlert(result) : null;
  }

  /**
   * Get alerts with filters
   */
  async getAlerts(filters?: {
    state?: 'firing' | 'resolved' | 'acknowledged';
    severity?: 'info' | 'warning' | 'critical';
    ruleId?: string;
    limit?: number;
  }): Promise<Alert[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }

    if (filters?.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }

    if (filters?.ruleId) {
      conditions.push('rule_id = ?');
      params.push(filters.ruleId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 100;

    const results = this.db
      .prepare(`SELECT * FROM alerts ${whereClause} ORDER BY started_at DESC LIMIT ?`)
      .all(...params, limit);

    return results.map((row: any) => this.rowToAlert(row));
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number;
    firing: number;
    resolved: number;
    acknowledged: number;
    bySeverity: { info: number; warning: number; critical: number };
  } {
    const result = this.db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN state = 'firing' THEN 1 ELSE 0 END) as firing,
          SUM(CASE WHEN state = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN state = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged,
          SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info,
          SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical
         FROM alerts
         WHERE started_at > ?`
      )
      .get(Date.now() - 24 * 60 * 60 * 1000);

    return {
      total: result.total || 0,
      firing: result.firing || 0,
      resolved: result.resolved || 0,
      acknowledged: result.acknowledged || 0,
      bySeverity: {
        info: result.info || 0,
        warning: result.warning || 0,
        critical: result.critical || 0,
      },
    };
  }

  /**
   * Create or update an alert rule
   */
  async saveRule(rule: Partial<AlertRule>): Promise<AlertRule> {
    const now = Date.now();
    const alertRule: AlertRule = {
      id: rule.id || uuidv4(),
      name: rule.name!,
      description: rule.description,
      metric: rule.metric!,
      operator: rule.operator!,
      threshold: rule.threshold!,
      durationSeconds: rule.durationSeconds || 60,
      provider: rule.provider,
      model: rule.model,
      severity: rule.severity || 'warning',
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      labels: rule.labels,
      annotations: rule.annotations,
      createdAt: rule.createdAt || now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT OR REPLACE INTO alert_rules (
          id, name, description, metric, operator, threshold, duration_seconds,
          provider, model, severity, enabled, labels, annotations,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        alertRule.id,
        alertRule.name,
        alertRule.description || null,
        alertRule.metric,
        alertRule.operator,
        alertRule.threshold,
        alertRule.durationSeconds,
        alertRule.provider || null,
        alertRule.model || null,
        alertRule.severity,
        alertRule.enabled ? 1 : 0,
        alertRule.labels ? JSON.stringify(alertRule.labels) : null,
        alertRule.annotations ? JSON.stringify(alertRule.annotations) : null,
        alertRule.createdAt,
        alertRule.updatedAt
      );

    return alertRule;
  }

  /**
   * Get all alert rules
   */
  getAllRules(): AlertRule[] {
    const results = this.db
      .prepare('SELECT * FROM alert_rules ORDER BY name ASC')
      .all();

    return results.map((row: any) => this.rowToRule(row));
  }

  /**
   * Get enabled alert rules
   */
  getEnabledRules(): AlertRule[] {
    const results = this.db
      .prepare('SELECT * FROM alert_rules WHERE enabled = 1 ORDER BY name ASC')
      .all();

    return results.map((row: any) => this.rowToRule(row));
  }

  /**
   * Get alert rules (alias for getAllRules for consistency with getAlerts)
   */
  async getRules(): Promise<AlertRule[]> {
    return this.getAllRules();
  }

  /**
   * Get alert rule by ID
   */
  getRule(ruleId: string): AlertRule | null {
    const result = this.db
      .prepare('SELECT * FROM alert_rules WHERE id = ?')
      .get(ruleId);

    return result ? this.rowToRule(result) : null;
  }

  /**
   * Delete an alert rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    this.db.prepare('DELETE FROM alert_rules WHERE id = ?').run(ruleId);
  }

  /**
   * Enable/disable a rule
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    this.db
      .prepare('UPDATE alert_rules SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, Date.now(), ruleId);
  }

  /**
   * Convert database row to Alert object
   */
  private rowToAlert(row: any): Alert {
    // Fetch the associated rule
    const rule = this.getRule(row.rule_id);
    if (!rule) {
      throw new Error(`Alert ${row.id} references non-existent rule ${row.rule_id}`);
    }

    return {
      id: row.id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      rule, // Embed the rule for easy access
      state: row.state,
      severity: row.severity,
      startedAt: row.started_at,
      resolvedAt: row.resolved_at,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
      currentValue: row.current_value,
      thresholdValue: row.threshold_value,
      provider: row.provider,
      model: row.model,
      labels: row.labels ? JSON.parse(row.labels) : undefined,
      annotations: row.annotations ? JSON.parse(row.annotations) : undefined,
      notified: row.notified === 1,
      notificationTime: row.notification_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to AlertRule object
   */
  private rowToRule(row: any): AlertRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      metric: row.metric,
      operator: row.operator,
      threshold: row.threshold,
      durationSeconds: row.duration_seconds,
      provider: row.provider,
      model: row.model,
      severity: row.severity,
      enabled: row.enabled === 1,
      labels: row.labels ? JSON.parse(row.labels) : undefined,
      annotations: row.annotations ? JSON.parse(row.annotations) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
