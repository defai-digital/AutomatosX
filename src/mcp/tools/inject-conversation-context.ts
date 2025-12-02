/**
 * MCP Tool: inject_conversation_context
 *
 * Injects conversation context into the shared context store.
 * Allows AI assistants to save context for future retrieval.
 *
 * @since v10.2.0 (Phase 3.1)
 */

import { randomUUID } from 'crypto';
import type { ToolHandler } from '../types.js';
import type { ConversationContextStore, ConversationContext } from '../../core/conversation-context-store.js';
import { logger } from '../../utils/logger.js';

export interface InjectConversationContextInput {
  source: string;                // Source assistant (e.g., "gemini-cli", "claude-code")
  content: string;               // Context content
  metadata?: {
    topic?: string;              // Conversation topic
    participants?: string[];     // Agent names involved
    tags?: string[];             // Searchable tags
  };
}

export interface InjectConversationContextOutput {
  id: string;                    // Generated context ID
  timestamp: string;             // ISO 8601 timestamp
  success: boolean;
}

export interface InjectConversationContextHandlerDeps {
  contextStore: ConversationContextStore;
}

export function createInjectConversationContextHandler(
  deps: InjectConversationContextHandlerDeps
): ToolHandler<InjectConversationContextInput, InjectConversationContextOutput> {
  return async (input: InjectConversationContextInput): Promise<InjectConversationContextOutput> => {
    logger.info('[MCP Tool] inject_conversation_context', {
      source: input.source,
      contentLength: input.content.length
    });

    const { contextStore } = deps;

    try {
      const context: ConversationContext = {
        id: randomUUID(),
        source: input.source,
        timestamp: new Date().toISOString(),
        content: input.content,
        metadata: input.metadata
      };

      await contextStore.save(context);

      return {
        id: context.id,
        timestamp: context.timestamp,
        success: true
      };
    } catch (error) {
      logger.error('[MCP Tool] inject_conversation_context failed', { error });
      throw new Error(`Failed to inject conversation context: ${(error as Error).message}`);
    }
  };
}
