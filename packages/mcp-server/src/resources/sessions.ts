/**
 * MCP Session Resources
 *
 * Read-only access to session data via MCP resources protocol.
 *
 * Invariants:
 * - INV-MCP-RES-001: Resources are read-only
 * - INV-MCP-RES-003: Sensitive data is never exposed via resources
 */

import type { MCPResource, MCPResourceContent, ResourceHandler } from '../types.js';
import type { Session } from '@defai.digital/session-domain';
import { getSharedSessionManager } from '../session-accessor.js';

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * Active sessions resource
 */
export const activeSessionsResource: MCPResource = {
  uri: 'automatosx://sessions/active',
  name: 'Active Sessions',
  description: 'List of currently active collaboration sessions',
  mimeType: 'application/json',
};

// ============================================================================
// Resource Handlers
// ============================================================================

/**
 * Handler for automatosx://sessions/active
 *
 * INV-MCP-RES-001: Read-only - returns active sessions list
 * INV-MCP-RES-003: No sensitive data (e.g., full metadata) exposed
 */
export const handleActiveSessions: ResourceHandler = async (): Promise<MCPResourceContent> => {
  const manager = getSharedSessionManager();
  const sessions = await manager.listSessions({ status: 'active' });

  const sessionSummaries = sessions.map((s: Session) => ({
    sessionId: s.sessionId,
    initiator: s.initiator,
    task: s.task,
    status: s.status,
    participantCount: s.participants.length,
    participants: s.participants.map((p) => ({
      agentId: p.agentId,
      role: p.role,
    })),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return {
    uri: 'automatosx://sessions/active',
    mimeType: 'application/json',
    text: JSON.stringify({ sessions: sessionSummaries, total: sessions.length }, null, 2),
  };
};

/**
 * All session resources
 */
export const SESSION_RESOURCES: MCPResource[] = [activeSessionsResource];

/**
 * Session resource handlers map
 */
export const SESSION_RESOURCE_HANDLERS: Record<string, ResourceHandler> = {
  'automatosx://sessions/active': handleActiveSessions,
};
