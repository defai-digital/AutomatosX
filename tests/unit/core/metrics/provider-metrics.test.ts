/**
 * Provider Metrics Infrastructure Tests
 *
 * Tests the provider metrics collection for PRD-012.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProviderMetricsCollector,
  getProviderMetrics
} from '@/core/metrics/provider-metrics.js';

// Mock feature flags to enable metrics
vi.mock('@/core/feature-flags/flags.js', () => ({
  shouldCollectProviderMetrics: vi.fn(() => true),
  isSDKFallbackEnabled: vi.fn(() => true)
}));

describe('Provider Metrics Infrastructure', () => {
  let metrics: ProviderMetricsCollector;

  beforeEach(() => {
    // Reset singleton and get fresh instance
    ProviderMetricsCollector.resetInstance();
    metrics = getProviderMetrics();
  });

  afterEach(() => {
    metrics.reset();
  });

  describe('SDK Execution Metrics', () => {
    it('should record successful SDK execution', () => {
      metrics.recordSDKExecution('glm', 100, true);

      const data = metrics.getProviderMetrics('glm');
      expect(data).toBeDefined();
      expect(data?.metrics.sdkExecutions).toBe(1);
      expect(data?.metrics.sdkErrors).toBe(0);
      expect(data?.metrics.avgSdkLatencyMs).toBe(100);
      expect(data?.metrics.sdkSuccessRate).toBe(1);
    });

    it('should record failed SDK execution', () => {
      metrics.recordSDKExecution('glm', 50, false);

      const data = metrics.getProviderMetrics('glm');
      expect(data?.metrics.sdkExecutions).toBe(1);
      expect(data?.metrics.sdkErrors).toBe(1);
      expect(data?.metrics.sdkSuccessRate).toBe(0);
    });

    it('should calculate average latency correctly', () => {
      metrics.recordSDKExecution('glm', 100, true);
      metrics.recordSDKExecution('glm', 200, true);
      metrics.recordSDKExecution('glm', 300, true);

      const data = metrics.getProviderMetrics('glm');
      expect(data?.metrics.avgSdkLatencyMs).toBe(200);  // (100+200+300)/3
    });

    it('should track success rate correctly', () => {
      metrics.recordSDKExecution('glm', 100, true);
      metrics.recordSDKExecution('glm', 100, true);
      metrics.recordSDKExecution('glm', 100, false);
      metrics.recordSDKExecution('glm', 100, true);

      const data = metrics.getProviderMetrics('glm');
      expect(data?.metrics.sdkSuccessRate).toBe(0.75);  // 3/4
    });
  });

  describe('CLI Execution Metrics', () => {
    it('should record CLI execution', () => {
      metrics.recordCLIExecution('claude', 500, true);

      const data = metrics.getProviderMetrics('claude');
      expect(data).toBeDefined();
      expect(data?.metrics.cliExecutions).toBe(1);
      expect(data?.metrics.cliErrors).toBe(0);
      expect(data?.metrics.avgCliLatencyMs).toBe(500);
    });

    it('should track CLI errors', () => {
      metrics.recordCLIExecution('claude', 100, false);

      const data = metrics.getProviderMetrics('claude');
      expect(data?.metrics.cliErrors).toBe(1);
      expect(data?.metrics.cliSuccessRate).toBe(0);
    });
  });

  describe('SDK Fallback Metrics', () => {
    it('should record SDK fallback', () => {
      metrics.recordSDKExecution('grok', 100, true);
      metrics.recordSDKExecution('grok', 100, false);
      metrics.recordSDKFallback('grok', 'SDK timeout');

      const data = metrics.getProviderMetrics('grok');
      expect(data?.metrics.sdkFallbacks).toBe(1);
      expect(data?.metrics.fallbackRate).toBe(0.5);  // 1 fallback / 2 executions
    });

    it('should calculate fallback rate correctly', () => {
      // 10 executions, 2 fallbacks
      for (let i = 0; i < 10; i++) {
        metrics.recordSDKExecution('grok', 100, true);
      }
      metrics.recordSDKFallback('grok', 'error1');
      metrics.recordSDKFallback('grok', 'error2');

      const data = metrics.getProviderMetrics('grok');
      expect(data?.metrics.fallbackRate).toBe(0.2);  // 2/10
    });
  });

  describe('MCP Connection Metrics', () => {
    it('should record successful MCP connection', () => {
      metrics.recordMCPConnection('claude', true);

      const mcpMetrics = metrics.getMCPMetrics();
      expect(mcpMetrics.totalConnections).toBe(1);
      expect(mcpMetrics.activeConnections).toBe(1);
      expect(mcpMetrics.failedConnections).toBe(0);
      expect(mcpMetrics.sessionsByProvider['claude']).toBe(1);
    });

    it('should record failed MCP connection', () => {
      metrics.recordMCPConnection('claude', false);

      const mcpMetrics = metrics.getMCPMetrics();
      expect(mcpMetrics.totalConnections).toBe(1);
      expect(mcpMetrics.failedConnections).toBe(1);
      expect(mcpMetrics.activeConnections).toBe(0);

      const providerData = metrics.getProviderMetrics('claude');
      expect(providerData?.metrics.mcpConnectionFailures).toBe(1);
    });

    it('should track MCP disconnection', () => {
      metrics.recordMCPConnection('claude', true);
      metrics.recordMCPConnection('claude', true);
      metrics.recordMCPDisconnection('claude');

      const mcpMetrics = metrics.getMCPMetrics();
      expect(mcpMetrics.activeConnections).toBe(1);
      expect(mcpMetrics.sessionsByProvider['claude']).toBe(1);
    });
  });

  describe('MCP Tool Call Metrics', () => {
    it('should record MCP tool calls', () => {
      metrics.recordMCPToolCall('claude', 'run_agent', 50, true);

      const data = metrics.getProviderMetrics('claude');
      expect(data?.metrics.mcpToolCalls).toBe(1);
      expect(data?.metrics.avgMcpLatencyMs).toBe(50);

      const mcpMetrics = metrics.getMCPMetrics();
      expect(mcpMetrics.totalToolCalls).toBe(1);
      expect(mcpMetrics.avgToolCallLatencyMs).toBe(50);
    });

    it('should calculate average MCP latency', () => {
      metrics.recordMCPToolCall('claude', 'tool1', 100, true);
      metrics.recordMCPToolCall('claude', 'tool2', 200, true);
      metrics.recordMCPToolCall('claude', 'tool3', 300, true);

      const data = metrics.getProviderMetrics('claude');
      expect(data?.metrics.avgMcpLatencyMs).toBe(200);
    });
  });

  describe('Circuit Breaker State', () => {
    it('should update circuit breaker state', () => {
      metrics.updateCircuitBreakerState('glm', 'closed');
      expect(metrics.getProviderMetrics('glm')?.circuitBreakerState).toBe('closed');

      metrics.updateCircuitBreakerState('glm', 'open');
      expect(metrics.getProviderMetrics('glm')?.circuitBreakerState).toBe('open');

      metrics.updateCircuitBreakerState('glm', 'half-open');
      expect(metrics.getProviderMetrics('glm')?.circuitBreakerState).toBe('half-open');
    });
  });

  describe('Execution Mode', () => {
    it('should update execution mode', () => {
      metrics.updateExecutionMode('glm', 'sdk');
      expect(metrics.getProviderMetrics('glm')?.executionMode).toBe('sdk');

      metrics.updateExecutionMode('glm', 'cli');
      expect(metrics.getProviderMetrics('glm')?.executionMode).toBe('cli');
    });
  });

  describe('Metrics Summary', () => {
    it('should aggregate metrics across providers', () => {
      // GLM: 5 SDK, 2 CLI
      for (let i = 0; i < 5; i++) {
        metrics.recordSDKExecution('glm', 100, true);
      }
      for (let i = 0; i < 2; i++) {
        metrics.recordCLIExecution('glm', 200, true);
      }

      // Grok: 3 SDK, 1 fallback
      for (let i = 0; i < 3; i++) {
        metrics.recordSDKExecution('grok', 150, true);
      }
      metrics.recordSDKFallback('grok', 'error');

      // MCP connections
      metrics.recordMCPConnection('claude', true);
      metrics.recordMCPConnection('gemini', true);

      const summary = metrics.getMetricsSummary();
      expect(summary.totalSDKExecutions).toBe(8);  // 5 + 3
      expect(summary.totalCLIExecutions).toBe(2);
      expect(summary.totalMCPConnections).toBe(2);
      expect(summary.overallFallbackRate).toBeCloseTo(0.125);  // 1/8
    });

    it('should track providers with open circuit breakers', () => {
      metrics.updateCircuitBreakerState('glm', 'open');
      metrics.updateCircuitBreakerState('grok', 'closed');
      metrics.updateCircuitBreakerState('claude', 'open');

      const summary = metrics.getMetricsSummary();
      expect(summary.providersWithOpenCircuitBreaker).toContain('glm');
      expect(summary.providersWithOpenCircuitBreaker).toContain('claude');
      expect(summary.providersWithOpenCircuitBreaker).not.toContain('grok');
    });
  });

  describe('getAllProviderMetrics', () => {
    it('should return all provider metrics', () => {
      metrics.recordSDKExecution('glm', 100, true);
      metrics.recordCLIExecution('claude', 200, true);
      metrics.recordMCPToolCall('gemini', 'tool', 50, true);

      const allMetrics = metrics.getAllProviderMetrics();
      expect(allMetrics).toHaveLength(3);

      const providers = allMetrics.map(m => m.providerName);
      expect(providers).toContain('glm');
      expect(providers).toContain('claude');
      expect(providers).toContain('gemini');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getProviderMetrics();
      const instance2 = getProviderMetrics();

      expect(instance1).toBe(instance2);
    });

    it('should reset correctly', () => {
      metrics.recordSDKExecution('test', 100, true);
      metrics.reset();

      expect(metrics.getAllProviderMetrics()).toHaveLength(0);
      expect(metrics.getMCPMetrics().totalConnections).toBe(0);
    });
  });
});
