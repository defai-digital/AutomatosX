/**
 * MCP Tool: get_conversation_context
 *
 * Retrieves conversation context from the shared context store.
 * Allows AI assistants to access context from previous conversations.
 *
 * @since v10.2.0 (Phase 3.1)
 */

import type { ToolHandler } from '../types.js';
import type { ConversationContextStore } from '../../core/session/context-store.js';
import { logger } from '../../shared/logging/logger.js';

export interface GetConversationContextInput {
  id?: string;                   // Optional: Get specific context by ID
  source?: string;               // Optional: Filter by source (e.g., "gemini-cli")
  limit?: number;                // Optional: Max results (default: 10)
}

export interface GetConversationContextOutput {
  contexts: Array<{
    id: string;
    source: string;
    timestamp: string;
    content: string;
    metadata?: {
      topic?: string;
      participants?: string[];
      tags?: string[];
    };
  }>;
  total: number;
}

export interface GetConversationContextHandlerDeps {
  contextStore: ConversationContextStore;
}

export function createGetConversationContextHandler(
  deps: GetConversationContextHandlerDeps
): ToolHandler<GetConversationContextInput, GetConversationContextOutput> {
  return async (input: GetConversationContextInput): Promise<GetConversationContextOutput> => {
    logger.info('[MCP Tool] get_conversation_context', { input });

    const { contextStore } = deps;

    try {
      // If ID specified, get single context
      if (input.id) {
        const context = await contextStore.get(input.id);
        if (!context) {
          return { contexts: [], total: 0 };
        }
        return { contexts: [context], total: 1 };
      }

      // Otherwise, list contexts with filters
      const contexts = await contextStore.list({
        source: input.source,
        limit: input.limit ?? 10
      });

      return {
        contexts,
        total: contexts.length
      };
    } catch (error) {
      logger.error('[MCP Tool] get_conversation_context failed', { error });
      throw new Error(`Failed to get conversation context: ${(error as Error).message}`);
    }
  };
}
