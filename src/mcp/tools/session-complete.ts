/**
 * MCP Tool: session_complete
 *
 * Marks a session as completed.
 */

import type {
  ToolHandler,
  SessionCompleteInput,
  SessionCompleteOutput
} from '../types.js';
import { SessionManager } from '../../core/session-manager.js';
import { logger } from '../../utils/logger.js';

export interface SessionCompleteDependencies {
  sessionManager: SessionManager;
}

export function createSessionCompleteHandler(
  deps: SessionCompleteDependencies
): ToolHandler<SessionCompleteInput, SessionCompleteOutput> {
  return async (input: SessionCompleteInput): Promise<SessionCompleteOutput> => {
    logger.info('[MCP] session_complete called', { input });

    try {
      const { id } = input;

      // Complete the session
      await deps.sessionManager.completeSession(id);

      // Get updated session to confirm status
      const session = await deps.sessionManager.getSession(id);

      if (!session) {
        throw new Error(`Session not found after completion: ${id}`);
      }

      const result: SessionCompleteOutput = {
        success: true,
        sessionId: id,
        status: session.status
      };

      logger.info('[MCP] session_complete completed', {
        sessionId: id,
        status: session.status
      });

      return result;
    } catch (error) {
      logger.error('[MCP] session_complete failed', { error });
      throw new Error(`Session completion failed: ${(error as Error).message}`);
    }
  };
}
