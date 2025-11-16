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
 * Manages multi-agent sessions with persistence
 */
export class SessionManager {
    projectRoot;
    sessionsDir;
    // BUG FIX #11: Add session locks to prevent race conditions
    sessionLocks = new Map();
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = projectRoot;
        this.sessionsDir = join(projectRoot, AUTOMATOSX_DIRS.SESSIONS);
    }
    /**
     * Acquire lock for a session (prevents concurrent modifications)
     */
    async acquireLock(id) {
        // BUG FIX #18: Proper lock acquisition with loop to handle race conditions
        // Keep trying to acquire lock until we successfully set our lock
        while (true) {
            const existingLock = this.sessionLocks.get(id);
            if (!existingLock) {
                // No existing lock - try to set ours
                let releaseLock;
                const lockPromise = new Promise(resolve => {
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
            }
            else {
                // Wait for existing lock to be released
                await existingLock;
                // Loop again to try acquiring
            }
        }
    }
    /**
     * Create a new session
     */
    async createSession(name, agents) {
        // Ensure sessions directory exists
        await ensureDir(this.sessionsDir);
        const session = {
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
    async loadSession(id) {
        const sessionPath = join(this.sessionsDir, `${id}.json`);
        if (!existsSync(sessionPath)) {
            return null;
        }
        try {
            const data = await readFile(sessionPath, 'utf-8');
            const session = parseJsonWithDates(data, SESSION_DATE_FIELDS);
            return session;
        }
        catch (error) {
            logger.error(`Failed to load session: ${id}`, { error });
            return null;
        }
    }
    /**
     * List all sessions
     */
    async listSessions() {
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
            const sessions = loadedSessions.filter((s) => s !== null);
            sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            return sessions;
        }
        catch (error) {
            logger.error('Failed to list sessions', { error });
            return [];
        }
    }
    /**
     * Add an agent to an existing session
     */
    async joinSession(id, agent) {
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
        }
        finally {
            release();
        }
    }
    /**
     * Add execution history to session
     */
    async addToHistory(id, entry) {
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
        }
        finally {
            release();
        }
    }
    /**
     * Close a session
     */
    async closeSession(id) {
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
        }
        finally {
            release();
        }
    }
    /**
     * Delete a session
     */
    async deleteSession(id) {
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
    async saveSession(session) {
        const sessionPath = join(this.sessionsDir, `${session.id}.json`);
        await writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
    }
}
//# sourceMappingURL=SessionManager.js.map