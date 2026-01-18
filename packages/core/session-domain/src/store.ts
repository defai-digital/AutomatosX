/**
 * Session Store Implementation
 *
 * Provides storage for session state.
 */

import type {
  Session,
  CreateSessionInput,
} from '@defai.digital/contracts';
import type { SessionStore, SessionFilter } from './types.js';

/**
 * In-memory session store implementation
 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  /**
   * Create a new session
   */
  async create(input: CreateSessionInput): Promise<Session> {
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();

    const session: Session = {
      sessionId,
      initiator: input.initiator,
      task: input.task,
      participants: [
        {
          agentId: input.initiator,
          role: 'initiator',
          joinedAt: now,
          tasks: [],
        },
      ],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      version: 1,
      workspace: input.workspace,
      metadata: input.metadata,
      appliedPolicies: [],
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get a session by ID
   */
  async get(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId);
  }

  /**
   * Update a session
   */
  async update(sessionId: string, session: Session): Promise<void> {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check version for optimistic concurrency
    const existing = this.sessions.get(sessionId)!;
    if (existing.version !== session.version - 1) {
      throw new SessionVersionConflictError(sessionId, existing.version, session.version);
    }

    this.sessions.set(sessionId, {
      ...session,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  /**
   * List sessions with optional filters
   */
  async list(filter?: SessionFilter): Promise<Session[]> {
    let sessions = Array.from(this.sessions.values());

    if (filter !== undefined) {
      if (filter.status !== undefined) {
        sessions = sessions.filter((s) => s.status === filter.status);
      }

      if (filter.initiator !== undefined) {
        sessions = sessions.filter((s) => s.initiator === filter.initiator);
      }

      if (filter.participant !== undefined) {
        sessions = sessions.filter((s) =>
          s.participants.some((p) => p.agentId === filter.participant)
        );
      }

      if (filter.workspace !== undefined) {
        sessions = sessions.filter((s) => s.workspace === filter.workspace);
      }

      if (filter.createdAfter !== undefined) {
        const after = new Date(filter.createdAfter).getTime();
        sessions = sessions.filter(
          (s) => new Date(s.createdAt).getTime() > after
        );
      }

      if (filter.createdBefore !== undefined) {
        const before = new Date(filter.createdBefore).getTime();
        sessions = sessions.filter(
          (s) => new Date(s.createdAt).getTime() < before
        );
      }

      if (filter.limit !== undefined) {
        sessions = sessions.slice(0, filter.limit);
      }
    }

    // Sort by createdAt descending
    sessions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return sessions;
  }

  /**
   * Find active session for an agent
   */
  async findActiveForAgent(
    agentId: string,
    workspace?: string
  ): Promise<Session | undefined> {
    for (const session of this.sessions.values()) {
      if (session.status !== 'active') {
        continue;
      }

      if (workspace !== undefined && session.workspace !== workspace) {
        continue;
      }

      const isParticipant = session.participants.some(
        (p) => p.agentId === agentId && p.leftAt === undefined
      );

      if (isParticipant) {
        return session;
      }
    }

    return undefined;
  }

  /**
   * Apply a governance policy to a session
   */
  async applyPolicy(sessionId: string, policyId: string): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check if policy already applied
    const appliedPolicies = session.appliedPolicies ?? [];
    if (appliedPolicies.includes(policyId)) {
      return session; // Already applied, return as-is
    }

    // Apply policy and increment version
    const updatedSession: Session = {
      ...session,
      appliedPolicies: [...appliedPolicies, policyId],
      updatedAt: new Date().toISOString(),
      version: session.version + 1,
    };

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  /**
   * Get applied policies for a session
   */
  async getAppliedPolicies(sessionId: string): Promise<string[]> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session.appliedPolicies ?? [];
  }

  /**
   * Clear all sessions (useful for testing)
   */
  clear(): void {
    this.sessions.clear();
  }

  /**
   * Get the count of sessions
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * Close stuck sessions that have been active longer than maxAgeMs
   * Marks them as failed with an auto-close message
   * @param maxAgeMs Maximum age in milliseconds (default: 24 hours)
   * @returns number of sessions that were closed
   */
  async closeStuckSessions(maxAgeMs = 86400000): Promise<number> {
    // Input validation
    if (maxAgeMs <= 0) {
      throw new Error('maxAgeMs must be a positive number');
    }

    const cutoffTime = Date.now();
    const cutoff = cutoffTime - maxAgeMs;
    let closedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      // Only process active sessions
      if (session.status !== 'active') continue;

      const createdTime = new Date(session.createdAt).getTime();
      if (createdTime < cutoff) {
        // Update session to failed status
        // Store error in metadata following the same pattern as failSession
        const timestamp = new Date().toISOString();
        const updatedSession: Session = {
          ...session,
          status: 'failed',
          updatedAt: timestamp,
          completedAt: timestamp,
          version: session.version + 1,
          metadata: {
            ...session.metadata,
            error: {
              code: 'SESSION_AUTO_CLOSED',
              message: 'Session closed automatically - exceeded maximum active time',
            },
          },
        };

        this.sessions.set(sessionId, updatedSession);
        closedCount++;
      }
    }

    return closedCount;
  }
}

/**
 * Session version conflict error
 */
export class SessionVersionConflictError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `Version conflict for session ${sessionId}: expected ${expectedVersion}, got ${actualVersion}`
    );
    this.name = 'SessionVersionConflictError';
  }
}

/**
 * Creates a new in-memory session store
 */
export function createSessionStore(): SessionStore {
  return new InMemorySessionStore();
}
