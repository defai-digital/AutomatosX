/**
 * Orchestration Instruction Injector Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrchestrationInstructionInjector,
  createInstruction,
  type InstructionProvider,
  type OrchestrationContext,
  type EmbeddedInstruction
} from '../../../src/core/orchestration/index.js';

// Mock provider for testing
class MockProvider implements InstructionProvider {
  readonly name: string;
  private instructions: EmbeddedInstruction[];
  private shouldGenerateValue: boolean;

  constructor(
    name: string,
    instructions: EmbeddedInstruction[] = [],
    shouldGenerate = true
  ) {
    this.name = name;
    this.instructions = instructions;
    this.shouldGenerateValue = shouldGenerate;
  }

  shouldGenerate(_context: OrchestrationContext): boolean {
    return this.shouldGenerateValue;
  }

  async getInstructions(_context: OrchestrationContext): Promise<EmbeddedInstruction[]> {
    return this.instructions;
  }
}

describe('OrchestrationInstructionInjector', () => {
  let injector: OrchestrationInstructionInjector;
  let defaultContext: OrchestrationContext;

  beforeEach(() => {
    injector = new OrchestrationInstructionInjector();
    defaultContext = {
      todos: [],
      turnCount: 0,
      workflowMode: 'default'
    };
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(injector.isEnabled()).toBe(true);
      expect(injector.getProviders()).toHaveLength(0);
    });

    it('should accept custom config', () => {
      const customInjector = new OrchestrationInstructionInjector({
        enabled: false
      });
      expect(customInjector.isEnabled()).toBe(false);
    });
  });

  describe('registerProvider', () => {
    it('should register a provider', () => {
      const provider = new MockProvider('test');
      injector.registerProvider(provider);
      expect(injector.getProviders()).toHaveLength(1);
      expect(injector.getProviders()[0]?.name).toBe('test');
    });

    it('should replace existing provider with same name', () => {
      const provider1 = new MockProvider('test');
      const provider2 = new MockProvider('test');
      injector.registerProvider(provider1);
      injector.registerProvider(provider2);
      expect(injector.getProviders()).toHaveLength(1);
    });
  });

  describe('unregisterProvider', () => {
    it('should remove registered provider', () => {
      const provider = new MockProvider('test');
      injector.registerProvider(provider);
      const removed = injector.unregisterProvider('test');
      expect(removed).toBe(true);
      expect(injector.getProviders()).toHaveLength(0);
    });

    it('should return false for non-existent provider', () => {
      const removed = injector.unregisterProvider('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('inject', () => {
    it('should return empty result when disabled', async () => {
      injector.setEnabled(false);
      const result = await injector.inject(defaultContext);
      expect(result.hasInstructions).toBe(false);
      expect(result.formattedText).toBe('');
    });

    it('should collect instructions from all providers', async () => {
      const instruction1 = createInstruction('task', 'Task instruction');
      const instruction2 = createInstruction('memory', 'Memory instruction');

      injector.registerProvider(new MockProvider('provider1', [instruction1]));
      injector.registerProvider(new MockProvider('provider2', [instruction2]));

      const result = await injector.inject(defaultContext);
      expect(result.instructions).toHaveLength(2);
      expect(result.hasInstructions).toBe(true);
    });

    it('should skip providers that should not generate', async () => {
      const instruction = createInstruction('task', 'Task instruction');
      injector.registerProvider(new MockProvider('active', [instruction]));
      injector.registerProvider(new MockProvider('inactive', [instruction], false));

      const result = await injector.inject(defaultContext);
      expect(result.instructions).toHaveLength(1);
    });

    it('should filter by includeTypes option', async () => {
      const taskInstruction = createInstruction('task', 'Task');
      const memoryInstruction = createInstruction('memory', 'Memory');

      injector.registerProvider(new MockProvider('mixed', [taskInstruction, memoryInstruction]));

      const result = await injector.inject(defaultContext, {
        includeTypes: ['task']
      });
      expect(result.instructions).toHaveLength(1);
      expect(result.instructions[0]?.type).toBe('task');
    });

    it('should filter by excludeTypes option', async () => {
      const taskInstruction = createInstruction('task', 'Task');
      const memoryInstruction = createInstruction('memory', 'Memory');

      injector.registerProvider(new MockProvider('mixed', [taskInstruction, memoryInstruction]));

      const result = await injector.inject(defaultContext, {
        excludeTypes: ['memory']
      });
      expect(result.instructions).toHaveLength(1);
      expect(result.instructions[0]?.type).toBe('task');
    });

    it('should handle provider errors gracefully', async () => {
      const errorProvider: InstructionProvider = {
        name: 'error',
        shouldGenerate: () => true,
        getInstructions: async () => {
          throw new Error('Provider error');
        }
      };

      const goodInstruction = createInstruction('task', 'Good task');
      injector.registerProvider(errorProvider);
      injector.registerProvider(new MockProvider('good', [goodInstruction]));

      const result = await injector.inject(defaultContext);
      expect(result.instructions).toHaveLength(1);
      expect(result.instructions[0]?.content).toBe('Good task');
    });

    it('should respect token budget', async () => {
      const smallInjector = new OrchestrationInstructionInjector({
        tokenBudget: {
          maxTotal: 100,
          perType: {
            task: 50,
            memory: 50,
            session: 50,
            delegation: 50,
            mode: 50
          },
          criticalReserve: 0
        }
      });

      // Create instruction that exceeds budget
      const largeInstruction = createInstruction(
        'task',
        'a'.repeat(1000) // Very large content
      );

      smallInjector.registerProvider(new MockProvider('large', [largeInstruction]));

      const result = await smallInjector.inject(defaultContext);
      expect(result.allocation.excluded.length).toBeGreaterThan(0);
    });

    it('should skip budget allocation when skipBudget is true', async () => {
      const instruction = createInstruction('task', 'a'.repeat(10000));
      injector.registerProvider(new MockProvider('test', [instruction]));

      const result = await injector.inject(defaultContext, { skipBudget: true });
      expect(result.instructions).toHaveLength(1);
      expect(result.allocation.excluded).toHaveLength(0);
    });
  });

  describe('formatInstructions', () => {
    it('should format instructions as system-reminder tags', async () => {
      const instruction = createInstruction('task', 'Test content');
      injector.registerProvider(new MockProvider('test', [instruction]));

      const result = await injector.inject(defaultContext);
      expect(result.formattedText).toContain('<system-reminder>');
      expect(result.formattedText).toContain('Test content');
      expect(result.formattedText).toContain('</system-reminder>');
    });

    it('should return empty string for no instructions', () => {
      const formatted = injector.formatInstructions([]);
      expect(formatted).toBe('');
    });

    it('should group instructions by type', async () => {
      const modeInstruction = createInstruction('mode', 'Mode content');
      const taskInstruction = createInstruction('task', 'Task content');

      injector.registerProvider(
        new MockProvider('test', [taskInstruction, modeInstruction])
      );

      const result = await injector.inject(defaultContext);
      // Mode should come before task in output
      const modeIndex = result.formattedText.indexOf('Mode content');
      const taskIndex = result.formattedText.indexOf('Task content');
      expect(modeIndex).toBeLessThan(taskIndex);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      injector.updateConfig({ enabled: false });
      expect(injector.isEnabled()).toBe(false);
    });

    it('should get current configuration', () => {
      const config = injector.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.tokenBudget).toBeDefined();
    });

    it('should toggle enabled state', () => {
      injector.setEnabled(false);
      expect(injector.isEnabled()).toBe(false);
      injector.setEnabled(true);
      expect(injector.isEnabled()).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear instruction cache without error', () => {
      expect(() => injector.clearCache()).not.toThrow();
    });
  });

  describe('getBudgetManager', () => {
    it('should return budget manager instance', () => {
      const budgetManager = injector.getBudgetManager();
      expect(budgetManager).toBeDefined();
      expect(budgetManager.getConfig()).toBeDefined();
    });
  });
});

describe('createInstruction', () => {
  it('should create instruction with default priority', () => {
    const instruction = createInstruction('task', 'Test content');
    expect(instruction.type).toBe('task');
    expect(instruction.priority).toBe('normal');
    expect(instruction.content).toBe('Test content');
    expect(instruction.source).toBe('automatosx');
    expect(instruction.createdAt).toBeGreaterThan(0);
  });

  it('should accept custom priority', () => {
    const instruction = createInstruction('task', 'Test', 'critical');
    expect(instruction.priority).toBe('critical');
  });

  it('should accept options', () => {
    const instruction = createInstruction('task', 'Test', 'high', {
      expiresAfter: 5,
      id: 'custom-id'
    });
    expect(instruction.expiresAfter).toBe(5);
    expect(instruction.id).toBe('custom-id');
  });

  it('should generate id if not provided', () => {
    const instruction = createInstruction('task', 'Test');
    expect(instruction.id).toContain('task-');
  });
});
