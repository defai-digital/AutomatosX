/**
 * Tests for VerbosityManager (v8.5.8)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VerbosityManager, VerbosityLevel } from '../../src/shared/logging/verbosity-manager.js';

describe('VerbosityManager', () => {
  // Store original env vars
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment
    originalEnv = {
      AUTOMATOSX_VERBOSITY: process.env.AUTOMATOSX_VERBOSITY,
      AUTOMATOSX_QUIET: process.env.AUTOMATOSX_QUIET,
      CI: process.env.CI,
      AUTOMATOSX_ITERATE: process.env.AUTOMATOSX_ITERATE
    };

    // Reset singleton before each test
    VerbosityManager.reset();

    // Clear env vars
    delete process.env.AUTOMATOSX_VERBOSITY;
    delete process.env.AUTOMATOSX_QUIET;
    delete process.env.CI;
    delete process.env.AUTOMATOSX_ITERATE;
  });

  afterEach(() => {
    // Restore original environment
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    // Reset singleton after each test
    VerbosityManager.reset();
  });

  describe('Level Detection', () => {
    it('should detect quiet mode from AUTOMATOSX_VERBOSITY=0', () => {
      process.env.AUTOMATOSX_VERBOSITY = '0';
      const vm = VerbosityManager.getInstance();
      expect(vm.getLevel()).toBe(VerbosityLevel.QUIET);
      expect(vm.isQuiet()).toBe(true);
    });

    it('should detect normal mode from AUTOMATOSX_VERBOSITY=1', () => {
      process.env.AUTOMATOSX_VERBOSITY = '1';
      const vm = VerbosityManager.getInstance();
      expect(vm.getLevel()).toBe(VerbosityLevel.NORMAL);
      expect(vm.isNormal()).toBe(true);
    });

    it('should detect verbose mode from AUTOMATOSX_VERBOSITY=2', () => {
      process.env.AUTOMATOSX_VERBOSITY = '2';
      const vm = VerbosityManager.getInstance();
      expect(vm.getLevel()).toBe(VerbosityLevel.VERBOSE);
      expect(vm.isVerbose()).toBe(true);
    });

    it('should detect quiet mode from legacy AUTOMATOSX_QUIET=true', () => {
      process.env.AUTOMATOSX_QUIET = 'true';
      const vm = VerbosityManager.getInstance();
      expect(vm.getLevel()).toBe(VerbosityLevel.QUIET);
    });

    it('should prioritize AUTOMATOSX_VERBOSITY over AUTOMATOSX_QUIET', () => {
      process.env.AUTOMATOSX_VERBOSITY = '2';
      process.env.AUTOMATOSX_QUIET = 'true';
      const vm = VerbosityManager.getInstance();
      expect(vm.getLevel()).toBe(VerbosityLevel.VERBOSE);
    });

    it('should detect quiet mode in CI environment', () => {
      process.env.CI = 'true';
      const vm = VerbosityManager.getInstance();
      expect(vm.getLevel()).toBe(VerbosityLevel.QUIET);
    });

    it('should detect quiet mode when AUTOMATOSX_ITERATE=true', () => {
      process.env.AUTOMATOSX_ITERATE = 'true';
      const vm = VerbosityManager.getInstance();
      expect(vm.getLevel()).toBe(VerbosityLevel.QUIET);
    });

    it('should handle invalid AUTOMATOSX_VERBOSITY gracefully', () => {
      process.env.AUTOMATOSX_VERBOSITY = 'invalid';
      const vm = VerbosityManager.getInstance();
      // Should fall back to auto-detection
      expect(vm.getLevel()).toBeGreaterThanOrEqual(VerbosityLevel.QUIET);
      expect(vm.getLevel()).toBeLessThanOrEqual(VerbosityLevel.VERBOSE);
    });

    it('should handle out-of-range AUTOMATOSX_VERBOSITY gracefully', () => {
      process.env.AUTOMATOSX_VERBOSITY = '99';
      const vm = VerbosityManager.getInstance();
      // Should fall back to auto-detection
      expect(vm.getLevel()).toBeGreaterThanOrEqual(VerbosityLevel.QUIET);
      expect(vm.getLevel()).toBeLessThanOrEqual(VerbosityLevel.VERBOSE);
    });
  });

  describe('Explicit Level Override', () => {
    it('should allow explicit quiet level override', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.QUIET);
      expect(vm.getLevel()).toBe(VerbosityLevel.QUIET);
    });

    it('should allow explicit normal level override', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.NORMAL);
      expect(vm.getLevel()).toBe(VerbosityLevel.NORMAL);
    });

    it('should allow explicit verbose level override', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.VERBOSE);
      expect(vm.getLevel()).toBe(VerbosityLevel.VERBOSE);
    });

    it('should allow changing level after initialization', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.NORMAL);
      expect(vm.getLevel()).toBe(VerbosityLevel.NORMAL);

      vm.setLevel(VerbosityLevel.QUIET);
      expect(vm.getLevel()).toBe(VerbosityLevel.QUIET);
    });
  });

  describe('Configuration for Quiet Mode', () => {
    it('should disable all output features in quiet mode', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.QUIET);
      const config = vm.getConfig();

      expect(config.showProgress).toBe(false);
      expect(config.showProviderOutput).toBe(false);
      expect(config.showComplexityAnalysis).toBe(false);
      expect(config.showSpinner).toBe(false);
      expect(config.showCompletionMessages).toBe(false);
      expect(config.showExecutionInfo).toBe(false);
      expect(config.showBanner).toBe(false);
    });

    it('should use shouldShow() helper for feature checks', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.QUIET);

      expect(vm.shouldShow('showProgress')).toBe(false);
      expect(vm.shouldShow('showProviderOutput')).toBe(false);
      expect(vm.shouldShow('showComplexityAnalysis')).toBe(false);
      expect(vm.shouldShow('showSpinner')).toBe(false);
      expect(vm.shouldShow('showCompletionMessages')).toBe(false);
      expect(vm.shouldShow('showExecutionInfo')).toBe(false);
      expect(vm.shouldShow('showBanner')).toBe(false);
    });
  });

  describe('Configuration for Normal Mode', () => {
    it('should enable appropriate features in normal mode', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.NORMAL);
      const config = vm.getConfig();

      expect(config.showProgress).toBe(true);
      expect(config.showProviderOutput).toBe(false); // Still hidden
      expect(config.showComplexityAnalysis).toBe(false); // Still hidden
      expect(config.showSpinner).toBe(true);
      expect(config.showCompletionMessages).toBe(true);
      expect(config.showExecutionInfo).toBe(false); // Only in verbose
      expect(config.showBanner).toBe(true);
    });
  });

  describe('Configuration for Verbose Mode', () => {
    it('should enable all output features in verbose mode', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.VERBOSE);
      const config = vm.getConfig();

      expect(config.showProgress).toBe(true);
      expect(config.showProviderOutput).toBe(true);
      expect(config.showComplexityAnalysis).toBe(true);
      expect(config.showSpinner).toBe(true);
      expect(config.showCompletionMessages).toBe(true);
      expect(config.showExecutionInfo).toBe(true);
      expect(config.showBanner).toBe(true);
    });
  });

  describe('Singleton Behavior', () => {
    it('should return same instance when called multiple times', () => {
      const vm1 = VerbosityManager.getInstance();
      const vm2 = VerbosityManager.getInstance();

      expect(vm1).toBe(vm2);
    });

    it('should update singleton when explicit level provided', () => {
      const vm1 = VerbosityManager.getInstance(VerbosityLevel.NORMAL);
      expect(vm1.getLevel()).toBe(VerbosityLevel.NORMAL);

      const vm2 = VerbosityManager.getInstance(VerbosityLevel.QUIET);
      expect(vm2.getLevel()).toBe(VerbosityLevel.QUIET);

      // When explicit level provided, creates new singleton instance
      // vm1 reference still points to old object, but vm2 is the new singleton
      expect(vm2.getLevel()).toBe(VerbosityLevel.QUIET);

      // Getting instance again should return the updated singleton
      const vm3 = VerbosityManager.getInstance();
      expect(vm3.getLevel()).toBe(VerbosityLevel.QUIET);
      expect(vm3).toBe(vm2);
    });

    it('should reset singleton on VerbosityManager.reset()', () => {
      const _vm1 = VerbosityManager.getInstance(VerbosityLevel.NORMAL);
      VerbosityManager.reset();
      const vm2 = VerbosityManager.getInstance(VerbosityLevel.QUIET);

      // After reset, we get a fresh instance
      expect(vm2.getLevel()).toBe(VerbosityLevel.QUIET);
    });
  });

  describe('Level Name Helper', () => {
    it('should return correct name for quiet level', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.QUIET);
      expect(vm.getLevelName()).toBe('quiet');
    });

    it('should return correct name for normal level', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.NORMAL);
      expect(vm.getLevelName()).toBe('normal');
    });

    it('should return correct name for verbose level', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.VERBOSE);
      expect(vm.getLevelName()).toBe('verbose');
    });
  });

  describe('Config Immutability', () => {
    it('should return copy of config (not reference)', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.NORMAL);
      const config1 = vm.getConfig();
      const config2 = vm.getConfig();

      // Different objects
      expect(config1).not.toBe(config2);

      // But same values
      expect(config1).toEqual(config2);
    });

    it('should not allow external mutation of config', () => {
      const vm = VerbosityManager.getInstance(VerbosityLevel.NORMAL);
      const config = vm.getConfig();

      // Try to mutate
      config.showBanner = false;

      // Should not affect internal config
      const freshConfig = vm.getConfig();
      expect(freshConfig.showBanner).toBe(true);
    });
  });
});
