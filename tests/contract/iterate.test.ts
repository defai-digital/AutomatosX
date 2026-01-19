/**
 * Iterate Contract Tests
 *
 * Validates iterate mode schemas and contract invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  IterateIntentSchema,
  IterateActionTypeSchema,
  IterateBudgetSchema,
  IterateStateSchema,
  IterateSafetyConfigSchema,
  IterateStartRequestSchema,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TIME_MS,
  validateIterateBudget,
  validateIterateState,
  validateIterateStartRequest,
} from '@defai.digital/contracts';

describe('Iterate Contract', () => {
  describe('IterateIntentSchema', () => {
    it('should accept valid intents', () => {
      const intents = ['continue', 'question', 'blocked', 'complete', 'error'];
      for (const intent of intents) {
        const result = IterateIntentSchema.safeParse(intent);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('IterateActionTypeSchema', () => {
    it('should accept valid action types', () => {
      const types = ['CONTINUE', 'PAUSE', 'STOP', 'RETRY'];
      for (const type of types) {
        const result = IterateActionTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('IterateBudgetSchema', () => {
    it('should validate budget', () => {
      const budget = {
        maxIterations: 10,
        maxTimeMs: 300000,
      };
      const result = validateIterateBudget(budget);
      expect(result.maxIterations).toBe(10);
    });

    it('should apply defaults', () => {
      const result = IterateBudgetSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxIterations).toBe(DEFAULT_MAX_ITERATIONS);
      }
    });
  });

  describe('IterateStateSchema', () => {
    it('should validate state', () => {
      const state = {
        sessionId: 'test-session',
        budget: {
          maxIterations: 10,
          maxTimeMs: 300000,
        },
        consumed: {
          iterations: 5,
          timeMs: 60000,
        },
        iteration: 5,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        status: 'running',
        consecutiveErrors: 0,
      };
      const result = validateIterateState(state);
      expect(result.iteration).toBe(5);
    });
  });

  describe('IterateSafetyConfigSchema', () => {
    it('should validate safety config', () => {
      const config = {
        maxConsecutiveErrors: 5,
        enableDangerousPatternDetection: true,
      };
      const result = IterateSafetyConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('IterateStartRequestSchema', () => {
    it('should validate start request', () => {
      const request = {
        task: 'Improve the code',
      };
      const result = validateIterateStartRequest(request);
      expect(result.task).toBe('Improve the code');
    });

    it('should validate request with budget', () => {
      const request = {
        task: 'Add tests',
        budget: {
          maxIterations: 5,
          maxTimeMs: 120000,
        },
      };
      const result = IterateStartRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should have defined defaults', () => {
      expect(DEFAULT_MAX_ITERATIONS).toBeGreaterThan(0);
      expect(DEFAULT_MAX_TIME_MS).toBeGreaterThan(0);
    });
  });

  describe('INV-ITR-001: Budget Enforcement', () => {
    it('should enforce maxIterations minimum', () => {
      const budget = {
        maxIterations: 0,
      };
      const result = IterateBudgetSchema.safeParse(budget);
      expect(result.success).toBe(false);
    });

    it('should reject negative maxIterations', () => {
      const budget = {
        maxIterations: -5,
      };
      const result = IterateBudgetSchema.safeParse(budget);
      expect(result.success).toBe(false);
    });

    it('should reject negative maxTimeMs', () => {
      const budget = {
        maxTimeMs: -1000,
      };
      const result = IterateBudgetSchema.safeParse(budget);
      expect(result.success).toBe(false);
    });
  });

  describe('Schema Rejection Tests', () => {
    it('should reject invalid intent', () => {
      const result = IterateIntentSchema.safeParse('invalid-intent');
      expect(result.success).toBe(false);
    });

    it('should reject invalid action type', () => {
      const result = IterateActionTypeSchema.safeParse('INVALID');
      expect(result.success).toBe(false);
    });

    it('should reject state without required sessionId', () => {
      const state = {
        budget: { maxIterations: 10 },
        consumed: { iterations: 0, timeMs: 0 },
        iteration: 0,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        status: 'running',
        consecutiveErrors: 0,
      };
      const result = IterateStateSchema.safeParse(state);
      expect(result.success).toBe(false);
    });

    it('should reject start request without task', () => {
      const request = {};
      const result = IterateStartRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject start request with empty task', () => {
      const request = { task: '' };
      const result = IterateStartRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should accept valid status values', () => {
      const statuses = ['running', 'paused', 'completed', 'failed', 'budget_exceeded'];
      for (const status of statuses) {
        const state = {
          sessionId: 'test-session',
          budget: { maxIterations: 10, maxTimeMs: 300000 },
          consumed: { iterations: 0, timeMs: 0 },
          iteration: 0,
          startedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          status,
          consecutiveErrors: 0,
        };
        const result = IterateStateSchema.safeParse(state);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const state = {
        sessionId: 'test-session',
        budget: { maxIterations: 10, maxTimeMs: 300000 },
        consumed: { iterations: 0, timeMs: 0 },
        iteration: 0,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        status: 'invalid-status',
        consecutiveErrors: 0,
      };
      const result = IterateStateSchema.safeParse(state);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should validate state at budget limit', () => {
      const state = {
        sessionId: 'test-session',
        budget: { maxIterations: 10, maxTimeMs: 300000 },
        consumed: { iterations: 10, timeMs: 300000 },
        iteration: 10,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        status: 'completed',
        consecutiveErrors: 0,
      };
      const result = validateIterateState(state);
      expect(result.consumed.iterations).toBe(state.budget.maxIterations);
    });

    it('should validate safety config with all options', () => {
      const config = {
        maxConsecutiveErrors: 3,
        enableDangerousPatternDetection: true,
        dangerousPatterns: ['rm -rf', 'DROP TABLE'],
        allowedPaths: ['/src', '/tests'],
        blockedPaths: ['/etc', '/sys'],
      };
      const result = IterateSafetyConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});
