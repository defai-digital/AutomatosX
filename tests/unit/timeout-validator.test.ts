/**
 * Timeout Validator Unit Tests
 *
 * Tests for timeout configuration validation and backward compatibility.
 *
 * @module timeout-validator.test
 */

import { describe, it, expect } from 'vitest';
import {
  validateTimeoutConfig,
  buildTimeoutConfig,
  validateAndBuildTimeoutConfig,
  getTimeoutConfigSummary,
} from '../../src/utils/timeout-validator.js';
import { TimeoutConfig } from '../../src/types/timeout.js';
import { ExecutionConfig } from '../../src/types/config.js';
import { ConfigError } from '../../src/utils/errors.js';

describe('timeout-validator', () => {
  describe('validateTimeoutConfig', () => {
    it('should accept valid timeout configuration', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        teams: { engineering: 1800000 },
        agents: { backend: 1200000 },
        warningThreshold: 0.8,
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();
    });

    it('should accept empty timeout configuration', () => {
      const config: TimeoutConfig = {};

      expect(() => validateTimeoutConfig(config)).not.toThrow();
    });

    it('should accept minimum warning threshold (0.5)', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        warningThreshold: 0.5,
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();
    });

    it('should accept maximum warning threshold (0.95)', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        warningThreshold: 0.95,
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();
    });

    it('should reject warning threshold below minimum', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        warningThreshold: 0.49,
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
      expect(() => validateTimeoutConfig(config)).toThrow(
        'warning threshold must be between'
      );
    });

    it('should reject warning threshold above maximum', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        warningThreshold: 0.96,
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
      expect(() => validateTimeoutConfig(config)).toThrow(
        'warning threshold must be between'
      );
    });

    it('should reject negative global timeout', () => {
      const config: TimeoutConfig = {
        global: -1000,
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
      expect(() => validateTimeoutConfig(config)).toThrow(
        'Global timeout must be a positive integer'
      );
    });

    it('should reject zero global timeout', () => {
      const config: TimeoutConfig = {
        global: 0,
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
    });

    it('should reject non-integer global timeout', () => {
      const config: TimeoutConfig = {
        global: 1500.5,
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
    });

    it('should reject negative team timeout', () => {
      const config: TimeoutConfig = {
        teams: { engineering: -1000 },
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
      expect(() => validateTimeoutConfig(config)).toThrow(
        "Team timeout for 'engineering' must be a positive integer"
      );
    });

    it('should reject zero team timeout', () => {
      const config: TimeoutConfig = {
        teams: { research: 0 },
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
    });

    it('should reject negative agent timeout', () => {
      const config: TimeoutConfig = {
        agents: { backend: -1000 },
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
      expect(() => validateTimeoutConfig(config)).toThrow(
        "Agent timeout for 'backend' must be a positive integer"
      );
    });

    it('should reject zero agent timeout', () => {
      const config: TimeoutConfig = {
        agents: { frontend: 0 },
      };

      expect(() => validateTimeoutConfig(config)).toThrow(ConfigError);
    });

    it('should validate multiple team timeouts', () => {
      const config: TimeoutConfig = {
        teams: {
          engineering: 1800000,
          research: 3600000,
          business: 900000,
        },
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();
    });

    it('should validate multiple agent timeouts', () => {
      const config: TimeoutConfig = {
        agents: {
          backend: 1200000,
          frontend: 1500000,
          researcher: 3600000,
        },
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();
    });
  });

  describe('buildTimeoutConfig', () => {
    it('should use timeouts config when defined', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        defaultTimeout: 1500000,
        timeouts: {
          global: 1800000,
          teams: { engineering: 2000000 },
        },
      };

      const result = buildTimeoutConfig(executionConfig);

      expect(result.global).toBe(1800000);
      expect(result.teams).toEqual({ engineering: 2000000 });
    });

    it('should fallback to defaultTimeout when timeouts not defined', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        defaultTimeout: 1500000,
      };

      const result = buildTimeoutConfig(executionConfig);

      expect(result.global).toBe(1500000);
      expect(result.teams).toBeUndefined();
      expect(result.agents).toBeUndefined();
    });

    it('should return empty config when neither timeouts nor defaultTimeout defined', () => {
      const executionConfig: Partial<ExecutionConfig> = {};

      const result = buildTimeoutConfig(executionConfig);

      expect(result).toEqual({});
    });

    it('should prioritize timeouts over defaultTimeout', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        defaultTimeout: 1500000,
        timeouts: {
          global: 2000000,
        },
      };

      const result = buildTimeoutConfig(executionConfig);

      expect(result.global).toBe(2000000);
    });

    it('should preserve all timeouts config properties', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        timeouts: {
          global: 1800000,
          teams: { engineering: 2000000, research: 3600000 },
          agents: { backend: 1200000 },
          warningThreshold: 0.75,
        },
      };

      const result = buildTimeoutConfig(executionConfig);

      expect(result).toEqual({
        global: 1800000,
        teams: { engineering: 2000000, research: 3600000 },
        agents: { backend: 1200000 },
        warningThreshold: 0.75,
      });
    });

    it('should handle undefined defaultTimeout', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        defaultTimeout: undefined,
      };

      const result = buildTimeoutConfig(executionConfig);

      expect(result).toEqual({});
    });
  });

  describe('validateAndBuildTimeoutConfig', () => {
    it('should validate and build valid config', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        timeouts: {
          global: 1800000,
          warningThreshold: 0.8,
        },
      };

      const result = validateAndBuildTimeoutConfig(executionConfig);

      expect(result.global).toBe(1800000);
      expect(result.warningThreshold).toBe(0.8);
    });

    it('should throw error for invalid config', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        timeouts: {
          global: -1000, // Invalid
        },
      };

      expect(() => validateAndBuildTimeoutConfig(executionConfig)).toThrow(
        ConfigError
      );
    });

    it('should validate backward compatible config', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        defaultTimeout: 1500000,
      };

      const result = validateAndBuildTimeoutConfig(executionConfig);

      expect(result.global).toBe(1500000);
    });

    it('should not throw error for empty config', () => {
      const executionConfig: Partial<ExecutionConfig> = {};

      expect(() => validateAndBuildTimeoutConfig(executionConfig)).not.toThrow();
    });

    it('should throw error for invalid team timeout', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        timeouts: {
          teams: { engineering: -1000 },
        },
      };

      expect(() => validateAndBuildTimeoutConfig(executionConfig)).toThrow(
        ConfigError
      );
    });

    it('should throw error for invalid agent timeout', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        timeouts: {
          agents: { backend: 0 },
        },
      };

      expect(() => validateAndBuildTimeoutConfig(executionConfig)).toThrow(
        ConfigError
      );
    });
  });

  describe('getTimeoutConfigSummary', () => {
    it('should return summary for complete config', () => {
      const config: TimeoutConfig = {
        global: 1500000,
        teams: { engineering: 1800000, research: 3600000 },
        agents: { backend: 1200000 },
        warningThreshold: 0.8,
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.global).toBe('25m');
      expect(summary.teamsCount).toBe(2);
      expect(summary.agentsCount).toBe(1);
      expect(summary.warningThreshold).toBe('80%');
    });

    it('should return summary for minimal config', () => {
      const config: TimeoutConfig = {};

      const summary = getTimeoutConfigSummary(config);

      expect(summary.global).toBeUndefined();
      expect(summary.teamsCount).toBe(0);
      expect(summary.agentsCount).toBe(0);
      expect(summary.warningThreshold).toBe('80%'); // Default
    });

    it('should format time correctly (seconds)', () => {
      const config: TimeoutConfig = {
        global: 45000, // 45 seconds
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.global).toBe('45s');
    });

    it('should format time correctly (minutes and seconds)', () => {
      const config: TimeoutConfig = {
        global: 330000, // 5 minutes 30 seconds
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.global).toBe('5m 30s');
    });

    it('should format time correctly (minutes only)', () => {
      const config: TimeoutConfig = {
        global: 600000, // 10 minutes
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.global).toBe('10m');
    });

    it('should format time correctly (hours and minutes)', () => {
      const config: TimeoutConfig = {
        global: 5400000, // 1 hour 30 minutes
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.global).toBe('1h 30m');
    });

    it('should format time correctly (hours only)', () => {
      const config: TimeoutConfig = {
        global: 3600000, // 1 hour
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.global).toBe('1h');
    });

    it('should use custom warning threshold', () => {
      const config: TimeoutConfig = {
        warningThreshold: 0.75,
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.warningThreshold).toBe('75%');
    });

    it('should count teams correctly', () => {
      const config: TimeoutConfig = {
        teams: {
          engineering: 1800000,
          research: 3600000,
          business: 900000,
        },
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.teamsCount).toBe(3);
    });

    it('should count agents correctly', () => {
      const config: TimeoutConfig = {
        agents: {
          backend: 1200000,
          frontend: 1500000,
          researcher: 3600000,
          qa: 1800000,
        },
      };

      const summary = getTimeoutConfigSummary(config);

      expect(summary.agentsCount).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle config with only warning threshold', () => {
      const config: TimeoutConfig = {
        warningThreshold: 0.85,
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();

      const summary = getTimeoutConfigSummary(config);
      expect(summary.warningThreshold).toBe('85%');
    });

    it('should handle config with only global timeout', () => {
      const config: TimeoutConfig = {
        global: 1500000,
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();

      const summary = getTimeoutConfigSummary(config);
      expect(summary.global).toBe('25m');
    });

    it('should handle config with empty teams object', () => {
      const config: TimeoutConfig = {
        teams: {},
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();

      const summary = getTimeoutConfigSummary(config);
      expect(summary.teamsCount).toBe(0);
    });

    it('should handle config with empty agents object', () => {
      const config: TimeoutConfig = {
        agents: {},
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();

      const summary = getTimeoutConfigSummary(config);
      expect(summary.agentsCount).toBe(0);
    });

    it('should handle very large timeout values', () => {
      const config: TimeoutConfig = {
        global: Number.MAX_SAFE_INTEGER,
      };

      expect(() => validateTimeoutConfig(config)).not.toThrow();
    });

    it('should handle execution config with undefined properties', () => {
      const executionConfig: Partial<ExecutionConfig> = {
        defaultTimeout: undefined,
        timeouts: undefined,
      };

      const result = buildTimeoutConfig(executionConfig);

      expect(result).toEqual({});
    });
  });
});
