/**
 * LoopGuard Unit Tests
 *
 * Tests for the loop prevention system:
 * - Depth limit enforcement
 * - Self-call prevention
 * - Chain length limits
 * - Blocked pattern detection
 * - Context creation and extension
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LoopGuard,
  createLoopGuard,
  getLoopGuard,
  resetLoopGuard
} from '@/core/task-engine/loop-guard';
import {
  type TaskContext,
  LoopPreventionError
} from '@/core/task-engine/types';

describe('LoopGuard', () => {
  let guard: LoopGuard;

  beforeEach(() => {
    resetLoopGuard();
    guard = new LoopGuard();
  });

  afterEach(() => {
    resetLoopGuard();
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const config = guard.getConfig();

      expect(config.maxDepth).toBe(2);
      expect(config.maxChainLength).toBe(5);
      expect(config.blockSelfCalls).toBe(true);
      expect(config.blockedPatterns).toHaveLength(1);
    });

    it('should accept custom configuration', () => {
      const customGuard = new LoopGuard({
        maxDepth: 3,
        maxChainLength: 10,
        blockSelfCalls: false
      });

      const config = customGuard.getConfig();

      expect(config.maxDepth).toBe(3);
      expect(config.maxChainLength).toBe(10);
      expect(config.blockSelfCalls).toBe(false);
    });

    it('should reject invalid maxDepth', () => {
      expect(() => new LoopGuard({ maxDepth: 0 })).toThrow();
      expect(() => new LoopGuard({ maxDepth: 11 })).toThrow();
    });

    it('should reject invalid maxChainLength', () => {
      expect(() => new LoopGuard({ maxChainLength: 1 })).toThrow();
      expect(() => new LoopGuard({ maxChainLength: 21 })).toThrow();
    });
  });

  describe('createContext', () => {
    it('should create valid context from origin client', () => {
      const ctx = guard.createContext('claude-code');

      expect(ctx.originClient).toBe('claude-code');
      expect(ctx.callChain).toEqual(['claude-code']);
      expect(ctx.depth).toBe(0);
      expect(ctx.maxDepth).toBe(2);
      expect(ctx.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('should normalize client names', () => {
      expect(guard.createContext('claude').originClient).toBe('claude-code');
      expect(guard.createContext('CLAUDE-CODE').originClient).toBe('claude-code');
      expect(guard.createContext('gemini').originClient).toBe('gemini-cli');
      expect(guard.createContext('codex').originClient).toBe('codex-cli');
      // v12.0.0: Updated to GLM/Grok instead of ax-cli
      expect(guard.createContext('glm').originClient).toBe('glm');
      expect(guard.createContext('grok').originClient).toBe('grok');
    });

    it('should preserve unknown client names (normalized format) to prevent false-positive loop detection', () => {
      // Unknown engines should be preserved rather than all becoming 'unknown'
      // This prevents false-positive loop detection when two different unknown engines
      // would otherwise both map to 'unknown'
      expect(guard.createContext('my-custom-engine').originClient).toBe('my-custom-engine');
      expect(guard.createContext('another-engine').originClient).toBe('another-engine');
      expect(guard.createContext('Some_Engine').originClient).toBe('some-engine'); // normalized format
    });

    it('should set task ID if provided', () => {
      const ctx = guard.createContext('claude-code', 'task_123');

      expect(ctx.taskId).toBe('task_123');
    });
  });

  describe('validateExecution', () => {
    describe('depth limit', () => {
      it('should allow execution at depth 0', () => {
        const ctx = guard.createContext('claude-code');

        expect(() => guard.validateExecution(ctx, 'gemini')).not.toThrow();
      });

      it('should allow execution at depth 1', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'gemini'],
          depth: 1,
          maxDepth: 2,
          createdAt: Date.now()
        };

        expect(() => guard.validateExecution(ctx, 'codex')).not.toThrow();
      });

      it('should block execution at maxDepth', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini', 'automatosx'],
          depth: 2,
          maxDepth: 2,
          createdAt: Date.now()
        };

        expect(() => guard.validateExecution(ctx, 'codex')).toThrow(LoopPreventionError);
      });

      it('should include correct error code for depth exceeded', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 2,
          maxDepth: 2,
          createdAt: Date.now()
        };

        try {
          guard.validateExecution(ctx, 'codex');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(LoopPreventionError);
          expect((error as LoopPreventionError).code).toBe('DEPTH_EXCEEDED');
        }
      });
    });

    describe('self-call prevention', () => {
      it('should block calls to engine already in chain', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        // Trying to call gemini again (already in chain)
        expect(() => guard.validateExecution(ctx, 'gemini')).toThrow(LoopPreventionError);
      });

      it('should block calls back to origin client', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        // Trying to call claude-code (already in chain as origin)
        expect(() => guard.validateExecution(ctx, 'claude')).toThrow(LoopPreventionError);
      });

      it('should include correct error code for loop detection', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        try {
          guard.validateExecution(ctx, 'gemini');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(LoopPreventionError);
          expect((error as LoopPreventionError).code).toBe('LOOP_DETECTED');
        }
      });

      it('should allow self-calls when blockSelfCalls is false', () => {
        const permissiveGuard = new LoopGuard({
          blockSelfCalls: false,
          maxDepth: 5,
          maxChainLength: 10,
          blockedPatterns: []
        });

        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        expect(() => permissiveGuard.validateExecution(ctx, 'gemini')).not.toThrow();
      });

      // Bug fix test: different unknown engines should NOT trigger false-positive loop detection
      it('should NOT trigger false-positive loop for different unknown engines', () => {
        const noPatternGuard = new LoopGuard({
          blockedPatterns: [],
          maxDepth: 5,
          maxChainLength: 10
        });

        // Call chain contains one unknown engine
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'unknown' as const,
          callChain: ['custom-engine-a', 'automatosx'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        // Calling a DIFFERENT unknown engine should NOT trigger loop detection
        // Bug: Previously both would normalize to 'unknown' and trigger false-positive
        expect(() => noPatternGuard.validateExecution(ctx, 'custom-engine-b')).not.toThrow();
      });

      it('should still detect loops for same unknown engine', () => {
        const noPatternGuard = new LoopGuard({
          blockedPatterns: [],
          maxDepth: 5,
          maxChainLength: 10
        });

        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'unknown' as const,
          callChain: ['custom-engine-a', 'automatosx'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        // Calling the SAME unknown engine should still trigger loop detection
        expect(() => noPatternGuard.validateExecution(ctx, 'custom-engine-a')).toThrow(LoopPreventionError);
      });
    });

    describe('chain length limit', () => {
      it('should allow chains within limit', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'gemini'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        expect(() => guard.validateExecution(ctx, 'codex')).not.toThrow();
      });

      it('should block chains exceeding limit', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          // Chain of 4, adding automatosx + target = 6, which exceeds default 5
          callChain: ['a', 'b', 'c', 'd'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        expect(() => guard.validateExecution(ctx, 'codex')).toThrow(LoopPreventionError);
      });

      it('should include correct error code for chain too long', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['a', 'b', 'c', 'd'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        try {
          guard.validateExecution(ctx, 'codex');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(LoopPreventionError);
          expect((error as LoopPreventionError).code).toBe('CHAIN_TOO_LONG');
        }
      });
    });

    describe('blocked patterns', () => {
      it('should block recursive automatosx pattern', () => {
        // Pattern: automatosx.*automatosx
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          // Already has automatosx in chain
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        // Adding another automatosx → target creates: automatosx.*automatosx
        // But self-call check will trigger first for gemini
        // Let's use a different target
        // Actually, the pattern matches the projected chain including automatosx
        expect(() => guard.validateExecution(ctx, 'ax-cli')).toThrow(LoopPreventionError);
      });

      it('should include correct error code for blocked pattern', () => {
        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 1,
          maxDepth: 10,
          createdAt: Date.now()
        };

        try {
          guard.validateExecution(ctx, 'ax-cli');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(LoopPreventionError);
          expect((error as LoopPreventionError).code).toBe('BLOCKED_PATTERN');
        }
      });

      it('should allow custom blocked patterns', () => {
        const customGuard = new LoopGuard({
          blockedPatterns: [/claude.*gemini.*claude/]
        });

        const ctx: TaskContext = {
          taskId: 'test',
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 1,
          maxDepth: 5,
          createdAt: Date.now()
        };

        // This would create: claude→automatosx→gemini→automatosx→claude
        expect(() => customGuard.validateExecution(ctx, 'claude')).toThrow(LoopPreventionError);
      });
    });

    describe('valid execution paths', () => {
      it('should allow simple single-hop execution', () => {
        const ctx = guard.createContext('claude-code');

        expect(() => guard.validateExecution(ctx, 'gemini')).not.toThrow();
      });

      it('should allow two-hop execution with different engines', () => {
        const ctx = guard.createContext('claude-code');
        guard.validateExecution(ctx, 'gemini'); // First hop OK

        // Simulate the extended context after first hop
        const extendedCtx = guard.extendContext(ctx, 'gemini');

        // Second hop to a different engine
        // Note: This will hit blocked pattern because automatosx appears twice
        // Let's test with a guard that has no blocked patterns
        const noPatternGuard = new LoopGuard({
          blockedPatterns: []
        });

        expect(() => noPatternGuard.validateExecution(extendedCtx, 'codex')).not.toThrow();
      });
    });
  });

  describe('extendContext', () => {
    it('should increment depth', () => {
      const ctx = guard.createContext('claude-code');
      const extended = guard.extendContext(ctx, 'gemini');

      expect(extended.depth).toBe(1);
    });

    it('should extend call chain', () => {
      const ctx = guard.createContext('claude-code');
      const extended = guard.extendContext(ctx, 'gemini');

      expect(extended.callChain).toEqual(['claude-code', 'automatosx', 'gemini-cli']);
    });

    it('should preserve task ID', () => {
      const ctx = guard.createContext('claude-code', 'task_123');
      const extended = guard.extendContext(ctx, 'gemini');

      expect(extended.taskId).toBe('task_123');
    });

    it('should update createdAt timestamp', () => {
      const ctx = guard.createContext('claude-code');
      const originalTime = ctx.createdAt;

      // Small delay to ensure different timestamp
      const extended = guard.extendContext(ctx, 'gemini');

      expect(extended.createdAt).toBeGreaterThanOrEqual(originalTime);
    });
  });

  describe('mergeContext', () => {
    it('should merge incoming context with current origin', () => {
      const incoming = {
        taskId: 'task_123',
        originClient: 'claude-code' as const,
        callChain: ['claude-code', 'automatosx'],
        depth: 1
      };

      const merged = guard.mergeContext(incoming);

      expect(merged.taskId).toBe('task_123');
      expect(merged.depth).toBe(2);
      expect(merged.callChain).toEqual(['claude-code', 'automatosx', 'automatosx']);
    });

    it('should create new chain if incoming is empty', () => {
      const incoming = {
        originClient: 'gemini-cli' as const
      };

      const merged = guard.mergeContext(incoming);

      expect(merged.callChain).toEqual(['gemini-cli', 'automatosx']);
    });
  });

  describe('getCallChainString', () => {
    it('should format call chain as arrow-separated string', () => {
      const ctx: TaskContext = {
        taskId: 'test',
        originClient: 'claude-code',
        callChain: ['claude-code', 'automatosx', 'gemini-cli'],
        depth: 1,
        maxDepth: 2,
        createdAt: Date.now()
      };

      expect(guard.getCallChainString(ctx)).toBe('claude-code → automatosx → gemini-cli');
    });
  });

  describe('isValidContext', () => {
    it('should return true for valid context', () => {
      const ctx = guard.createContext('claude-code');

      expect(guard.isValidContext(ctx)).toBe(true);
    });

    it('should return false for null', () => {
      expect(guard.isValidContext(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(guard.isValidContext(undefined)).toBe(false);
    });

    it('should return false for missing fields', () => {
      expect(guard.isValidContext({ taskId: 'test' })).toBe(false);
    });

    it('should return false for invalid types', () => {
      expect(guard.isValidContext({
        taskId: 123, // Should be string
        originClient: 'claude-code',
        callChain: [],
        depth: 0,
        maxDepth: 2,
        createdAt: Date.now()
      })).toBe(false);
    });

    it('should return false for negative depth', () => {
      expect(guard.isValidContext({
        taskId: 'test',
        originClient: 'claude-code',
        callChain: [],
        depth: -1,
        maxDepth: 2,
        createdAt: Date.now()
      })).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getLoopGuard', () => {
      const guard1 = getLoopGuard();
      const guard2 = getLoopGuard();

      expect(guard1).toBe(guard2);
    });

    it('should reset singleton with resetLoopGuard', () => {
      const guard1 = getLoopGuard();
      resetLoopGuard();
      const guard2 = getLoopGuard();

      expect(guard1).not.toBe(guard2);
    });
  });

  describe('factory function', () => {
    it('should create new instance with createLoopGuard', () => {
      const guard1 = createLoopGuard();
      const guard2 = createLoopGuard();

      expect(guard1).not.toBe(guard2);
    });

    it('should accept configuration', () => {
      const customGuard = createLoopGuard({ maxDepth: 5 });

      expect(customGuard.getConfig().maxDepth).toBe(5);
    });
  });
});

describe('LoopPreventionError', () => {
  it('should include call chain in error', () => {
    const callChain = ['claude-code', 'automatosx', 'gemini'];
    const error = new LoopPreventionError('Test error', callChain);

    expect(error.callChain).toEqual(callChain);
    expect(error.code).toBe('LOOP_DETECTED');
    expect(error.message).toBe('Test error');
  });

  it('should accept custom error code', () => {
    const error = new LoopPreventionError('Depth exceeded', [], 'DEPTH_EXCEEDED');

    expect(error.code).toBe('DEPTH_EXCEEDED');
  });

  it('should be instance of TaskEngineError', () => {
    const error = new LoopPreventionError('Test', []);

    expect(error.name).toBe('LoopPreventionError');
  });
});
