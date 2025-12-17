/**
 * Telemetry Contract Tests
 *
 * Validates telemetry schemas and contract invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  MetricTypeSchema,
  MetricUnitSchema,
  MetricCategorySchema,
  MetricDefinitionSchema,
  MetricDataPointSchema,
  RecordMetricRequestSchema,
  QueryMetricsRequestSchema,
  TelemetrySummaryResultSchema,
  validateMetricDefinition,
  validateRecordMetricRequest,
  safeValidateRecordMetricRequest,
} from '@automatosx/contracts';

describe('Telemetry Contract', () => {
  describe('MetricTypeSchema', () => {
    it('should accept valid metric types', () => {
      const types = ['counter', 'gauge', 'histogram', 'summary', 'timer'];
      for (const type of types) {
        const result = MetricTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid metric type', () => {
      expect(MetricTypeSchema.safeParse('invalid-type').success).toBe(false);
    });
  });

  describe('MetricUnitSchema', () => {
    it('should accept valid units', () => {
      const units = ['count', 'bytes', 'milliseconds', 'seconds', 'percent'];
      for (const unit of units) {
        const result = MetricUnitSchema.safeParse(unit);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('MetricCategorySchema', () => {
    it('should accept valid categories', () => {
      const categories = ['system', 'agent', 'workflow', 'provider', 'custom'];
      for (const category of categories) {
        const result = MetricCategorySchema.safeParse(category);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('MetricDefinitionSchema', () => {
    it('should validate a metric definition', () => {
      const definition = {
        name: 'request_count',
        type: 'counter',
        description: 'Total number of requests',
        unit: 'count',
        category: 'system',
      };
      const result = validateMetricDefinition(definition);
      expect(result.name).toBe('request_count');
      expect(result.type).toBe('counter');
    });

    it('should validate histogram with buckets', () => {
      const definition = {
        name: 'request_duration',
        type: 'histogram',
        description: 'Request duration',
        unit: 'milliseconds',
        category: 'system',
        buckets: [10, 50, 100, 500, 1000],
      };
      const result = MetricDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(true);
    });
  });

  describe('MetricDataPointSchema', () => {
    it('should validate a data point', () => {
      const dataPoint = {
        metricName: 'test_metric',
        timestamp: new Date().toISOString(),
        value: 100,
      };
      const result = MetricDataPointSchema.safeParse(dataPoint);
      expect(result.success).toBe(true);
    });

    it('should validate data point with labels', () => {
      const dataPoint = {
        metricName: 'request_count',
        timestamp: new Date().toISOString(),
        value: 150,
        labels: { endpoint: '/api/users', method: 'GET' },
      };
      const result = MetricDataPointSchema.safeParse(dataPoint);
      expect(result.success).toBe(true);
    });
  });

  describe('RecordMetricRequestSchema', () => {
    it('should validate record request', () => {
      const request = {
        metricName: 'request_count',
        value: 1,
      };
      const result = validateRecordMetricRequest(request);
      expect(result.metricName).toBe('request_count');
    });

    it('should validate request with labels', () => {
      const request = {
        metricName: 'response_time',
        value: 150,
        labels: { status: '200' },
      };
      const result = safeValidateRecordMetricRequest(request);
      expect(result.success).toBe(true);
    });
  });

  describe('QueryMetricsRequestSchema', () => {
    it('should validate query request', () => {
      const request = {
        metricName: 'request_count',
        timeRange: {
          start: new Date(Date.now() - 3600000).toISOString(),
          end: new Date().toISOString(),
        },
      };
      const result = QueryMetricsRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate query with aggregation', () => {
      const request = {
        metricName: 'cpu_usage',
        timeRange: {
          start: new Date(Date.now() - 3600000).toISOString(),
          end: new Date().toISOString(),
        },
        aggregation: 'avg',
      };
      const result = QueryMetricsRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('TelemetrySummaryResultSchema', () => {
    it('should validate summary result', () => {
      const result = {
        totalMetrics: 10,
        totalDataPoints: 100,
        byCategory: [],
        generatedAt: new Date().toISOString(),
      };
      const parsed = TelemetrySummaryResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('INV-TEL-001: Metric Ordering', () => {
    it('should include timestamp on all data points', () => {
      const dataPoint = {
        metricName: 'test_metric',
        timestamp: new Date().toISOString(),
        value: 42,
      };
      const result = MetricDataPointSchema.safeParse(dataPoint);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timestamp).toBeDefined();
      }
    });
  });
});
