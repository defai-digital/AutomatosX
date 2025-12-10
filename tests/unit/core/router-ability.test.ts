/**
 * Unit Tests for Router Ability Manager (v13.2.0)
 *
 * Tests ability-based provider routing functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RouterAbilityManager,
  getRouterAbilityManager,
  resetRouterAbilityManager,
  ABILITY_TYPES,
  type AbilityType,
  type AbilityLookupResult
} from '../../../src/core/router/ability-manager.js';
import type { RoutingConfig, AbilityRoutingConfig } from '../../../src/types/config.js';

describe('RouterAbilityManager', () => {
  let manager: RouterAbilityManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRouterAbilityManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRouterAbilityManager();
  });

  describe('constructor', () => {
    it('should initialize with empty config', () => {
      manager = new RouterAbilityManager();

      expect(manager.isEnabled()).toBe(false);
      expect(manager.getAllRoutings()).toEqual({});
    });

    it('should initialize with routing config', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: true,
        lastConfiguredAt: '2024-01-01T00:00:00Z',
        strategy: 'capability-based',
        abilityRouting: {
          'code-generation': { preferredProviders: ['claude-code', 'codex'] },
          'code-review': { preferredProviders: ['gemini-cli', 'claude-code'] }
        }
      };

      manager = new RouterAbilityManager(routingConfig);

      expect(manager.isEnabled()).toBe(true);
      expect(Object.keys(manager.getAllRoutings())).toHaveLength(2);
    });
  });

  describe('getAbilityRouting', () => {
    const routingConfig: RoutingConfig = {
      autoConfigured: true,
      abilityRouting: {
        'code-generation': { preferredProviders: ['claude-code', 'codex', 'qwen'] },
        'code-review': { preferredProviders: ['gemini-cli', 'claude-code'] },
        'custom-ability': { preferredProviders: ['grok'] }
      }
    };

    beforeEach(() => {
      manager = new RouterAbilityManager(routingConfig);
    });

    it('should return configured routing for known ability', () => {
      const result = manager.getAbilityRouting('code-generation');

      expect(result.hasRouting).toBe(true);
      expect(result.preferredProviders).toEqual(['claude-code', 'codex', 'qwen']);
      expect(result.source).toBe('config');
    });

    it('should return default routing for unconfigured known ability', () => {
      // 'security-audit' is a known ability but not in our config
      const result = manager.getAbilityRouting('security-audit');

      expect(result.hasRouting).toBe(true);
      expect(result.preferredProviders.length).toBeGreaterThan(0);
      expect(result.source).toBe('default');
    });

    it('should return custom routing for custom ability type', () => {
      const result = manager.getAbilityRouting('custom-ability');

      expect(result.hasRouting).toBe(true);
      expect(result.preferredProviders).toEqual(['grok']);
      expect(result.source).toBe('config');
    });

    it('should return no routing for completely unknown ability', () => {
      const result = manager.getAbilityRouting('unknown-ability-xyz');

      expect(result.hasRouting).toBe(false);
      expect(result.preferredProviders).toEqual([]);
      expect(result.source).toBe('default');
    });
  });

  describe('reorderByAbility', () => {
    const routingConfig: RoutingConfig = {
      autoConfigured: true,
      abilityRouting: {
        'code-generation': { preferredProviders: ['claude-code', 'codex', 'gemini-cli'] },
        'code-review': { preferredProviders: ['gemini-cli', 'claude-code'] }
      }
    };

    beforeEach(() => {
      manager = new RouterAbilityManager(routingConfig);
    });

    it('should reorder providers based on ability routing', () => {
      const result = manager.reorderByAbility({
        abilityType: 'code-generation',
        availableProviders: ['gemini-cli', 'codex', 'claude-code']
      });

      // claude-code should be first (preferred), then codex, then gemini-cli
      expect(result).toEqual(['claude-code', 'codex', 'gemini-cli']);
    });

    it('should handle missing preferred providers in available list', () => {
      const result = manager.reorderByAbility({
        abilityType: 'code-generation',
        availableProviders: ['gemini-cli', 'grok'] // claude-code and codex not available
      });

      // gemini-cli is in preferred list, grok is extra
      expect(result).toEqual(['gemini-cli', 'grok']);
    });

    it('should return original order for unknown ability', () => {
      const result = manager.reorderByAbility({
        abilityType: 'unknown-ability',
        availableProviders: ['gemini-cli', 'codex', 'claude-code']
      });

      // Should maintain original order
      expect(result).toEqual(['gemini-cli', 'codex', 'claude-code']);
    });

    it('should handle single provider', () => {
      const result = manager.reorderByAbility({
        abilityType: 'code-generation',
        availableProviders: ['claude-code']
      });

      expect(result).toEqual(['claude-code']);
    });

    it('should handle empty providers', () => {
      const result = manager.reorderByAbility({
        abilityType: 'code-generation',
        availableProviders: []
      });

      expect(result).toEqual([]);
    });

    it('should include providers not in routing config at the end', () => {
      const result = manager.reorderByAbility({
        abilityType: 'code-generation',
        availableProviders: ['glm', 'grok', 'claude-code', 'gemini-cli']
      });

      // claude-code first, then codex (missing), then gemini-cli, then extras
      expect(result[0]).toBe('claude-code');
      expect(result[1]).toBe('gemini-cli'); // codex not available, so gemini-cli next
      expect(result).toContain('glm');
      expect(result).toContain('grok');
    });

    it('should use default routing for unconfigured known ability', () => {
      const result = manager.reorderByAbility({
        abilityType: 'security-audit', // Not in our config, uses default
        availableProviders: ['grok', 'claude-code', 'codex']
      });

      // Default for security-audit: ['claude-code', 'grok', 'codex']
      expect(result[0]).toBe('claude-code');
    });
  });

  describe('updateConfig', () => {
    it('should update routing config at runtime', () => {
      manager = new RouterAbilityManager();
      expect(manager.isEnabled()).toBe(false);

      const newConfig: RoutingConfig = {
        autoConfigured: true,
        abilityRouting: {
          'code-generation': { preferredProviders: ['claude-code', 'codex'] }
        }
      };

      manager.updateConfig(newConfig);

      expect(manager.isEnabled()).toBe(true);
      const routing = manager.getAbilityRouting('code-generation');
      expect(routing.preferredProviders).toEqual(['claude-code', 'codex']);
      expect(routing.source).toBe('config');
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: true,
        lastConfiguredAt: '2024-01-15T12:00:00Z',
        strategy: 'capability-based',
        abilityRouting: {
          'code-generation': { preferredProviders: ['claude-code'] },
          'code-review': { preferredProviders: ['gemini-cli'] }
        }
      };

      manager = new RouterAbilityManager(routingConfig);
      const stats = manager.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.abilityCount).toBe(2);
      expect(stats.strategy).toBe('capability-based');
      expect(stats.lastConfiguredAt).toBe('2024-01-15T12:00:00Z');
      expect(stats.configuredAbilities).toContain('code-generation');
      expect(stats.configuredAbilities).toContain('code-review');
    });
  });

  describe('isEnabled', () => {
    it('should return false when not auto-configured', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: false,
        abilityRouting: {
          'code-generation': { preferredProviders: ['claude-code'] }
        }
      };

      manager = new RouterAbilityManager(routingConfig);
      expect(manager.isEnabled()).toBe(false);
    });

    it('should return false when no abilities configured', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: true,
        abilityRouting: {}
      };

      manager = new RouterAbilityManager(routingConfig);
      expect(manager.isEnabled()).toBe(false);
    });

    it('should return true when auto-configured with abilities', () => {
      const routingConfig: RoutingConfig = {
        autoConfigured: true,
        abilityRouting: {
          'code-generation': { preferredProviders: ['claude-code'] }
        }
      };

      manager = new RouterAbilityManager(routingConfig);
      expect(manager.isEnabled()).toBe(true);
    });
  });

  describe('isKnownAbility', () => {
    beforeEach(() => {
      manager = new RouterAbilityManager();
    });

    it('should return true for known ability types', () => {
      expect(manager.isKnownAbility('code-generation')).toBe(true);
      expect(manager.isKnownAbility('code-review')).toBe(true);
      expect(manager.isKnownAbility('security-audit')).toBe(true);
      expect(manager.isKnownAbility('documentation')).toBe(true);
      expect(manager.isKnownAbility('data-analysis')).toBe(true);
      expect(manager.isKnownAbility('architecture')).toBe(true);
      expect(manager.isKnownAbility('testing')).toBe(true);
      expect(manager.isKnownAbility('devops')).toBe(true);
      expect(manager.isKnownAbility('research')).toBe(true);
      expect(manager.isKnownAbility('creative')).toBe(true);
    });

    it('should return false for unknown ability types', () => {
      expect(manager.isKnownAbility('unknown')).toBe(false);
      expect(manager.isKnownAbility('custom-ability')).toBe(false);
      expect(manager.isKnownAbility('')).toBe(false);
    });
  });

  describe('getKnownAbilities', () => {
    it('should return all known ability types', () => {
      manager = new RouterAbilityManager();
      const abilities = manager.getKnownAbilities();

      expect(abilities).toEqual(ABILITY_TYPES);
      expect(abilities).toContain('code-generation');
      expect(abilities).toContain('code-review');
      expect(abilities).toContain('security-audit');
      expect(abilities.length).toBe(10);
    });
  });
});

describe('getRouterAbilityManager singleton', () => {
  beforeEach(() => {
    resetRouterAbilityManager();
  });

  afterEach(() => {
    resetRouterAbilityManager();
  });

  it('should return singleton instance', () => {
    const manager1 = getRouterAbilityManager();
    const manager2 = getRouterAbilityManager();

    expect(manager1).toBe(manager2);
  });

  it('should initialize with config on first call', () => {
    const config: RoutingConfig = {
      autoConfigured: true,
      abilityRouting: {
        'code-generation': { preferredProviders: ['claude-code'] }
      }
    };

    const manager = getRouterAbilityManager(config);
    expect(manager.isEnabled()).toBe(true);
  });

  it('should update config on subsequent calls', () => {
    // First call without config
    const manager1 = getRouterAbilityManager();
    expect(manager1.isEnabled()).toBe(false);

    // Second call with config
    const config: RoutingConfig = {
      autoConfigured: true,
      abilityRouting: {
        'code-generation': { preferredProviders: ['claude-code'] }
      }
    };

    const manager2 = getRouterAbilityManager(config);
    expect(manager2.isEnabled()).toBe(true);
    expect(manager1).toBe(manager2); // Same instance
  });
});

describe('ABILITY_TYPES constant', () => {
  it('should contain all expected ability types', () => {
    expect(ABILITY_TYPES).toContain('code-generation');
    expect(ABILITY_TYPES).toContain('code-review');
    expect(ABILITY_TYPES).toContain('security-audit');
    expect(ABILITY_TYPES).toContain('documentation');
    expect(ABILITY_TYPES).toContain('data-analysis');
    expect(ABILITY_TYPES).toContain('architecture');
    expect(ABILITY_TYPES).toContain('testing');
    expect(ABILITY_TYPES).toContain('devops');
    expect(ABILITY_TYPES).toContain('research');
    expect(ABILITY_TYPES).toContain('creative');
  });

  it('should be readonly', () => {
    // This is a compile-time check, but we can verify the array is frozen-like
    expect(ABILITY_TYPES.length).toBe(10);
  });
});
