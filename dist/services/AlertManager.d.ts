/**
 * AlertManager.ts
 *
 * Alert management service for monitoring provider performance,
 * evaluating alert rules, and managing alert lifecycle.
 *
 * Phase 3 Week 3 Day 13: Alert System
 */
import { MetricsCollector } from './MetricsCollector.js';
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
    rule: AlertRule;
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
export declare class AlertManager {
    private db;
    private metricsCollector;
    private evaluationTimer?;
    private readonly evaluationInterval;
    constructor(metricsCollector?: MetricsCollector);
    /**
     * Start automatic alert evaluation
     */
    start(): void;
    /**
     * Stop automatic alert evaluation
     */
    stop(): void;
    /**
     * Evaluate all enabled alert rules
     */
    evaluateAllRules(): Promise<void>;
    /**
     * Evaluate a single alert rule
     */
    evaluateRule(rule: AlertRule): Promise<AlertEvaluation>;
    /**
     * Get current value for alert metric
     */
    private getMetricValue;
    /**
     * Check if threshold is exceeded
     */
    private checkThreshold;
    /**
     * Handle triggered alert
     */
    private handleTriggeredAlert;
    /**
     * Handle resolved alert
     */
    private handleResolvedAlert;
    /**
     * Create a new alert
     */
    createAlert(alert: Partial<Alert>): Promise<Alert>;
    /**
     * Update an alert
     */
    private updateAlert;
    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string): Promise<void>;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string, acknowledgedBy?: string): Promise<void>;
    /**
     * Get active alert for a rule
     */
    private getActiveAlertForRule;
    /**
     * Get all active alerts
     */
    getActiveAlerts(severity?: 'info' | 'warning' | 'critical'): Alert[];
    /**
     * Get all alerts (including resolved)
     */
    getAllAlerts(limit?: number): Alert[];
    /**
     * Get alert by ID
     */
    getAlert(alertId: string): Alert | null;
    /**
     * Get alerts with filters
     */
    getAlerts(filters?: {
        state?: 'firing' | 'resolved' | 'acknowledged';
        severity?: 'info' | 'warning' | 'critical';
        ruleId?: string;
        limit?: number;
    }): Promise<Alert[]>;
    /**
     * Get alert statistics
     */
    getAlertStats(): {
        total: number;
        firing: number;
        resolved: number;
        acknowledged: number;
        bySeverity: {
            info: number;
            warning: number;
            critical: number;
        };
    };
    /**
     * Create or update an alert rule
     */
    saveRule(rule: Partial<AlertRule>): Promise<AlertRule>;
    /**
     * Get all alert rules
     */
    getAllRules(): AlertRule[];
    /**
     * Get enabled alert rules
     */
    getEnabledRules(): AlertRule[];
    /**
     * Get alert rules (alias for getAllRules for consistency with getAlerts)
     */
    getRules(): Promise<AlertRule[]>;
    /**
     * Get alert rule by ID
     */
    getRule(ruleId: string): AlertRule | null;
    /**
     * Delete an alert rule
     */
    deleteRule(ruleId: string): Promise<void>;
    /**
     * Enable/disable a rule
     */
    toggleRule(ruleId: string, enabled: boolean): Promise<void>;
    /**
     * Convert database row to Alert object
     */
    private rowToAlert;
    /**
     * Convert database row to AlertRule object
     */
    private rowToRule;
}
export {};
//# sourceMappingURL=AlertManager.d.ts.map