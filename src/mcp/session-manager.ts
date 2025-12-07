/**
 * Enhanced MCP Session Manager (v12.0.0)
 *
 * Manages MCP sessions with:
 * - Session isolation (unique ID per agent)
 * - Max concurrent sessions limit
 * - Session timeout with auto-cleanup
 * - Memory namespace isolation
 *
 * @module mcp/session-manager
 */

import { randomUUID } from 'crypto';
import { logger } from '../shared/logging/logger.js';
import type {
  McpSession,
  EnhancedMcpSession,
  McpSessionManagerConfig
} from './types.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<McpSessionManagerConfig> = {
  maxSessions: 10,
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  enableMemoryIsolation: true
};

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  /** Client info from MCP initialize */
  clientInfo: McpSession['clientInfo'];
  /** Normalized provider name */
  normalizedProvider: McpSession['normalizedProvider'];
  /** Optional agent name */
  agent?: string;
  /** Optional parent session (for delegation) */
  parentSessionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced MCP Session Manager
 *
 * Provides session lifecycle management for MCP bidirectional communication.
 */
export class McpSessionManager {
  private sessions: Map<string, EnhancedMcpSession> = new Map();
  private timeoutHandles: Map<string, NodeJS.Timeout> = new Map();
  private readonly config: Required<McpSessionManagerConfig>;

  constructor(config: McpSessionManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.debug('MCP Session Manager initialized', {
      maxSessions: this.config.maxSessions,
      timeoutMs: this.config.sessionTimeoutMs
    });
  }

  /**
   * Create a new MCP session
   */
  createSession(options: CreateSessionOptions): EnhancedMcpSession {
    // Check max sessions
    if (this.sessions.size >= this.config.maxSessions) {
      // Try to clean up expired sessions first
      this.cleanupExpiredSessions();

      if (this.sessions.size >= this.config.maxSessions) {
        throw new Error(`Maximum concurrent sessions (${this.config.maxSessions}) reached`);
      }
    }

    const sessionId = randomUUID();
    const now = Date.now();

    // Generate memory namespace
    const memoryNamespace = this.config.enableMemoryIsolation
      ? `mcp_${options.normalizedProvider}_${sessionId.slice(0, 8)}`
      : 'default';

    const session: EnhancedMcpSession = {
      sessionId,
      clientInfo: options.clientInfo,
      normalizedProvider: options.normalizedProvider,
      initTime: now,
      createdAt: now,
      lastActivityAt: now,
      memoryNamespace,
      currentAgent: options.agent,
      parentSessionId: options.parentSessionId,
      metadata: options.metadata
    };

    this.sessions.set(sessionId, session);

    // Set up timeout
    this.resetTimeout(sessionId);

    logger.info('MCP session created', {
      sessionId,
      provider: options.normalizedProvider,
      agent: options.agent,
      memoryNamespace
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): EnhancedMcpSession | undefined {
    const session = this.sessions.get(sessionId);

    if (session) {
      // Update activity timestamp
      session.lastActivityAt = Date.now();
      this.resetTimeout(sessionId);
    }

    return session;
  }

  /**
   * Get session by legacy McpSession (for backward compatibility)
   */
  getSessionByClient(clientInfo: McpSession['clientInfo']): EnhancedMcpSession | undefined {
    for (const session of this.sessions.values()) {
      if (
        session.clientInfo.name === clientInfo.name &&
        session.clientInfo.version === clientInfo.version
      ) {
        session.lastActivityAt = Date.now();
        this.resetTimeout(session.sessionId);
        return session;
      }
    }
    return undefined;
  }

  /**
   * Update session activity
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
      this.resetTimeout(sessionId);
    }
  }

  /**
   * Update session agent
   */
  setSessionAgent(sessionId: string, agent: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentAgent = agent;
      session.lastActivityAt = Date.now();
      this.resetTimeout(sessionId);
    }
  }

  /**
   * End a session
   */
  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Clear timeout
    const timeout = this.timeoutHandles.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeoutHandles.delete(sessionId);
    }

    // Remove session
    this.sessions.delete(sessionId);

    logger.info('MCP session ended', {
      sessionId,
      provider: session.normalizedProvider,
      durationMs: Date.now() - session.createdAt
    });

    return true;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): EnhancedMcpSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get sessions by provider
   */
  getSessionsByProvider(provider: McpSession['normalizedProvider']): EnhancedMcpSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.normalizedProvider === provider
    );
  }

  /**
   * Get sessions by agent
   */
  getSessionsByAgent(agent: string): EnhancedMcpSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.currentAgent === agent
    );
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Reset session timeout
   */
  private resetTimeout(sessionId: string): void {
    // Clear existing timeout
    const existingTimeout = this.timeoutHandles.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.expireSession(sessionId);
    }, this.config.sessionTimeoutMs);

    // Prevent timeout from keeping process alive
    if (timeout.unref) {
      timeout.unref();
    }

    this.timeoutHandles.set(sessionId, timeout);
  }

  /**
   * Expire a session due to timeout
   */
  private expireSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    logger.warn('MCP session expired due to timeout', {
      sessionId,
      provider: session.normalizedProvider,
      agent: session.currentAgent,
      idleMs: Date.now() - session.lastActivityAt
    });

    this.endSession(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();

    // Collect session IDs to delete first (avoid modifying Map while iterating)
    const expiredSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now - session.lastActivityAt;
      if (idleTime >= this.config.sessionTimeoutMs) {
        expiredSessionIds.push(sessionId);
      }
    }

    // Now delete the expired sessions
    for (const sessionId of expiredSessionIds) {
      this.endSession(sessionId);
    }

    if (expiredSessionIds.length > 0) {
      logger.info('Cleaned up expired MCP sessions', { count: expiredSessionIds.length });
    }

    return expiredSessionIds.length;
  }

  /**
   * End all sessions
   */
  endAllSessions(): number {
    const count = this.sessions.size;

    // Clear all timeouts
    for (const timeout of this.timeoutHandles.values()) {
      clearTimeout(timeout);
    }
    this.timeoutHandles.clear();

    // Clear sessions
    this.sessions.clear();

    logger.info('All MCP sessions ended', { count });

    return count;
  }

  /**
   * Get memory namespace for a session
   */
  getMemoryNamespace(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    return session?.memoryNamespace || 'default';
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    byProvider: Record<string, number>;
    byAgent: Record<string, number>;
    oldestSession: number | null;
  } {
    const byProvider: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let oldestSession: number | null = null;

    for (const session of this.sessions.values()) {
      // Count by provider
      byProvider[session.normalizedProvider] = (byProvider[session.normalizedProvider] || 0) + 1;

      // Count by agent
      if (session.currentAgent) {
        byAgent[session.currentAgent] = (byAgent[session.currentAgent] || 0) + 1;
      }

      // Track oldest
      if (oldestSession === null || session.createdAt < oldestSession) {
        oldestSession = session.createdAt;
      }
    }

    return {
      totalSessions: this.sessions.size,
      byProvider,
      byAgent,
      oldestSession
    };
  }
}

// Global instance
let globalSessionManager: McpSessionManager | null = null;

/**
 * Get the global MCP session manager
 */
export function getMcpSessionManager(config?: McpSessionManagerConfig): McpSessionManager {
  if (!globalSessionManager) {
    globalSessionManager = new McpSessionManager(config);
  }
  return globalSessionManager;
}

/**
 * Reset the global session manager (for testing)
 */
export function resetMcpSessionManager(): void {
  if (globalSessionManager) {
    globalSessionManager.endAllSessions();
    globalSessionManager = null;
  }
}
