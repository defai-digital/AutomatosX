/**
 * MCP Tool: session_create
 *
 * Creates a new multi-agent session.
 */

import type {
  ToolHandler,
  SessionCreateInput,
  SessionCreateOutput
} from '../types.js';
import { SessionManager } from '../../core/session-manager.js';
import { logger } from '../../utils/logger.js';

export interface SessionCreateDependencies {
  sessionManager: SessionManager;
}

export function createSessionCreateHandler(
  deps: SessionCreateDependencies
): ToolHandler<SessionCreateInput, SessionCreateOutput> {
  return async (input: SessionCreateInput): Promise<SessionCreateOutput> => {
    logger.info('[MCP] session_create called', { input });

    try {
      const { name, agent } = input;

      // Create new session
      const session = await deps.sessionManager.createSession(name, agent);

      const result: SessionCreateOutput = {
        sessionId: session.id,
        name: session.task,
        agent: session.initiator,
        status: session.status,
        createdAt: session.createdAt.toISOString()
      };

      logger.info('[MCP] session_create completed', {
        sessionId: session.id,
        status: session.status
      });

      return result;
    } catch (error) {
      logger.error('[MCP] session_create failed', { error });
      throw new Error(`Session creation failed: ${(error as Error).message}`);
    }
  };
}
