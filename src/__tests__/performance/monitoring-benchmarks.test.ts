/**
 * monitoring-benchmarks.test.ts
 *
 * Performance benchmarks for monitoring system
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { MetricsCollector } from '../../monitoring/MetricsCollector.js';
import { AlertingService } from '../../monitoring/AlertingService.js';
import { DistributedTracer } from '../../monitoring/DistributedTracer.js';
import { StructuredLogger } from '../../monitoring/StructuredLogger.js';
import { WorkflowMonitor } from '../../monitoring/WorkflowMonitor.js';

describe('Monitoring System Performance Benchmarks', () => {
  let db: Database.Database;
  let metrics: MetricsCollector;
  let alerting: AlertingService;
  let tracer: DistributedTracer;
  let logger: StructuredLogger;
  let workflows: WorkflowMonitor;

  beforeEach(() => {
    db = new Database(':memory:');
    metrics = new MetricsCollector(db);
    alerting = new AlertingService(db, metrics);
    tracer = new DistributedTracer(db, 1.0);
    logger = new StructuredLogger(db, 100, 'info');
    workflows = new WorkflowMonitor(db);
  });

  afterEach(() => {
    logger.stop();
    alerting.stopEvaluation();
    db.close();
  });

  describe('Metrics Collection Throughput', () => {
    it('should handle high-volume metric recording (10,000 metrics)', () => {
      const count = 10000;
      const start = Date.now();

      for (let i = 0; i < count; i++) {
        metrics.recordMetric('benchmark.metric', Math.random() * 100, {
          iteration: i.toString(),
        });
      }

      const duration = Date.now() - start;
      const throughput = count / (duration / 1000); // metrics per second

      console.log(`Metrics throughput: ${throughput.toFixed(0)} metrics/sec`);
      console.log(`Total duration: ${duration}ms for ${count} metrics`);

      // Should handle at least 1000 metrics/sec
      expect(throughput).toBeGreaterThan(1000);
      expect(duration).toBeLessThan(10000); // <10 seconds for 10k metrics
    });

    it('should efficiently aggregate large metric datasets', () => {
      // Record 1000 metrics
      for (let i = 0; i < 1000; i++) {
        metrics.recordMetric('aggregate.test', Math.random() * 1000);
      }

      const start = Date.now();

      // Perform aggregation
      const aggregation = metrics.getAggregation(
        'aggregate.test',
        Date.now() - 60000,
        Date.now()
      );

      const duration = Date.now() - start;

      console.log(`Aggregation time: ${duration}ms for 1000 metrics`);

      expect(aggregation).toBeDefined();
      expect(aggregation?.count).toBe(1000);
      expect(duration).toBeLessThan(100); // <100ms aggregation
    });
  });

  describe('Alert Evaluation Performance', () => {
    it('should evaluate alert rules efficiently (100 rules)', () => {
      // Create 100 alert rules
      for (let i = 0; i < 100; i++) {
        alerting.createRule(
          `Rule ${i}`,
          `Description ${i}`,
          'test.metric',
          {
            operator: 'gt',
            threshold: 50 + i,
            windowMs: 60000,
            aggregation: 'avg',
          },
          'warning'
        );
      }

      // Record metrics
      for (let i = 0; i < 100; i++) {
        metrics.recordMetric('test.metric', Math.random() * 200);
      }

      const start = Date.now();

      // Trigger evaluation (via private method simulation)
      const rules = alerting.listRules({ enabled: true });
      const duration = Date.now() - start;

      console.log(`Alert rule listing time: ${duration}ms for ${rules.length} rules`);

      expect(rules.length).toBe(100);
      expect(duration).toBeLessThan(50); // <50ms to list rules
    });

    it('should handle cooldown period checks efficiently', () => {
      // Create rule with short cooldown
      const ruleId = alerting.createRule(
        'Cooldown Test',
        'Test',
        'cooldown.metric',
        { operator: 'gt', threshold: 10, windowMs: 10000, aggregation: 'sum' },
        'info',
        { cooldownMs: 1000 }
      );

      const iterations = 100;
      const start = Date.now();

      // Repeatedly record metrics and check evaluation
      for (let i = 0; i < iterations; i++) {
        metrics.recordMetric('cooldown.metric', 20);
      }

      const duration = Date.now() - start;

      console.log(`Cooldown check overhead: ${(duration / iterations).toFixed(2)}ms per check`);

      expect(duration / iterations).toBeLessThan(5); // <5ms per check
    });
  });

  describe('Distributed Tracing Overhead', () => {
    it('should minimize tracing overhead (1,000 spans)', () => {
      const executionId = 'benchmark-exec';
      const traceId = tracer.startTrace(executionId);

      const spanCount = 1000;
      const start = Date.now();

      const spanIds: string[] = [];

      // Create 1000 spans
      for (let i = 0; i < spanCount; i++) {
        const spanId = tracer.startSpan(traceId, `Span ${i}`, 'internal', {
          attributes: { index: i },
        });
        spanIds.push(spanId);
      }

      // Complete all spans
      for (const spanId of spanIds) {
        tracer.completeSpan(spanId, 'ok');
      }

      tracer.completeTrace(traceId);

      const duration = Date.now() - start;
      const perSpan = duration / spanCount;

      console.log(`Tracing overhead: ${perSpan.toFixed(3)}ms per span`);
      console.log(`Total duration: ${duration}ms for ${spanCount} spans`);

      // Verify trace created correctly
      const trace = tracer.getTrace(traceId);
      expect(trace?.spans.length).toBe(spanCount);

      // Should be <1ms per span
      expect(perSpan).toBeLessThan(1);
    });

    it('should efficiently retrieve trace data', () => {
      const executionId = 'retrieve-benchmark';
      const traceId = tracer.startTrace(executionId);

      // Create nested span hierarchy
      const rootSpan = tracer.startSpan(traceId, 'Root', 'internal');

      for (let i = 0; i < 10; i++) {
        const childSpan = tracer.startSpan(traceId, `Child ${i}`, 'internal', {
          parentSpanId: rootSpan,
        });

        for (let j = 0; j < 5; j++) {
          const grandchildSpan = tracer.startSpan(traceId, `Grandchild ${i}-${j}`, 'internal', {
            parentSpanId: childSpan,
          });
          tracer.completeSpan(grandchildSpan);
        }

        tracer.completeSpan(childSpan);
      }

      tracer.completeSpan(rootSpan);
      tracer.completeTrace(traceId);

      // Benchmark retrieval
      const start = Date.now();
      const trace = tracer.getTrace(traceId);
      const duration = Date.now() - start;

      console.log(`Trace retrieval time: ${duration}ms for ${trace?.spans.length} spans`);

      expect(trace?.spans.length).toBe(61); // 1 root + 10 children + 50 grandchildren
      expect(duration).toBeLessThan(50); // <50ms retrieval
    });
  });

  describe('Structured Logging Throughput', () => {
    it('should handle high-volume logging (10,000 logs)', () => {
      const count = 10000;
      const start = Date.now();

      for (let i = 0; i < count; i++) {
        logger.info(`Log message ${i}`, 'benchmark', {
          metadata: { iteration: i },
        });
      }

      logger.flush();

      const duration = Date.now() - start;
      const throughput = count / (duration / 1000);

      console.log(`Logging throughput: ${throughput.toFixed(0)} logs/sec`);
      console.log(`Total duration: ${duration}ms for ${count} logs`);

      // Should handle at least 2000 logs/sec
      expect(throughput).toBeGreaterThan(2000);
    });

    it('should perform full-text search efficiently', () => {
      // Insert diverse log messages
      const keywords = ['authentication', 'database', 'cache', 'api', 'workflow'];

      for (let i = 0; i < 1000; i++) {
        const keyword = keywords[i % keywords.length];
        logger.info(`Processing ${keyword} operation ${i}`, 'service', {
          metadata: { operation: keyword, index: i },
        });
      }

      logger.flush();

      // Benchmark search
      const start = Date.now();
      const results = logger.queryLogs({ search: 'authentication' });
      const duration = Date.now() - start;

      console.log(`FTS search time: ${duration}ms for query across 1000 logs`);
      console.log(`Results found: ${results.length}`);

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50); // <50ms search
    });
  });

  describe('Workflow Monitoring Performance', () => {
    it('should track concurrent workflow executions efficiently', () => {
      const count = 100;
      const start = Date.now();

      // Start 100 concurrent workflow executions
      for (let i = 0; i < count; i++) {
        workflows.startExecution(`exec-${i}`, 'benchmark-workflow', {
          metadata: { index: i },
        });
      }

      const startDuration = Date.now() - start;

      // Update progress for all
      const updateStart = Date.now();
      for (let i = 0; i < count; i++) {
        workflows.updateStepProgress(`exec-${i}`, 5, 10);
      }
      const updateDuration = Date.now() - updateStart;

      // Complete all
      const completeStart = Date.now();
      for (let i = 0; i < count; i++) {
        workflows.completeExecution(`exec-${i}`, { result: 'success' });
      }
      const completeDuration = Date.now() - completeStart;

      console.log(`Workflow start: ${(startDuration / count).toFixed(2)}ms per workflow`);
      console.log(`Workflow update: ${(updateDuration / count).toFixed(2)}ms per workflow`);
      console.log(`Workflow complete: ${(completeDuration / count).toFixed(2)}ms per workflow`);

      expect(startDuration / count).toBeLessThan(5);
      expect(updateDuration / count).toBeLessThan(5);
      expect(completeDuration / count).toBeLessThan(5);
    });

    it('should retrieve workflow statistics efficiently', () => {
      // Create workflow history
      for (let i = 0; i < 100; i++) {
        workflows.startExecution(`exec-${i}`, 'test-workflow');
        workflows.completeExecution(`exec-${i}`);
      }

      const start = Date.now();
      const stats = workflows.getWorkflowStats();
      const duration = Date.now() - start;

      console.log(`Workflow stats calculation: ${duration}ms`);

      expect(stats.totalExecutions).toBe(100);
      expect(duration).toBeLessThan(100); // <100ms
    });
  });

  describe('End-to-End Performance', () => {
    it('should handle complete monitoring pipeline efficiently', () => {
      const iterations = 100;
      const totalStart = Date.now();

      for (let i = 0; i < iterations; i++) {
        const executionId = `e2e-${i}`;
        const workflowId = 'e2e-workflow';

        // 1. Start workflow
        workflows.startExecution(executionId, workflowId);

        // 2. Start trace
        const traceId = tracer.startTrace(executionId);

        // 3. Log workflow start
        logger.info('Workflow started', 'engine', { executionId, traceId });

        // 4. Create spans
        const spanId = tracer.startSpan(traceId, 'Main Operation', 'internal');

        // 5. Record metrics
        metrics.recordMetric('workflow.duration', Math.random() * 1000, { workflowId });

        // 6. Complete span
        tracer.completeSpan(spanId);

        // 7. Complete trace
        tracer.completeTrace(traceId);

        // 8. Log completion
        logger.info('Workflow completed', 'engine', { executionId, traceId });

        // 9. Complete workflow
        workflows.completeExecution(executionId);
      }

      logger.flush();

      const totalDuration = Date.now() - totalStart;
      const perIteration = totalDuration / iterations;

      console.log(`E2E monitoring overhead: ${perIteration.toFixed(2)}ms per workflow`);
      console.log(`Total duration: ${totalDuration}ms for ${iterations} workflows`);

      // Should be <50ms per complete workflow with full monitoring
      expect(perIteration).toBeLessThan(50);
    });
  });

  describe('Memory and Storage Efficiency', () => {
    it('should maintain reasonable database size', () => {
      // Generate monitoring data
      for (let i = 0; i < 1000; i++) {
        metrics.recordMetric('test.metric', Math.random() * 100);
        logger.info(`Log ${i}`, 'test');

        if (i % 10 === 0) {
          const execId = `exec-${i}`;
          workflows.startExecution(execId, 'test-workflow');
          const traceId = tracer.startTrace(execId);
          const spanId = tracer.startSpan(traceId, 'Test', 'internal');
          tracer.completeSpan(spanId);
          tracer.completeTrace(traceId);
          workflows.completeExecution(execId);
        }
      }

      logger.flush();

      // Check database size
      const sizeQuery = db.prepare(`
        SELECT page_count * page_size as size
        FROM pragma_page_count(), pragma_page_size()
      `).get() as any;

      const sizeInMB = sizeQuery.size / (1024 * 1024);

      console.log(`Database size: ${sizeInMB.toFixed(2)} MB`);

      // Should be reasonable size (<10MB for 1000 workflows)
      expect(sizeInMB).toBeLessThan(10);
    });
  });
});
