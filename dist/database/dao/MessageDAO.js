/**
 * MessageDAO - Data Access Object for messages table
 * Provides CRUD operations with Zod validation and FTS5 search
 */
import { v4 as uuidv4 } from 'uuid';
import { MessageSchema, CreateMessageSchema, MessageListOptionsSchema, MemorySearchOptionsSchema, } from '../../types/schemas/memory.schema.js';
export class MessageDAO {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Create a new message
     */
    create(data) {
        // Validate input
        const validated = CreateMessageSchema.parse(data);
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000); // UNIX seconds for consistency with embeddings
        const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, conversation_id, role, content, tokens,
        metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, validated.conversationId, validated.role, validated.content, validated.tokens || null, JSON.stringify(validated.metadata || {}), now, now);
        return this.getById(id);
    }
    /**
     * Get message by ID
     */
    getById(id) {
        const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
        const row = stmt.get(id);
        if (!row) {
            return null;
        }
        return this.rowToMessage(row);
    }
    /**
     * Update message content
     */
    update(id, content, tokens) {
        const now = Math.floor(Date.now() / 1000); // UNIX seconds for consistency
        const stmt = this.db.prepare(`
      UPDATE messages
      SET content = ?,
          tokens = ?,
          updated_at = ?
      WHERE id = ?
    `);
        stmt.run(content, tokens || null, now, id);
        return this.getById(id);
    }
    /**
     * Delete message
     */
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    /**
     * List messages for a conversation
     */
    list(options) {
        // Validate options
        const validated = MessageListOptionsSchema.parse(options);
        // Build WHERE clauses
        const whereClauses = ['conversation_id = ?'];
        const params = [validated.conversationId];
        if (validated.role) {
            whereClauses.push('role = ?');
            params.push(validated.role);
        }
        const whereClause = whereClauses.join(' AND ');
        // Get total count
        const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM messages
      WHERE ${whereClause}
    `);
        const countResult = countStmt.get(...params);
        const total = countResult.total;
        // Get messages
        // Convert camelCase to snake_case for SQL
        const sqlSortBy = validated.sortBy === 'createdAt' ? 'created_at' :
            validated.sortBy === 'updatedAt' ? 'updated_at' :
                validated.sortBy;
        const orderBy = `ORDER BY ${sqlSortBy} ${validated.sortOrder.toUpperCase()}`;
        const limit = `LIMIT ? OFFSET ?`;
        const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE ${whereClause}
      ${orderBy}
      ${limit}
    `);
        const rows = stmt.all(...params, validated.limit, validated.offset);
        const messages = rows.map((row) => this.rowToMessage(row));
        return {
            messages,
            total,
            limit: validated.limit,
            offset: validated.offset,
            hasMore: validated.offset + validated.limit < total,
        };
    }
    /**
     * Search messages using FTS5
     */
    search(options) {
        // Validate options
        const validated = MemorySearchOptionsSchema.parse(options);
        // Build WHERE clauses
        const whereClauses = [];
        const params = [];
        // FTS5 search
        whereClauses.push('messages_fts.content MATCH ?');
        params.push(validated.query);
        // Additional filters
        if (validated.conversationId) {
            whereClauses.push('m.conversation_id = ?');
            params.push(validated.conversationId);
        }
        if (validated.role) {
            whereClauses.push('m.role = ?');
            params.push(validated.role);
        }
        const whereClause = whereClauses.join(' AND ');
        // Get total count (skip if requested for performance)
        let total = -1; // -1 indicates count was skipped
        if (!validated.skipCount) {
            const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total
        FROM messages m
        JOIN messages_fts ON messages_fts.rowid = m.rowid
        WHERE ${whereClause}
      `);
            const countResult = countStmt.get(...params);
            total = countResult.total;
        }
        // Get messages with relevance ranking
        const orderByClause = validated.sortBy === 'relevance'
            ? 'ORDER BY messages_fts.rank'
            : `ORDER BY m.${validated.sortBy} ${validated.sortOrder.toUpperCase()}`;
        const limitClause = `LIMIT ? OFFSET ?`;
        const stmt = this.db.prepare(`
      SELECT m.*
      FROM messages m
      JOIN messages_fts ON messages_fts.rowid = m.rowid
      WHERE ${whereClause}
      ${orderByClause}
      ${limitClause}
    `);
        const rows = stmt.all(...params, validated.limit, validated.offset);
        const messages = rows.map((row) => this.rowToMessage(row));
        // Get unique conversations
        const conversationIds = [...new Set(messages.map((m) => m.conversationId))];
        const conversations = [];
        if (conversationIds.length > 0) {
            const placeholders = conversationIds.map(() => '?').join(', ');
            const convStmt = this.db.prepare(`
        SELECT * FROM conversations
        WHERE id IN (${placeholders})
      `);
            const convRows = convStmt.all(...conversationIds);
            for (const row of convRows) {
                conversations.push({
                    id: row.id,
                    agentId: row.agent_id,
                    userId: row.user_id || undefined,
                    title: row.title,
                    state: row.state,
                    messageCount: row.message_count,
                    totalTokens: row.total_tokens,
                    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    archivedAt: row.archived_at || undefined,
                    deletedAt: row.deleted_at || undefined,
                });
            }
        }
        return {
            messages,
            conversations,
            total,
            limit: validated.limit,
            offset: validated.offset,
            hasMore: total >= 0 ? validated.offset + validated.limit < total : messages.length >= validated.limit,
        };
    }
    /**
     * Get messages by conversation
     */
    getByConversation(conversationId, limit = 100) {
        const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT ?
    `);
        const rows = stmt.all(conversationId, limit);
        return rows.map((row) => this.rowToMessage(row));
    }
    /**
     * Get recent messages
     */
    getRecent(limit = 10) {
        const stmt = this.db.prepare(`
      SELECT * FROM messages
      ORDER BY created_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map((row) => this.rowToMessage(row));
    }
    /**
     * Get message count by conversation
     */
    getCountByConversation(conversationId) {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE conversation_id = ?
    `);
        const result = stmt.get(conversationId);
        return result.count;
    }
    /**
     * Get total token count by conversation
     */
    getTotalTokensByConversation(conversationId) {
        const stmt = this.db.prepare(`
      SELECT SUM(COALESCE(tokens, 0)) as total
      FROM messages
      WHERE conversation_id = ?
    `);
        const result = stmt.get(conversationId);
        return result.total || 0;
    }
    /**
     * Delete all messages for a conversation
     */
    deleteByConversation(conversationId) {
        const stmt = this.db.prepare(`
      DELETE FROM messages
      WHERE conversation_id = ?
    `);
        const result = stmt.run(conversationId);
        return result.changes;
    }
    /**
     * Get global statistics for all messages
     * Used by MemoryService.getMemoryStats() to avoid pagination issues
     */
    getGlobalStats() {
        const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalMessages,
        COALESCE(SUM(tokens), 0) as totalTokens
      FROM messages
    `);
        const result = stmt.get();
        return {
            totalMessages: result.totalMessages || 0,
            totalTokens: result.totalTokens || 0,
        };
    }
    /**
     * Convert database row to Message object
     */
    rowToMessage(row) {
        const data = {
            id: row.id,
            conversationId: row.conversation_id,
            role: row.role,
            content: row.content,
            tokens: row.tokens || undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
        return MessageSchema.parse(data);
    }
}
//# sourceMappingURL=MessageDAO.js.map