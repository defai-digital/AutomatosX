/**
 * Timeout Manager Unit Tests
 *
 * Comprehensive test suite for TimeoutManager and WarningEmitter.
 *
 * @module timeout-manager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimeoutManager } from '../../src/core/timeout-manager.js';
import { WarningEmitter } from '../../src/core/warning-emitter.js';
import {
  TimeoutConfig,
  ResolvedTimeout,
  TimeoutWarningEvent,
} from '../../src/types/timeout.js';

describe('TimeoutManager', () => {
  describe('Configuration Validation', () => {
    it('should accept valid configuration', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        teams: { engineering: 1800000 },
        agents: { backend: 1200000 },
        warningThreshold: 0.8,
      };

      const manager = new TimeoutManager(config);
      expect(manager.getConfig()).toEqual(config);
    });

    it('should throw error for invalid warning threshold (too low)', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        warningThreshold: 0.3, // Below minimum (0.5)
      };

      expect(() => new TimeoutManager(config)).toThrow(
        'Warning threshold must be between'
      );
    });

    it('should throw error for invalid warning threshold (too high)', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        warningThreshold: 0.98, // Above maximum (0.95)
      };

      expect(() => new TimeoutManager(config)).toThrow(
        'Warning threshold must be between'
      );
    });

    it('should accept valid warning threshold at minimum boundary', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        warningThreshold: 0.5,
      };

      expect(() => new TimeoutManager(config)).not.toThrow();
    });

    it('should accept valid warning threshold at maximum boundary', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        warningThreshold: 0.95,
      };

      expect(() => new TimeoutManager(config)).not.toThrow();
    });

    it('should throw error for negative global timeout', () => {
      const config: TimeoutConfig = {
        global: -1000,
      };

      expect(() => new TimeoutManager(config)).toThrow(
        'Global timeout must be positive'
      );
    });

    it('should throw error for zero global timeout', () => {
      const config: TimeoutConfig = {
        global: 0,
      };

      expect(() => new TimeoutManager(config)).toThrow(
        'Global timeout must be positive'
      );
    });

    it('should throw error for negative team timeout', () => {
      const config: TimeoutConfig = {
        teams: { engineering: -1000 },
      };

      expect(() => new TimeoutManager(config)).toThrow(
        "Team timeout for 'engineering' must be positive"
      );
    });

    it('should throw error for negative agent timeout', () => {
      const config: TimeoutConfig = {
        agents: { backend: -1000 },
      };

      expect(() => new TimeoutManager(config)).toThrow(
        "Agent timeout for 'backend' must be positive"
      );
    });
  });

  describe('Timeout Resolution - Priority Order', () => {
    let manager: TimeoutManager;

    beforeEach(() => {
      const config: TimeoutConfig = {
        global: 1500000,
        teams: {
          engineering: 1800000,
          research: 3600000,
        },
        agents: {
          backend: 1200000,
          researcher: 4200000,
        },
        warningThreshold: 0.8,
      };

      manager = new TimeoutManager(config);
    });

    it('should resolve runtime timeout (highest priority)', () => {
      const resolved = manager.resolve({
        agentName: 'backend',
        teamName: 'engineering',
        runtimeTimeout: 2000000,
      });

      expect(resolved.value).toBe(2000000);
      expect(resolved.source).toBe('runtime');
    });

    it('should resolve agent timeout when no runtime override', () => {
      const resolved = manager.resolve({
        agentName: 'backend',
        teamName: 'engineering',
        runtimeTimeout: undefined,
      });

      expect(resolved.value).toBe(1200000);
      expect(resolved.source).toBe('agent');
    });

    it('should resolve team timeout when no agent config', () => {
      const resolved = manager.resolve({
        agentName: 'nonexistent-agent',
        teamName: 'engineering',
        runtimeTimeout: undefined,
      });

      expect(resolved.value).toBe(1800000);
      expect(resolved.source).toBe('team');
    });

    it('should resolve global timeout when no team config', () => {
      const resolved = manager.resolve({
        agentName: 'nonexistent-agent',
        teamName: 'nonexistent-team',
        runtimeTimeout: undefined,
      });

      expect(resolved.value).toBe(1500000);
      expect(resolved.source).toBe('global');
    });

    it('should resolve default timeout when no config', () => {
      const emptyManager = new TimeoutManager({});

      const resolved = emptyManager.resolve({
        agentName: 'any-agent',
        teamName: 'any-team',
        runtimeTimeout: undefined,
      });

      expect(resolved.value).toBe(1500000); // Default timeout
      expect(resolved.source).toBe('default');
    });

    it('should prefer agent timeout over team timeout', () => {
      const resolved = manager.resolve({
        agentName: 'backend',
        teamName: 'engineering',
        runtimeTimeout: undefined,
      });

      expect(resolved.value).toBe(1200000); // Agent timeout
      expect(resolved.source).toBe('agent');
    });

    it('should prefer runtime timeout over all other configs', () => {
      const resolved = manager.resolve({
        agentName: 'researcher',
        teamName: 'research',
        runtimeTimeout: 5000000,
      });

      expect(resolved.value).toBe(5000000); // Runtime override
      expect(resolved.source).toBe('runtime');
    });
  });

  describe('Resolved Timeout Computation', () => {
    it('should calculate warning threshold correctly (80%)', () => {
      const config: TimeoutConfig = {
        global: 1000000,
        warningThreshold: 0.8,
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: 'test',
        teamName: 'test',
      });

      expect(resolved.warningAt).toBe(800000); // 80% of 1000000
    });

    it('should calculate warning threshold correctly (75%)', () => {
      const config: TimeoutConfig = {
        global: 2000000,
        warningThreshold: 0.75,
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: 'test',
        teamName: 'test',
      });

      expect(resolved.warningAt).toBe(1500000); // 75% of 2000000
    });

    it('should use default warning threshold (80%) when not configured', () => {
      const config: TimeoutConfig = {
        global: 1000000,
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: 'test',
        teamName: 'test',
      });

      expect(resolved.warningAt).toBe(800000); // Default 80%
    });

    it('should enable warnings by default', () => {
      const config: TimeoutConfig = {
        global: 1000000,
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: 'test',
        teamName: 'test',
      });

      expect(resolved.warningsEnabled).toBe(true);
    });

    it('should floor warning time to integer', () => {
      const config: TimeoutConfig = {
        global: 1000000,
        warningThreshold: 0.777, // Results in 777000
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: 'test',
        teamName: 'test',
      });

      expect(resolved.warningAt).toBe(777000);
      expect(Number.isInteger(resolved.warningAt)).toBe(true);
    });
  });

  describe('Timeout Monitoring', () => {
    let manager: TimeoutManager;

    beforeEach(() => {
      vi.useFakeTimers();

      const config: TimeoutConfig = {
        global: 1000000,
        warningThreshold: 0.8,
      };

      manager = new TimeoutManager(config);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should start monitoring with resolved timeout', () => {
      const resolved: ResolvedTimeout = {
        value: 1000000,
        source: 'global',
        warningAt: 800000,
        warningsEnabled: true,
      };

      const monitor = manager.startMonitoring(resolved, {
        agentName: 'test',
        taskDescription: 'Test task',
      });

      expect(monitor.resolved).toEqual(resolved);
      expect(monitor.startTime).toBeGreaterThan(0);
      expect(monitor.warningTimer).toBeDefined();
    });

    it('should emit warning at threshold', () => {
      const resolved: ResolvedTimeout = {
        value: 1000000,
        source: 'global',
        warningAt: 800000,
        warningsEnabled: true,
      };

      const emitter = manager.getWarningEmitter();
      const warningSpy = vi.fn();
      emitter.on('timeout-warning', warningSpy);

      manager.startMonitoring(resolved, {
        agentName: 'test-agent',
        taskDescription: 'Test task description',
      });

      // Fast-forward to warning time
      vi.advanceTimersByTime(800000);

      expect(warningSpy).toHaveBeenCalledTimes(1);
      expect(warningSpy).toHaveBeenCalledWith({
        agentName: 'test-agent',
        taskDescription: 'Test task description',
        elapsedMs: 800000,
        remainingMs: 200000,
        timeoutMs: 1000000,
      });
    });

    it('should not emit warning before threshold', () => {
      const resolved: ResolvedTimeout = {
        value: 1000000,
        source: 'global',
        warningAt: 800000,
        warningsEnabled: true,
      };

      const emitter = manager.getWarningEmitter();
      const warningSpy = vi.fn();
      emitter.on('timeout-warning', warningSpy);

      manager.startMonitoring(resolved, {
        agentName: 'test',
        taskDescription: 'Test task',
      });

      // Fast-forward to before warning time
      vi.advanceTimersByTime(700000);

      expect(warningSpy).not.toHaveBeenCalled();
    });

    it('should stop monitoring when stop is called', () => {
      const resolved: ResolvedTimeout = {
        value: 1000000,
        source: 'global',
        warningAt: 800000,
        warningsEnabled: true,
      };

      const emitter = manager.getWarningEmitter();
      const warningSpy = vi.fn();
      emitter.on('timeout-warning', warningSpy);

      const monitor = manager.startMonitoring(resolved, {
        agentName: 'test',
        taskDescription: 'Test task',
      });

      // Stop monitoring before threshold
      monitor.stop();

      // Fast-forward past warning time
      vi.advanceTimersByTime(1000000);

      expect(warningSpy).not.toHaveBeenCalled();
    });

    it('should not schedule warning timer when warnings disabled', () => {
      const resolved: ResolvedTimeout = {
        value: 1000000,
        source: 'global',
        warningAt: 800000,
        warningsEnabled: false,
      };

      const monitor = manager.startMonitoring(resolved, {
        agentName: 'test',
        taskDescription: 'Test task',
      });

      expect(monitor.warningTimer).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty team name', () => {
      const config: TimeoutConfig = {
        global: 1500000,
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: 'test',
        teamName: '',
      });

      expect(resolved.value).toBe(1500000);
      expect(resolved.source).toBe('global');
    });

    it('should handle empty agent name', () => {
      const config: TimeoutConfig = {
        global: 1500000,
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: '',
        teamName: 'test',
      });

      expect(resolved.value).toBe(1500000);
      expect(resolved.source).toBe('global');
    });

    it('should handle runtime timeout of zero', () => {
      const config: TimeoutConfig = {
        global: 1500000,
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: 'test',
        teamName: 'test',
        runtimeTimeout: 0,
      });

      expect(resolved.value).toBe(0);
      expect(resolved.source).toBe('runtime');
    });

    it('should handle very large timeout values', () => {
      const config: TimeoutConfig = {
        global: Number.MAX_SAFE_INTEGER,
      };

      const manager = new TimeoutManager(config);
      const resolved = manager.resolve({
        agentName: 'test',
        teamName: 'test',
      });

      expect(resolved.value).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should get warning emitter instance', () => {
      const config: TimeoutConfig = {
        global: 1500000,
      };

      const manager = new TimeoutManager(config);
      const emitter = manager.getWarningEmitter();

      expect(emitter).toBeInstanceOf(WarningEmitter);
    });
  });
});

describe('WarningEmitter', () => {
  describe('Event Emission', () => {
    it('should emit timeout-warning events', () => {
      const emitter = new WarningEmitter();
      const spy = vi.fn();

      emitter.on('timeout-warning', spy);

      const event: TimeoutWarningEvent = {
        agentName: 'test',
        taskDescription: 'Test task',
        elapsedMs: 800000,
        remainingMs: 200000,
        timeoutMs: 1000000,
      };

      emitter.emitWarning(event);

      expect(spy).toHaveBeenCalledWith(event);
    });

    it('should support multiple listeners', () => {
      const emitter = new WarningEmitter();
      const spy1 = vi.fn();
      const spy2 = vi.fn();

      emitter.on('timeout-warning', spy1);
      emitter.on('timeout-warning', spy2);

      const event: TimeoutWarningEvent = {
        agentName: 'test',
        taskDescription: 'Test task',
        elapsedMs: 800000,
        remainingMs: 200000,
        timeoutMs: 1000000,
      };

      emitter.emitWarning(event);

      expect(spy1).toHaveBeenCalledWith(event);
      expect(spy2).toHaveBeenCalledWith(event);
    });
  });

  describe('Default Warning Handler', () => {
    it('should have default warning handler registered', () => {
      const emitter = new WarningEmitter();

      expect(emitter.listenerCount('timeout-warning')).toBeGreaterThan(0);
    });

    it('should log warnings to console (integration test)', () => {
      const emitter = new WarningEmitter();

      const event: TimeoutWarningEvent = {
        agentName: 'test-agent',
        taskDescription: 'Test task description',
        elapsedMs: 800000,
        remainingMs: 200000,
        timeoutMs: 1000000,
      };

      // This should not throw
      expect(() => emitter.emitWarning(event)).not.toThrow();
    });
  });
});
