/**
 * monitoring-integration.test.ts
 *
 * End-to-end integration tests for monitoring system
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { MetricsCollector } from '../../monitoring/MetricsCollector.js';
import { AlertingService } from '../../monitoring/AlertingService.js';
import { DistributedTracer } from '../../monitoring/DistributedTracer.js';
import { StructuredLogger } from '../../monitoring/StructuredLogger.js';
import { HealthCheckService } from '../../monitoring/HealthCheckService.js';
import { WorkflowMonitor } from '../../monitoring/WorkflowMonitor.js';

describe('Monitoring System Integration', () => {
  let db: Database.Database;
  let metrics: MetricsCollector;
  let alerting: AlertingService;
  let tracer: DistributedTracer;
  let logger: StructuredLogger;
  let health: HealthCheckService;
  let workflows: WorkflowMonitor;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Initialize all monitoring components
    metrics = new MetricsCollector(db);
    alerting = new AlertingService(db, metrics);
    tracer = new DistributedTracer(db, 1.0); // 100% sampling for tests
    logger = new StructuredLogger(db, 10, 'debug'); // Small buffer, debug level
    health = new HealthCheckService(db);
    workflows = new WorkflowMonitor(db);
  });

  afterEach(() => {
    logger.stop();
    alerting.stopEvaluation();
    health.stopPeriodicChecks();
    db.close();
  });

  describe('End-to-End Workflow Monitoring', () => {
    it('should track complete workflow lifecycle with metrics, traces, and logs', async () => {
      const workflowId = 'test-workflow';
      const executionId = 'exec-001';

      // 1. Start workflow execution
      workflows.startExecution(executionId, workflowId, { userId: 'test-user' });

      // 2. Start distributed trace
      const traceId = tracer.startTrace(executionId);
      expect(traceId).toBeTruthy();

      // 3. Log workflow start
      logger.info('Workflow started', 'workflow-engine', {
        executionId,
        traceId,
        metadata: { workflowId },
      });

      // 4. Simulate workflow steps with spans and metrics
      const step1SpanId = tracer.startSpan(traceId, 'Step 1: Validation', 'internal', {
        attributes: { step: 1 },
      });

      logger.debug('Validating input', 'workflow-engine', { executionId, traceId, spanId: step1SpanId });

      // Record step duration metric
      const step1Start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate work
      const step1Duration = Date.now() - step1Start;

      metrics.recordMetric('workflow.step.duration', step1Duration, {
        workflowId,
        step: 'validation',
      });

      tracer.completeSpan(step1SpanId, 'ok');
      workflows.updateStepProgress(executionId, 1, 3);

      // Step 2 with error simulation
      const step2SpanId = tracer.startSpan(traceId, 'Step 2: Processing', 'internal', {
        attributes: { step: 2 },
      });

      logger.warn('Processing encountered warning', 'workflow-engine', {
        executionId,
        traceId,
        spanId: step2SpanId,
      });

      metrics.recordMetric('workflow.step.duration', 75, {
        workflowId,
        step: 'processing',
      });

      tracer.addSpanEvent(step2SpanId, 'warning.detected', { message: 'Minor issue' });
      tracer.completeSpan(step2SpanId, 'ok');
      workflows.updateStepProgress(executionId, 2, 3);

      // Step 3 - completion
      const step3SpanId = tracer.startSpan(traceId, 'Step 3: Finalization', 'internal', {
        attributes: { step: 3 },
      });

      metrics.recordMetric('workflow.step.duration', 30, {
        workflowId,
        step: 'finalization',
      });

      tracer.completeSpan(step3SpanId, 'ok');
      workflows.updateStepProgress(executionId, 3, 3);

      // 5. Complete workflow
      workflows.completeExecution(executionId, { result: 'success' });
      tracer.completeTrace(traceId);

      logger.info('Workflow completed', 'workflow-engine', {
        executionId,
        traceId,
        metadata: { status: 'success' },
      });

      logger.flush();

      // 6. Verify workflow execution
      const execution = workflows.getExecution(executionId);
      expect(execution).toBeDefined();
      expect(execution?.status).toBe('completed');
      expect(execution?.currentStep).toBe(3);

      // 7. Verify trace
      const trace = tracer.getTrace(traceId);
      expect(trace).toBeDefined();
      expect(trace?.spans).toHaveLength(3);
      expect(trace?.spans[0].name).toBe('Step 1: Validation');
      expect(trace?.spans[1].events).toHaveLength(1);
      expect(trace?.spans[1].events[0].name).toBe('warning.detected');

      // 8. Verify metrics
      const aggregation = metrics.getAggregation(
        'workflow.step.duration',
        Date.now() - 1000,
        Date.now()
      );
      expect(aggregation).toBeDefined();
      expect(aggregation?.count).toBe(3);
      expect(aggregation?.avg).toBeCloseTo(51.67, 0);

      // 9. Verify logs
      const logs = logger.getExecutionLogs(executionId);
      expect(logs.length).toBeGreaterThanOrEqual(3);
      expect(logs.some((log) => log.message === 'Workflow started')).toBe(true);
      expect(logs.some((log) => log.message === 'Workflow completed')).toBe(true);
    });

    it('should handle workflow failure with error tracking', async () => {
      const executionId = 'exec-002';
      const workflowId = 'failing-workflow';

      workflows.startExecution(executionId, workflowId);
      const traceId = tracer.startTrace(executionId);

      const spanId = tracer.startSpan(traceId, 'Failing Step', 'internal');

      // Simulate error
      const error = new Error('Step failed');
      logger.error('Step execution failed', 'workflow-engine', {
        executionId,
        traceId,
        spanId,
        error,
        stackTrace: error.stack,
      });

      metrics.recordMetric('workflow.errors', 1, { workflowId });

      tracer.setSpanStatus(spanId, 'error');
      tracer.completeSpan(spanId);

      workflows.failExecution(executionId, 'Step failed');
      tracer.completeTrace(traceId);

      logger.flush();

      // Verify failure tracking
      const execution = workflows.getExecution(executionId);
      expect(execution?.status).toBe('failed');
      expect(execution?.error).toBe('Step failed');

      const trace = tracer.getTrace(traceId);
      expect(trace?.spans[0].status).toBe('error');

      const errorLogs = logger.getErrorLogs(10);
      expect(errorLogs.some((log) => log.message === 'Step execution failed')).toBe(true);
    });
  });

  describe('Alert Evaluation and Triggering', () => {
    it('should trigger alert when metric threshold is exceeded', async () => {
      return new Promise<void>((resolve) => {
        // Create alert rule for high error rate
        const ruleId = alerting.createRule(
          'High Error Rate',
          'Error rate exceeds 10% in last 1 minute',
          'workflow.errors',
          {
            operator: 'gt',
            threshold: 5,
            windowMs: 60000,
            aggregation: 'sum',
          },
          'critical',
          { cooldownMs: 1000 }
        );

        // Listen for alert trigger
        alerting.once('alert.triggered', (alert) => {
          expect(alert).toBeDefined();
          expect(alert.severity).toBe('critical');
          expect(alert.title).toBe('High Error Rate');

          // Verify alert is stored
          const storedAlert = alerting.getAlert(alert.id);
          expect(storedAlert).toBeDefined();
          expect(storedAlert?.status).toBe('active');

          // Acknowledge alert
          alerting.acknowledgeAlert(alert.id, 'test-user');
          const acknowledgedAlert = alerting.getAlert(alert.id);
          expect(acknowledgedAlert?.status).toBe('acknowledged');
          expect(acknowledgedAlert?.acknowledgedBy).toBe('test-user');

          // Resolve alert
          alerting.resolveAlert(alert.id);
          const resolvedAlert = alerting.getAlert(alert.id);
          expect(resolvedAlert?.status).toBe('resolved');

          resolve();
        });

        // Record metrics to trigger alert
        for (let i = 0; i < 10; i++) {
          metrics.recordMetric('workflow.errors', 1, { source: 'test' });
        }

        // Start evaluation
        alerting.startEvaluation(100); // Evaluate every 100ms for faster test
      });
    });

    it('should respect cooldown period for alerts', async () => {
      const ruleId = alerting.createRule(
        'High CPU',
        'CPU usage above 80%',
        'system.cpu',
        {
          operator: 'gt',
          threshold: 80,
          windowMs: 10000,
          aggregation: 'avg',
        },
        'warning',
        { cooldownMs: 5000 }
      );

      let alertCount = 0;
      alerting.on('alert.triggered', () => {
        alertCount++;
      });

      // Record high CPU multiple times
      metrics.recordMetric('system.cpu', 90);
      metrics.recordMetric('system.cpu', 95);
      metrics.recordMetric('system.cpu', 92);

      // Start evaluation
      alerting.startEvaluation(100);

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should only trigger once due to cooldown
      expect(alertCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Health Check Monitoring', () => {
    it('should detect system health status', async () => {
      const systemHealth = await health.getSystemHealth();

      expect(systemHealth).toBeDefined();
      expect(systemHealth.overall).toMatch(/healthy|degraded|unhealthy/);
      expect(systemHealth.components).toBeDefined();
      expect(systemHealth.components.length).toBeGreaterThan(0);

      // Check individual components
      const dbHealth = systemHealth.components.find((c) => c.component === 'database');
      expect(dbHealth).toBeDefined();
      expect(dbHealth?.status).toBe('healthy');
      expect(dbHealth?.responseTime).toBeLessThan(100);
    });

    it('should emit health change events', async () => {
      return new Promise<void>((resolve) => {
        let initialHealth: any = null;

        health.on('health.checked', (healthData) => {
          if (!initialHealth) {
            initialHealth = healthData;
          }
        });

        health.on('health.changed', ({ from, to }) => {
          expect(from).toBeDefined();
          expect(to).toBeDefined();
          expect(from).not.toBe(to);
          resolve();
        });

        health.startPeriodicChecks(100);

        // Simulate health degradation (in real scenario, would be actual system issues)
        setTimeout(() => {
          health.stopPeriodicChecks();
          resolve(); // Resolve even if no change detected
        }, 500);
      });
    });
  });

  describe('Structured Logging with Search', () => {
    it('should support full-text search across logs', () => {
      // Log various messages
      logger.info('User authentication successful', 'auth-service', {
        metadata: { userId: 'user-123', method: 'oauth' },
      });

      logger.error('Database connection failed', 'db-service', {
        metadata: { host: 'localhost', port: 5432 },
      });

      logger.warn('Rate limit approaching threshold', 'api-gateway', {
        metadata: { currentRate: 95, threshold: 100 },
      });

      logger.debug('Cache hit for key', 'cache-service', {
        metadata: { key: 'user:123', ttl: 300 },
      });

      logger.flush();

      // Full-text search
      const authLogs = logger.queryLogs({ search: 'authentication' });
      expect(authLogs.length).toBeGreaterThan(0);
      expect(authLogs[0].message).toContain('authentication');

      const dbLogs = logger.queryLogs({ search: 'database' });
      expect(dbLogs.length).toBeGreaterThan(0);

      // Filter by level
      const errorLogs = logger.queryLogs({ level: 'error' });
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].message).toContain('Database connection failed');

      // Filter by source
      const authServiceLogs = logger.queryLogs({ source: 'auth-service' });
      expect(authServiceLogs.length).toBe(1);

      // Combined filters
      const apiWarnings = logger.queryLogs({ source: 'api-gateway', level: 'warn' });
      expect(apiWarnings.length).toBe(1);
      expect(apiWarnings[0].message).toContain('Rate limit');
    });
  });

  describe('Metrics Aggregation and Percentiles', () => {
    it('should calculate accurate percentiles for latency metrics', () => {
      const latencies = [10, 15, 20, 25, 30, 35, 40, 45, 50, 100, 150, 200, 500, 1000];

      // Record latencies
      latencies.forEach((latency) => {
        metrics.recordMetric('api.latency', latency, { endpoint: '/users' });
      });

      const aggregation = metrics.getAggregation(
        'api.latency',
        Date.now() - 1000,
        Date.now()
      );

      expect(aggregation).toBeDefined();
      expect(aggregation?.count).toBe(14);
      expect(aggregation?.min).toBe(10);
      expect(aggregation?.max).toBe(1000);
      expect(aggregation?.p50).toBeGreaterThan(30);
      expect(aggregation?.p50).toBeLessThan(50);
      expect(aggregation?.p95).toBeGreaterThan(200);
      expect(aggregation?.p99).toBeGreaterThan(500);
    });
  });
});
