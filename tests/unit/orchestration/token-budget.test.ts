/**
 * Token Budget Manager Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TokenBudgetManager,
  type EmbeddedInstruction,
  DEFAULT_TOKEN_BUDGET
} from '../../../src/core/orchestration/index.js';

describe('TokenBudgetManager', () => {
  let manager: TokenBudgetManager;

  beforeEach(() => {
    manager = new TokenBudgetManager();
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const config = manager.getConfig();
      expect(config.maxTotal).toBe(DEFAULT_TOKEN_BUDGET.maxTotal);
      expect(config.criticalReserve).toBe(DEFAULT_TOKEN_BUDGET.criticalReserve);
    });

    it('should merge custom config with defaults', () => {
      const customManager = new TokenBudgetManager({
        maxTotal: 3000,
        perType: { task: 800, memory: 600, session: 300, delegation: 200, mode: 400 }
      });
      const config = customManager.getConfig();
      expect(config.maxTotal).toBe(3000);
      expect(config.perType.task).toBe(800);
      expect(config.perType.memory).toBe(600);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const result = manager.estimateTokens('Hello world'); // 11 chars
      expect(result.characters).toBe(11);
      expect(result.tokens).toBe(3); // ceil(11 / 4)
      expect(result.isEstimate).toBe(true);
    });

    it('should handle empty strings', () => {
      const result = manager.estimateTokens('');
      expect(result.tokens).toBe(0);
      expect(result.characters).toBe(0);
    });

    it('should handle long strings', () => {
      const longString = 'a'.repeat(1000);
      const result = manager.estimateTokens(longString);
      expect(result.characters).toBe(1000);
      expect(result.tokens).toBe(250); // 1000 / 4
    });
  });

  describe('estimateInstructionTokens', () => {
    it('should include overhead for formatting', () => {
      const instruction: EmbeddedInstruction = {
        type: 'task',
        priority: 'normal',
        content: 'Test content', // 12 chars = 3 tokens
        source: 'automatosx',
        createdAt: Date.now()
      };
      const tokens = manager.estimateInstructionTokens(instruction);
      // 3 (content) + 50 (overhead) = 53
      expect(tokens).toBe(53);
    });
  });

  describe('allocateBudget', () => {
    it('should include all instructions when within budget', () => {
      const instructions: EmbeddedInstruction[] = [
        {
          type: 'task',
          priority: 'normal',
          content: 'Task 1',
          source: 'automatosx',
          createdAt: Date.now()
        },
        {
          type: 'memory',
          priority: 'normal',
          content: 'Memory 1',
          source: 'automatosx',
          createdAt: Date.now()
        }
      ];

      const result = manager.allocateBudget(instructions);
      expect(result.included).toHaveLength(2);
      expect(result.excluded).toHaveLength(0);
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should prioritize critical instructions', () => {
      const instructions: EmbeddedInstruction[] = [
        {
          type: 'task',
          priority: 'low',
          content: 'Low priority',
          source: 'automatosx',
          createdAt: Date.now()
        },
        {
          type: 'task',
          priority: 'critical',
          content: 'Critical task',
          source: 'automatosx',
          createdAt: Date.now()
        },
        {
          type: 'task',
          priority: 'high',
          content: 'High priority',
          source: 'automatosx',
          createdAt: Date.now()
        }
      ];

      const result = manager.allocateBudget(instructions);
      // Check that critical comes first in included
      expect(result.included[0]?.priority).toBe('critical');
    });

    it('should respect type limits', () => {
      // Create manager with low type limit
      const limitedManager = new TokenBudgetManager({
        maxTotal: 10000,
        perType: { task: 100, memory: 600, session: 300, delegation: 200, mode: 400 } // Very low task limit
      });

      const instructions: EmbeddedInstruction[] = [
        {
          type: 'task',
          priority: 'normal',
          content: 'a'.repeat(500), // Will exceed task limit
          source: 'automatosx',
          createdAt: Date.now()
        }
      ];

      const result = limitedManager.allocateBudget(instructions);
      expect(result.excluded).toHaveLength(1);
    });

    it('should allow critical instructions to use reserve budget', () => {
      // Create manager with low total but some reserve
      const reserveManager = new TokenBudgetManager({
        maxTotal: 100,
        criticalReserve: 200
      });

      const instructions: EmbeddedInstruction[] = [
        {
          type: 'task',
          priority: 'normal',
          content: 'a'.repeat(400), // ~100 tokens, exceeds maxTotal
          source: 'automatosx',
          createdAt: Date.now()
        },
        {
          type: 'task',
          priority: 'critical',
          content: 'Critical', // Small, uses reserve
          source: 'automatosx',
          createdAt: Date.now()
        }
      ];

      const result = reserveManager.allocateBudget(instructions);
      // Critical should be included despite exceeding maxTotal
      const criticalIncluded = result.included.some(i => i.priority === 'critical');
      expect(criticalIncluded).toBe(true);
    });

    it('should track per-type usage', () => {
      const instructions: EmbeddedInstruction[] = [
        {
          type: 'task',
          priority: 'normal',
          content: 'Task',
          source: 'automatosx',
          createdAt: Date.now()
        },
        {
          type: 'memory',
          priority: 'normal',
          content: 'Memory',
          source: 'automatosx',
          createdAt: Date.now()
        }
      ];

      const result = manager.allocateBudget(instructions);
      expect(result.perTypeUsage.task).toBeGreaterThan(0);
      expect(result.perTypeUsage.memory).toBeGreaterThan(0);
    });
  });

  describe('fitsInBudget', () => {
    it('should return true when instruction fits', () => {
      const instruction: EmbeddedInstruction = {
        type: 'task',
        priority: 'normal',
        content: 'Short content',
        source: 'automatosx',
        createdAt: Date.now()
      };

      const fits = manager.fitsInBudget(instruction, 0, {
        task: 0,
        memory: 0,
        session: 0,
        delegation: 0,
        mode: 0
      });
      expect(fits).toBe(true);
    });

    it('should return false when exceeding total budget', () => {
      const instruction: EmbeddedInstruction = {
        type: 'task',
        priority: 'normal',
        content: 'a'.repeat(10000), // Very long
        source: 'automatosx',
        createdAt: Date.now()
      };

      const fits = manager.fitsInBudget(instruction, 0, {
        task: 0,
        memory: 0,
        session: 0,
        delegation: 0,
        mode: 0
      });
      expect(fits).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      manager.updateConfig({ maxTotal: 5000 });
      const config = manager.getConfig();
      expect(config.maxTotal).toBe(5000);
    });

    it('should merge perType updates', () => {
      manager.updateConfig({ perType: { task: 1000, memory: 600, session: 300, delegation: 200, mode: 400 } });
      const config = manager.getConfig();
      expect(config.perType.task).toBe(1000);
      expect(config.perType.memory).toBe(600);
    });
  });

  describe('getRemainingTypeBudget', () => {
    it('should calculate remaining budget for type', () => {
      const remaining = manager.getRemainingTypeBudget('task', {
        task: 100,
        memory: 0,
        session: 0,
        delegation: 0,
        mode: 0
      });
      expect(remaining).toBe(DEFAULT_TOKEN_BUDGET.perType.task - 100);
    });

    it('should return 0 when budget exhausted', () => {
      const remaining = manager.getRemainingTypeBudget('task', {
        task: 10000,
        memory: 0,
        session: 0,
        delegation: 0,
        mode: 0
      });
      expect(remaining).toBe(0);
    });
  });

  describe('formatBudgetStatus', () => {
    it('should format budget status as string', () => {
      const allocation = manager.allocateBudget([
        {
          type: 'task',
          priority: 'normal',
          content: 'Test',
          source: 'automatosx',
          createdAt: Date.now()
        }
      ]);

      const status = manager.formatBudgetStatus(allocation);
      expect(status).toContain('Token Budget Status');
      expect(status).toContain('Total:');
      expect(status).toContain('Per-Type Usage:');
    });
  });
});
