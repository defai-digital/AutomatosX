/**
 * MonitoringAPI.ts
 *
 * REST API endpoints for monitoring data access
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 3
 */
import { Router } from 'express';
import Database from 'better-sqlite3';
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
export declare class MonitoringAPI {
    private router;
    private db;
    private metrics;
    private alerting;
    private health;
    private workflows;
    private tracer;
    private logger;
    constructor(db?: Database.Database, metrics?: MetricsCollector, alerting?: AlertingService, health?: HealthCheckService, workflows?: WorkflowMonitor, tracer?: DistributedTracer, logger?: StructuredLogger);
    /**
     * Setup all routes
     */
    private setupRoutes;
    /**
     * GET /api/monitoring/metrics
     * Query metrics with aggregation
     * Query params: type, startTime, endTime
     */
    private getMetrics;
    /**
     * GET /api/monitoring/alerts
     * List alerts with filters
     * Query params: status, severity, tenantId, limit
     */
    private getAlerts;
    /**
     * POST /api/monitoring/alerts/:id/acknowledge
     * Acknowledge an alert
     * Body: { userId: string }
     */
    private acknowledgeAlert;
    /**
     * POST /api/monitoring/alerts/:id/resolve
     * Resolve an alert
     */
    private resolveAlert;
    /**
     * GET /api/monitoring/health
     * Get overall system health
     */
    private getSystemHealth;
    /**
     * GET /api/monitoring/health/:component
     * Get component health
     */
    private getComponentHealth;
    /**
     * GET /api/monitoring/workflows
     * List workflow executions
     * Query params: status, limit
     */
    private getWorkflows;
    /**
     * GET /api/monitoring/workflows/:id
     * Get single workflow execution
     */
    private getWorkflow;
    /**
     * GET /api/monitoring/traces/:id
     * Get trace by ID
     */
    private getTrace;
    /**
     * GET /api/monitoring/traces/execution/:id
     * Get traces by workflow execution ID
     */
    private getTracesByExecution;
    /**
     * GET /api/monitoring/logs
     * Query logs
     * Query params: level, source, executionId, tenantId, search, limit
     */
    private getLogs;
    /**
     * GET /api/monitoring/logs/execution/:id
     * Get logs by execution ID
     */
    private getExecutionLogs;
    /**
     * GET /api/monitoring/stats
     * Get overall monitoring statistics
     */
    private getStats;
    /**
     * Get Express router
     */
    getRouter(): Router;
}
//# sourceMappingURL=MonitoringAPI.d.ts.map