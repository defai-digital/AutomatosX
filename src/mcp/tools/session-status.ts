/**
 * MCP Tool: session_status
 *
 * Gets detailed status of a specific session.
 */

import type {
  ToolHandler,
  SessionStatusInput,
  SessionStatusOutput
} from '../types.js';
import { SessionManager } from '../../core/session/manager.js';
import { logger } from '../../shared/logging/logger.js';

export interface SessionStatusDependencies {
  sessionManager: SessionManager;
}

export function createSessionStatusHandler(
  deps: SessionStatusDependencies
): ToolHandler<SessionStatusInput, SessionStatusOutput> {
  return async (input: SessionStatusInput): Promise<SessionStatusOutput> => {
    logger.info('[MCP] session_status called', { input });

    try {
      const { id } = input;

      // Get session details
      const session = await deps.sessionManager.getSession(id);

      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }

      const result: SessionStatusOutput = {
        id: session.id,
        task: session.task,
        initiator: session.initiator,
        status: session.status,
        agents: session.agents,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        metadata: session.metadata
      };

      logger.info('[MCP] session_status completed', {
        sessionId: id,
        status: session.status
      });

      return result;
    } catch (error) {
      logger.error('[MCP] session_status failed', { error });
      throw new Error(`Session status failed: ${(error as Error).message}`);
    }
  };
}
