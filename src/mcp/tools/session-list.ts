/**
 * MCP Tool: session_list
 *
 * Lists all active sessions.
 */

import type { ToolHandler, SessionListOutput } from '../types.js';
import { SessionManager } from '../../core/session-manager.js';
import { logger } from '../../utils/logger.js';

export interface SessionListDependencies {
  sessionManager: SessionManager;
}

export function createSessionListHandler(
  deps: SessionListDependencies
): ToolHandler<Record<string, never>, SessionListOutput> {
  return async (): Promise<SessionListOutput> => {
    logger.info('[MCP] session_list called');

    try {
      // Get all active sessions
      const sessions = await deps.sessionManager.getActiveSessions();

      const result: SessionListOutput = {
        sessions: sessions.map((session) => ({
          id: session.id,
          task: session.task,
          initiator: session.initiator,
          status: session.status,
          agents: session.agents,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString()
        }))
      };

      logger.info('[MCP] session_list completed', {
        count: sessions.length
      });

      return result;
    } catch (error) {
      logger.error('[MCP] session_list failed', { error });
      throw new Error(`Session list failed: ${(error as Error).message}`);
    }
  };
}
