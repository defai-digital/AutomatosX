/**
 * AlertingService.ts
 *
 * Threshold-based alerting with rule evaluation and notifications
 * Phase 6 Week 2: Advanced Monitoring & Observability
 */
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { Alert, AlertRule, AlertSeverity, AlertStatus, AlertCondition, MetricType } from '../types/monitoring.types.js';
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
export declare class AlertingService extends EventEmitter {
    private db;
    private metricsCollector;
    private evaluationInterval;
    private lastAlertTimes;
    constructor(db?: Database.Database, metricsCollector?: MetricsCollector);
    /**
     * Initialize alerting schema
     */
    private initializeSchema;
    /**
     * Create a new alert rule
     */
    createRule(name: string, description: string, metricType: MetricType, condition: AlertCondition, severity: AlertSeverity, options?: {
        labels?: Record<string, string>;
        cooldownMs?: number;
        enabled?: boolean;
    }): string;
    /**
     * Update an alert rule
     */
    updateRule(ruleId: string, updates: Partial<Pick<AlertRule, 'name' | 'description' | 'enabled' | 'condition' | 'severity' | 'cooldownMs'>>): void;
    /**
     * Delete an alert rule
     */
    deleteRule(ruleId: string): void;
    /**
     * Get alert rule by ID
     */
    getRule(ruleId: string): AlertRule | null;
    /**
     * List all alert rules
     */
    listRules(options?: {
        enabled?: boolean;
        metricType?: MetricType;
    }): AlertRule[];
    /**
     * Start periodic alert evaluation
     */
    startEvaluation(intervalMs?: number): void;
    /**
     * Stop periodic alert evaluation
     */
    stopEvaluation(): void;
    /**
     * Evaluate all enabled alert rules
     */
    private evaluateAllRules;
    /**
     * Evaluate a single alert rule
     */
    private evaluateRule;
    /**
     * Get aggregation value based on aggregation type
     */
    private getAggregationValue;
    /**
     * Evaluate condition operator
     */
    private evaluateCondition;
    /**
     * Trigger an alert
     */
    private triggerAlert;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string, userId: string): void;
    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string): void;
    /**
     * Get alert by ID
     */
    getAlert(alertId: string): Alert | null;
    /**
     * List alerts with filters
     */
    listAlerts(options?: {
        status?: AlertStatus;
        severity?: AlertSeverity;
        tenantId?: string;
        limit?: number;
    }): Alert[];
    /**
     * Get active alert count
     */
    getActiveAlertCount(severity?: AlertSeverity): number;
    /**
     * Validate alert condition
     */
    private validateCondition;
    /**
     * Convert database row to AlertRule
     */
    private rowToRule;
    /**
     * Convert database row to Alert
     */
    private rowToAlert;
    /**
     * Cleanup old resolved alerts
     */
    cleanup(retentionDays?: number): Promise<number>;
}
//# sourceMappingURL=AlertingService.d.ts.map