/**
 * StrategySelector Tests
 *
 * Comprehensive test suite for strategy selection logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrategySelector, BUILTIN_STRATEGIES } from '../StrategySelector.js';
import type { FailureAnalysis, IterationResult, Strategy } from '../../types/iterate.types.js';

describe('StrategySelector', () => {
  let selector: StrategySelector;

  beforeEach(() => {
    selector = new StrategySelector('auto');
  });

  describe('selectInitial', () => {
    it('should always select default strategy first', async () => {
      const strategy = await selector.selectInitial();

      expect(strategy.name).toBe('default');
      expect(strategy.priority).toBe(10);
    });

    it('should return strategy with correct configuration', async () => {
      const strategy = await selector.selectInitial();

      expect(strategy.config.timeout).toBe(300000);
      expect(strategy.config.retryBackoff).toBe('exponential');
      expect(strategy.config.parallelism).toBe(5);
      expect(strategy.config.useCache).toBe(true);
    });
  });

  describe('selectNext - Error Type Matching', () => {
    it('should select aggressive-timeout for timeout errors', async () => {
      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'timeout',
        isTransient: true,
        isPermanent: false,
        severity: 'low',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.8
      };

      const strategy = await selector.selectNext(previousStrategy, failureAnalysis, []);

      expect(strategy.name).toBe('aggressive-timeout');
      expect(strategy.config.timeout).toBe(600000); // 10 minutes
    });

    it('should select fallback-providers for rate limit errors', async () => {
      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'rate_limit',
        isTransient: true,
        isPermanent: false,
        severity: 'medium',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.9
      };

      const strategy = await selector.selectNext(previousStrategy, failureAnalysis, []);

      expect(strategy.name).toBe('fallback-providers');
      expect(strategy.config.fallbackProviders).toBe(true);
      expect(strategy.config.useCache).toBe(false); // Force fresh attempt
    });

    it('should select reduced-parallelism for resource errors', async () => {
      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'resource_exhausted',
        isTransient: true,
        isPermanent: false,
        severity: 'high',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.85
      };

      const strategy = await selector.selectNext(previousStrategy, failureAnalysis, []);

      expect(strategy.name).toBe('reduced-parallelism');
      expect(strategy.config.parallelism).toBe(1);
    });

    it('should select skip-optional for partial failures', async () => {
      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'partial_failure',
        isTransient: true,
        isPermanent: false,
        severity: 'low',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.7
      };

      const strategy = await selector.selectNext(previousStrategy, failureAnalysis, []);

      expect(strategy.name).toBe('skip-optional');
      expect(strategy.config.skipOptionalSteps).toBe(true);
    });
  });

  describe('selectNext - Fallback Logic', () => {
    it('should fallback to next priority when no specific match', async () => {
      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'unknown',
        isTransient: true,
        isPermanent: false,
        severity: 'medium',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.5
      };

      const strategy = await selector.selectNext(previousStrategy, failureAnalysis, []);

      // Should get next highest priority (aggressive-timeout = 8)
      expect(strategy.priority).toBeLessThan(previousStrategy.priority);
    });

    it('should avoid selecting same strategy immediately', async () => {
      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'aggressive-timeout')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'timeout',
        isTransient: true,
        isPermanent: false,
        severity: 'low',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.8
      };

      const strategy = await selector.selectNext(previousStrategy, failureAnalysis, []);

      expect(strategy.name).not.toBe('aggressive-timeout');
    });

    it('should cycle back to high priority when all strategies exhausted', async () => {
      const lowestStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'skip-optional')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'unknown',
        isTransient: true,
        isPermanent: false,
        severity: 'medium',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.5
      };

      const strategy = await selector.selectNext(lowestStrategy, failureAnalysis, []);

      // Should cycle back to a high priority strategy
      expect(strategy.priority).toBeGreaterThan(lowestStrategy.priority);
    });
  });

  describe('selectNext - Success History', () => {
    it('should prefer strategies with success history', async () => {
      // Record some successes
      const aggressiveTimeout = BUILTIN_STRATEGIES.find(s => s.name === 'aggressive-timeout')!;
      selector.recordSuccess(aggressiveTimeout);
      selector.recordSuccess(aggressiveTimeout);

      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'timeout',
        isTransient: true,
        isPermanent: false,
        severity: 'low',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.8
      };

      const strategy = await selector.selectNext(previousStrategy, failureAnalysis, []);

      expect(strategy.name).toBe('aggressive-timeout');
    });
  });

  describe('selectNext - Mode-Specific Selection', () => {
    it('should use conservative selection in conservative mode', async () => {
      const conservativeSelector = new StrategySelector('conservative');

      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'timeout',
        isTransient: true,
        isPermanent: false,
        severity: 'low',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.8
      };

      const strategy = await conservativeSelector.selectNext(previousStrategy, failureAnalysis, []);

      // Conservative mode picks highest priority
      expect(strategy.name).toBe('aggressive-timeout');
    });

    it('should handle critical errors conservatively in auto mode', async () => {
      const previousStrategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const failureAnalysis: FailureAnalysis = {
        errorType: 'timeout',
        isTransient: true,
        isPermanent: false,
        severity: 'critical',
        failedStep: 'step1',
        recommendations: [],
        confidence: 0.8
      };

      const strategy = await selector.selectNext(previousStrategy, failureAnalysis, []);

      // Critical severity -> conservative approach (highest priority)
      expect(strategy.name).toBe('aggressive-timeout');
    });
  });

  describe('recordSuccess', () => {
    it('should track successful strategy usage', () => {
      const strategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;

      selector.recordSuccess(strategy);
      selector.recordSuccess(strategy);
      selector.recordSuccess(strategy);

      const history = selector.getHistory();
      expect(history.get('default')).toBe(3);
    });

    it('should track multiple different strategies', () => {
      const default_ = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      const aggressive = BUILTIN_STRATEGIES.find(s => s.name === 'aggressive-timeout')!;

      selector.recordSuccess(default_);
      selector.recordSuccess(aggressive);
      selector.recordSuccess(default_);

      const history = selector.getHistory();
      expect(history.get('default')).toBe(2);
      expect(history.get('aggressive-timeout')).toBe(1);
    });
  });

  describe('getHistory', () => {
    it('should return empty map initially', () => {
      const history = selector.getHistory();
      expect(history.size).toBe(0);
    });

    it('should return copy of history', () => {
      const strategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      selector.recordSuccess(strategy);

      const history1 = selector.getHistory();
      const history2 = selector.getHistory();

      expect(history1).not.toBe(history2); // Different objects
      expect(history1.get('default')).toBe(history2.get('default')); // Same values
    });
  });

  describe('resetHistory', () => {
    it('should clear all success history', () => {
      const strategy = BUILTIN_STRATEGIES.find(s => s.name === 'default')!;
      selector.recordSuccess(strategy);
      selector.recordSuccess(strategy);

      selector.resetHistory();

      const history = selector.getHistory();
      expect(history.size).toBe(0);
    });
  });

  describe('getStrategy', () => {
    it('should return strategy by name', () => {
      const strategy = selector.getStrategy('default');

      expect(strategy).toBeDefined();
      expect(strategy?.name).toBe('default');
    });

    it('should return undefined for non-existent strategy', () => {
      const strategy = selector.getStrategy('non-existent');

      expect(strategy).toBeUndefined();
    });
  });

  describe('listStrategies', () => {
    it('should return all built-in strategies', () => {
      const strategies = selector.listStrategies();

      expect(strategies.length).toBe(5);
      expect(strategies.map(s => s.name)).toEqual([
        'default',
        'aggressive-timeout',
        'fallback-providers',
        'reduced-parallelism',
        'skip-optional'
      ]);
    });

    it('should return copy of strategies array', () => {
      const strategies1 = selector.listStrategies();
      const strategies2 = selector.listStrategies();

      expect(strategies1).not.toBe(strategies2);
      expect(strategies1).toEqual(strategies2);
    });
  });

  describe('BUILTIN_STRATEGIES', () => {
    it('should have correct number of strategies', () => {
      expect(BUILTIN_STRATEGIES.length).toBe(5);
    });

    it('should have unique strategy names', () => {
      const names = BUILTIN_STRATEGIES.map(s => s.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(BUILTIN_STRATEGIES.length);
    });

    it('should have descending priority order', () => {
      const priorities = BUILTIN_STRATEGIES.map(s => s.priority);

      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
      }
    });

    it('should have valid configuration for each strategy', () => {
      for (const strategy of BUILTIN_STRATEGIES) {
        expect(strategy.name).toBeTruthy();
        expect(strategy.description).toBeTruthy();
        expect(strategy.config).toBeDefined();
        expect(strategy.priority).toBeGreaterThan(0);
        expect(Array.isArray(strategy.applicableErrors)).toBe(true);
      }
    });
  });
});
