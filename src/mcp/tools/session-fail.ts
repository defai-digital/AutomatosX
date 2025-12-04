/**
 * MCP Tool: session_fail
 *
 * Marks a session as failed with an error reason.
 */

import type {
  ToolHandler,
  SessionFailInput,
  SessionFailOutput
} from '../types.js';
import { SessionManager } from '../../core/session/manager.js';
import { logger } from '../../shared/logging/logger.js';

export interface SessionFailDependencies {
  sessionManager: SessionManager;
}

export function createSessionFailHandler(
  deps: SessionFailDependencies
): ToolHandler<SessionFailInput, SessionFailOutput> {
  return async (input: SessionFailInput): Promise<SessionFailOutput> => {
    logger.info('[MCP] session_fail called', { input });

    try {
      const { id, reason } = input;

      // Mark session as failed
      const error = new Error(reason);
      await deps.sessionManager.failSession(id, error);

      // Get updated session to confirm status
      const session = await deps.sessionManager.getSession(id);

      if (!session) {
        throw new Error(`Session not found after failure: ${id}`);
      }

      const result: SessionFailOutput = {
        success: true,
        sessionId: id,
        status: session.status,
        error: reason
      };

      logger.info('[MCP] session_fail completed', {
        sessionId: id,
        status: session.status,
        reason
      });

      return result;
    } catch (error) {
      logger.error('[MCP] session_fail failed', { error });
      throw new Error(`Session failure marking failed: ${(error as Error).message}`);
    }
  };
}
