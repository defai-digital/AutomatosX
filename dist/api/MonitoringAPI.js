/**
 * MonitoringAPI.ts
 *
 * REST API endpoints for monitoring data access
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 3
 */
import express from 'express';
import { getDatabase } from '../database/connection.js';
import { MetricsCollector } from '../monitoring/MetricsCollector.js';
import { AlertingService } from '../monitoring/AlertingService.js';
import { HealthCheckService } from '../monitoring/HealthCheckService.js';
import { WorkflowMonitor } from '../monitoring/WorkflowMonitor.js';
import { DistributedTracer } from '../monitoring/DistributedTracer.js';
import { StructuredLogger } from '../monitoring/StructuredLogger.js';
/**
 * MonitoringAPI - REST API for monitoring data
 *
 * Endpoints:
 * - GET /api/monitoring/metrics - Query metrics with aggregation
 * - GET /api/monitoring/alerts - List alerts with filters
 * - POST /api/monitoring/alerts/:id/acknowledge - Acknowledge alert
 * - POST /api/monitoring/alerts/:id/resolve - Resolve alert
 * - GET /api/monitoring/health - System health status
 * - GET /api/monitoring/health/:component - Component health
 * - GET /api/monitoring/workflows - Workflow executions
 * - GET /api/monitoring/workflows/:id - Single workflow execution
 * - GET /api/monitoring/traces/:id - Get trace by ID
 * - GET /api/monitoring/traces/execution/:id - Get traces by execution ID
 * - GET /api/monitoring/logs - Query logs
 * - GET /api/monitoring/logs/execution/:id - Get logs by execution ID
 * - GET /api/monitoring/stats - Overall monitoring statistics
 */
export class MonitoringAPI {
    router;
    db;
    metrics;
    alerting;
    health;
    workflows;
    tracer;
    logger;
    constructor(db, metrics, alerting, health, workflows, tracer, logger) {
        this.router = express.Router();
        this.db = db || getDatabase();
        this.metrics = metrics || new MetricsCollector(this.db);
        this.alerting = alerting || new AlertingService(this.db, this.metrics);
        this.health = health || new HealthCheckService(this.db);
        this.workflows = workflows || new WorkflowMonitor(this.db);
        this.tracer = tracer || new DistributedTracer(this.db);
        this.logger = logger || new StructuredLogger(this.db);
        this.setupRoutes();
    }
    /**
     * Setup all routes
     */
    setupRoutes() {
        // Metrics endpoints
        this.router.get('/metrics', this.getMetrics.bind(this));
        // Alerts endpoints
        this.router.get('/alerts', this.getAlerts.bind(this));
        this.router.post('/alerts/:id/acknowledge', this.acknowledgeAlert.bind(this));
        this.router.post('/alerts/:id/resolve', this.resolveAlert.bind(this));
        // Health endpoints
        this.router.get('/health', this.getSystemHealth.bind(this));
        this.router.get('/health/:component', this.getComponentHealth.bind(this));
        // Workflow endpoints
        this.router.get('/workflows', this.getWorkflows.bind(this));
        this.router.get('/workflows/:id', this.getWorkflow.bind(this));
        // Trace endpoints
        this.router.get('/traces/:id', this.getTrace.bind(this));
        this.router.get('/traces/execution/:id', this.getTracesByExecution.bind(this));
        // Log endpoints
        this.router.get('/logs', this.getLogs.bind(this));
        this.router.get('/logs/execution/:id', this.getExecutionLogs.bind(this));
        // Stats endpoint
        this.router.get('/stats', this.getStats.bind(this));
    }
    // ============================================================================
    // Metrics Endpoints
    // ============================================================================
    /**
     * GET /api/monitoring/metrics
     * Query metrics with aggregation
     * Query params: type, startTime, endTime
     */
    async getMetrics(req, res) {
        try {
            const { type, startTime, endTime } = req.query;
            if (!type) {
                res.status(400).json({ error: 'Metric type is required' });
                return;
            }
            const start = startTime ? parseInt(startTime) : Date.now() - 3600000; // 1 hour ago
            const end = endTime ? parseInt(endTime) : Date.now();
            const aggregation = this.metrics.getAggregation(type, start, end);
            res.json({
                type,
                startTime: start,
                endTime: end,
                aggregation,
            });
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    // ============================================================================
    // Alerts Endpoints
    // ============================================================================
    /**
     * GET /api/monitoring/alerts
     * List alerts with filters
     * Query params: status, severity, tenantId, limit
     */
    async getAlerts(req, res) {
        try {
            const { status, severity, tenantId, limit } = req.query;
            const alerts = this.alerting.listAlerts({
                status: status,
                severity: severity,
                tenantId: tenantId,
                limit: limit ? parseInt(limit) : undefined,
            });
            res.json(alerts);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * POST /api/monitoring/alerts/:id/acknowledge
     * Acknowledge an alert
     * Body: { userId: string }
     */
    async acknowledgeAlert(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.body;
            if (!userId) {
                res.status(400).json({ error: 'userId is required' });
                return;
            }
            this.alerting.acknowledgeAlert(id, userId);
            res.json({ success: true, alertId: id });
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * POST /api/monitoring/alerts/:id/resolve
     * Resolve an alert
     */
    async resolveAlert(req, res) {
        try {
            const { id } = req.params;
            this.alerting.resolveAlert(id);
            res.json({ success: true, alertId: id });
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    // ============================================================================
    // Health Endpoints
    // ============================================================================
    /**
     * GET /api/monitoring/health
     * Get overall system health
     */
    async getSystemHealth(req, res) {
        try {
            const health = await this.health.getSystemHealth();
            res.json(health);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * GET /api/monitoring/health/:component
     * Get component health
     */
    async getComponentHealth(req, res) {
        try {
            const { component } = req.params;
            const health = await this.health.getComponentHealth(component);
            if (!health) {
                res.status(404).json({ error: `Component not found: ${component}` });
                return;
            }
            res.json(health);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    // ============================================================================
    // Workflow Endpoints
    // ============================================================================
    /**
     * GET /api/monitoring/workflows
     * List workflow executions
     * Query params: status, limit
     */
    async getWorkflows(req, res) {
        try {
            const { status, limit } = req.query;
            let workflows;
            if (status === 'active') {
                workflows = this.workflows.getActiveExecutions();
            }
            else if (status === 'completed') {
                workflows = this.workflows.getCompletedExecutions(limit ? parseInt(limit) : 100);
            }
            else if (status === 'failed') {
                workflows = this.workflows.getFailedExecutions(limit ? parseInt(limit) : 100);
            }
            else {
                // Get recent executions
                const activeWorkflows = this.workflows.getActiveExecutions();
                const completedWorkflows = this.workflows.getCompletedExecutions(50);
                workflows = [...activeWorkflows, ...completedWorkflows];
            }
            res.json(workflows);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * GET /api/monitoring/workflows/:id
     * Get single workflow execution
     */
    async getWorkflow(req, res) {
        try {
            const { id } = req.params;
            const workflow = this.workflows.getExecution(id);
            if (!workflow) {
                res.status(404).json({ error: `Workflow not found: ${id}` });
                return;
            }
            res.json(workflow);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    // ============================================================================
    // Trace Endpoints
    // ============================================================================
    /**
     * GET /api/monitoring/traces/:id
     * Get trace by ID
     */
    async getTrace(req, res) {
        try {
            const { id } = req.params;
            const trace = this.tracer.getTrace(id);
            if (!trace) {
                res.status(404).json({ error: `Trace not found: ${id}` });
                return;
            }
            res.json(trace);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * GET /api/monitoring/traces/execution/:id
     * Get traces by workflow execution ID
     */
    async getTracesByExecution(req, res) {
        try {
            const { id } = req.params;
            const traces = this.tracer.getTracesByExecution(id);
            res.json(traces);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    // ============================================================================
    // Log Endpoints
    // ============================================================================
    /**
     * GET /api/monitoring/logs
     * Query logs
     * Query params: level, source, executionId, tenantId, search, limit
     */
    async getLogs(req, res) {
        try {
            const { level, source, executionId, tenantId, search, limit } = req.query;
            const logs = this.logger.queryLogs({
                level: level,
                source: source,
                executionId: executionId,
                tenantId: tenantId,
                search: search,
                limit: limit ? parseInt(limit) : 100,
            });
            res.json(logs);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * GET /api/monitoring/logs/execution/:id
     * Get logs by execution ID
     */
    async getExecutionLogs(req, res) {
        try {
            const { id } = req.params;
            const logs = this.logger.getExecutionLogs(id);
            res.json(logs);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    // ============================================================================
    // Stats Endpoint
    // ============================================================================
    /**
     * GET /api/monitoring/stats
     * Get overall monitoring statistics
     */
    async getStats(req, res) {
        try {
            const stats = {
                metrics: this.metrics.getMetricsCount(),
                alerts: {
                    active: this.alerting.getActiveAlertCount(),
                    critical: this.alerting.getActiveAlertCount('critical'),
                    warning: this.alerting.getActiveAlertCount('warning'),
                },
                workflows: {
                    active: this.workflows.getActiveExecutions().length,
                    totalCompleted: this.workflows.getWorkflowStats().totalExecutions,
                    avgDuration: this.workflows.getWorkflowStats().avgDuration,
                },
                traces: this.tracer.getTraceStats(),
                logs: {
                    total: this.logger.getLogCount(),
                    errors: this.logger.getErrorLogs(1).length > 0 ? this.logger.getLogCountByLevel().error : 0,
                },
                health: await this.health.getSystemHealth(),
                uptime: this.health.getUptime(),
            };
            res.json(stats);
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * Get Express router
     */
    getRouter() {
        return this.router;
    }
}
//# sourceMappingURL=MonitoringAPI.js.map