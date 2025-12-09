/**
 * Workflow Mode Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  WorkflowModeSchema,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  DEFAULT_MODE_CONFIG,
  PLAN_MODE_CONFIG,
  ITERATE_MODE_CONFIG,
  REVIEW_MODE_CONFIG,
  WORKFLOW_MODE_CONFIGS,
  getWorkflowModeConfig,
  isToolAllowedInMode,
  getBlockedToolsForMode,
  getAllowedToolsForMode
} from '../../../src/core/workflow/index.js';

describe('WorkflowMode', () => {
  describe('WorkflowModeSchema', () => {
    it('should validate valid modes', () => {
      expect(WorkflowModeSchema.parse('default')).toBe('default');
      expect(WorkflowModeSchema.parse('plan')).toBe('plan');
      expect(WorkflowModeSchema.parse('iterate')).toBe('iterate');
      expect(WorkflowModeSchema.parse('review')).toBe('review');
    });

    it('should reject invalid modes', () => {
      expect(() => WorkflowModeSchema.parse('invalid')).toThrow();
      expect(() => WorkflowModeSchema.parse('')).toThrow();
      expect(() => WorkflowModeSchema.parse(123)).toThrow();
    });
  });

  describe('Tool constants', () => {
    it('should define read-only tools', () => {
      expect(READ_ONLY_TOOLS).toContain('Read');
      expect(READ_ONLY_TOOLS).toContain('Glob');
      expect(READ_ONLY_TOOLS).toContain('Grep');
      expect(READ_ONLY_TOOLS).not.toContain('Write');
      expect(READ_ONLY_TOOLS).not.toContain('Edit');
    });

    it('should define write tools', () => {
      expect(WRITE_TOOLS).toContain('Write');
      expect(WRITE_TOOLS).toContain('Edit');
      expect(WRITE_TOOLS).toContain('Bash');
      expect(WRITE_TOOLS).not.toContain('Read');
    });
  });

  describe('Mode configurations', () => {
    it('should have all required modes', () => {
      expect(WORKFLOW_MODE_CONFIGS.default).toBeDefined();
      expect(WORKFLOW_MODE_CONFIGS.plan).toBeDefined();
      expect(WORKFLOW_MODE_CONFIGS.iterate).toBeDefined();
      expect(WORKFLOW_MODE_CONFIGS.review).toBeDefined();
    });

    it('should configure default mode with no restrictions', () => {
      expect(DEFAULT_MODE_CONFIG.name).toBe('default');
      expect(DEFAULT_MODE_CONFIG.blockedTools).toBeUndefined();
      expect(DEFAULT_MODE_CONFIG.allowedTools).toBeUndefined();
      expect(DEFAULT_MODE_CONFIG.allowNesting).toBe(true);
    });

    it('should configure plan mode to block write tools', () => {
      expect(PLAN_MODE_CONFIG.name).toBe('plan');
      expect(PLAN_MODE_CONFIG.blockedTools).toBeDefined();
      expect(PLAN_MODE_CONFIG.blockedTools).toContain('Write');
      expect(PLAN_MODE_CONFIG.blockedTools).toContain('Edit');
      expect(PLAN_MODE_CONFIG.blockedTools).toContain('Bash');
      expect(PLAN_MODE_CONFIG.allowNesting).toBe(false);
    });

    it('should configure iterate mode for continuous execution', () => {
      expect(ITERATE_MODE_CONFIG.name).toBe('iterate');
      expect(ITERATE_MODE_CONFIG.allowNesting).toBe(true);
      expect(ITERATE_MODE_CONFIG.systemInstructions).toContain('Iterate Mode');
    });

    it('should configure review mode to block write tools', () => {
      expect(REVIEW_MODE_CONFIG.name).toBe('review');
      expect(REVIEW_MODE_CONFIG.blockedTools).toContain('Write');
      expect(REVIEW_MODE_CONFIG.blockedTools).toContain('Edit');
      expect(REVIEW_MODE_CONFIG.systemInstructions).toContain('Review Mode');
    });
  });

  describe('getWorkflowModeConfig', () => {
    it('should return correct config for each mode', () => {
      expect(getWorkflowModeConfig('default').name).toBe('default');
      expect(getWorkflowModeConfig('plan').name).toBe('plan');
      expect(getWorkflowModeConfig('iterate').name).toBe('iterate');
      expect(getWorkflowModeConfig('review').name).toBe('review');
    });
  });

  describe('isToolAllowedInMode', () => {
    it('should allow all tools in default mode', () => {
      expect(isToolAllowedInMode('Read', 'default')).toBe(true);
      expect(isToolAllowedInMode('Write', 'default')).toBe(true);
      expect(isToolAllowedInMode('Edit', 'default')).toBe(true);
      expect(isToolAllowedInMode('Bash', 'default')).toBe(true);
    });

    it('should block write tools in plan mode', () => {
      expect(isToolAllowedInMode('Read', 'plan')).toBe(true);
      expect(isToolAllowedInMode('Glob', 'plan')).toBe(true);
      expect(isToolAllowedInMode('Write', 'plan')).toBe(false);
      expect(isToolAllowedInMode('Edit', 'plan')).toBe(false);
      expect(isToolAllowedInMode('Bash', 'plan')).toBe(false);
    });

    it('should allow all tools in iterate mode', () => {
      expect(isToolAllowedInMode('Read', 'iterate')).toBe(true);
      expect(isToolAllowedInMode('Write', 'iterate')).toBe(true);
      expect(isToolAllowedInMode('Edit', 'iterate')).toBe(true);
    });

    it('should block write tools in review mode', () => {
      expect(isToolAllowedInMode('Read', 'review')).toBe(true);
      expect(isToolAllowedInMode('Write', 'review')).toBe(false);
      expect(isToolAllowedInMode('Edit', 'review')).toBe(false);
    });
  });

  describe('getBlockedToolsForMode', () => {
    it('should return empty array for default mode', () => {
      expect(getBlockedToolsForMode('default')).toHaveLength(0);
    });

    it('should return blocked tools for plan mode', () => {
      const blocked = getBlockedToolsForMode('plan');
      expect(blocked).toContain('Write');
      expect(blocked).toContain('Edit');
      expect(blocked).toContain('Bash');
    });

    it('should return empty array for iterate mode', () => {
      expect(getBlockedToolsForMode('iterate')).toHaveLength(0);
    });

    it('should return blocked tools for review mode', () => {
      const blocked = getBlockedToolsForMode('review');
      expect(blocked).toContain('Write');
      expect(blocked).toContain('Edit');
    });
  });

  describe('getAllowedToolsForMode', () => {
    it('should return undefined for modes without whitelist', () => {
      expect(getAllowedToolsForMode('default')).toBeUndefined();
      expect(getAllowedToolsForMode('plan')).toBeUndefined();
      expect(getAllowedToolsForMode('iterate')).toBeUndefined();
      expect(getAllowedToolsForMode('review')).toBeUndefined();
    });
  });
});
