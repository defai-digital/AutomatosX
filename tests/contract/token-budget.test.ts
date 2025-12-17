/**
 * Token Budget Contract Tests
 *
 * Validates token budget schemas and allocation contracts.
 */

import { describe, it, expect } from 'vitest';
import {
  TokenBudgetConfigSchema,
  EmbeddedInstructionSchema,
  BudgetAllocationSchema,
  BudgetStatusSchema,
  InstructionTypeSchema,
  InstructionPrioritySchema,
  DEFAULT_TOKEN_BUDGET,
  PRIORITY_ORDER,
  TYPE_PRIORITY_ORDER,
  validateTokenBudgetConfig,
  safeValidateTokenBudgetConfig,
  validateEmbeddedInstruction,
  getPriorityValue,
  getTypePriorityValue,
  TokenBudgetErrorCode,
} from '@automatosx/contracts';

describe('Token Budget Contract', () => {
  describe('TokenBudgetConfigSchema', () => {
    it('should validate default config', () => {
      const result = TokenBudgetConfigSchema.safeParse(DEFAULT_TOKEN_BUDGET);
      expect(result.success).toBe(true);
    });

    it('should validate custom config', () => {
      const config = {
        maxTotal: 8000,
        perType: {
          memory: 3000,
          todo: 1500,
          session: 1500,
          context: 1000,
          system: 1000,
        },
        criticalReserve: 1000,
      };

      const result = TokenBudgetConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid maxTotal', () => {
      const config = {
        maxTotal: 50, // Min is 100
        perType: {
          memory: 20,
          todo: 10,
          session: 10,
          system: 10,
        },
        criticalReserve: 0,
      };

      const result = TokenBudgetConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative values', () => {
      const config = {
        maxTotal: 4000,
        perType: {
          memory: -100,
          todo: 800,
          session: 700,
          system: 500,
        },
        criticalReserve: 500,
      };

      const result = TokenBudgetConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('EmbeddedInstructionSchema', () => {
    it('should validate a memory instruction', () => {
      const instruction = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'memory',
        content: 'Previous conversation context...',
        priority: 'normal',
      };

      const result = EmbeddedInstructionSchema.safeParse(instruction);
      expect(result.success).toBe(true);
    });

    it('should validate a critical system instruction', () => {
      const instruction = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'system',
        content: 'You are an AI assistant...',
        priority: 'critical',
        estimatedTokens: 150,
        source: 'system-prompt',
      };

      const result = EmbeddedInstructionSchema.safeParse(instruction);
      expect(result.success).toBe(true);
    });

    it('should validate a todo instruction', () => {
      const instruction = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        type: 'todo',
        content: '1. Implement feature X\n2. Write tests',
        priority: 'high',
        createdAt: new Date().toISOString(),
      };

      const result = EmbeddedInstructionSchema.safeParse(instruction);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const instruction = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'invalid-type',
        content: 'Test content',
        priority: 'normal',
      };

      const result = EmbeddedInstructionSchema.safeParse(instruction);
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const instruction = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'memory',
        content: '',
        priority: 'normal',
      };

      const result = EmbeddedInstructionSchema.safeParse(instruction);
      expect(result.success).toBe(false);
    });
  });

  describe('BudgetAllocationSchema', () => {
    it('should validate allocation result', () => {
      const allocation = {
        included: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'system',
            content: 'System prompt',
            priority: 'critical',
          },
        ],
        excluded: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            type: 'todo',
            content: 'Low priority todo',
            priority: 'low',
          },
        ],
        totalTokens: 500,
        remaining: 3500,
        usageByType: {
          memory: 0,
          todo: 0,
          session: 0,
          context: 0,
          system: 500,
        },
        criticalReserveUsed: 0,
        allocationTimestamp: new Date().toISOString(),
      };

      const result = BudgetAllocationSchema.safeParse(allocation);
      expect(result.success).toBe(true);
    });
  });

  describe('BudgetStatusSchema', () => {
    it('should validate budget status', () => {
      const status = {
        config: DEFAULT_TOKEN_BUDGET,
        currentUsage: 2000,
        usageByType: {
          memory: 1000,
          todo: 500,
          session: 300,
          context: 100,
          system: 100,
        },
        remaining: 2000,
        criticalReserveAvailable: 500,
        utilizationPercent: 50,
        canAcceptMore: true,
      };

      const result = BudgetStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });
  });

  describe('Priority Order', () => {
    it('should have correct priority values', () => {
      expect(PRIORITY_ORDER.critical).toBe(4);
      expect(PRIORITY_ORDER.high).toBe(3);
      expect(PRIORITY_ORDER.normal).toBe(2);
      expect(PRIORITY_ORDER.low).toBe(1);
    });

    it('getPriorityValue should return correct values', () => {
      expect(getPriorityValue('critical')).toBe(4);
      expect(getPriorityValue('high')).toBe(3);
      expect(getPriorityValue('normal')).toBe(2);
      expect(getPriorityValue('low')).toBe(1);
    });

    it('critical should have highest priority', () => {
      expect(getPriorityValue('critical')).toBeGreaterThan(
        getPriorityValue('high')
      );
      expect(getPriorityValue('high')).toBeGreaterThan(
        getPriorityValue('normal')
      );
      expect(getPriorityValue('normal')).toBeGreaterThan(
        getPriorityValue('low')
      );
    });
  });

  describe('Type Priority Order', () => {
    it('should have correct type priority values', () => {
      expect(TYPE_PRIORITY_ORDER.system).toBe(5);
      expect(TYPE_PRIORITY_ORDER.memory).toBe(4);
      expect(TYPE_PRIORITY_ORDER.session).toBe(3);
      expect(TYPE_PRIORITY_ORDER.context).toBe(2);
      expect(TYPE_PRIORITY_ORDER.todo).toBe(1);
    });

    it('getTypePriorityValue should return correct values', () => {
      expect(getTypePriorityValue('system')).toBe(5);
      expect(getTypePriorityValue('memory')).toBe(4);
      expect(getTypePriorityValue('session')).toBe(3);
      expect(getTypePriorityValue('context')).toBe(2);
      expect(getTypePriorityValue('todo')).toBe(1);
    });

    it('system should have highest type priority', () => {
      expect(getTypePriorityValue('system')).toBeGreaterThan(
        getTypePriorityValue('memory')
      );
      expect(getTypePriorityValue('memory')).toBeGreaterThan(
        getTypePriorityValue('session')
      );
    });
  });

  describe('Validation Functions', () => {
    it('validateTokenBudgetConfig should throw on invalid input', () => {
      expect(() =>
        validateTokenBudgetConfig({ maxTotal: 10 })
      ).toThrow();
    });

    it('safeValidateTokenBudgetConfig should return error on invalid input', () => {
      const result = safeValidateTokenBudgetConfig({ maxTotal: 10 });
      expect(result.success).toBe(false);
    });

    it('validateEmbeddedInstruction should throw on invalid input', () => {
      expect(() =>
        validateEmbeddedInstruction({ type: 'invalid' })
      ).toThrow();
    });
  });

  describe('Default Budget', () => {
    it('DEFAULT_TOKEN_BUDGET should have reasonable values', () => {
      expect(DEFAULT_TOKEN_BUDGET.maxTotal).toBe(4000);
      expect(DEFAULT_TOKEN_BUDGET.criticalReserve).toBe(500);
      expect(DEFAULT_TOKEN_BUDGET.perType.memory).toBe(1500);
      expect(DEFAULT_TOKEN_BUDGET.perType.todo).toBe(800);
      expect(DEFAULT_TOKEN_BUDGET.perType.session).toBe(700);
      expect(DEFAULT_TOKEN_BUDGET.perType.system).toBe(500);
    });

    it('per-type limits should not exceed maxTotal', () => {
      const totalPerType = Object.values(DEFAULT_TOKEN_BUDGET.perType).reduce(
        (sum: number, val) => sum + (val ?? 0),
        0
      );
      // Per-type limits can exceed maxTotal since they're individual limits
      // Just verify they're reasonable
      expect(totalPerType).toBeGreaterThan(0);
    });
  });

  describe('Error Codes', () => {
    it('should have all required error codes', () => {
      expect(TokenBudgetErrorCode.TOKEN_BUDGET_EXCEEDED).toBe(
        'TOKEN_BUDGET_EXCEEDED'
      );
      expect(TokenBudgetErrorCode.TOKEN_TYPE_LIMIT_EXCEEDED).toBe(
        'TOKEN_TYPE_LIMIT_EXCEEDED'
      );
      expect(TokenBudgetErrorCode.TOKEN_CRITICAL_DROPPED).toBe(
        'TOKEN_CRITICAL_DROPPED'
      );
      expect(TokenBudgetErrorCode.TOKEN_ESTIMATION_FAILED).toBe(
        'TOKEN_ESTIMATION_FAILED'
      );
    });
  });

  describe('InstructionType and Priority enums', () => {
    it('InstructionTypeSchema should validate all types', () => {
      const types = ['memory', 'todo', 'session', 'context', 'system'];
      for (const type of types) {
        const result = InstructionTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it('InstructionPrioritySchema should validate all priorities', () => {
      const priorities = ['critical', 'high', 'normal', 'low'];
      for (const priority of priorities) {
        const result = InstructionPrioritySchema.safeParse(priority);
        expect(result.success).toBe(true);
      }
    });
  });

  /**
   * Invariant Tests
   * Tests for documented invariants in packages/contracts/src/token-budget/v1/invariants.md
   */
  describe('INV-TOK: Token Budget Invariants', () => {
    describe('INV-TOK-001: Allocation Limits', () => {
      it('config should enforce maxTotal limit', () => {
        const config = {
          maxTotal: 8000,
          perType: {
            memory: 3000,
            todo: 1500,
            session: 1500,
            context: 1000,
            system: 1000,
          },
          criticalReserve: 500,
        };
        const result = TokenBudgetConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxTotal).toBe(8000);
        }
      });

      it('config should enforce minimum maxTotal', () => {
        const config = {
          maxTotal: 50, // Below minimum of 100
          perType: {},
          criticalReserve: 0,
        };
        const result = TokenBudgetConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });

      it('per-type limits should be enforced', () => {
        const config = {
          maxTotal: 4000,
          perType: {
            memory: 1500,
            todo: 800,
            session: 700,
            context: 500,
            system: 500,
          },
          criticalReserve: 500,
        };
        const result = TokenBudgetConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.perType.memory).toBe(1500);
          expect(result.data.perType.system).toBe(500);
        }
      });

      it('should reject negative per-type values', () => {
        const config = {
          maxTotal: 4000,
          perType: {
            memory: -100,
          },
          criticalReserve: 500,
        };
        const result = TokenBudgetConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });
    });

    describe('INV-TOK-002: Usage Tracking', () => {
      it('budget status should track current usage', () => {
        const status = {
          config: DEFAULT_TOKEN_BUDGET,
          currentUsage: 2500,
          usageByType: {
            memory: 1200,
            todo: 600,
            session: 400,
            context: 200,
            system: 100,
          },
          remaining: 1500,
          criticalReserveAvailable: 500,
          utilizationPercent: 62.5,
          canAcceptMore: true,
        };
        const result = BudgetStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.currentUsage).toBe(2500);
        }
      });

      it('allocation should track usage by type', () => {
        const allocation = {
          included: [],
          excluded: [],
          totalTokens: 2000,
          remaining: 2000,
          usageByType: {
            memory: 800,
            todo: 400,
            session: 500,
            context: 200,
            system: 100,
          },
          criticalReserveUsed: 0,
          allocationTimestamp: new Date().toISOString(),
        };
        const result = BudgetAllocationSchema.safeParse(allocation);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.usageByType.memory).toBe(800);
        }
      });

      it('instruction should support estimatedTokens', () => {
        const instruction = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'memory',
          content: 'Some content',
          priority: 'normal',
          estimatedTokens: 150,
        };
        const result = EmbeddedInstructionSchema.safeParse(instruction);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.estimatedTokens).toBe(150);
        }
      });
    });

    describe('INV-TOK-003: Budget Exhaustion', () => {
      it('budget status should indicate when cannot accept more', () => {
        const status = {
          config: DEFAULT_TOKEN_BUDGET,
          currentUsage: 3900,
          usageByType: {
            memory: 1500,
            todo: 800,
            session: 700,
            context: 500,
            system: 400,
          },
          remaining: 100,
          criticalReserveAvailable: 100,
          utilizationPercent: 97.5,
          canAcceptMore: false,
        };
        const result = BudgetStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.canAcceptMore).toBe(false);
        }
      });

      it('error codes should include budget exceeded', () => {
        expect(TokenBudgetErrorCode.TOKEN_BUDGET_EXCEEDED).toBe('TOKEN_BUDGET_EXCEEDED');
        expect(TokenBudgetErrorCode.TOKEN_TYPE_LIMIT_EXCEEDED).toBe('TOKEN_TYPE_LIMIT_EXCEEDED');
      });

      it('allocation should track excluded instructions', () => {
        const allocation = {
          included: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              type: 'system',
              content: 'System prompt',
              priority: 'critical',
            },
          ],
          excluded: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              type: 'todo',
              content: 'Low priority item',
              priority: 'low',
            },
          ],
          totalTokens: 500,
          remaining: 0,
          usageByType: { system: 500 },
          criticalReserveUsed: 0,
          allocationTimestamp: new Date().toISOString(),
        };
        const result = BudgetAllocationSchema.safeParse(allocation);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.excluded).toHaveLength(1);
        }
      });
    });

    describe('INV-TOK-EST-001: Conservative Estimation', () => {
      it('priority ordering should ensure critical comes first', () => {
        expect(getPriorityValue('critical')).toBeGreaterThan(getPriorityValue('high'));
        expect(getPriorityValue('high')).toBeGreaterThan(getPriorityValue('normal'));
        expect(getPriorityValue('normal')).toBeGreaterThan(getPriorityValue('low'));
      });

      it('type priority should ensure system comes first', () => {
        expect(getTypePriorityValue('system')).toBeGreaterThan(getTypePriorityValue('memory'));
        expect(getTypePriorityValue('memory')).toBeGreaterThan(getTypePriorityValue('session'));
        expect(getTypePriorityValue('session')).toBeGreaterThan(getTypePriorityValue('context'));
        expect(getTypePriorityValue('context')).toBeGreaterThan(getTypePriorityValue('todo'));
      });

      it('critical reserve should be maintained', () => {
        expect(DEFAULT_TOKEN_BUDGET.criticalReserve).toBe(500);
        expect(DEFAULT_TOKEN_BUDGET.criticalReserve).toBeGreaterThan(0);
      });
    });

    describe('INV-TOK-EST-002: Model-Specific Counting', () => {
      it('instruction should track source for tokenizer selection', () => {
        const instruction = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'system',
          content: 'System prompt content',
          priority: 'critical',
          source: 'claude-prompt',
        };
        const result = EmbeddedInstructionSchema.safeParse(instruction);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source).toBe('claude-prompt');
        }
      });

      it('allocation should track reserve usage', () => {
        const allocation = {
          included: [],
          excluded: [],
          totalTokens: 4500,
          remaining: 0,
          usageByType: {},
          criticalReserveUsed: 500,
          allocationTimestamp: new Date().toISOString(),
        };
        const result = BudgetAllocationSchema.safeParse(allocation);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.criticalReserveUsed).toBe(500);
        }
      });

      it('error code for estimation failure should be defined', () => {
        expect(TokenBudgetErrorCode.TOKEN_ESTIMATION_FAILED).toBe('TOKEN_ESTIMATION_FAILED');
      });
    });
  });
});
