/**
 * Mode Command Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  WORKFLOW_MODES,
  isValidWorkflowMode,
  getWorkflowModeDescription
} from '../../../../src/core/workflow/index.js';

// Test the helper functions used by mode command
describe('Mode Command Helpers', () => {
  describe('isValidWorkflowMode', () => {
    it('should return true for valid modes', () => {
      expect(isValidWorkflowMode('default')).toBe(true);
      expect(isValidWorkflowMode('plan')).toBe(true);
      expect(isValidWorkflowMode('iterate')).toBe(true);
      expect(isValidWorkflowMode('review')).toBe(true);
    });

    it('should return false for invalid modes', () => {
      expect(isValidWorkflowMode('invalid')).toBe(false);
      expect(isValidWorkflowMode('')).toBe(false);
      expect(isValidWorkflowMode('PLAN')).toBe(false); // Case sensitive
    });

    it('should reject object prototype property names', () => {
      expect(isValidWorkflowMode('toString')).toBe(false);
      expect(isValidWorkflowMode('__proto__')).toBe(false);
    });
  });

  describe('getWorkflowModeDescription', () => {
    it('should return description for each mode', () => {
      expect(getWorkflowModeDescription('default')).toContain('Standard');
      expect(getWorkflowModeDescription('plan')).toContain('Planning');
      expect(getWorkflowModeDescription('iterate')).toContain('Continuous');
      expect(getWorkflowModeDescription('review')).toContain('review');
    });
  });

  describe('WORKFLOW_MODES', () => {
    it('should contain all workflow modes', () => {
      expect(WORKFLOW_MODES.default).toBeDefined();
      expect(WORKFLOW_MODES.plan).toBeDefined();
      expect(WORKFLOW_MODES.iterate).toBeDefined();
      expect(WORKFLOW_MODES.review).toBeDefined();
    });

    it('should have required properties for each mode', () => {
      for (const [name, config] of Object.entries(WORKFLOW_MODES)) {
        expect(config.name).toBe(name);
        expect(config.displayName).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.systemInstructions).toBeDefined();
        expect(typeof config.allowNesting).toBe('boolean');
      }
    });

    it('should have blocked tools for plan mode', () => {
      expect(WORKFLOW_MODES.plan.blockedTools).toBeDefined();
      expect(WORKFLOW_MODES.plan.blockedTools).toContain('Write');
      expect(WORKFLOW_MODES.plan.blockedTools).toContain('Edit');
      expect(WORKFLOW_MODES.plan.blockedTools).toContain('Bash');
    });

    it('should have blocked tools for review mode', () => {
      expect(WORKFLOW_MODES.review.blockedTools).toBeDefined();
      expect(WORKFLOW_MODES.review.blockedTools).toContain('Write');
      expect(WORKFLOW_MODES.review.blockedTools).toContain('Edit');
    });

    it('should not block tools in default mode', () => {
      expect(WORKFLOW_MODES.default.blockedTools).toBeUndefined();
    });

    it('should not block tools in iterate mode', () => {
      expect(WORKFLOW_MODES.iterate.blockedTools).toBeUndefined();
    });
  });
});

describe('Mode Command Logic', () => {
  describe('mode validation', () => {
    it('should accept lowercase mode names', () => {
      const modes = ['default', 'plan', 'iterate', 'review'];
      modes.forEach(mode => {
        expect(isValidWorkflowMode(mode)).toBe(true);
      });
    });

    it('should reject uppercase mode names', () => {
      const modes = ['DEFAULT', 'PLAN', 'ITERATE', 'REVIEW'];
      modes.forEach(mode => {
        expect(isValidWorkflowMode(mode)).toBe(false);
      });
    });

    it('should reject mixed case mode names', () => {
      expect(isValidWorkflowMode('Default')).toBe(false);
      expect(isValidWorkflowMode('Plan')).toBe(false);
    });
  });

  describe('mode properties', () => {
    it('should define nesting behavior', () => {
      expect(WORKFLOW_MODES.default.allowNesting).toBe(true);
      expect(WORKFLOW_MODES.plan.allowNesting).toBe(false);
      expect(WORKFLOW_MODES.iterate.allowNesting).toBe(true);
      expect(WORKFLOW_MODES.review.allowNesting).toBe(false);
    });

    it('should define max nesting depth for allowed modes', () => {
      expect(WORKFLOW_MODES.default.maxNestingDepth).toBe(3);
      expect(WORKFLOW_MODES.iterate.maxNestingDepth).toBe(2);
    });

    it('should have auto-exit conditions for plan mode', () => {
      expect(WORKFLOW_MODES.plan.autoExitConditions).toBeDefined();
      expect(WORKFLOW_MODES.plan.autoExitConditions?.onToolUse).toContain('ExitPlanMode');
    });
  });
});
