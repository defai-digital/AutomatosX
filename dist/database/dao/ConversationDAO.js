/**
 * ConversationDAO - Data Access Object for conversations table
 * Provides CRUD operations with Zod validation
 */
import { v4 as uuidv4 } from 'uuid';
import { ConversationSchema, CreateConversationSchema, UpdateConversationSchema, ConversationListOptionsSchema, } from '../../types/schemas/memory.schema.js';
export class ConversationDAO {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Create a new conversation
     */
    create(data) {
        // Validate input
        const validated = CreateConversationSchema.parse(data);
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000); // UNIX seconds for consistency with embeddings
        const state = 'idle';
        const stmt = this.db.prepare(`
      INSERT INTO conversations (
        id, agent_id, user_id, title, state,
        message_count, total_tokens, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, validated.agentId, validated.userId || null, validated.title, state, 0, 0, JSON.stringify(validated.metadata || {}), now, now);
        return this.getById(id);
    }
    /**
     * Get conversation by ID
     */
    getById(id) {
        const stmt = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `);
        const row = stmt.get(id);
        if (!row) {
            return null;
        }
        return this.rowToConversation(row);
    }
    /**
     * Update conversation
     */
    update(data) {
        // Validate input
        const validated = UpdateConversationSchema.parse(data);
        // Check if exists
        const existing = this.getById(validated.id);
        if (!existing) {
            throw new Error(`Conversation not found: ${validated.id}`);
        }
        const now = Math.floor(Date.now() / 1000); // UNIX seconds for consistency
        const updates = [];
        const values = [];
        if (validated.title !== undefined) {
            updates.push('title = ?');
            values.push(validated.title);
        }
        if (validated.state !== undefined) {
            updates.push('state = ?');
            values.push(validated.state);
        }
        if (validated.metadata !== undefined) {
            updates.push('metadata = ?');
            values.push(JSON.stringify(validated.metadata));
        }
        // Always update updated_at
        updates.push('updated_at = ?');
        values.push(now);
        // Add ID for WHERE clause
        values.push(validated.id);
        const stmt = this.db.prepare(`
      UPDATE conversations
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.getById(validated.id);
    }
    /**
     * Delete conversation (soft delete by marking as deleted)
     */
    delete(id) {
        const stmt = this.db.prepare(`
      UPDATE conversations
      SET state = 'deleted', deleted_at = ?, updated_at = ?
      WHERE id = ?
    `);
        const now = Math.floor(Date.now() / 1000); // UNIX seconds for consistency
        const result = stmt.run(now, now, id);
        return result.changes > 0;
    }
    /**
     * Permanently delete conversation and all messages
     */
    permanentlyDelete(id) {
        const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    /**
     * Archive conversation
     */
    archive(id) {
        const stmt = this.db.prepare(`
      UPDATE conversations
      SET state = 'archived', archived_at = ?, updated_at = ?
      WHERE id = ?
    `);
        const now = Math.floor(Date.now() / 1000); // UNIX seconds for consistency
        const result = stmt.run(now, now, id);
        return result.changes > 0;
    }
    /**
     * Restore conversation from archived or deleted state
     */
    restore(id) {
        const stmt = this.db.prepare(`
      UPDATE conversations
      SET state = 'active',
          archived_at = NULL,
          deleted_at = NULL,
          updated_at = ?
      WHERE id = ?
    `);
        const now = Math.floor(Date.now() / 1000); // UNIX seconds for consistency
        const result = stmt.run(now, id);
        return result.changes > 0;
    }
    /**
     * Increment message count
     */
    incrementMessageCount(id, tokens = 0) {
        const stmt = this.db.prepare(`
      UPDATE conversations
      SET message_count = message_count + 1,
          total_tokens = total_tokens + ?,
          updated_at = ?
      WHERE id = ?
    `);
        const now = Math.floor(Date.now() / 1000); // UNIX seconds for consistency
        const result = stmt.run(tokens, now, id);
        return result.changes > 0;
    }
    /**
     * List conversations with filters
     */
    list(options) {
        // Validate options
        const validated = ConversationListOptionsSchema.parse(options);
        // Build WHERE clauses
        const whereClauses = [];
        const params = [];
        if (validated.agentId) {
            whereClauses.push('agent_id = ?');
            params.push(validated.agentId);
        }
        if (validated.userId) {
            whereClauses.push('user_id = ?');
            params.push(validated.userId);
        }
        if (validated.state) {
            whereClauses.push('state = ?');
            params.push(validated.state);
        }
        if (!validated.includeArchived) {
            whereClauses.push("state != 'archived'");
        }
        if (!validated.includeDeleted) {
            whereClauses.push("state != 'deleted'");
        }
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        // Get total count
        const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM conversations ${whereClause}
    `);
        const countResult = countStmt.get(...params);
        const total = countResult.total;
        // Get conversations
        // Convert camelCase to snake_case for SQL
        const sqlSortBy = validated.sortBy === 'createdAt' ? 'created_at' :
            validated.sortBy === 'updatedAt' ? 'updated_at' :
                validated.sortBy === 'messageCount' ? 'message_count' :
                    validated.sortBy;
        const orderBy = `ORDER BY ${sqlSortBy} ${validated.sortOrder.toUpperCase()}`;
        const limit = `LIMIT ? OFFSET ?`;
        const stmt = this.db.prepare(`
      SELECT * FROM conversations
      ${whereClause}
      ${orderBy}
      ${limit}
    `);
        const rows = stmt.all(...params, validated.limit, validated.offset);
        const conversations = rows.map((row) => this.rowToConversation(row));
        return {
            conversations,
            total,
            limit: validated.limit,
            offset: validated.offset,
            hasMore: validated.offset + validated.limit < total,
        };
    }
    /**
     * Get conversation with all messages
     */
    getWithMessages(id) {
        const conversation = this.getById(id);
        if (!conversation) {
            return null;
        }
        // Get messages
        const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `);
        const messageRows = stmt.all(id);
        const messages = messageRows.map((row) => ({
            id: row.id,
            conversationId: row.conversation_id,
            role: row.role,
            content: row.content,
            tokens: row.tokens,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
        return {
            ...conversation,
            messages,
        };
    }
    /**
     * Search conversations by title
     */
    searchByTitle(query, limit = 10) {
        const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE title LIKE ?
        AND state != 'deleted'
      ORDER BY updated_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(`%${query}%`, limit);
        return rows.map((row) => this.rowToConversation(row));
    }
    /**
     * Get conversations by agent
     */
    getByAgent(agentId, limit = 10) {
        const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE agent_id = ?
        AND state != 'deleted'
      ORDER BY updated_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(agentId, limit);
        return rows.map((row) => this.rowToConversation(row));
    }
    /**
     * Get conversations by user
     */
    getByUser(userId, limit = 10) {
        const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ?
        AND state != 'deleted'
      ORDER BY updated_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(userId, limit);
        return rows.map((row) => this.rowToConversation(row));
    }
    /**
     * Get conversation count by state
     */
    getCountByState(state) {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM conversations
      WHERE state = ?
    `);
        const result = stmt.get(state);
        return result.count;
    }
    /**
     * Convert database row to Conversation object
     */
    rowToConversation(row) {
        const data = {
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
        };
        return ConversationSchema.parse(data);
    }
}
//# sourceMappingURL=ConversationDAO.js.map