/**
 * AutomatosX v8.0.0 - Conversation Context Manager
 *
 * Manages conversation state, messages, and context variables
 * Day 3: In-memory implementation
 * Day 4: Will add SQLite persistence
 */
import { randomUUID } from 'crypto';
/**
 * Conversation Context Manager
 *
 * Handles:
 * - Message history (in-memory for Day 3)
 * - Active agent tracking
 * - Active workflow tracking
 * - Context variables
 * - Snapshots for save/load
 */
export class ConversationContext {
    db;
    conversationId;
    userId;
    messages = [];
    activeAgent;
    activeWorkflow;
    variables = {};
    createdAt;
    updatedAt;
    constructor(db, userId, conversationId) {
        this.db = db;
        this.userId = userId;
        this.conversationId = conversationId || randomUUID();
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }
    /**
     * Get conversation ID
     */
    getConversationId() {
        return this.conversationId;
    }
    /**
     * Get user ID
     */
    getUserId() {
        return this.userId;
    }
    /**
     * Add message to conversation
     */
    addMessage(role, content, metadata) {
        const message = {
            id: randomUUID(),
            conversationId: this.conversationId,
            role,
            content,
            timestamp: new Date(),
            metadata: metadata || {}
        };
        this.messages.push(message);
        this.updatedAt = new Date();
        return message;
    }
    /**
     * Get all messages in conversation
     */
    getMessages() {
        return [...this.messages];
    }
    /**
     * Get recent messages (last N)
     */
    getRecentMessages(limit = 10) {
        return this.messages.slice(-limit);
    }
    /**
     * Get message count
     */
    getMessageCount() {
        return this.messages.length;
    }
    /**
     * Set active agent
     */
    setActiveAgent(agentName) {
        this.activeAgent = agentName;
        this.updatedAt = new Date();
    }
    /**
     * Get active agent
     */
    getActiveAgent() {
        return this.activeAgent;
    }
    /**
     * Set active workflow
     */
    setActiveWorkflow(workflowPath) {
        this.activeWorkflow = workflowPath;
        this.updatedAt = new Date();
    }
    /**
     * Get active workflow
     */
    getActiveWorkflow() {
        return this.activeWorkflow;
    }
    /**
     * Set context variable
     */
    setVariable(key, value) {
        this.variables[key] = value;
        this.updatedAt = new Date();
    }
    /**
     * Get context variable
     */
    getVariable(key) {
        return this.variables[key];
    }
    /**
     * Get all variables
     */
    getVariables() {
        return { ...this.variables };
    }
    /**
     * Delete context variable
     */
    deleteVariable(key) {
        if (key in this.variables) {
            delete this.variables[key];
            this.updatedAt = new Date();
            return true;
        }
        return false;
    }
    /**
     * Clear all variables
     */
    clearVariables() {
        this.variables = {};
        this.updatedAt = new Date();
    }
    /**
     * Get context snapshot for save/load
     */
    getSnapshot() {
        return {
            conversationId: this.conversationId,
            userId: this.userId,
            messages: this.getMessages(),
            activeAgent: this.activeAgent,
            activeWorkflow: this.activeWorkflow,
            variables: this.getVariables(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    /**
     * Restore from snapshot
     */
    restoreFromSnapshot(snapshot) {
        this.conversationId = snapshot.conversationId;
        this.userId = snapshot.userId;
        this.messages = [...snapshot.messages];
        this.activeAgent = snapshot.activeAgent;
        this.activeWorkflow = snapshot.activeWorkflow;
        this.variables = { ...snapshot.variables };
        this.createdAt = new Date(snapshot.createdAt);
        this.updatedAt = new Date(snapshot.updatedAt);
    }
    /**
     * Clear conversation (reset to initial state)
     */
    clear() {
        this.messages = [];
        this.activeAgent = undefined;
        this.activeWorkflow = undefined;
        this.variables = {};
        this.conversationId = randomUUID();
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }
    /**
     * Get conversation summary
     */
    getSummary() {
        return {
            conversationId: this.conversationId,
            messageCount: this.messages.length,
            activeAgent: this.activeAgent,
            activeWorkflow: this.activeWorkflow,
            variableCount: Object.keys(this.variables).length,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    // ============================================
    // SQLite Persistence (Day 4 Implementation)
    // ============================================
    /**
     * Save context to SQLite
     * Persists conversation metadata and all messages to database
     */
    async saveToDB() {
        try {
            const { ConversationDAO } = await import('../../database/dao/ConversationDAO.js');
            const { MessageDAO } = await import('../../database/dao/MessageDAO.js');
            const conversationDAO = new ConversationDAO(this.db);
            const messageDAO = new MessageDAO(this.db);
            // Check if conversation exists
            const existing = conversationDAO.getById(this.conversationId);
            if (existing) {
                // Update existing conversation
                conversationDAO.update({
                    id: this.conversationId,
                    metadata: {
                        activeAgent: this.activeAgent,
                        activeWorkflow: this.activeWorkflow,
                        variables: this.variables
                    }
                });
            }
            else {
                // Create new conversation
                conversationDAO.create({
                    agentId: this.activeAgent || 'system', // Required field, use system if no active agent
                    userId: this.userId,
                    title: `Conversation ${this.conversationId.slice(0, 8)}`,
                    metadata: {
                        activeAgent: this.activeAgent,
                        activeWorkflow: this.activeWorkflow,
                        variables: this.variables
                    }
                });
            }
            // Save all messages
            for (const message of this.messages) {
                // Check if message exists
                const existingMessage = messageDAO.getById(message.id);
                if (!existingMessage) {
                    // Create new message
                    messageDAO.create({
                        conversationId: this.conversationId,
                        role: message.role,
                        content: message.content,
                        tokens: message.tokensUsed,
                        metadata: message.metadata
                    });
                }
                // Note: We don't update existing messages as they are immutable
            }
        }
        catch (error) {
            console.error('[ConversationContext] Failed to save to DB:', error.message);
            // Don't throw - allow REPL to continue even if save fails
        }
    }
    /**
     * Load context from SQLite
     * Reconstructs ConversationContext from database records
     */
    static async loadFromDB(db, conversationId) {
        try {
            const { ConversationDAO } = await import('../../database/dao/ConversationDAO.js');
            const { MessageDAO } = await import('../../database/dao/MessageDAO.js');
            const conversationDAO = new ConversationDAO(db);
            const messageDAO = new MessageDAO(db);
            // Load conversation record
            const conversation = conversationDAO.getById(conversationId);
            if (!conversation) {
                return null;
            }
            // Load all messages for this conversation
            const dbMessages = messageDAO.getByConversation(conversationId);
            // Create new ConversationContext
            const context = new ConversationContext(db, conversation.userId || 'unknown', conversationId);
            // Restore state from snapshot
            const messages = dbMessages.map((m) => ({
                id: m.id,
                conversationId: m.conversationId,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.createdAt * 1000), // Convert UNIX seconds to Date
                tokensUsed: m.tokens,
                metadata: m.metadata || {}
            }));
            const snapshot = {
                conversationId: conversation.id,
                userId: conversation.userId || 'unknown',
                messages,
                activeAgent: conversation.metadata?.activeAgent,
                activeWorkflow: conversation.metadata?.activeWorkflow,
                variables: conversation.metadata?.variables || {},
                createdAt: new Date(conversation.createdAt * 1000), // Convert UNIX seconds to Date
                updatedAt: new Date(conversation.updatedAt * 1000)
            };
            context.restoreFromSnapshot(snapshot);
            return context;
        }
        catch (error) {
            console.error('[ConversationContext] Failed to load from DB:', error.message);
            return null;
        }
    }
    /**
     * Get conversation metadata
     */
    getMetadata() {
        return {
            conversationId: this.conversationId,
            userId: this.userId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}
//# sourceMappingURL=ConversationContext.js.map