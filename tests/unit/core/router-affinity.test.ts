/**
 * Unit Tests for Router Affinity Manager (v13.1.0)
 *
 * Tests agent-provider affinity routing functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RouterAffinityManager,
  getRouterAffinityManager,
  resetRouterAffinityManager,
  type AffinityLookupResult
} from '../../../src/core/router/affinity-manager.js';
import type { RoutingConfig, AgentAffinityConfig } from '../../../src/types/config.js';

describe('RouterAffinityManager', () => {
  let manager: RouterAffinityManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRouterAffinityManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRouterAffinityManager();
  });

  describe('constructor', () => {
    it('should initialize with empty config', () => {
      manager = new RouterAffinityManager();

      expect(manager.isEnabled()).toBe(false);
      expect(manager.getAllAffinities()).toEqual({});
    });

    it('should initialize with routing config', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: true,
        lastConfiguredAt: '2024-01-01T00:00:00Z',
        strategy: 'capability-based',
        agentAffinities: {
          backend: { primary: 'claude-code', fallback: ['gemini-cli', 'codex'] },
          quality: { primary: 'gemini-cli', fallback: ['claude-code'] }
        }
      };

      manager = new RouterAffinityManager(routingConfig);

      expect(manager.isEnabled()).toBe(true);
      expect(Object.keys(manager.getAllAffinities())).toHaveLength(2);
    });
  });

  describe('getAgentAffinity', () => {
    const routingConfig: RoutingConfig = {
      autoConfigured: true,
      agentAffinities: {
        backend: { primary: 'claude-code', fallback: ['gemini-cli', 'codex'] },
        quality: { primary: 'gemini-cli', fallback: ['claude-code'] },
        frontend: { primary: null, fallback: [] }
      }
    };

    beforeEach(() => {
      manager = new RouterAffinityManager(routingConfig);
    });

    it('should return affinity for configured agent', () => {
      const result = manager.getAgentAffinity('backend');

      expect(result.hasAffinity).toBe(true);
      expect(result.primary).toBe('claude-code');
      expect(result.fallback).toEqual(['gemini-cli', 'codex']);
      expect(result.source).toBe('config');
    });

    it('should return default for unknown agent', () => {
      const result = manager.getAgentAffinity('unknown-agent');

      expect(result.hasAffinity).toBe(false);
      expect(result.primary).toBe(null);
      expect(result.fallback).toEqual([]);
      expect(result.source).toBe('default');
    });

    it('should handle agent with null primary', () => {
      const result = manager.getAgentAffinity('frontend');

      expect(result.hasAffinity).toBe(true);
      expect(result.primary).toBe(null);
      expect(result.fallback).toEqual([]);
      expect(result.source).toBe('config');
    });
  });

  describe('reorderByAffinity', () => {
    const routingConfig: RoutingConfig = {
      autoConfigured: true,
      agentAffinities: {
        backend: { primary: 'claude-code', fallback: ['codex', 'gemini-cli'] },
        quality: { primary: 'gemini-cli', fallback: ['claude-code'] }
      }
    };

    beforeEach(() => {
      manager = new RouterAffinityManager(routingConfig);
    });

    it('should reorder providers based on agent affinity', () => {
      const result = manager.reorderByAffinity({
        agentName: 'backend',
        availableProviders: ['gemini-cli', 'codex', 'claude-code']
      });

      // claude-code (primary) should be first, then codex, then gemini-cli
      expect(result).toEqual(['claude-code', 'codex', 'gemini-cli']);
    });

    it('should handle missing primary in available providers', () => {
      const result = manager.reorderByAffinity({
        agentName: 'backend',
        availableProviders: ['gemini-cli', 'codex'] // claude-code not available
      });

      // Should use fallback order: codex, gemini-cli
      expect(result).toEqual(['codex', 'gemini-cli']);
    });

    it('should return original order for unknown agent', () => {
      const result = manager.reorderByAffinity({
        agentName: 'unknown',
        availableProviders: ['gemini-cli', 'codex', 'claude-code']
      });

      // Should maintain original order
      expect(result).toEqual(['gemini-cli', 'codex', 'claude-code']);
    });

    it('should handle single provider', () => {
      const result = manager.reorderByAffinity({
        agentName: 'backend',
        availableProviders: ['claude-code']
      });

      expect(result).toEqual(['claude-code']);
    });

    it('should handle empty providers', () => {
      const result = manager.reorderByAffinity({
        agentName: 'backend',
        availableProviders: []
      });

      expect(result).toEqual([]);
    });

    it('should include providers not in affinity config at the end', () => {
      const result = manager.reorderByAffinity({
        agentName: 'backend',
        availableProviders: ['glm', 'grok', 'claude-code', 'gemini-cli']
      });

      // claude-code first, then fallback (gemini-cli), then others
      expect(result[0]).toBe('claude-code');
      // codex is in fallback but not available, so it's skipped
      // gemini-cli is next in fallback and available
      expect(result).toContain('glm');
      expect(result).toContain('grok');
    });
  });

  describe('updateConfig', () => {
    it('should update routing config at runtime', () => {
      manager = new RouterAffinityManager();
      expect(manager.isEnabled()).toBe(false);

      const newConfig: RoutingConfig = {
        autoConfigured: true,
        agentAffinities: {
          backend: { primary: 'claude-code', fallback: [] }
        }
      };

      manager.updateConfig(newConfig);

      expect(manager.isEnabled()).toBe(true);
      const affinity = manager.getAgentAffinity('backend');
      expect(affinity.primary).toBe('claude-code');
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: true,
        lastConfiguredAt: '2024-01-15T12:00:00Z',
        strategy: 'capability-based',
        agentAffinities: {
          backend: { primary: 'claude-code', fallback: [] },
          quality: { primary: 'gemini-cli', fallback: [] }
        }
      };

      manager = new RouterAffinityManager(routingConfig);
      const stats = manager.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.agentCount).toBe(2);
      expect(stats.strategy).toBe('capability-based');
      expect(stats.lastConfiguredAt).toBe('2024-01-15T12:00:00Z');
    });
  });

  describe('isEnabled', () => {
    it('should return false when not auto-configured', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: false,
        agentAffinities: {
          backend: { primary: 'claude-code', fallback: [] }
        }
      };

      manager = new RouterAffinityManager(routingConfig);
      expect(manager.isEnabled()).toBe(false);
    });

    it('should return false when no affinities configured', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: true,
        agentAffinities: {}
      };

      manager = new RouterAffinityManager(routingConfig);
      expect(manager.isEnabled()).toBe(false);
    });

    it('should return true when auto-configured with affinities', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: true,
        agentAffinities: {
          backend: { primary: 'claude-code', fallback: [] }
        }
      };

      manager = new RouterAffinityManager(routingConfig);
      expect(manager.isEnabled()).toBe(true);
    });
  });
});

describe('getRouterAffinityManager singleton', () => {
  beforeEach(() => {
    resetRouterAffinityManager();
  });

  afterEach(() => {
    resetRouterAffinityManager();
  });

  it('should return singleton instance', () => {
    const manager1 = getRouterAffinityManager();
    const manager2 = getRouterAffinityManager();

    expect(manager1).toBe(manager2);
  });

  it('should initialize with config on first call', () => {
    const config: RoutingConfig = {
      autoConfigured: true,
      agentAffinities: {
        backend: { primary: 'claude-code', fallback: [] }
      }
    };

    const manager = getRouterAffinityManager(config);
    expect(manager.isEnabled()).toBe(true);
  });

  it('should update config on subsequent calls', () => {
    // First call without config
    const manager1 = getRouterAffinityManager();
    expect(manager1.isEnabled()).toBe(false);

    // Second call with config
    const config: RoutingConfig = {
      autoConfigured: true,
      agentAffinities: {
        backend: { primary: 'claude-code', fallback: [] }
      }
    };

    const manager2 = getRouterAffinityManager(config);
    expect(manager2.isEnabled()).toBe(true);
    expect(manager1).toBe(manager2); // Same instance
  });
});
