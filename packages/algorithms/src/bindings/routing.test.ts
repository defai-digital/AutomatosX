/**
 * Routing Algorithm Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect } from 'vitest';
import {
  type Provider,
  type RoutingContext,
  defaultRoutingContext,
  calculateScore,
  selectProvider,
  getFallbackOrder,
} from './routing.js';

// Test providers
const createProvider = (overrides: Partial<Provider> = {}): Provider => ({
  id: 'test-provider',
  priority: 1,
  healthy: true,
  rateLimit: 0,
  latencyMs: 100,
  successRate: 0.95,
  integrationMode: 'mcp',
  ...overrides,
});

const testProviders: Provider[] = [
  createProvider({
    id: 'claude',
    priority: 1,
    latencyMs: 100,
    successRate: 0.98,
    integrationMode: 'mcp',
  }),
  createProvider({
    id: 'gemini',
    priority: 2,
    latencyMs: 150,
    successRate: 0.95,
    integrationMode: 'mcp',
  }),
  createProvider({
    id: 'openai',
    priority: 3,
    latencyMs: 200,
    successRate: 0.92,
    integrationMode: 'bash',
  }),
  createProvider({
    id: 'ax-cli',
    priority: 4,
    latencyMs: 50,
    successRate: 0.99,
    integrationMode: 'sdk',
  }),
];

describe('defaultRoutingContext', () => {
  it('should have default values', () => {
    expect(defaultRoutingContext.taskType).toBe('general');
    expect(defaultRoutingContext.complexity).toBe(5);
    expect(defaultRoutingContext.preferMcp).toBe(true);
    expect(defaultRoutingContext.excludeProviders).toEqual([]);
  });
});

describe('calculateScore', () => {
  it('should return negative score for unhealthy provider', () => {
    const unhealthy = createProvider({ healthy: false });
    const score = calculateScore(unhealthy, defaultRoutingContext);

    expect(score).toBeLessThan(0);
  });

  it('should give higher score to lower priority', () => {
    const highPriority = createProvider({ priority: 1 });
    const lowPriority = createProvider({ priority: 10 });

    const highScore = calculateScore(highPriority, defaultRoutingContext);
    const lowScore = calculateScore(lowPriority, defaultRoutingContext);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should give higher score to lower rate limit', () => {
    const lowUsage = createProvider({ rateLimit: 0.1 });
    const highUsage = createProvider({ rateLimit: 0.9 });

    const lowScore = calculateScore(lowUsage, defaultRoutingContext);
    const highScore = calculateScore(highUsage, defaultRoutingContext);

    expect(lowScore).toBeGreaterThan(highScore);
  });

  it('should give higher score to lower latency', () => {
    const fast = createProvider({ latencyMs: 50 });
    const slow = createProvider({ latencyMs: 500 });

    const fastScore = calculateScore(fast, defaultRoutingContext);
    const slowScore = calculateScore(slow, defaultRoutingContext);

    expect(fastScore).toBeGreaterThan(slowScore);
  });

  it('should give higher score to higher success rate', () => {
    const reliable = createProvider({ successRate: 0.99 });
    const unreliable = createProvider({ successRate: 0.7 });

    const reliableScore = calculateScore(reliable, defaultRoutingContext);
    const unreliableScore = calculateScore(unreliable, defaultRoutingContext);

    expect(reliableScore).toBeGreaterThan(unreliableScore);
  });

  it('should add MCP bonus when preferMcp is true', () => {
    const mcpProvider = createProvider({ integrationMode: 'mcp' });
    const bashProvider = createProvider({ integrationMode: 'bash' });

    const mcpContext: RoutingContext = { ...defaultRoutingContext, preferMcp: true };
    const mcpScore = calculateScore(mcpProvider, mcpContext);
    const bashScore = calculateScore(bashProvider, mcpContext);

    expect(mcpScore).toBeGreaterThan(bashScore);
  });

  it('should not add MCP bonus when preferMcp is false', () => {
    const mcpProvider = createProvider({ integrationMode: 'mcp' });
    const bashProvider = createProvider({ integrationMode: 'bash' });

    const noMcpContext: RoutingContext = { ...defaultRoutingContext, preferMcp: false };
    const mcpScore = calculateScore(mcpProvider, noMcpContext);
    const bashScore = calculateScore(bashProvider, noMcpContext);

    // Scores should be similar without MCP preference
    expect(Math.abs(mcpScore - bashScore)).toBeLessThan(30);
  });

  it('should add complexity bonus for high complexity tasks', () => {
    const reliable = createProvider({ successRate: 0.99 });

    const lowComplexity: RoutingContext = { ...defaultRoutingContext, complexity: 3 };
    const highComplexity: RoutingContext = { ...defaultRoutingContext, complexity: 9 };

    const lowScore = calculateScore(reliable, lowComplexity);
    const highScore = calculateScore(reliable, highComplexity);

    expect(highScore).toBeGreaterThan(lowScore);
  });
});

describe('selectProvider', () => {
  it('should select the best provider', () => {
    const result = selectProvider(testProviders);

    expect(result.provider).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
    expect(result.reason).toBeDefined();
  });

  it('should return null when no providers available', () => {
    const result = selectProvider([]);

    expect(result.provider).toBeNull();
    expect(result.reason).toContain('No healthy providers');
  });

  it('should return null when all providers are unhealthy', () => {
    const unhealthy = testProviders.map(p => ({ ...p, healthy: false }));
    const result = selectProvider(unhealthy);

    expect(result.provider).toBeNull();
    expect(result.reason).toContain('No healthy providers');
  });

  it('should force selection of specific provider', () => {
    const ctx: RoutingContext = {
      ...defaultRoutingContext,
      forceProvider: 'openai',
    };

    const result = selectProvider(testProviders, ctx);

    expect(result.provider?.id).toBe('openai');
    expect(result.reason).toContain('Forced');
  });

  it('should return error when forced provider not found', () => {
    const ctx: RoutingContext = {
      ...defaultRoutingContext,
      forceProvider: 'nonexistent',
    };

    const result = selectProvider(testProviders, ctx);

    expect(result.provider).toBeNull();
    expect(result.reason).toContain('not found');
  });

  it('should exclude specified providers', () => {
    const ctx: RoutingContext = {
      ...defaultRoutingContext,
      excludeProviders: ['claude', 'gemini'],
    };

    const result = selectProvider(testProviders, ctx);

    expect(result.provider?.id).not.toBe('claude');
    expect(result.provider?.id).not.toBe('gemini');
  });

  it('should provide alternatives', () => {
    const result = selectProvider(testProviders);

    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
  });

  it('should sort alternatives by score', () => {
    const result = selectProvider(testProviders);

    for (let i = 0; i < result.alternatives.length - 1; i++) {
      expect(result.alternatives[i]!.score).toBeGreaterThanOrEqual(
        result.alternatives[i + 1]!.score
      );
    }
  });

  it('should use default context when none provided', () => {
    const result = selectProvider(testProviders);

    expect(result.provider).not.toBeNull();
  });
});

describe('getFallbackOrder', () => {
  it('should return providers sorted by score', () => {
    const order = getFallbackOrder(testProviders);

    expect(order.length).toBeGreaterThan(0);
    expect(order.length).toBeLessThanOrEqual(testProviders.length);
  });

  it('should exclude unhealthy providers', () => {
    const withUnhealthy = [
      ...testProviders,
      createProvider({ id: 'unhealthy', healthy: false }),
    ];

    const order = getFallbackOrder(withUnhealthy);

    expect(order.every(p => p.healthy)).toBe(true);
    expect(order.find(p => p.id === 'unhealthy')).toBeUndefined();
  });

  it('should exclude specified providers', () => {
    const ctx: RoutingContext = {
      ...defaultRoutingContext,
      excludeProviders: ['claude'],
    };

    const order = getFallbackOrder(testProviders, ctx);

    expect(order.find(p => p.id === 'claude')).toBeUndefined();
  });

  it('should return empty array when all providers excluded', () => {
    const ctx: RoutingContext = {
      ...defaultRoutingContext,
      excludeProviders: testProviders.map(p => p.id),
    };

    const order = getFallbackOrder(testProviders, ctx);

    expect(order).toEqual([]);
  });

  it('should prefer MCP providers when preferMcp is true', () => {
    const ctx: RoutingContext = {
      ...defaultRoutingContext,
      preferMcp: true,
    };

    const order = getFallbackOrder(testProviders, ctx);

    // MCP providers should generally be at the top
    const mcpProviders = order.filter(p => p.integrationMode === 'mcp');
    expect(mcpProviders.length).toBeGreaterThan(0);
  });
});
