/**
 * SQLite Session Store
 *
 * Provides persistent storage for collaboration sessions.
 *
 * Invariants:
 * - INV-SESS-SQL-001: Sessions are persisted to SQLite
 * - INV-SESS-SQL-002: Optimistic concurrency via version field
 * - INV-SESS-SQL-003: Participants stored as JSON array
 */

import type {
  Session,
  SessionStatus,
  CreateSessionInput,
} from '@defai.digital/contracts';
import type Database from 'better-sqlite3';
import { isValidTableName, invalidTableNameMessage } from './validation.js';

/**
 * Filter options for listing sessions (matches session-domain interface)
 */
export interface SessionFilter {
  status?: SessionStatus;
  initiator?: string;
  participant?: string;
  workspace?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
}

/**
 * Session store interface (matches session-domain interface)
 */
export interface SessionStore {
  create(input: CreateSessionInput): Promise<Session>;
  get(sessionId: string): Promise<Session | undefined>;
  update(sessionId: string, session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
  list(filter?: SessionFilter): Promise<Session[]>;
  findActiveForAgent(agentId: string, workspace?: string): Promise<Session | undefined>;
  applyPolicy(sessionId: string, policyId: string): Promise<Session>;
  getAppliedPolicies(sessionId: string): Promise<string[]>;
  closeStuckSessions(maxAgeMs?: number): Promise<number>;
}

/**
 * Error thrown by SQLite session store operations
 */
export class SqliteSessionStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SqliteSessionStoreError';
  }
}

/**
 * Error codes for SQLite session store
 */
export const SqliteSessionStoreErrorCodes = {
  DATABASE_ERROR: 'SQLITE_SESSION_DATABASE_ERROR',
  NOT_FOUND: 'SQLITE_SESSION_NOT_FOUND',
  VERSION_CONFLICT: 'SQLITE_SESSION_VERSION_CONFLICT',
  INVALID_TABLE_NAME: 'SQLITE_SESSION_INVALID_TABLE_NAME',
  JSON_PARSE_ERROR: 'SQLITE_SESSION_JSON_PARSE_ERROR',
} as const;

/**
 * Safely parse JSON with fallback for corrupted data
 * INV-SESS-SQL-004: Safe JSON parsing prevents crashes from corrupted database data
 */
function safeJsonParse<T>(
  json: string | null | undefined,
  defaultValue: T,
  fieldName: string,
  sessionId?: string
): T {
  if (json === null || json === undefined) {
    return defaultValue;
  }
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    // Log the error for debugging but don't crash
    console.warn(
      `[SqliteSessionStore] Failed to parse ${fieldName}${sessionId ? ` for session ${sessionId}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}. Using default value.`
    );
    return defaultValue;
  }
}

/**
 * SQLite implementation of SessionStore
 * INV-SESS-SQL-001: Sessions are persisted to SQLite
 */
export class SqliteSessionStore implements SessionStore {
  private readonly db: Database.Database;
  private readonly tableName: string;

  constructor(db: Database.Database, tableName = 'sessions') {
    // Validate table name to prevent SQL injection
    if (!isValidTableName(tableName)) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.INVALID_TABLE_NAME,
        invalidTableNameMessage(tableName)
      );
    }
    this.db = db;
    this.tableName = tableName;
    this.initialize();
  }

  /**
   * Initializes the database schema
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        initiator TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        participants TEXT NOT NULL DEFAULT '[]',
        workspace TEXT,
        metadata TEXT,
        applied_policies TEXT DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_status
        ON ${this.tableName}(status);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_initiator
        ON ${this.tableName}(initiator);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at
        ON ${this.tableName}(created_at DESC);
    `);
  }

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

    try {
      const stmt = this.db.prepare(`
        INSERT INTO ${this.tableName} (
          session_id, initiator, task, status, participants,
          workspace, metadata, applied_policies, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        session.sessionId,
        session.initiator,
        session.task,
        session.status,
        JSON.stringify(session.participants),
        session.workspace ?? null,
        session.metadata ? JSON.stringify(session.metadata) : null,
        JSON.stringify(session.appliedPolicies),
        session.version,
        session.createdAt,
        session.updatedAt
      );

      return session;
    } catch (error) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.DATABASE_ERROR,
        `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a session by ID
   */
  async get(sessionId: string): Promise<Session | undefined> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName} WHERE session_id = ?
      `);

      const row = stmt.get(sessionId) as SessionRow | undefined;
      if (!row) return undefined;

      return this.rowToSession(row);
    } catch (error) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.DATABASE_ERROR,
        `Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update a session
   * INV-SESS-SQL-002: Optimistic concurrency via version field
   */
  async update(sessionId: string, session: Session): Promise<void> {
    try {
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        UPDATE ${this.tableName}
        SET initiator = ?,
            task = ?,
            status = ?,
            participants = ?,
            workspace = ?,
            metadata = ?,
            applied_policies = ?,
            version = ?,
            updated_at = ?,
            completed_at = ?
        WHERE session_id = ? AND version = ?
      `);

      const result = stmt.run(
        session.initiator,
        session.task,
        session.status,
        JSON.stringify(session.participants),
        session.workspace ?? null,
        session.metadata ? JSON.stringify(session.metadata) : null,
        JSON.stringify(session.appliedPolicies ?? []),
        session.version,
        now,
        session.completedAt ?? null,
        sessionId,
        session.version - 1 // Expected previous version
      );

      if (result.changes === 0) {
        // Check if session exists
        const existing = await this.get(sessionId);
        if (!existing) {
          throw new SqliteSessionStoreError(
            SqliteSessionStoreErrorCodes.NOT_FOUND,
            `Session ${sessionId} not found`
          );
        }
        throw new SqliteSessionStoreError(
          SqliteSessionStoreErrorCodes.VERSION_CONFLICT,
          `Version conflict for session ${sessionId}: expected ${session.version - 1}, got ${existing.version}`
        );
      }
    } catch (error) {
      if (error instanceof SqliteSessionStoreError) throw error;
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.DATABASE_ERROR,
        `Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE session_id = ?
      `);
      stmt.run(sessionId);
    } catch (error) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.DATABASE_ERROR,
        `Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List sessions with optional filters
   */
  async list(filter?: SessionFilter): Promise<Session[]> {
    try {
      let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params: unknown[] = [];

      if (filter?.status) {
        sql += ' AND status = ?';
        params.push(filter.status);
      }

      if (filter?.initiator) {
        sql += ' AND initiator = ?';
        params.push(filter.initiator);
      }

      if (filter?.workspace) {
        sql += ' AND workspace = ?';
        params.push(filter.workspace);
      }

      if (filter?.createdAfter) {
        sql += ' AND created_at > ?';
        params.push(filter.createdAfter);
      }

      if (filter?.createdBefore) {
        sql += ' AND created_at < ?';
        params.push(filter.createdBefore);
      }

      sql += ' ORDER BY created_at DESC';

      if (filter?.limit) {
        sql += ' LIMIT ?';
        params.push(filter.limit);
      }

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as SessionRow[];

      let sessions = rows.map((row) => this.rowToSession(row));

      // Filter by participant (requires post-query filtering due to JSON)
      if (filter?.participant) {
        sessions = sessions.filter((s) =>
          s.participants.some((p) => p.agentId === filter.participant)
        );
      }

      return sessions;
    } catch (error) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.DATABASE_ERROR,
        `Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find active session for an agent
   */
  async findActiveForAgent(
    agentId: string,
    workspace?: string
  ): Promise<Session | undefined> {
    try {
      let sql = `
        SELECT * FROM ${this.tableName}
        WHERE status = 'active'
      `;
      const params: unknown[] = [];

      if (workspace) {
        sql += ' AND workspace = ?';
        params.push(workspace);
      }

      sql += ' ORDER BY created_at DESC';

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as SessionRow[];

      for (const row of rows) {
        const session = this.rowToSession(row);
        const isParticipant = session.participants.some(
          (p) => p.agentId === agentId && p.leftAt === undefined
        );
        if (isParticipant) {
          return session;
        }
      }

      return undefined;
    } catch (error) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.DATABASE_ERROR,
        `Failed to find active session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Apply a governance policy to a session
   */
  async applyPolicy(sessionId: string, policyId: string): Promise<Session> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.NOT_FOUND,
        `Session ${sessionId} not found`
      );
    }

    const appliedPolicies = session.appliedPolicies ?? [];
    if (appliedPolicies.includes(policyId)) {
      return session; // Already applied
    }

    const updatedSession: Session = {
      ...session,
      appliedPolicies: [...appliedPolicies, policyId],
      version: session.version + 1,
    };

    await this.update(sessionId, updatedSession);
    return updatedSession;
  }

  /**
   * Get applied policies for a session
   */
  async getAppliedPolicies(sessionId: string): Promise<string[]> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.NOT_FOUND,
        `Session ${sessionId} not found`
      );
    }
    return session.appliedPolicies ?? [];
  }

  /**
   * Close stuck sessions that have been active longer than maxAgeMs
   */
  async closeStuckSessions(maxAgeMs = 86400000): Promise<number> {
    if (maxAgeMs <= 0) {
      throw new Error('maxAgeMs must be a positive number');
    }

    try {
      const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        UPDATE ${this.tableName}
        SET status = 'failed',
            updated_at = ?,
            completed_at = ?,
            version = version + 1,
            metadata = json_set(
              COALESCE(metadata, '{}'),
              '$.error',
              json('{"code":"SESSION_AUTO_CLOSED","message":"Session closed automatically - exceeded maximum active time"}')
            )
        WHERE status = 'active' AND created_at < ?
      `);

      const result = stmt.run(now, now, cutoff);
      return result.changes;
    } catch (error) {
      throw new SqliteSessionStoreError(
        SqliteSessionStoreErrorCodes.DATABASE_ERROR,
        `Failed to close stuck sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert database row to Session object
   * INV-SESS-SQL-004: Uses safe JSON parsing to handle corrupted data gracefully
   */
  private rowToSession(row: SessionRow): Session {
    return {
      sessionId: row.session_id,
      initiator: row.initiator,
      task: row.task,
      status: row.status as SessionStatus,
      participants: safeJsonParse(row.participants, [], 'participants', row.session_id),
      workspace: row.workspace ?? undefined,
      metadata: safeJsonParse(row.metadata, undefined, 'metadata', row.session_id),
      appliedPolicies: safeJsonParse(row.applied_policies, [], 'applied_policies', row.session_id),
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at ?? undefined,
    };
  }
}

/**
 * Database row type
 */
interface SessionRow {
  id: number;
  session_id: string;
  initiator: string;
  task: string;
  status: string;
  participants: string;
  workspace: string | null;
  metadata: string | null;
  applied_policies: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Creates a new SQLite session store
 */
export function createSqliteSessionStore(
  db: Database.Database,
  tableName = 'sessions'
): SessionStore {
  return new SqliteSessionStore(db, tableName);
}
