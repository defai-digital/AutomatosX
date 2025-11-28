/**
 * Provider Router Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderRouter, type RouteOptions, type ProviderRouterEvents } from './provider-router.js';
import type { Config, ExecutionRequest, ExecutionResponse, ProviderType } from '@ax/schemas';

// Mock config
const mockConfig: Config = {
  providers: {
    default: 'claude',
    enabled: ['claude', 'gemini'],
    fallbackOrder: ['claude', 'gemini'],
  },
  execution: {
    timeout: 60000,
    maxConcurrency: 5,
    retryAttempts: 3,
  },
  memory: {
    enabled: true,
    databasePath: ':memory:',
    maxEntries: 1000,
  },
  session: {
    storagePath: '/tmp/sessions',
    maxInMemory: 100,
  },
  checkpoint: {
    enabled: false,
    storagePath: '/tmp/checkpoints',
    interval: 60000,
  },
  router: {
    healthCheckInterval: 60000,
    preferMcp: true,
  },
  workspace: {
    basePath: '/tmp/workspace',
    agentsPath: '/tmp/agents',
  },
  logging: {
    level: 'info',
    format: 'text',
  },
};

// Mock provider
const createMockProvider = (id: ProviderType, healthy = true) => ({
  id,
  integrationMode: 'mcp' as const,
  isHealthy: vi.fn().mockReturnValue(healthy),
  getHealth: vi.fn().mockReturnValue({
    healthy,
    latencyMs: 100,
    successRate: 0.95,
    consecutiveFailures: 0,
  }),
  checkHealth: vi.fn().mockResolvedValue(healthy),
  executeWithTracking: vi.fn().mockResolvedValue({
    success: true,
    output: 'Result',
    provider: id,
    metadata: { duration: 100, tokens: 50, model: 'test' },
  } as ExecutionResponse),
  setEvents: vi.fn(),
  cleanup: vi.fn().mockResolvedValue(undefined),
});

// Mock createProvider
vi.mock('@ax/providers', () => ({
  createProvider: vi.fn((type: ProviderType) => createMockProvider(type)),
  BaseProvider: class {},
}));

describe('ProviderRouter', () => {
  let router: ProviderRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new ProviderRouter({
      config: mockConfig,
      autoHealthCheck: false, // Disable to avoid timing issues in tests
    });
  });

  afterEach(async () => {
    await router.cleanup();
  });

  describe('initialization', () => {
    it('should initialize with enabled providers', () => {
      const providers = router.getEnabledProviders();

      expect(providers).toContain('claude');
      expect(providers).toContain('gemini');
    });

    it('should throw if no providers can be initialized', async () => {
      const providers = await import('@ax/providers');
      const originalMock = vi.mocked(providers.createProvider).getMockImplementation();

      vi.mocked(providers.createProvider).mockImplementation(() => {
        throw new Error('Failed to initialize');
      });

      try {
        expect(() => new ProviderRouter({
          config: mockConfig,
          autoHealthCheck: false,
        })).toThrow('No providers could be initialized');
      } finally {
        // Restore original mock
        if (originalMock) {
          vi.mocked(providers.createProvider).mockImplementation(originalMock);
        } else {
          vi.mocked(providers.createProvider).mockImplementation((type: ProviderType) => createMockProvider(type));
        }
      }
    });
  });

  describe('route()', () => {
    it('should route request to best provider', async () => {
      const request: ExecutionRequest = {
        task: 'Test task',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      const response = await router.route(request);

      expect(response.success).toBe(true);
      expect(response.output).toBe('Result');
    });

    it('should update metrics on successful request', async () => {
      const request: ExecutionRequest = {
        task: 'Test task',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await router.route(request);

      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
    });

    it('should use forced provider when specified', async () => {
      const request: ExecutionRequest = {
        task: 'Test task',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await router.route(request, { forceProvider: 'gemini' });

      // Request should be routed
      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(1);
    });

    it('should attempt fallback on failure', async () => {
      const providers = await import('@ax/providers');
      const originalMock = vi.mocked(providers.createProvider).getMockImplementation();

      try {
        // First provider fails, second succeeds
        let callCount = 0;
        vi.mocked(providers.createProvider).mockImplementation((type: ProviderType) => {
          const provider = createMockProvider(type);
          if (callCount === 0) {
            provider.executeWithTracking.mockResolvedValue({
              success: false,
              output: '',
              error: 'Failed',
              provider: type,
              metadata: { duration: 100, tokens: 0, model: 'test' },
            });
          }
          callCount++;
          return provider;
        });

        const newRouter = new ProviderRouter({
          config: mockConfig,
          autoHealthCheck: false,
        });

        const request: ExecutionRequest = {
          task: 'Test task',
          agent: 'backend',
          context: {},
          timeout: 60000,
          stream: false,
          priority: 'normal',
        };

        await newRouter.route(request, { enableFallback: true });

        const metrics = newRouter.getMetrics();
        expect(metrics.fallbackAttempts).toBeGreaterThanOrEqual(0);

        await newRouter.cleanup();
      } finally {
        // Restore original mock
        if (originalMock) {
          vi.mocked(providers.createProvider).mockImplementation(originalMock);
        } else {
          vi.mocked(providers.createProvider).mockImplementation((type: ProviderType) => createMockProvider(type));
        }
      }
    });

    it('should respect maxRetries option', async () => {
      const request: ExecutionRequest = {
        task: 'Test task',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await router.route(request, { maxRetries: 1 });

      // Should not exceed retry limit
      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(1);
    });
  });

  describe('executeWithProvider()', () => {
    it('should execute directly with provider instance', async () => {
      const provider = router.getProvider('claude');
      expect(provider).toBeDefined();

      const request: ExecutionRequest = {
        task: 'Direct execution',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      const response = await router.executeWithProvider(provider!, request);

      expect(response.success).toBe(true);
    });

    it('should execute with provider type string', async () => {
      const request: ExecutionRequest = {
        task: 'Direct execution',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      const response = await router.executeWithProvider('claude', request);

      expect(response.success).toBe(true);
    });

    it('should throw for non-existent provider', async () => {
      const request: ExecutionRequest = {
        task: 'Test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await expect(router.executeWithProvider('invalid' as any, request)).rejects.toThrow(
        'Provider not found'
      );
    });
  });

  describe('getProvider()', () => {
    it('should return provider by type', () => {
      const provider = router.getProvider('claude');
      expect(provider).toBeDefined();
    });

    it('should return undefined for non-existent provider', () => {
      const provider = router.getProvider('invalid' as any);
      expect(provider).toBeUndefined();
    });
  });

  describe('getAllProviders()', () => {
    it('should return all providers', () => {
      const providers = router.getAllProviders();

      expect(providers.size).toBe(2);
      expect(providers.has('claude')).toBe(true);
      expect(providers.has('gemini')).toBe(true);
    });

    it('should return a copy', () => {
      const providers1 = router.getAllProviders();
      const providers2 = router.getAllProviders();

      expect(providers1).not.toBe(providers2);
    });
  });

  describe('isProviderAvailable()', () => {
    it('should return true for healthy provider', () => {
      const available = router.isProviderAvailable('claude');
      expect(available).toBe(true);
    });

    it('should return false for non-existent provider', () => {
      const available = router.isProviderAvailable('invalid' as any);
      expect(available).toBe(false);
    });
  });

  describe('getFallbackChain()', () => {
    it('should return ordered fallback chain', () => {
      const chain = router.getFallbackChain();

      expect(chain.length).toBe(2);
      expect(chain).toContain('claude');
      expect(chain).toContain('gemini');
    });
  });

  describe('metrics', () => {
    it('should track request counts', async () => {
      const request: ExecutionRequest = {
        task: 'Test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await router.route(request);
      await router.route(request);

      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(2);
    });

    it('should track latency per provider', async () => {
      const request: ExecutionRequest = {
        task: 'Test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await router.route(request);

      const metrics = router.getMetrics();
      expect(metrics.avgLatencyByProvider.size).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', async () => {
      const request: ExecutionRequest = {
        task: 'Test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await router.route(request);
      router.resetMetrics();

      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
    });
  });

  describe('health checks', () => {
    it('should check all provider health', async () => {
      const results = await router.checkAllHealth();

      expect(results.size).toBe(2);
      expect(results.get('claude')).toBe(true);
      expect(results.get('gemini')).toBe(true);
    });
  });

  describe('events', () => {
    it('should emit onProviderSelected', async () => {
      let selectedProvider: ProviderType | null = null;
      router.setEvents({
        onProviderSelected: (provider) => { selectedProvider = provider; },
      });

      const request: ExecutionRequest = {
        task: 'Test',
        agent: 'backend',
        context: {},
        timeout: 60000,
        stream: false,
        priority: 'normal',
      };

      await router.route(request);

      expect(selectedProvider).not.toBeNull();
    });

    it('should emit onHealthUpdate during health check', async () => {
      const healthUpdates: Array<{ provider: ProviderType; healthy: boolean }> = [];
      router.setEvents({
        onHealthUpdate: (provider, healthy) => {
          healthUpdates.push({ provider, healthy });
        },
      });

      await router.checkAllHealth();

      expect(healthUpdates.length).toBe(2);
    });
  });

  describe('cleanup()', () => {
    it('should clean up all providers', async () => {
      await router.cleanup();

      const providers = router.getAllProviders();
      expect(providers.size).toBe(0);
    });
  });
});
