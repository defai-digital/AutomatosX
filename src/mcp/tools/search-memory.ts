/**
 * MCP Tool: search_memory
 *
 * Searches AutomatosX memory for relevant information.
 * Wraps the existing memory search command logic.
 */

import type { ToolHandler, SearchMemoryInput, SearchMemoryOutput } from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';

export interface SearchMemoryDependencies {
  memoryManager: IMemoryManager;
}

export function createSearchMemoryHandler(
  deps: SearchMemoryDependencies
): ToolHandler<SearchMemoryInput, SearchMemoryOutput> {
  return async (input: SearchMemoryInput): Promise<SearchMemoryOutput> => {
    const { query, limit = 10 } = input;

    logger.info('[MCP] search_memory called', { query, limit });

    try {
      const results = await deps.memoryManager.search({
        text: query,
        limit
      });

      const output: SearchMemoryOutput = {
        results: results.map((result) => ({
          id: result.entry.id,
          similarity: result.similarity,
          content: result.entry.content,
          metadata: {
            agent: result.entry.metadata?.agent as string | undefined,
            timestamp: result.entry.metadata?.timestamp as string | undefined,
            ...(result.entry.metadata || {})
          }
        }))
      };

      logger.info('[MCP] search_memory completed', {
        query,
        resultsCount: results.length
      });

      return output;
    } catch (error) {
      logger.error('[MCP] search_memory failed', { query, error });
      throw new Error(`Memory search failed: ${(error as Error).message}`);
    }
  };
}
