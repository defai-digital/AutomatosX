/**
 * Integration tests for Memory System (Phase 1 Week 1)
 * Tests ReScript state machine + TypeScript DAOs + Database
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConversationDAO } from '../../database/dao/ConversationDAO.js';
import { MessageDAO } from '../../database/dao/MessageDAO.js';
import * as MemoryStateMachine from '../../../packages/rescript-core/src/memory/MemoryStateMachine.bs.js';
describe('Memory System Integration', () => {
    let db;
    let conversationDAO;
    let messageDAO;
    beforeAll(() => {
        // Create in-memory database
        db = new Database(':memory:');
        // Apply migration 008
        const migrationSQL = readFileSync(join(process.cwd(), 'src/migrations/008_create_memory_system.sql'), 'utf-8');
        db.exec(migrationSQL);
        // Initialize DAOs
        conversationDAO = new ConversationDAO(db);
        messageDAO = new MessageDAO(db);
    });
    afterAll(() => {
        db.close();
    });
    describe('ReScript State Machine', () => {
        it('should create a state machine with idle state', () => {
            const machine = MemoryStateMachine.makeSimple('conv-123', 'backend');
            expect(MemoryStateMachine.getCurrentState(machine)).toBe('idle');
            expect(MemoryStateMachine.getMessageCount(machine)).toBe(0);
            expect(MemoryStateMachine.getTotalTokens(machine)).toBe(0);
            expect(MemoryStateMachine.getConversationId(machine)).toBe('conv-123');
            expect(MemoryStateMachine.getAgentId(machine)).toBe('backend');
        });
        it('should transition from idle to active', () => {
            const machine = MemoryStateMachine.makeSimple('conv-123', 'backend');
            const eventData = JSON.stringify({
                agentId: 'backend',
                title: 'Test Conversation',
            });
            const result = MemoryStateMachine.transition(machine, 'create_conversation', JSON.parse(eventData), 'active');
            expect(result.TAG).toBe('Ok');
            if (result.TAG === 'Ok') {
                const newMachine = result._0;
                expect(MemoryStateMachine.getCurrentState(newMachine)).toBe('active');
            }
        });
        it('should increment message count', () => {
            let machine = MemoryStateMachine.makeSimple('conv-123', 'backend');
            machine = MemoryStateMachine.incrementMessageCount(machine);
            expect(MemoryStateMachine.getMessageCount(machine)).toBe(1);
            machine = MemoryStateMachine.addTokens(machine, 50);
            expect(MemoryStateMachine.getTotalTokens(machine)).toBe(50);
        });
        it('should track state history', () => {
            let machine = MemoryStateMachine.makeSimple('conv-123', 'backend');
            const eventData = JSON.stringify({
                agentId: 'backend',
                title: 'Test',
            });
            const result = MemoryStateMachine.transition(machine, 'create_conversation', JSON.parse(eventData), 'active');
            if (result.TAG === 'Ok') {
                const newMachine = result._0;
                const history = MemoryStateMachine.getHistory(newMachine);
                expect(history.length).toBe(1);
                expect(history[0]).toBe('idle');
            }
        });
        it('should reject invalid transitions', () => {
            const machine = MemoryStateMachine.makeSimple('conv-123', 'backend');
            const eventData = JSON.stringify({ query: 'test' });
            const result = MemoryStateMachine.transition(machine, 'search_messages', JSON.parse(eventData), 'searching');
            expect(result.TAG).toBe('Error');
            if (result.TAG === 'Error') {
                expect(result._0).toContain('Invalid memory transition');
            }
        });
        it('should validate transition capabilities', () => {
            const machine = MemoryStateMachine.makeSimple('conv-123', 'backend');
            expect(MemoryStateMachine.canTransition(machine, 'create_conversation', 'active')).toBe(true);
            expect(MemoryStateMachine.canTransition(machine, 'search_messages', 'searching')).toBe(false);
        });
    });
    describe('ConversationDAO', () => {
        beforeEach(() => {
            // Clear conversations table
            db.exec('DELETE FROM conversations');
        });
        it('should create a conversation', () => {
            const conversation = conversationDAO.create({
                agentId: 'backend',
                title: 'Test Conversation',
            });
            expect(conversation.id).toBeDefined();
            expect(conversation.agentId).toBe('backend');
            expect(conversation.title).toBe('Test Conversation');
            expect(conversation.state).toBe('idle');
            expect(conversation.messageCount).toBe(0);
            expect(conversation.totalTokens).toBe(0);
        });
        it('should get conversation by ID', () => {
            const created = conversationDAO.create({
                agentId: 'backend',
                title: 'Test',
            });
            const retrieved = conversationDAO.getById(created.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved.id).toBe(created.id);
            expect(retrieved.title).toBe('Test');
        });
        it('should update conversation', async () => {
            const created = conversationDAO.create({
                agentId: 'backend',
                title: 'Original Title',
            });
            // Small delay to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));
            const updated = conversationDAO.update({
                id: created.id,
                title: 'Updated Title',
            });
            expect(updated.title).toBe('Updated Title');
            expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
        });
        it('should archive conversation', () => {
            const conversation = conversationDAO.create({
                agentId: 'backend',
                title: 'Test',
            });
            const success = conversationDAO.archive(conversation.id);
            expect(success).toBe(true);
            const archived = conversationDAO.getById(conversation.id);
            expect(archived.state).toBe('archived');
            expect(archived.archivedAt).toBeDefined();
        });
        it('should restore conversation', () => {
            const conversation = conversationDAO.create({
                agentId: 'backend',
                title: 'Test',
            });
            conversationDAO.archive(conversation.id);
            conversationDAO.restore(conversation.id);
            const restored = conversationDAO.getById(conversation.id);
            expect(restored.state).toBe('active');
            expect(restored.archivedAt).toBeUndefined();
        });
        it('should increment message count', () => {
            const conversation = conversationDAO.create({
                agentId: 'backend',
                title: 'Test',
            });
            conversationDAO.incrementMessageCount(conversation.id, 50);
            const updated = conversationDAO.getById(conversation.id);
            expect(updated.messageCount).toBe(1);
            expect(updated.totalTokens).toBe(50);
        });
        it('should list conversations with filters', () => {
            conversationDAO.create({ agentId: 'backend', title: 'Conv 1' });
            conversationDAO.create({ agentId: 'frontend', title: 'Conv 2' });
            conversationDAO.create({ agentId: 'backend', title: 'Conv 3' });
            const result = conversationDAO.list({
                agentId: 'backend',
                limit: 10,
                offset: 0,
                sortBy: 'createdAt',
                sortOrder: 'desc',
            });
            expect(result.total).toBe(2);
            expect(result.conversations.length).toBe(2);
            expect(result.conversations.every((c) => c.agentId === 'backend')).toBe(true);
        });
        it('should search conversations by title', () => {
            conversationDAO.create({ agentId: 'backend', title: 'API Development' });
            conversationDAO.create({ agentId: 'backend', title: 'Database Design' });
            conversationDAO.create({ agentId: 'backend', title: 'REST API Testing' });
            const results = conversationDAO.searchByTitle('API');
            expect(results.length).toBe(2);
            expect(results.every((c) => c.title.includes('API'))).toBe(true);
        });
    });
    describe('MessageDAO', () => {
        let conversationId;
        beforeEach(() => {
            // Clear tables
            db.exec('DELETE FROM messages');
            db.exec('DELETE FROM conversations');
            // Create a test conversation
            const conversation = conversationDAO.create({
                agentId: 'backend',
                title: 'Test Conversation',
            });
            conversationId = conversation.id;
        });
        it('should create a message', () => {
            const message = messageDAO.create({
                conversationId,
                role: 'user',
                content: 'Hello, how are you?',
                tokens: 5,
            });
            expect(message.id).toBeDefined();
            expect(message.conversationId).toBe(conversationId);
            expect(message.role).toBe('user');
            expect(message.content).toBe('Hello, how are you?');
            expect(message.tokens).toBe(5);
        });
        it('should get message by ID', () => {
            const created = messageDAO.create({
                conversationId,
                role: 'user',
                content: 'Test message',
            });
            const retrieved = messageDAO.getById(created.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved.id).toBe(created.id);
            expect(retrieved.content).toBe('Test message');
        });
        it('should update message content', () => {
            const created = messageDAO.create({
                conversationId,
                role: 'user',
                content: 'Original content',
            });
            const updated = messageDAO.update(created.id, 'Updated content', 10);
            expect(updated.content).toBe('Updated content');
            expect(updated.tokens).toBe(10);
        });
        it('should list messages for conversation', () => {
            messageDAO.create({
                conversationId,
                role: 'user',
                content: 'Message 1',
            });
            messageDAO.create({
                conversationId,
                role: 'assistant',
                content: 'Message 2',
            });
            messageDAO.create({
                conversationId,
                role: 'user',
                content: 'Message 3',
            });
            const result = messageDAO.list({
                conversationId,
                limit: 100,
                offset: 0,
                sortBy: 'createdAt',
                sortOrder: 'asc',
            });
            expect(result.total).toBe(3);
            expect(result.messages.length).toBe(3);
            expect(result.messages[0].content).toBe('Message 1');
        });
        it('should search messages using FTS5', () => {
            messageDAO.create({
                conversationId,
                role: 'user',
                content: 'How do I create a REST API with Express?',
            });
            messageDAO.create({
                conversationId,
                role: 'assistant',
                content: 'To create a REST API with Express, you need to install express.',
            });
            messageDAO.create({
                conversationId,
                role: 'user',
                content: 'Can you help me with database design?',
            });
            const result = messageDAO.search({
                query: 'REST API',
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(result.total).toBeGreaterThanOrEqual(2);
            expect(result.messages.length).toBeGreaterThanOrEqual(2);
            expect(result.messages.every((m) => m.content.includes('REST API'))).toBe(true);
        });
        it('should get messages by conversation', () => {
            messageDAO.create({ conversationId, role: 'user', content: 'Msg 1' });
            messageDAO.create({ conversationId, role: 'assistant', content: 'Msg 2' });
            const messages = messageDAO.getByConversation(conversationId);
            expect(messages.length).toBe(2);
            expect(messages[0].content).toBe('Msg 1');
        });
        it('should count messages by conversation', () => {
            messageDAO.create({ conversationId, role: 'user', content: 'Msg 1' });
            messageDAO.create({ conversationId, role: 'user', content: 'Msg 2' });
            messageDAO.create({ conversationId, role: 'user', content: 'Msg 3' });
            const count = messageDAO.getCountByConversation(conversationId);
            expect(count).toBe(3);
        });
        it('should calculate total tokens', () => {
            messageDAO.create({ conversationId, role: 'user', content: 'Msg 1', tokens: 10 });
            messageDAO.create({ conversationId, role: 'user', content: 'Msg 2', tokens: 20 });
            messageDAO.create({ conversationId, role: 'user', content: 'Msg 3', tokens: 15 });
            const totalTokens = messageDAO.getTotalTokensByConversation(conversationId);
            expect(totalTokens).toBe(45);
        });
    });
    describe('End-to-End Memory Workflow', () => {
        beforeEach(() => {
            db.exec('DELETE FROM messages');
            db.exec('DELETE FROM conversations');
        });
        it('should complete a full conversation lifecycle', () => {
            // 1. Create state machine
            let machine = MemoryStateMachine.makeSimple('test-conv', 'backend');
            expect(MemoryStateMachine.getCurrentState(machine)).toBe('idle');
            // 2. Create conversation in database
            const conversation = conversationDAO.create({
                agentId: 'backend',
                title: 'Help with Express API',
            });
            // 3. Transition to active
            const createEvent = JSON.stringify({
                agentId: 'backend',
                title: 'Help with Express API',
            });
            const result1 = MemoryStateMachine.transition(machine, 'create_conversation', JSON.parse(createEvent), 'active');
            expect(result1.TAG).toBe('Ok');
            if (result1.TAG === 'Ok') {
                machine = result1._0;
            }
            // 4. Add messages
            const msg1 = messageDAO.create({
                conversationId: conversation.id,
                role: 'user',
                content: 'How do I create a REST API?',
                tokens: 8,
            });
            machine = MemoryStateMachine.incrementMessageCount(machine);
            machine = MemoryStateMachine.addTokens(machine, 8);
            conversationDAO.incrementMessageCount(conversation.id, 8);
            const msg2 = messageDAO.create({
                conversationId: conversation.id,
                role: 'assistant',
                content: 'To create a REST API with Express, install express and create routes.',
                tokens: 15,
            });
            machine = MemoryStateMachine.incrementMessageCount(machine);
            machine = MemoryStateMachine.addTokens(machine, 15);
            conversationDAO.incrementMessageCount(conversation.id, 15);
            // 5. Search messages
            const searchEvent = JSON.stringify({ query: 'REST API' });
            const result2 = MemoryStateMachine.transition(machine, 'search_messages', JSON.parse(searchEvent), 'searching');
            expect(result2.TAG).toBe('Ok');
            if (result2.TAG === 'Ok') {
                machine = result2._0;
            }
            const searchResults = messageDAO.search({
                query: 'REST API',
                conversationId: conversation.id,
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(searchResults.total).toBeGreaterThanOrEqual(2);
            expect(searchResults.messages.length).toBeGreaterThanOrEqual(2);
            // 6. Verify state machine state
            expect(MemoryStateMachine.getCurrentState(machine)).toBe('searching');
            expect(MemoryStateMachine.getMessageCount(machine)).toBe(2);
            expect(MemoryStateMachine.getTotalTokens(machine)).toBe(23);
            // 7. Verify database state
            const updatedConv = conversationDAO.getById(conversation.id);
            expect(updatedConv.messageCount).toBe(2);
            expect(updatedConv.totalTokens).toBe(23);
            // 8. Archive conversation
            conversationDAO.archive(conversation.id);
            const archiveEvent = JSON.stringify({});
            const result3 = MemoryStateMachine.transition(machine, 'archive_conversation', JSON.parse(archiveEvent), 'archived');
            expect(result3.TAG).toBe('Ok');
            if (result3.TAG === 'Ok') {
                machine = result3._0;
            }
            expect(MemoryStateMachine.getCurrentState(machine)).toBe('archived');
            const archivedConv = conversationDAO.getById(conversation.id);
            expect(archivedConv.state).toBe('archived');
            expect(archivedConv.archivedAt).toBeDefined();
        });
    });
});
//# sourceMappingURL=memory-system.test.js.map