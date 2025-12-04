/**
 * Memory Instruction Provider Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MemoryInstructionProvider,
  createMockMemoryProvider,
  type MemorySearchProvider,
  type OrchestrationContext,
  createTodoItem
} from '../../../src/core/orchestration/index.js';

describe('MemoryInstructionProvider', () => {
  let provider: MemoryInstructionProvider;
  let mockSearchProvider: MemorySearchProvider;
  let defaultContext: OrchestrationContext;

  beforeEach(() => {
    mockSearchProvider = createMockMemoryProvider([
      {
        content: 'Previously implemented user authentication with JWT tokens',
        score: 0.8,
        agentId: 'backend'
      },
      {
        content: 'Database schema uses PostgreSQL with migrations',
        score: 0.7,
        agentId: 'backend'
      },
      {
        content: 'Frontend uses React with TypeScript',
        score: 0.6,
        agentId: 'frontend'
      }
    ]);

    provider = new MemoryInstructionProvider(mockSearchProvider);
    provider.reset();

    defaultContext = {
      todos: [],
      currentTask: 'implement user login',
      turnCount: 0,
      workflowMode: 'default'
    };
  });

  describe('constructor', () => {
    it('should use default config', () => {
      const config = provider.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.maxEntries).toBe(5);
      expect(config.minRelevance).toBe(0.5);
    });

    it('should accept custom config', () => {
      const customProvider = new MemoryInstructionProvider(mockSearchProvider, {
        maxEntries: 3,
        minRelevance: 0.7
      });
      const config = customProvider.getConfig();
      expect(config.maxEntries).toBe(3);
      expect(config.minRelevance).toBe(0.7);
    });

    it('should work without search provider', () => {
      const noProviderInstance = new MemoryInstructionProvider();
      expect(noProviderInstance.hasSearchProvider()).toBe(false);
    });
  });

  describe('setSearchProvider', () => {
    it('should set the search provider', () => {
      const noProviderInstance = new MemoryInstructionProvider();
      expect(noProviderInstance.hasSearchProvider()).toBe(false);

      noProviderInstance.setSearchProvider(mockSearchProvider);
      expect(noProviderInstance.hasSearchProvider()).toBe(true);
    });
  });

  describe('shouldGenerate', () => {
    it('should return false when disabled', () => {
      const disabledProvider = new MemoryInstructionProvider(mockSearchProvider, {
        enabled: false
      });
      expect(disabledProvider.shouldGenerate(defaultContext)).toBe(false);
    });

    it('should return false when no search provider', () => {
      const noProviderInstance = new MemoryInstructionProvider();
      expect(noProviderInstance.shouldGenerate(defaultContext)).toBe(false);
    });

    it('should return false when no task context', () => {
      const emptyContext: OrchestrationContext = {
        todos: [],
        turnCount: 0,
        workflowMode: 'default'
      };
      expect(provider.shouldGenerate(emptyContext)).toBe(false);
    });

    it('should return true with task context', () => {
      expect(provider.shouldGenerate(defaultContext)).toBe(true);
    });

    it('should return true when search frequency due', async () => {
      // First call
      await provider.getInstructions(defaultContext);

      // Advance turns
      const laterContext = { ...defaultContext, turnCount: 4 };
      expect(provider.shouldGenerate(laterContext)).toBe(true);
    });
  });

  describe('getInstructions', () => {
    it('should return empty array when no search provider', async () => {
      const noProviderInstance = new MemoryInstructionProvider();
      const instructions = await noProviderInstance.getInstructions(defaultContext);
      expect(instructions).toHaveLength(0);
    });

    it('should return memory instructions', async () => {
      const instructions = await provider.getInstructions(defaultContext);
      expect(instructions).toHaveLength(1);
      expect(instructions[0]?.type).toBe('memory');
      expect(instructions[0]?.priority).toBe('normal');
    });

    it('should include relevant memories in content', async () => {
      const instructions = await provider.getInstructions(defaultContext);
      const content = instructions[0]?.content || '';
      expect(content).toContain('Relevant Context from Memory');
      expect(content).toContain('Memory 1');
    });

    it('should filter by minRelevance', async () => {
      const strictProvider = new MemoryInstructionProvider(mockSearchProvider, {
        minRelevance: 0.75
      });

      const instructions = await strictProvider.getInstructions(defaultContext);
      const content = instructions[0]?.content || '';

      // Only 0.8 score memory should be included
      expect(content).toContain('authentication');
      expect(content).not.toContain('Frontend');
    });

    it('should respect maxEntries', async () => {
      const limitedProvider = new MemoryInstructionProvider(mockSearchProvider, {
        maxEntries: 1,
        minRelevance: 0.5
      });

      const instructions = await limitedProvider.getInstructions(defaultContext);
      const content = instructions[0]?.content || '';

      // Should only have 1 memory
      expect(content).toContain('Memory 1');
      expect(content).not.toContain('Memory 2');
    });

    it('should use todos when no current task', async () => {
      const todoContext: OrchestrationContext = {
        todos: [
          createTodoItem('Implement authentication', 'Implementing auth', 'in_progress')
        ],
        turnCount: 0,
        workflowMode: 'default'
      };

      const instructions = await provider.getInstructions(todoContext);
      expect(instructions).toHaveLength(1);
    });

    it('should cache results', async () => {
      // First call
      await provider.getInstructions(defaultContext);

      // Create spy on search provider
      const searchSpy = vi.spyOn(mockSearchProvider, 'search');

      // Second call with same context should use cache
      const laterContext = { ...defaultContext, turnCount: 1 };
      await provider.getInstructions(laterContext);

      // Search should not be called again (cached)
      expect(searchSpy).not.toHaveBeenCalled();
    });
  });

  describe('includeMetadata', () => {
    it('should include agent info when enabled', async () => {
      const metadataProvider = new MemoryInstructionProvider(mockSearchProvider, {
        includeMetadata: true
      });

      const instructions = await metadataProvider.getInstructions(defaultContext);
      const content = instructions[0]?.content || '';
      expect(content).toContain('backend');
    });

    it('should exclude agent info when disabled', async () => {
      const noMetadataProvider = new MemoryInstructionProvider(mockSearchProvider, {
        includeMetadata: false
      });

      const instructions = await noMetadataProvider.getInstructions(defaultContext);
      const content = instructions[0]?.content || '';
      expect(content).not.toContain('from backend');
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      // Populate cache
      await provider.getInstructions(defaultContext);

      // Create spy
      const searchSpy = vi.spyOn(mockSearchProvider, 'search');

      // Clear cache
      provider.clearCache();

      // Next call should search again
      await provider.getInstructions(defaultContext);
      expect(searchSpy).toHaveBeenCalled();
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      provider.updateConfig({ maxEntries: 10 });
      const config = provider.getConfig();
      expect(config.maxEntries).toBe(10);
    });

    it('should clear cache when relevance changes', async () => {
      // Populate cache
      await provider.getInstructions(defaultContext);

      const searchSpy = vi.spyOn(mockSearchProvider, 'search');

      // Update relevance
      provider.updateConfig({ minRelevance: 0.8 });

      // Cache should be cleared
      await provider.getInstructions(defaultContext);
      expect(searchSpy).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset state', async () => {
      await provider.getInstructions(defaultContext);
      provider.reset();

      // Should search again after reset
      const searchSpy = vi.spyOn(mockSearchProvider, 'search');
      await provider.getInstructions(defaultContext);
      expect(searchSpy).toHaveBeenCalled();
    });
  });
});

describe('createMockMemoryProvider', () => {
  it('should create a mock provider', () => {
    const provider = createMockMemoryProvider([
      { content: 'Test memory', score: 0.9 }
    ]);
    expect(provider).toBeDefined();
    expect(provider.search).toBeDefined();
  });

  it('should return memories matching query', async () => {
    const provider = createMockMemoryProvider([
      { content: 'User authentication system' },
      { content: 'Database migrations' },
      { content: 'Frontend components' }
    ]);

    const results = await provider.search({
      text: 'authentication user',
      limit: 10
    });

    expect(results.length).toBeGreaterThan(0);
    // First result should be most relevant
    expect(results[0]?.content).toContain('authentication');
  });

  it('should respect limit', async () => {
    const provider = createMockMemoryProvider([
      { content: 'Memory 1' },
      { content: 'Memory 2' },
      { content: 'Memory 3' }
    ]);

    const results = await provider.search({
      text: 'memory',
      limit: 2
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should use provided scores', async () => {
    const provider = createMockMemoryProvider([
      { content: 'Low relevance', score: 0.3 },
      { content: 'High relevance', score: 0.9 }
    ]);

    const results = await provider.search({
      text: 'anything',
      limit: 10
    });

    // Results should be sorted by score
    if (results.length >= 2) {
      const scores = results.map(r => r.score);
      expect(scores[0]).toBeGreaterThanOrEqual(scores[1] ?? 0);
    }
  });
});
