/**
 * MCP Tool Tests: search_memory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSearchMemoryHandler } from '../../../../src/mcp/tools/search-memory.js';
import type { SearchMemoryInput } from '../../../../src/mcp/types.js';

describe('MCP Tool: search_memory', () => {
  let mockMemoryManager: any;

  beforeEach(() => {
    mockMemoryManager = {
      search: vi.fn()
    };
  });

  describe('Successful Search', () => {
    it('should search memory with query and return results', async () => {
      const mockSearchResults = [
        {
          entry: {
            id: 'mem-1',
            content: 'User authentication implementation',
            metadata: {
              agent: 'backend',
              timestamp: '2025-10-11T10:00:00Z',
              type: 'implementation'
            }
          },
          similarity: 0.95
        },
        {
          entry: {
            id: 'mem-2',
            content: 'Login UI component design',
            metadata: {
              agent: 'frontend',
              timestamp: '2025-10-11T11:00:00Z',
              type: 'design'
            }
          },
          similarity: 0.87
        }
      ];

      mockMemoryManager.search.mockResolvedValue(mockSearchResults);

      const handler = createSearchMemoryHandler({
        memoryManager: mockMemoryManager
      });

      const input: SearchMemoryInput = {
        query: 'authentication'
      };

      const result = await handler(input);

      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        id: 'mem-1',
        similarity: 0.95,
        content: 'User authentication implementation',
        metadata: {
          agent: 'backend',
          timestamp: '2025-10-11T10:00:00Z',
          type: 'implementation'
        }
      });
      expect(result.results[1]).toEqual({
        id: 'mem-2',
        similarity: 0.87,
        content: 'Login UI component design',
        metadata: {
          agent: 'frontend',
          timestamp: '2025-10-11T11:00:00Z',
          type: 'design'
        }
      });

      // Verify search was called correctly
      expect(mockMemoryManager.search).toHaveBeenCalledWith({
        text: 'authentication',
        limit: 10 // default limit
      });
    });

    it('should use custom limit parameter', async () => {
      mockMemoryManager.search.mockResolvedValue([]);

      const handler = createSearchMemoryHandler({
        memoryManager: mockMemoryManager
      });

      const input: SearchMemoryInput = {
        query: 'test query',
        limit: 5
      };

      await handler(input);

      expect(mockMemoryManager.search).toHaveBeenCalledWith({
        text: 'test query',
        limit: 5
      });
    });

    it('should default to limit of 10 when not specified', async () => {
      mockMemoryManager.search.mockResolvedValue([]);

      const handler = createSearchMemoryHandler({
        memoryManager: mockMemoryManager
      });

      const input: SearchMemoryInput = {
        query: 'test query'
      };

      await handler(input);

      expect(mockMemoryManager.search).toHaveBeenCalledWith({
        text: 'test query',
        limit: 10
      });
    });

    it('should handle empty search results', async () => {
      mockMemoryManager.search.mockResolvedValue([]);

      const handler = createSearchMemoryHandler({
        memoryManager: mockMemoryManager
      });

      const input: SearchMemoryInput = {
        query: 'nonexistent term'
      };

      const result = await handler(input);

      expect(result.results).toHaveLength(0);
      expect(result.results).toEqual([]);
    });

    it('should handle entries with minimal metadata', async () => {
      const mockSearchResults = [
        {
          entry: {
            id: 'mem-1',
            content: 'Content without metadata',
            metadata: {}
          },
          similarity: 0.75
        }
      ];

      mockMemoryManager.search.mockResolvedValue(mockSearchResults);

      const handler = createSearchMemoryHandler({
        memoryManager: mockMemoryManager
      });

      const input: SearchMemoryInput = {
        query: 'test'
      };

      const result = await handler(input);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        id: 'mem-1',
        similarity: 0.75,
        content: 'Content without metadata',
        metadata: {
          agent: undefined,
          timestamp: undefined
        }
      });
    });

    it('should preserve all metadata fields', async () => {
      const mockSearchResults = [
        {
          entry: {
            id: 'mem-1',
            content: 'Test content',
            metadata: {
              agent: 'backend',
              timestamp: '2025-10-11T10:00:00Z',
              type: 'custom',
              customField1: 'value1',
              customField2: 'value2'
            }
          },
          similarity: 0.9
        }
      ];

      mockMemoryManager.search.mockResolvedValue(mockSearchResults);

      const handler = createSearchMemoryHandler({
        memoryManager: mockMemoryManager
      });

      const input: SearchMemoryInput = {
        query: 'test'
      };

      const result = await handler(input);

      expect(result.results[0]?.metadata).toEqual({
        agent: 'backend',
        timestamp: '2025-10-11T10:00:00Z',
        type: 'custom',
        customField1: 'value1',
        customField2: 'value2'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle memory search failure', async () => {
      mockMemoryManager.search.mockRejectedValue(
        new Error('Database connection failed')
      );

      const handler = createSearchMemoryHandler({
        memoryManager: mockMemoryManager
      });

      const input: SearchMemoryInput = {
        query: 'test query'
      };

      await expect(handler(input)).rejects.toThrow('Memory search failed');
      await expect(handler(input)).rejects.toThrow('Database connection failed');
    });

    it('should handle FTS5 syntax errors gracefully', async () => {
      mockMemoryManager.search.mockRejectedValue(
        new Error('fts5: syntax error near "("')
      );

      const handler = createSearchMemoryHandler({
        memoryManager: mockMemoryManager
      });

      const input: SearchMemoryInput = {
        query: 'query with (parentheses)'
      };

      await expect(handler(input)).rejects.toThrow('Memory search failed');
    });
  });
});
