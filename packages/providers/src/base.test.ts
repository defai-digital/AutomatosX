/**
 * Base Provider Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseProvider, type ProviderEvents } from './base.js';
import type { ExecutionRequest, ExecutionResponse, ProviderType, IntegrationMode } from '@ax/schemas';

// Concrete test implementation of BaseProvider
class TestProvider extends BaseProvider {
  readonly id: ProviderType = 'claude';
  readonly name = 'Test Provider';
  readonly integrationMode: IntegrationMode = 'mcp';

  private shouldFail = false;
  private executionDelay = 0;
  private healthyStatus = true;

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setExecutionDelay(delay: number): void {
    this.executionDelay = delay;
  }

  setHealthy(healthy: boolean): void {
    this.healthyStatus = healthy;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (this.executionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelay));
    }

    if (this.shouldFail) {
      return {
        success: false,
        output: '',
        error: 'Execution failed',
        provider: this.id,
        metadata: {
          duration: 100,
          tokens: 0,
          model: 'test',
        },
      };
    }

    return {
      success: true,
      output: `Executed: ${request.task}`,
      provider: this.id,
      metadata: {
        duration: 100,
        tokens: 50,
        model: 'test',
      },
    };
  }

  async checkHealth(): Promise<boolean> {
    return this.healthyStatus;
  }
}

describe('BaseProvider', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider();
  });

  describe('properties', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('claude');
    });

    it('should have correct name', () => {
      expect(provider.name).toBe('Test Provider');
    });

    it('should have correct integration mode', () => {
      expect(provider.integrationMode).toBe('mcp');
    });
  });

  describe('getHealth()', () => {
    it('should return default health status', () => {
      const health = provider.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.successRate).toBeGreaterThanOrEqual(0);
      expect(health.consecutiveFailures).toBe(0);
      expect(health.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe('isHealthy()', () => {
    it('should return true by default', () => {
      expect(provider.isHealthy()).toBe(true);
    });
  });

  describe('checkHealth()', () => {
    it('should return true when healthy', async () => {
      provider.setHealthy(true);
      expect(await provider.checkHealth()).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      provider.setHealthy(false);
      expect(await provider.checkHealth()).toBe(false);
    });
  });

  describe('execute()', () => {
    it('should execute request successfully', async () => {
      const request: ExecutionRequest = {
        task: 'Test task',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      const response = await provider.execute(request);

      expect(response.success).toBe(true);
      expect(response.output).toContain('Test task');
      expect(response.provider).toBe('claude');
    });

    it('should return failure response on error', async () => {
      provider.setFailure(true);

      const request: ExecutionRequest = {
        task: 'Test task',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      const response = await provider.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('executeWithTracking()', () => {
    it('should track successful execution', async () => {
      const request: ExecutionRequest = {
        task: 'Track test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      const response = await provider.executeWithTracking(request);

      expect(response.success).toBe(true);
      expect(response.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track failed execution', async () => {
      provider.setFailure(true);

      const request: ExecutionRequest = {
        task: 'Fail test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      const response = await provider.executeWithTracking(request);

      expect(response.success).toBe(false);
    });

    it('should emit onExecutionStart event', async () => {
      let startEmitted = false;
      provider.setEvents({
        onExecutionStart: () => { startEmitted = true; },
      });

      const request: ExecutionRequest = {
        task: 'Event test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await provider.executeWithTracking(request);

      expect(startEmitted).toBe(true);
    });

    it('should emit onExecutionEnd event', async () => {
      let endResponse: ExecutionResponse | null = null;
      provider.setEvents({
        onExecutionEnd: (response) => { endResponse = response; },
      });

      const request: ExecutionRequest = {
        task: 'Event test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await provider.executeWithTracking(request);

      expect(endResponse).not.toBeNull();
      expect(endResponse!.success).toBe(true);
    });

    it('should emit onExecutionEnd event on failure response', async () => {
      // Note: onError is only emitted for exceptions, not normal failure responses
      provider.setFailure(true);

      let endResponse: ExecutionResponse | null = null;
      provider.setEvents({
        onExecutionEnd: (response) => { endResponse = response; },
      });

      const request: ExecutionRequest = {
        task: 'Error test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await provider.executeWithTracking(request);

      // onExecutionEnd is called even for failed responses
      expect(endResponse).not.toBeNull();
      expect(endResponse!.success).toBe(false);
    });
  });

  describe('setEvents()', () => {
    it('should set event handlers', () => {
      const events: ProviderEvents = {
        onHealthChange: vi.fn(),
        onExecutionStart: vi.fn(),
        onExecutionEnd: vi.fn(),
        onError: vi.fn(),
      };

      provider.setEvents(events);

      // Verify by triggering events
      expect(() => provider.setEvents(events)).not.toThrow();
    });
  });

  describe('initialize()', () => {
    it('should initialize without config', async () => {
      await expect(provider.initialize()).resolves.not.toThrow();
    });

    it('should initialize with config', async () => {
      await expect(provider.initialize({
        timeout: 30000,
        retryAttempts: 3,
      })).resolves.not.toThrow();
    });
  });

  describe('cleanup()', () => {
    it('should cleanup without errors', async () => {
      await expect(provider.cleanup()).resolves.not.toThrow();
    });
  });

  describe('circuit breaker', () => {
    it('should track consecutive failures', async () => {
      provider.setFailure(true);

      const request: ExecutionRequest = {
        task: 'Fail',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      // Execute multiple failures
      await provider.executeWithTracking(request);
      await provider.executeWithTracking(request);

      const health = provider.getHealth();
      expect(health.consecutiveFailures).toBeGreaterThan(0);
    });

    it('should reset consecutive failures on success', async () => {
      provider.setFailure(true);

      const request: ExecutionRequest = {
        task: 'Test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      // Fail first
      await provider.executeWithTracking(request);

      // Then succeed
      provider.setFailure(false);
      await provider.executeWithTracking(request);

      const health = provider.getHealth();
      expect(health.consecutiveFailures).toBe(0);
    });
  });

  describe('success rate', () => {
    it('should track success rate', async () => {
      const request: ExecutionRequest = {
        task: 'Rate test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      // Execute several successful requests
      for (let i = 0; i < 5; i++) {
        await provider.executeWithTracking(request);
      }

      const health = provider.getHealth();
      expect(health.successRate).toBe(1); // All successful
    });

    it('should decrease success rate on failures', async () => {
      const request: ExecutionRequest = {
        task: 'Rate test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      // Execute some successes
      for (let i = 0; i < 3; i++) {
        await provider.executeWithTracking(request);
      }

      // Then some failures
      provider.setFailure(true);
      for (let i = 0; i < 2; i++) {
        await provider.executeWithTracking(request);
      }

      const health = provider.getHealth();
      expect(health.successRate).toBeLessThan(1);
    });
  });
});
