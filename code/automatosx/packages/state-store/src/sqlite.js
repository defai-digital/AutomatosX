// Uses Node.js built-in sqlite (node:sqlite), available from Node 22.5+ / Node 24.
// No native compilation required.
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const JOURNAL_MODE_SETUP_ATTEMPTS = 20;
const JOURNAL_MODE_SETUP_INITIAL_DELAY_MS = 5;
const atomicsWaitState = new Int32Array(new SharedArrayBuffer(4));
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isDatabaseLocked(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.includes('database is locked') || error.message.includes('database is busy');
}
function sleepBlocking(milliseconds) {
    Atomics.wait(atomicsWaitState, 0, 0, milliseconds);
}
function withJournalModeRetry(operation) {
    let lastError;
    for (let attempt = 0; attempt < JOURNAL_MODE_SETUP_ATTEMPTS; attempt += 1) {
        try {
            return operation();
        }
        catch (error) {
            if (!isDatabaseLocked(error) || attempt + 1 >= JOURNAL_MODE_SETUP_ATTEMPTS) {
                throw error;
            }
            lastError = error;
            const delayMs = JOURNAL_MODE_SETUP_INITIAL_DELAY_MS * Math.pow(2, attempt);
            sleepBlocking(delayMs);
        }
    }
    throw lastError;
}
function normalizeTags(tags) {
    return Array.from(new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0))).sort();
}
function normalizeRating(rating) {
    if (typeof rating !== 'number' || !Number.isFinite(rating))
        return undefined;
    return Math.max(1, Math.min(5, Math.round(rating)));
}
function safeJsonParse(json, fallback) {
    if (json == null)
        return fallback;
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
function computeTokenFreqRecord(content) {
    const tokens = content.toLowerCase().split(/[^a-z0-9_-]+/i).map((t) => t.trim()).filter((t) => t.length >= 2);
    const freq = {};
    for (const t of tokens)
        freq[t] = (freq[t] ?? 0) + 1;
    return freq;
}
function tfCosineSimilarity(a, b) {
    const aKeys = Object.keys(a);
    if (aKeys.length === 0 || Object.keys(b).length === 0)
        return 0;
    let dot = 0, aMag = 0, bMag = 0;
    for (const v of Object.values(a))
        aMag += v * v;
    for (const v of Object.values(b))
        bMag += v * v;
    for (const k of aKeys)
        dot += (a[k] ?? 0) * (b[k] ?? 0);
    if (dot === 0 || aMag === 0 || bMag === 0)
        return 0;
    return Number((dot / (Math.sqrt(aMag) * Math.sqrt(bMag))).toFixed(4));
}
function asRow(value) {
    return value;
}
function asRows(value) {
    return value;
}
const DEFAULT_DB_FILE = join('.automatosx', 'runtime', 'state.db');
export class SqliteStateStore {
    db;
    constructor(config = {}) {
        const dbFile = config.dbFile ?? join(config.basePath ?? process.cwd(), DEFAULT_DB_FILE);
        mkdirSync(dirname(dbFile), { recursive: true });
        this.db = new DatabaseSync(dbFile);
        this.db.prepare(`PRAGMA busy_timeout = 10000`).run();
        withJournalModeRetry(() => this.db.prepare(`PRAGMA journal_mode = WAL`).get());
        this.db.prepare(`PRAGMA foreign_keys = ON`).run();
        this.initialize();
    }
    initialize() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        key        TEXT NOT NULL,
        namespace  TEXT NOT NULL DEFAULT 'default',
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(key, namespace)
      );
      CREATE INDEX IF NOT EXISTS idx_mem_ns  ON memory_items(namespace);
      CREATE INDEX IF NOT EXISTS idx_mem_upd ON memory_items(updated_at DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        key, namespace, value,
        content='memory_items',
        content_rowid='id',
        tokenize='porter unicode61'
      );
      CREATE TRIGGER IF NOT EXISTS mem_ai AFTER INSERT ON memory_items BEGIN
        INSERT INTO memory_fts(rowid, key, namespace, value) VALUES (new.id, new.key, new.namespace, new.value);
      END;
      CREATE TRIGGER IF NOT EXISTS mem_ad AFTER DELETE ON memory_items BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, key, namespace, value) VALUES ('delete', old.id, old.key, old.namespace, old.value);
      END;
      CREATE TRIGGER IF NOT EXISTS mem_au AFTER UPDATE ON memory_items BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, key, namespace, value) VALUES ('delete', old.id, old.key, old.namespace, old.value);
        INSERT INTO memory_fts(rowid, key, namespace, value) VALUES (new.id, new.key, new.namespace, new.value);
      END;

      CREATE TABLE IF NOT EXISTS policies (
        policy_id  TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        enabled    INTEGER NOT NULL DEFAULT 1,
        metadata   TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        agent_id         TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        capabilities     TEXT NOT NULL DEFAULT '[]',
        metadata         TEXT,
        registration_key TEXT NOT NULL,
        registered_at    TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS semantic_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        key        TEXT NOT NULL,
        namespace  TEXT NOT NULL DEFAULT 'default',
        content    TEXT NOT NULL,
        token_freq TEXT,
        tags       TEXT,
        metadata   TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(key, namespace)
      );
      CREATE INDEX IF NOT EXISTS idx_sem_ns  ON semantic_items(namespace);
      CREATE INDEX IF NOT EXISTS idx_sem_upd ON semantic_items(updated_at DESC);

      CREATE TABLE IF NOT EXISTS feedback (
        feedback_id       TEXT PRIMARY KEY,
        selected_agent    TEXT NOT NULL,
        recommended_agent TEXT,
        rating            INTEGER,
        feedback_type     TEXT NOT NULL DEFAULT 'explicit',
        task_description  TEXT NOT NULL,
        user_comment      TEXT,
        outcome           TEXT,
        duration_ms       INTEGER,
        session_id        TEXT,
        metadata          TEXT,
        created_at        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fb_agent   ON feedback(selected_agent);
      CREATE INDEX IF NOT EXISTS idx_fb_created ON feedback(created_at DESC);

      CREATE TABLE IF NOT EXISTS sessions (
        session_id   TEXT PRIMARY KEY,
        task         TEXT NOT NULL,
        initiator    TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'active',
        workspace    TEXT,
        metadata     TEXT,
        summary      TEXT,
        error_msg    TEXT,
        participants TEXT NOT NULL DEFAULT '[]',
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sess_status  ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sess_updated ON sessions(updated_at DESC);
    `);
    }
    // -------------------------------------------------------------------------
    // Memory
    // -------------------------------------------------------------------------
    async storeMemory(entry) {
        const namespace = entry.namespace ?? 'default';
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO memory_items (key, namespace, value, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(key, namespace) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(entry.key, namespace, JSON.stringify(entry.value), now);
        return { key: entry.key, namespace: entry.namespace, value: entry.value, updatedAt: now };
    }
    async getMemory(key, namespace) {
        const row = asRow(this.db.prepare(`SELECT key, namespace, value, updated_at FROM memory_items WHERE key = ? AND namespace = ?`).get(key, namespace ?? 'default'));
        return row ? rowToMemory(row) : undefined;
    }
    async searchMemory(query, namespace) {
        const trimmed = query.trim();
        if (trimmed === '')
            return this.listMemory(namespace);
        const escaped = trimmed.replace(/"/g, '""');
        let sql = `
      SELECT m.key, m.namespace, m.value, m.updated_at
      FROM memory_fts fts JOIN memory_items m ON fts.rowid = m.id
      WHERE memory_fts MATCH ?
    `;
        const params = [`"${escaped}"`];
        if (namespace !== undefined) {
            sql += ` AND m.namespace = ?`;
            params.push(namespace);
        }
        sql += ` ORDER BY bm25(memory_fts) LIMIT 200`;
        const rows = asRows(this.db.prepare(sql).all(...params));
        return rows.map(rowToMemory);
    }
    async deleteMemory(key, namespace) {
        const result = this.db.prepare(`DELETE FROM memory_items WHERE key = ? AND namespace = ?`)
            .run(key, namespace ?? 'default');
        return result.changes > 0;
    }
    async listMemory(namespace) {
        const rows = namespace !== undefined
            ? asRows(this.db.prepare(`SELECT key, namespace, value, updated_at FROM memory_items WHERE namespace = ? ORDER BY updated_at DESC`).all(namespace))
            : asRows(this.db.prepare(`SELECT key, namespace, value, updated_at FROM memory_items ORDER BY updated_at DESC`).all());
        return rows.map(rowToMemory);
    }
    // -------------------------------------------------------------------------
    // Policies
    // -------------------------------------------------------------------------
    async registerPolicy(entry) {
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO policies (policy_id, name, enabled, metadata, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(policy_id) DO UPDATE SET name = excluded.name, enabled = excluded.enabled, metadata = excluded.metadata, updated_at = excluded.updated_at
    `).run(entry.policyId, entry.name, (entry.enabled ?? true) ? 1 : 0, entry.metadata ? JSON.stringify(entry.metadata) : null, now);
        return { policyId: entry.policyId, name: entry.name, enabled: entry.enabled ?? true, metadata: entry.metadata, updatedAt: now };
    }
    async listPolicies() {
        const rows = asRows(this.db.prepare(`SELECT policy_id, name, enabled, metadata, updated_at FROM policies ORDER BY policy_id`).all());
        return rows.map(rowToPolicy);
    }
    // -------------------------------------------------------------------------
    // Agents
    // -------------------------------------------------------------------------
    async registerAgent(entry) {
        const capabilities = Array.from(new Set((entry.capabilities ?? []).map((c) => c.trim()).filter(Boolean))).sort();
        const metadata = entry.metadata;
        const sortedMeta = metadata ? JSON.parse(JSON.stringify(metadata, Object.keys(metadata).sort())) : undefined;
        const registrationKey = JSON.stringify({ agentId: entry.agentId, name: entry.name, capabilities, metadata: sortedMeta });
        const now = new Date().toISOString();
        const existing = asRow(this.db.prepare(`SELECT agent_id, registration_key FROM agents WHERE agent_id = ?`).get(entry.agentId));
        if (existing !== undefined) {
            if (existing.registration_key !== registrationKey) {
                throw new Error(`Agent "${entry.agentId}" is already registered with a different configuration`);
            }
            return (await this.getAgent(entry.agentId));
        }
        this.db.prepare(`
      INSERT INTO agents (agent_id, name, capabilities, metadata, registration_key, registered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entry.agentId, entry.name, JSON.stringify(capabilities), metadata ? JSON.stringify(metadata) : null, registrationKey, now, now);
        return { agentId: entry.agentId, name: entry.name, capabilities, metadata, registrationKey, registeredAt: now, updatedAt: now };
    }
    async getAgent(agentId) {
        const row = asRow(this.db.prepare(`SELECT * FROM agents WHERE agent_id = ?`).get(agentId));
        return row ? rowToAgent(row) : undefined;
    }
    async listAgents() {
        return asRows(this.db.prepare(`SELECT * FROM agents ORDER BY agent_id`).all()).map(rowToAgent);
    }
    async removeAgent(agentId) {
        return this.db.prepare(`DELETE FROM agents WHERE agent_id = ?`).run(agentId).changes > 0;
    }
    async listAgentCapabilities() {
        const rows = this.db.prepare(`SELECT capabilities FROM agents`).all();
        const all = rows.flatMap((r) => safeJsonParse(r.capabilities, []));
        return Array.from(new Set(all)).sort();
    }
    // -------------------------------------------------------------------------
    // Semantic
    // -------------------------------------------------------------------------
    async storeSemantic(entry) {
        const namespace = entry.namespace ?? 'default';
        const tags = normalizeTags(entry.tags);
        const now = new Date().toISOString();
        const tokenFreq = computeTokenFreqRecord(entry.content);
        this.db.prepare(`
      INSERT INTO semantic_items (key, namespace, content, token_freq, tags, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key, namespace) DO UPDATE SET
        content = excluded.content, token_freq = excluded.token_freq, tags = excluded.tags,
        metadata = excluded.metadata, updated_at = excluded.updated_at
    `).run(entry.key, namespace, entry.content, JSON.stringify(tokenFreq), tags.join(','), entry.metadata ? JSON.stringify(entry.metadata) : null, now);
        return { key: entry.key, namespace: entry.namespace, content: entry.content, tags, metadata: entry.metadata, tokenFreq, updatedAt: now };
    }
    async searchSemantic(query, options = {}) {
        const filterTags = normalizeTags(options.filterTags);
        const minSimilarity = options.minSimilarity ?? 0;
        const queryFreq = computeTokenFreqRecord(query);
        let sql = `SELECT key, namespace, content, token_freq, tags, metadata, updated_at FROM semantic_items WHERE 1=1`;
        const params = [];
        if (options.namespace !== undefined) {
            sql += ` AND namespace = ?`;
            params.push(options.namespace);
        }
        for (const tag of filterTags) {
            sql += ` AND (',' || tags || ',') LIKE ?`;
            params.push(`%,${tag},%`);
        }
        const rows = asRows(this.db.prepare(sql).all(...params));
        const ranked = rows
            .map((row) => ({ row, score: tfCosineSimilarity(queryFreq, safeJsonParse(row.token_freq, {})) }))
            .filter((r) => r.score >= minSimilarity)
            .sort((a, b) => b.score - a.score || b.row.updated_at.localeCompare(a.row.updated_at));
        const sliced = options.topK !== undefined ? ranked.slice(0, Math.max(0, options.topK)) : ranked;
        return sliced.map(({ row, score }) => ({ ...rowToSemantic(row), score }));
    }
    async getSemantic(key, namespace) {
        const row = asRow(this.db.prepare(`SELECT key, namespace, content, token_freq, tags, metadata, updated_at FROM semantic_items WHERE key = ? AND namespace = ?`)
            .get(key, namespace ?? 'default'));
        return row ? rowToSemantic(row) : undefined;
    }
    async listSemantic(options = {}) {
        const filterTags = normalizeTags(options.filterTags);
        let sql = `SELECT key, namespace, content, token_freq, tags, metadata, updated_at FROM semantic_items WHERE 1=1`;
        const params = [];
        if (options.namespace !== undefined) {
            sql += ` AND namespace = ?`;
            params.push(options.namespace);
        }
        if (options.keyPrefix !== undefined) {
            sql += ` AND key LIKE ?`;
            params.push(`${options.keyPrefix}%`);
        }
        for (const tag of filterTags) {
            sql += ` AND (',' || tags || ',') LIKE ?`;
            params.push(`%,${tag},%`);
        }
        sql += ` ORDER BY updated_at DESC`;
        if (options.limit !== undefined) {
            sql += ` LIMIT ?`;
            params.push(Math.max(0, options.limit));
        }
        return asRows(this.db.prepare(sql).all(...params)).map(rowToSemantic);
    }
    async deleteSemantic(key, namespace) {
        return this.db.prepare(`DELETE FROM semantic_items WHERE key = ? AND namespace = ?`).run(key, namespace ?? 'default').changes > 0;
    }
    async clearSemantic(namespace) {
        return this.db.prepare(`DELETE FROM semantic_items WHERE namespace = ?`).run(namespace).changes;
    }
    async semanticStats(namespace) {
        const rows = namespace !== undefined
            ? this.db.prepare(`SELECT namespace, tags FROM semantic_items WHERE namespace = ?`).all(namespace)
            : this.db.prepare(`SELECT namespace, tags FROM semantic_items`).all();
        const byNs = new Map();
        for (const row of rows) {
            const ns = row.namespace ?? 'default';
            const tagList = row.tags ? row.tags.split(',').filter((t) => t.length > 0) : [];
            const existing = byNs.get(ns) ?? [];
            existing.push(tagList);
            byNs.set(ns, existing);
        }
        const updatedRows = namespace !== undefined
            ? this.db.prepare(`SELECT MAX(updated_at) as last FROM semantic_items WHERE namespace = ?`).all(namespace)
            : this.db.prepare(`SELECT namespace, MAX(updated_at) as last FROM semantic_items GROUP BY namespace`).all();
        const lastByNs = new Map();
        for (const r of updatedRows) {
            const ns = r.namespace ?? namespace ?? 'default';
            lastByNs.set(ns, r.last);
        }
        return [...byNs.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ns, tagLists]) => {
            const all = tagLists.flat();
            return { namespace: ns, totalItems: tagLists.length, totalTags: all.length, uniqueTags: new Set(all).size, lastUpdatedAt: lastByNs.get(ns) };
        });
    }
    // -------------------------------------------------------------------------
    // Feedback
    // -------------------------------------------------------------------------
    async submitFeedback(entry) {
        const now = new Date().toISOString();
        const stored = {
            feedbackId: entry.feedbackId ?? randomUUID(),
            selectedAgent: entry.selectedAgent,
            recommendedAgent: entry.recommendedAgent,
            rating: normalizeRating(entry.rating),
            feedbackType: typeof entry.feedbackType === 'string' && entry.feedbackType.trim().length > 0
                ? entry.feedbackType.trim().toLowerCase() : 'explicit',
            taskDescription: entry.taskDescription,
            userComment: entry.userComment,
            outcome: entry.outcome,
            durationMs: typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs)
                ? Math.max(0, Math.round(entry.durationMs)) : undefined,
            sessionId: entry.sessionId,
            metadata: entry.metadata,
            createdAt: now,
        };
        this.db.prepare(`
      INSERT INTO feedback (feedback_id, selected_agent, recommended_agent, rating, feedback_type,
        task_description, user_comment, outcome, duration_ms, session_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(stored.feedbackId, stored.selectedAgent, stored.recommendedAgent ?? null, stored.rating ?? null, stored.feedbackType, stored.taskDescription, stored.userComment ?? null, stored.outcome ?? null, stored.durationMs ?? null, stored.sessionId ?? null, stored.metadata ? JSON.stringify(stored.metadata) : null, now);
        return stored;
    }
    async listFeedback(options = {}) {
        let sql = `SELECT * FROM feedback WHERE 1=1`;
        const params = [];
        if (options.agentId !== undefined) {
            sql += ` AND selected_agent = ?`;
            params.push(options.agentId);
        }
        if (options.since !== undefined) {
            sql += ` AND created_at >= ?`;
            params.push(options.since);
        }
        sql += ` ORDER BY created_at DESC`;
        if (options.limit !== undefined) {
            sql += ` LIMIT ?`;
            params.push(Math.max(0, options.limit));
        }
        return asRows(this.db.prepare(sql).all(...params)).map(rowToFeedback);
    }
    // -------------------------------------------------------------------------
    // Sessions
    // -------------------------------------------------------------------------
    async createSession(entry) {
        const now = new Date().toISOString();
        const sessionId = entry.sessionId ?? randomUUID();
        const participants = [{ agentId: entry.initiator, role: 'initiator', joinedAt: now }];
        const session = { sessionId, task: entry.task, initiator: entry.initiator, status: 'active', workspace: entry.workspace, metadata: entry.metadata, participants, createdAt: now, updatedAt: now };
        this.db.prepare(`
      INSERT OR REPLACE INTO sessions (session_id, task, initiator, status, workspace, metadata, participants, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, entry.task, entry.initiator, 'active', entry.workspace ?? null, entry.metadata ? JSON.stringify(entry.metadata) : null, JSON.stringify(participants), now, now);
        return session;
    }
    async getSession(sessionId) {
        const row = asRow(this.db.prepare(`SELECT * FROM sessions WHERE session_id = ?`).get(sessionId));
        return row ? rowToSession(row) : undefined;
    }
    async listSessions() {
        return asRows(this.db.prepare(`SELECT * FROM sessions ORDER BY updated_at DESC`).all()).map(rowToSession);
    }
    async joinSession(entry) {
        return this.mutateSession(entry.sessionId, (s) => {
            ensureActiveSession(s);
            const now = new Date().toISOString();
            const ex = s.participants.find((p) => p.agentId === entry.agentId);
            if (ex) {
                ex.role = entry.role ?? ex.role;
                ex.leftAt = undefined;
                s.updatedAt = now;
                return s;
            }
            s.participants.push({ agentId: entry.agentId, role: entry.role ?? 'collaborator', joinedAt: now });
            s.updatedAt = now;
            return s;
        });
    }
    async leaveSession(sessionId, agentId) {
        return this.mutateSession(sessionId, (s) => {
            const p = s.participants.find((pt) => pt.agentId === agentId && pt.leftAt === undefined);
            if (!p)
                throw new Error(`Participant "${agentId}" is not active in session "${sessionId}"`);
            p.leftAt = new Date().toISOString();
            s.updatedAt = p.leftAt;
            return s;
        });
    }
    async completeSession(sessionId, summary) {
        return this.mutateSession(sessionId, (s) => {
            ensureActiveSession(s);
            s.status = 'completed';
            s.summary = summary;
            s.updatedAt = new Date().toISOString();
            return s;
        });
    }
    async failSession(sessionId, message) {
        return this.mutateSession(sessionId, (s) => {
            ensureActiveSession(s);
            s.status = 'failed';
            s.error = { message };
            s.updatedAt = new Date().toISOString();
            return s;
        });
    }
    async closeStuckSessions(maxAgeMs = 86_400_000) {
        const threshold = new Date(Date.now() - maxAgeMs).toISOString();
        const now = new Date().toISOString();
        const stuckRows = asRows(this.db.prepare(`SELECT * FROM sessions WHERE status = 'active' AND updated_at <= ?`).all(threshold));
        const closed = [];
        for (const row of stuckRows) {
            this.db.prepare(`UPDATE sessions SET status = 'failed', error_msg = ?, updated_at = ? WHERE session_id = ?`)
                .run('Auto-closed as stuck session', now, row.session_id);
            const updated = await this.getSession(row.session_id);
            if (updated)
                closed.push(updated);
        }
        return closed;
    }
    mutateSession(sessionId, mutate) {
        const row = asRow(this.db.prepare(`SELECT * FROM sessions WHERE session_id = ?`).get(sessionId));
        if (!row)
            throw new Error(`Session not found: ${sessionId}`);
        const session = mutate(rowToSession(row));
        this.db.prepare(`
      UPDATE sessions SET task=?, initiator=?, status=?, workspace=?, metadata=?, summary=?, error_msg=?, participants=?, updated_at=?
      WHERE session_id=?
    `).run(session.task, session.initiator, session.status, session.workspace ?? null, session.metadata ? JSON.stringify(session.metadata) : null, session.summary ?? null, session.error?.message ?? null, JSON.stringify(session.participants), session.updatedAt, sessionId);
        return session;
    }
    // -------------------------------------------------------------------------
    // Migration from JSON
    // -------------------------------------------------------------------------
    async importFromJson(jsonData) {
        const insertMem = this.db.prepare(`INSERT OR IGNORE INTO memory_items (key, namespace, value, updated_at) VALUES (?, ?, ?, ?)`);
        const insertPol = this.db.prepare(`INSERT OR IGNORE INTO policies (policy_id, name, enabled, metadata, updated_at) VALUES (?, ?, ?, ?, ?)`);
        const insertAg = this.db.prepare(`INSERT OR IGNORE INTO agents (agent_id, name, capabilities, metadata, registration_key, registered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        const insertSem = this.db.prepare(`INSERT OR IGNORE INTO semantic_items (key, namespace, content, token_freq, tags, metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        const insertFb = this.db.prepare(`INSERT OR IGNORE INTO feedback (feedback_id, selected_agent, recommended_agent, rating, feedback_type, task_description, user_comment, outcome, duration_ms, session_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const insertSess = this.db.prepare(`INSERT OR IGNORE INTO sessions (session_id, task, initiator, status, workspace, metadata, summary, error_msg, participants, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        this.db.exec('BEGIN');
        try {
            for (const m of jsonData.memory ?? [])
                insertMem.run(m.key, m.namespace ?? 'default', JSON.stringify(m.value), m.updatedAt);
            for (const p of jsonData.policies ?? [])
                insertPol.run(p.policyId, p.name, p.enabled ? 1 : 0, p.metadata ? JSON.stringify(p.metadata) : null, p.updatedAt);
            for (const a of jsonData.agents ?? [])
                insertAg.run(a.agentId, a.name, JSON.stringify(a.capabilities), a.metadata ? JSON.stringify(a.metadata) : null, a.registrationKey, a.registeredAt, a.updatedAt);
            for (const s of jsonData.semantic ?? [])
                insertSem.run(s.key, s.namespace ?? 'default', s.content, JSON.stringify(s.tokenFreq), s.tags.join(','), s.metadata ? JSON.stringify(s.metadata) : null, s.updatedAt);
            for (const f of jsonData.feedback ?? [])
                insertFb.run(f.feedbackId, f.selectedAgent, f.recommendedAgent ?? null, f.rating ?? null, f.feedbackType, f.taskDescription, f.userComment ?? null, f.outcome ?? null, f.durationMs ?? null, f.sessionId ?? null, f.metadata ? JSON.stringify(f.metadata) : null, f.createdAt);
            for (const sess of jsonData.sessions ?? [])
                insertSess.run(sess.sessionId, sess.task, sess.initiator, sess.status, sess.workspace ?? null, sess.metadata ? JSON.stringify(sess.metadata) : null, sess.summary ?? null, sess.error?.message ?? null, JSON.stringify(sess.participants), sess.createdAt, sess.updatedAt);
            this.db.exec('COMMIT');
        }
        catch (err) {
            this.db.exec('ROLLBACK');
            throw err;
        }
    }
    close() {
        this.db.close();
    }
}
function rowToMemory(r) {
    return { key: r.key, namespace: r.namespace === 'default' ? undefined : r.namespace, value: safeJsonParse(r.value, r.value), updatedAt: r.updated_at };
}
function rowToPolicy(r) {
    return { policyId: r.policy_id, name: r.name, enabled: r.enabled !== 0, metadata: safeJsonParse(r.metadata, undefined), updatedAt: r.updated_at };
}
function rowToAgent(r) {
    return { agentId: r.agent_id, name: r.name, capabilities: safeJsonParse(r.capabilities, []), metadata: safeJsonParse(r.metadata, undefined), registrationKey: r.registration_key, registeredAt: r.registered_at, updatedAt: r.updated_at };
}
function rowToSemantic(r) {
    return { key: r.key, namespace: r.namespace === 'default' ? undefined : r.namespace, content: r.content, tags: r.tags ? r.tags.split(',').filter((t) => t.length > 0) : [], metadata: safeJsonParse(r.metadata, undefined), tokenFreq: safeJsonParse(r.token_freq, {}), updatedAt: r.updated_at };
}
function rowToFeedback(r) {
    return { feedbackId: r.feedback_id, selectedAgent: r.selected_agent, recommendedAgent: r.recommended_agent ?? undefined, rating: r.rating ?? undefined, feedbackType: r.feedback_type, taskDescription: r.task_description, userComment: r.user_comment ?? undefined, outcome: r.outcome ?? undefined, durationMs: r.duration_ms ?? undefined, sessionId: r.session_id ?? undefined, metadata: safeJsonParse(r.metadata, undefined), createdAt: r.created_at };
}
function rowToSession(r) {
    return { sessionId: r.session_id, task: r.task, initiator: r.initiator, status: r.status, workspace: r.workspace ?? undefined, metadata: safeJsonParse(r.metadata, undefined), summary: r.summary ?? undefined, error: r.error_msg !== null ? { message: r.error_msg } : undefined, participants: safeJsonParse(r.participants, []), createdAt: r.created_at, updatedAt: r.updated_at };
}
function ensureActiveSession(s) {
    if (s.status !== 'active')
        throw new Error(`Session "${s.sessionId}" is not active`);
}
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createSqliteStateStore(config) {
    return new SqliteStateStore(config);
}
