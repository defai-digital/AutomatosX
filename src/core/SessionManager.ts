/**
 * SessionManager - Manage multi-agent sessions
 * Phase 3: Advanced Features - Week 3
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { ensureDir, parseJsonWithDates } from '../utils/file-helpers.js';
import { AUTOMATOSX_DIRS, SESSION_DATE_FIELDS } from '../agents/constants.js';

/**
 * Session history entry
 */
export interface SessionHistoryEntry {
  timestamp: Date;
  agent: string;
  task: string;
  result: string;
  duration: number;
  provider?: string;
  model?: string;
}

/**
 * Session configuration
 */
export interface Session {
  id: string;
  name: string;
  agents: string[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'closed';
  history: SessionHistoryEntry[];
  metadata?: Record<string, any>;
}

/**
 * Manages multi-agent sessions with persistence
 */
export class SessionManager {
  private projectRoot: string;
  private sessionsDir: string;
  // BUG FIX #11: Add session locks to prevent race conditions
  private sessionLocks: Map<string, Promise<void>> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.sessionsDir = join(projectRoot, AUTOMATOSX_DIRS.SESSIONS);
  }

  /**
   * Acquire lock for a session (prevents concurrent modifications)
   */
  private async acquireLock(id: string): Promise<() => void> {
    // BUG FIX #18: Proper lock acquisition with loop to handle race conditions
    // Keep trying to acquire lock until we successfully set our lock
    while (true) {
      const existingLock = this.sessionLocks.get(id);

      if (!existingLock) {
        // No existing lock - try to set ours
        let releaseLock!: () => void;
        const lockPromise = new Promise<void>(resolve => {
          releaseLock = resolve;
        });

        // Atomically check and set (still best-effort in JS single-threaded model)
        // If another caller set a lock between our check and set, we'll catch it next iteration
        if (!this.sessionLocks.has(id)) {
          this.sessionLocks.set(id, lockPromise);

          // Return release function
          return () => {
            this.sessionLocks.delete(id);
            releaseLock();
          };
        }
        // Lock was set by another caller - loop again
      } else {
        // Wait for existing lock to be released
        await existingLock;
        // Loop again to try acquiring
      }
    }
  }

  /**
   * Create a new session
   */
  async createSession(name: string, agents: string[]): Promise<Session> {
    // Ensure sessions directory exists
    await ensureDir(this.sessionsDir);

    const session: Session = {
      id: randomUUID(),
      name,
      agents,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      history: [],
    };

    await this.saveSession(session);

    logger.info(`Created session: ${session.id}`, {
      name,
      agents: agents.length,
    });

    return session;
  }

  /**
   * Load a session by ID
   */
  async loadSession(id: string): Promise<Session | null> {
    const sessionPath = join(this.sessionsDir, `${id}.json`);

    if (!existsSync(sessionPath)) {
      return null;
    }

    try {
      const data = await readFile(sessionPath, 'utf-8');
      const session = parseJsonWithDates<Session>(data, SESSION_DATE_FIELDS);

      return session;
    } catch (error) {
      logger.error(`Failed to load session: ${id}`, { error });
      return null;
    }
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Session[]> {
    if (!existsSync(this.sessionsDir)) {
      return [];
    }

    try {
      const files = await readdir(this.sessionsDir);
      const sessionIds = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));

      // Load sessions in parallel for better performance
      const sessionPromises = sessionIds.map(id => this.loadSession(id));
      const loadedSessions = await Promise.all(sessionPromises);

      // Filter out nulls and sort by updated date (most recent first)
      const sessions = loadedSessions.filter((s): s is Session => s !== null);
      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return sessions;
    } catch (error) {
      logger.error('Failed to list sessions', { error });
      return [];
    }
  }

  /**
   * Add an agent to an existing session
   */
  async joinSession(id: string, agent: string): Promise<void> {
    // BUG FIX #11: Acquire lock to prevent race conditions
    const release = await this.acquireLock(id);

    try {
      const session = await this.loadSession(id);

      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }

      if (session.status === 'closed') {
        throw new Error(`Session is closed: ${id}`);
      }

      if (!session.agents.includes(agent)) {
        session.agents.push(agent);
        session.updatedAt = new Date();
        await this.saveSession(session);

        logger.info(`Agent joined session: ${agent}`, { sessionId: id });
      }
    } finally {
      release();
    }
  }

  /**
   * Add execution history to session
   */
  async addToHistory(
    id: string,
    entry: Omit<SessionHistoryEntry, 'timestamp'>
  ): Promise<void> {
    // BUG FIX #11: Acquire lock to prevent race conditions
    const release = await this.acquireLock(id);

    try {
      const session = await this.loadSession(id);

      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }

      session.history.push({
        ...entry,
        timestamp: new Date(),
      });

      session.updatedAt = new Date();
      await this.saveSession(session);

      logger.info(`Added history entry to session: ${id}`, {
        agent: entry.agent,
        duration: entry.duration,
      });
    } finally {
      release();
    }
  }

  /**
   * Close a session
   */
  async closeSession(id: string): Promise<void> {
    // BUG FIX #11: Acquire lock to prevent race conditions
    const release = await this.acquireLock(id);

    try {
      const session = await this.loadSession(id);

      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }

      session.status = 'closed';
      session.updatedAt = new Date();
      await this.saveSession(session);

      logger.info(`Closed session: ${id}`);
    } finally {
      release();
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(id: string): Promise<void> {
    const sessionPath = join(this.sessionsDir, `${id}.json`);

    if (!existsSync(sessionPath)) {
      throw new Error(`Session not found: ${id}`);
    }

    const { unlink } = await import('fs/promises');
    await unlink(sessionPath);

    logger.info(`Deleted session: ${id}`);
  }

  /**
   * Save session to disk
   */
  private async saveSession(session: Session): Promise<void> {
    const sessionPath = join(this.sessionsDir, `${session.id}.json`);
    await writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
  }
}
