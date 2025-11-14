/**
 * api-integration.test.ts
 *
 * Integration tests for monitoring REST API
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { MonitoringAPI } from '../../api/MonitoringAPI.js';
import { MetricsCollector } from '../../monitoring/MetricsCollector.js';
import { AlertingService } from '../../monitoring/AlertingService.js';
import { HealthCheckService } from '../../monitoring/HealthCheckService.js';
import { WorkflowMonitor } from '../../monitoring/WorkflowMonitor.js';
import { DistributedTracer } from '../../monitoring/DistributedTracer.js';
import { StructuredLogger } from '../../monitoring/StructuredLogger.js';

describe('Monitoring REST API Integration', () => {
  let app: Express;
  let db: Database.Database;
  let metrics: MetricsCollector;
  let alerting: AlertingService;
  let health: HealthCheckService;
  let workflows: WorkflowMonitor;
  let tracer: DistributedTracer;
  let logger: StructuredLogger;

  beforeEach(() => {
    db = new Database(':memory:');
    metrics = new MetricsCollector(db);
    alerting = new AlertingService(db, metrics);
    health = new HealthCheckService(db);
    workflows = new WorkflowMonitor(db);
    tracer = new DistributedTracer(db);
    logger = new StructuredLogger(db);

    const monitoringAPI = new MonitoringAPI(
      db,
      metrics,
      alerting,
      health,
      workflows,
      tracer,
      logger
    );

    app = express();
    app.use(express.json());
    app.use('/api/monitoring', monitoringAPI.getRouter());
  });

  afterEach(() => {
    logger.stop();
    alerting.stopEvaluation();
    health.stopPeriodicChecks();
    db.close();
  });

  describe('GET /api/monitoring/metrics', () => {
    it('should return metric aggregation', async () => {
      // Record some metrics
      for (let i = 0; i < 10; i++) {
        metrics.recordMetric('api.latency', 100 + i * 10);
      }

      const response = await request(app)
        .get('/api/monitoring/metrics')
        .query({ type: 'api.latency' });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.aggregation).toBeDefined();
      expect(response.body.aggregation.count).toBe(10);
      expect(response.body.aggregation.min).toBe(100);
      expect(response.body.aggregation.max).toBe(190);
    });

    it('should return 400 if metric type is missing', async () => {
      const response = await request(app).get('/api/monitoring/metrics');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Metric type is required');
    });
  });

  describe('GET /api/monitoring/alerts', () => {
    it('should list alerts with filters', async () => {
      // Create alert rule and trigger alert
      alerting.createRule(
        'Test Alert',
        'Test description',
        'test.metric',
        { operator: 'gt', threshold: 5, windowMs: 10000, aggregation: 'sum' },
        'critical'
      );

      // Record metrics to trigger
      for (let i = 0; i < 10; i++) {
        metrics.recordMetric('test.metric', 1);
      }

      alerting.startEvaluation(50);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const response = await request(app)
        .get('/api/monitoring/alerts')
        .query({ status: 'active' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts')
        .query({ severity: 'critical' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/monitoring/alerts/:id/acknowledge', () => {
    it('should acknowledge an alert', async () => {
      // Create and trigger alert
      alerting.createRule(
        'Test',
        'Test',
        'test.metric',
        { operator: 'gt', threshold: 5, windowMs: 10000, aggregation: 'sum' },
        'warning'
      );

      for (let i = 0; i < 10; i++) {
        metrics.recordMetric('test.metric', 1);
      }

      alerting.startEvaluation(50);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const alerts = alerting.listAlerts({ status: 'active' });
      expect(alerts.length).toBeGreaterThan(0);

      const alertId = alerts[0].id;

      const response = await request(app)
        .post(`/api/monitoring/alerts/${alertId}/acknowledge`)
        .send({ userId: 'test-user' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const acknowledgedAlert = alerting.getAlert(alertId);
      expect(acknowledgedAlert?.status).toBe('acknowledged');
    });

    it('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/fake-id/acknowledge')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('userId is required');
    });
  });

  describe('GET /api/monitoring/health', () => {
    it('should return system health status', async () => {
      const response = await request(app).get('/api/monitoring/health');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.overall).toMatch(/healthy|degraded|unhealthy/);
      expect(response.body.components).toBeDefined();
      expect(Array.isArray(response.body.components)).toBe(true);
    });
  });

  describe('GET /api/monitoring/health/:component', () => {
    it('should return component health', async () => {
      const response = await request(app).get('/api/monitoring/health/database');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.component).toBe('database');
      expect(response.body.status).toBeDefined();
    });

    it('should return 404 for unknown component', async () => {
      const response = await request(app).get('/api/monitoring/health/unknown');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Component not found');
    });
  });

  describe('GET /api/monitoring/workflows', () => {
    it('should list workflow executions', async () => {
      workflows.startExecution('exec-001', 'test-workflow');
      workflows.startExecution('exec-002', 'test-workflow');
      workflows.completeExecution('exec-001');

      const response = await request(app).get('/api/monitoring/workflows');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      workflows.startExecution('exec-001', 'test-workflow');
      workflows.completeExecution('exec-001');

      const response = await request(app)
        .get('/api/monitoring/workflows')
        .query({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.every((w: any) => w.status === 'completed')).toBe(true);
    });
  });

  describe('GET /api/monitoring/traces/:id', () => {
    it('should return trace by ID', async () => {
      const executionId = 'exec-trace-001';
      const traceId = tracer.startTrace(executionId);
      const spanId = tracer.startSpan(traceId, 'Test Span', 'internal');
      tracer.completeSpan(spanId);
      tracer.completeTrace(traceId);

      const response = await request(app).get(`/api/monitoring/traces/${traceId}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.traceId).toBe(traceId);
      expect(response.body.spans).toBeDefined();
      expect(response.body.spans.length).toBe(1);
    });

    it('should return 404 for unknown trace', async () => {
      const response = await request(app).get('/api/monitoring/traces/unknown');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Trace not found');
    });
  });

  describe('GET /api/monitoring/logs', () => {
    it('should query logs with filters', async () => {
      logger.info('Test log 1', 'test-source');
      logger.error('Test log 2', 'test-source');
      logger.warn('Test log 3', 'other-source');
      logger.flush();

      const response = await request(app)
        .get('/api/monitoring/logs')
        .query({ source: 'test-source' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every((log: any) => log.source === 'test-source')).toBe(true);
    });

    it('should support full-text search', async () => {
      logger.info('User authentication successful', 'auth');
      logger.info('Database query executed', 'db');
      logger.flush();

      const response = await request(app)
        .get('/api/monitoring/logs')
        .query({ search: 'authentication' });

      expect(response.status).toBe(200);
      expect(response.body.some((log: any) => log.message.includes('authentication'))).toBe(true);
    });
  });

  describe('GET /api/monitoring/stats', () => {
    it('should return overall monitoring statistics', async () => {
      // Add some data
      metrics.recordMetric('test.metric', 100);
      workflows.startExecution('exec-001', 'test-workflow');
      logger.info('Test log', 'test-source');
      logger.flush();

      const response = await request(app).get('/api/monitoring/stats');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.metrics).toBeDefined();
      expect(response.body.alerts).toBeDefined();
      expect(response.body.workflows).toBeDefined();
      expect(response.body.traces).toBeDefined();
      expect(response.body.logs).toBeDefined();
      expect(response.body.health).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });
});
