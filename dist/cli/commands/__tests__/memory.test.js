/**
 * memory.test.ts
 *
 * Tests for memory CLI commands
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import * as sqlite_vec from 'sqlite-vec';
import { MemoryService } from '../../../memory/MemoryService.js';
import { MemoryExporter } from '../../../memory/MemoryExporter.js';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
/**
 * Helper: Wait for async embedding generation to complete
 * Polls getEmbeddingStats() until expected count reached or timeout
 */
async function waitForEmbeddings(memoryService, expectedCount, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const stats = await memoryService.getEmbeddingStats();
        if (stats.totalEmbeddings >= expectedCount) {
            return; // Success
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
    }
    throw new Error(`Timeout waiting for ${expectedCount} embeddings after ${timeoutMs}ms`);
}
describe('Memory CLI Commands', () => {
    let db;
    let memoryService;
    let memoryExporter;
    beforeAll(() => {
        // Create in-memory database
        db = new Database(':memory:');
        // Load sqlite-vec extension for vector operations
        sqlite_vec.load(db);
        // Apply migration 008 (memory system)
        const migration008SQL = readFileSync(join(process.cwd(), 'src/migrations/008_create_memory_system.sql'), 'utf-8');
        db.exec(migration008SQL);
        // Apply migration 009 (vector embeddings)
        const migration009SQL = readFileSync(join(process.cwd(), 'src/migrations/009_create_message_embeddings_vec0.sql'), 'utf-8');
        db.exec(migration009SQL);
        // Add FTS5 trigger for automatic synchronization
        // (ensures FTS5 table is populated when messages are inserted)
        db.exec(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_insert
      AFTER INSERT ON messages
      BEGIN
        INSERT INTO messages_fts (rowid, content)
        VALUES (NEW.rowid, NEW.content);
      END;
    `);
        // Initialize services
        memoryService = new MemoryService(db);
        memoryExporter = new MemoryExporter(memoryService);
    });
    afterAll(() => {
        db.close();
    });
    beforeEach(async () => {
        // Clear data
        db.exec('DELETE FROM messages');
        db.exec('DELETE FROM conversations');
        // Create test data
        const conv1 = await memoryService.createConversation({
            agentId: 'test-agent',
            userId: 'test-user',
            title: 'REST API Development',
            metadata: {},
        });
        await memoryService.addMessage({
            conversationId: conv1.id,
            role: 'user',
            content: 'How do I create a REST API?',
            tokens: 10,
            metadata: {},
        });
        await memoryService.addMessage({
            conversationId: conv1.id,
            role: 'assistant',
            content: 'To create a REST API, you need to define routes and handlers.',
            tokens: 20,
            metadata: {},
        });
        const conv2 = await memoryService.createConversation({
            agentId: 'backend-agent',
            userId: 'test-user',
            title: 'Database Design',
            metadata: {},
        });
        await memoryService.addMessage({
            conversationId: conv2.id,
            role: 'user',
            content: 'What is normalization in databases?',
            tokens: 8,
            metadata: {},
        });
        await memoryService.addMessage({
            conversationId: conv2.id,
            role: 'assistant',
            content: 'Normalization is the process of organizing data to reduce redundancy.',
            tokens: 15,
            metadata: {},
        });
        // NEW: Create conversation with semantic-optimized test data
        // Purpose: Test semantic vs exact search differentiation
        const convSemantic = await memoryService.createConversation({
            agentId: 'semantic-agent',
            userId: 'test-user',
            title: 'Authentication and Security',
            metadata: {},
        });
        // Auth topic - Message 1: Contains 'JWT' keyword
        await memoryService.addMessage({
            conversationId: convSemantic.id,
            role: 'user',
            content: 'How do I implement JWT authentication in Node.js?',
            tokens: 12,
            metadata: {},
        });
        // Auth topic - Message 2: NO 'JWT' keyword, semantically similar
        await memoryService.addMessage({
            conversationId: convSemantic.id,
            role: 'assistant',
            content: 'Can you help me secure user sessions with tokens?',
            tokens: 10,
            metadata: {},
        });
        // Auth topic - Message 3: NO 'JWT' or 'token', semantically similar
        await memoryService.addMessage({
            conversationId: convSemantic.id,
            role: 'user',
            content: 'What is the best practice for validating user credentials?',
            tokens: 11,
            metadata: {},
        });
        // Wait for async embedding generation to complete
        // Expected: 7 messages total (2 + 2 + 3)
        await waitForEmbeddings(memoryService, 7);
    });
    // ========================================================================
    // ax memory search
    // ========================================================================
    describe('memory search', () => {
        it('should search messages by query', async () => {
            const result = await memoryService.searchMessages({
                query: 'REST API',
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(result.messages.length).toBeGreaterThan(0);
            expect(result.messages[0].content).toContain('REST API');
        });
        it('should filter search by agent', async () => {
            const result = await memoryService.searchMessages({
                query: 'API',
                agentId: 'test-agent',
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(result.messages.length).toBeGreaterThan(0);
            for (const msg of result.messages) {
                const conversation = result.conversations.find((c) => c.id === msg.conversationId);
                expect(conversation?.agentId).toBe('test-agent');
            }
        });
        it('should limit search results', async () => {
            const result = await memoryService.searchMessages({
                query: 'database OR API',
                limit: 1,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(result.messages.length).toBeLessThanOrEqual(1);
        });
        it('should return empty results for non-matching query', async () => {
            const result = await memoryService.searchMessages({
                query: 'NONEXISTENT_QUERY_XYZ',
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(result.messages.length).toBe(0);
            expect(result.total).toBe(0);
        });
    });
    // ========================================================================
    // ax memory list
    // ========================================================================
    describe('memory list', () => {
        it('should list recent conversations', async () => {
            const result = await memoryService.listConversations({
                limit: 10,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            expect(result.conversations.length).toBe(2);
            expect(result.total).toBe(2);
        });
        it('should filter conversations by agent', async () => {
            const result = await memoryService.listConversations({
                agentId: 'backend-agent',
                limit: 10,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            expect(result.conversations.length).toBe(1);
            expect(result.conversations[0].agentId).toBe('backend-agent');
        });
        it('should filter conversations by user', async () => {
            const result = await memoryService.listConversations({
                userId: 'test-user',
                limit: 10,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            expect(result.conversations.length).toBe(2);
            for (const conv of result.conversations) {
                expect(conv.userId).toBe('test-user');
            }
        });
        it('should limit conversation results', async () => {
            const result = await memoryService.listConversations({
                limit: 1,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            expect(result.conversations.length).toBe(1);
            expect(result.hasMore).toBe(true);
        });
        it('should include message counts', async () => {
            const result = await memoryService.listConversations({
                limit: 10,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            for (const conv of result.conversations) {
                expect(conv.messageCount).toBeGreaterThan(0);
            }
        });
    });
    // ========================================================================
    // ax memory show
    // ========================================================================
    describe('memory show', () => {
        it('should show conversation with messages', async () => {
            const conversations = await memoryService.listConversations({
                limit: 1,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            const conversationId = conversations.conversations[0].id;
            const result = await memoryService.getConversationWithMessages(conversationId);
            expect(result).toBeDefined();
            expect(result?.id).toBe(conversationId);
            expect(result?.messages).toBeDefined();
            expect(result?.messages.length).toBeGreaterThan(0);
        });
        it('should return null for non-existent conversation', async () => {
            const result = await memoryService.getConversationWithMessages('non-existent-id');
            expect(result).toBeNull();
        });
        it('should include conversation metadata', async () => {
            const conversations = await memoryService.listConversations({
                limit: 1,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            const conversationId = conversations.conversations[0].id;
            const result = await memoryService.getConversationWithMessages(conversationId);
            expect(result).toBeDefined();
            expect(result?.agentId).toBeDefined();
            expect(result?.userId).toBeDefined();
            expect(result?.title).toBeDefined();
            expect(result?.state).toBeDefined();
            expect(result?.messageCount).toBeDefined();
            expect(result?.totalTokens).toBeDefined();
        });
    });
    // ========================================================================
    // ax memory export
    // ========================================================================
    describe('memory export', () => {
        const testExportFile = '/tmp/test-memory-export.json';
        afterEach(() => {
            if (existsSync(testExportFile)) {
                unlinkSync(testExportFile);
            }
        });
        it('should export conversations to JSON', async () => {
            const result = await memoryExporter.exportToJSON(testExportFile, {});
            expect(result.format).toBe('json');
            expect(result.conversationCount).toBeGreaterThan(0);
            expect(result.messageCount).toBeGreaterThan(0);
            expect(existsSync(testExportFile)).toBe(true);
            // Verify JSON content
            const content = readFileSync(testExportFile, 'utf-8');
            const data = JSON.parse(content);
            expect(data.conversations).toBeDefined();
            expect(Array.isArray(data.conversations)).toBe(true);
        });
        it('should export conversations to CSV', async () => {
            const csvFile = '/tmp/test-memory-export.csv';
            const result = await memoryExporter.exportToCSV(csvFile, {});
            expect(result.format).toBe('csv');
            expect(existsSync(csvFile)).toBe(true);
            // Verify CSV content
            const content = readFileSync(csvFile, 'utf-8');
            expect(content).toContain('ConversationID');
            expect(content).toContain('AgentID');
            unlinkSync(csvFile);
        });
        it('should export conversations to Markdown', async () => {
            const mdFile = '/tmp/test-memory-export.md';
            const result = await memoryExporter.exportToMarkdown(mdFile, {});
            expect(result.format).toBe('markdown');
            expect(existsSync(mdFile)).toBe(true);
            // Verify Markdown content
            const content = readFileSync(mdFile, 'utf-8');
            expect(content).toContain('# Memory Export');
            expect(content).toContain('**Conversations:**');
            unlinkSync(mdFile);
        });
        it('should filter export by agent', async () => {
            const result = await memoryExporter.exportToJSON(testExportFile, {
                agentId: 'backend-agent',
            });
            expect(result.conversationCount).toBe(1);
            const content = readFileSync(testExportFile, 'utf-8');
            const data = JSON.parse(content);
            expect(data.conversations[0].agentId).toBe('backend-agent');
        });
        it('should create full backup', async () => {
            const backupFile = '/tmp/test-backup.json';
            const result = await memoryExporter.createBackup(backupFile);
            expect(result.format).toBe('json');
            expect(result.conversationCount).toBeGreaterThan(0);
            expect(existsSync(backupFile)).toBe(true);
            unlinkSync(backupFile);
        });
    });
    // ========================================================================
    // ax memory stats
    // ========================================================================
    describe('memory stats', () => {
        it('should get memory statistics', async () => {
            const stats = await memoryService.getMemoryStats();
            expect(stats.totalConversations).toBeGreaterThan(0);
            expect(stats.totalMessages).toBeGreaterThan(0);
            expect(stats.totalTokens).toBeGreaterThan(0);
            expect(stats.averageMessagesPerConversation).toBeGreaterThan(0);
            expect(stats.averageTokensPerMessage).toBeGreaterThan(0);
        });
        it('should include conversation counts by state', async () => {
            const stats = await memoryService.getMemoryStats();
            expect(stats.activeConversations).toBeDefined();
            expect(stats.archivedConversations).toBeDefined();
            expect(stats.deletedConversations).toBeDefined();
        });
        it('should include timestamp ranges', async () => {
            const stats = await memoryService.getMemoryStats();
            expect(stats.oldestConversation).toBeDefined();
            expect(stats.newestConversation).toBeDefined();
            if (stats.oldestConversation && stats.newestConversation) {
                expect(stats.newestConversation).toBeGreaterThanOrEqual(stats.oldestConversation);
            }
        });
        it('should calculate averages correctly', async () => {
            const stats = await memoryService.getMemoryStats();
            const expectedAvgMessages = stats.totalMessages / stats.totalConversations;
            expect(stats.averageMessagesPerConversation).toBeCloseTo(expectedAvgMessages, 1);
            if (stats.totalMessages > 0) {
                const expectedAvgTokens = stats.totalTokens / stats.totalMessages;
                expect(stats.averageTokensPerMessage).toBeCloseTo(expectedAvgTokens, 1);
            }
        });
    });
    // ========================================================================
    // Integration Tests
    // ========================================================================
    describe('integration workflows', () => {
        it('should support full conversation lifecycle', async () => {
            // Create conversation
            const conv = await memoryService.createConversation({
                agentId: 'integration-agent',
                userId: 'integration-user',
                title: 'Integration Test',
                metadata: {},
            });
            expect(conv.id).toBeDefined();
            // Add messages
            await memoryService.addMessage({
                conversationId: conv.id,
                role: 'user',
                content: 'Test message 1',
                tokens: 5,
                metadata: {},
            });
            await memoryService.addMessage({
                conversationId: conv.id,
                role: 'assistant',
                content: 'Test response 1',
                tokens: 7,
                metadata: {},
            });
            // Search for messages
            const searchResult = await memoryService.searchMessages({
                query: 'Test message',
                conversationId: conv.id,
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(searchResult.messages.length).toBeGreaterThan(0);
            // Get conversation with messages
            const fullConv = await memoryService.getConversationWithMessages(conv.id);
            expect(fullConv).toBeDefined();
            expect(fullConv?.messages?.length).toBe(2);
            // Archive conversation
            await memoryService.archiveConversation(conv.id);
            const archivedConv = await memoryService.getConversation(conv.id);
            expect(archivedConv?.archivedAt).toBeDefined();
            // Export conversation
            const exportFile = '/tmp/integration-export.json';
            const exportResult = await memoryExporter.exportConversation(conv.id, exportFile, 'json');
            expect(exportResult.conversationCount).toBe(1);
            expect(existsSync(exportFile)).toBe(true);
            unlinkSync(exportFile);
        });
        it('should handle pagination correctly', async () => {
            // List first page
            const page1 = await memoryService.listConversations({
                limit: 1,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            expect(page1.conversations.length).toBe(1);
            expect(page1.hasMore).toBe(true);
            // List second page
            const page2 = await memoryService.listConversations({
                limit: 1,
                offset: 1,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            expect(page2.conversations.length).toBe(1);
            // Ensure pages are different
            expect(page1.conversations[0].id).not.toBe(page2.conversations[0].id);
        });
        it('should handle multi-agent scenarios', async () => {
            const agents = ['agent-1', 'agent-2', 'agent-3'];
            // Create conversations for each agent
            for (const agentId of agents) {
                const conv = await memoryService.createConversation({
                    agentId,
                    userId: 'multi-user',
                    title: `Conversation for ${agentId}`,
                    metadata: {},
                });
                await memoryService.addMessage({
                    conversationId: conv.id,
                    role: 'user',
                    content: `Message for ${agentId}`,
                    tokens: 5,
                    metadata: {},
                });
            }
            // Verify each agent has conversations
            for (const agentId of agents) {
                const result = await memoryService.listConversations({
                    agentId,
                    limit: 10,
                    offset: 0,
                    sortBy: 'updatedAt',
                    sortOrder: 'desc',
                });
                expect(result.conversations.length).toBeGreaterThan(0);
                expect(result.conversations[0].agentId).toBe(agentId);
            }
        });
    });
    // ========================================================================
    // NEW: ax memory search --semantic (Phase 4)
    // ========================================================================
    describe('memory semantic search', () => {
        it('should search messages using vector similarity', async () => {
            const result = await memoryService.searchMessagesSemantic('JWT authentication', {
                limit: 10,
            });
            expect(result.messages.length).toBeGreaterThan(0);
            expect(result.searchMode).toBe('semantic');
        });
        it('should return messages with similarity scores', async () => {
            const result = await memoryService.searchMessagesSemantic('user authentication', {
                limit: 10,
            });
            expect(result.messages.length).toBeGreaterThan(0);
            for (const msg of result.messages) {
                expect(msg.score).toBeDefined();
                expect(msg.score).toBeGreaterThan(0);
                expect(msg.score).toBeLessThanOrEqual(1);
                expect(msg.distance).toBeDefined();
            }
        });
        it('should rank by semantic relevance', async () => {
            const result = await memoryService.searchMessagesSemantic('JWT tokens security', {
                limit: 5,
            });
            expect(result.messages.length).toBeGreaterThan(0);
            // Scores should be in descending order (most similar first)
            for (let i = 0; i < result.messages.length - 1; i++) {
                expect(result.messages[i].score).toBeGreaterThanOrEqual(result.messages[i + 1].score);
            }
        });
        it('should filter by conversation', async () => {
            // Get the semantic conversation ID
            const conversations = await memoryService.listConversations({
                agentId: 'semantic-agent',
                limit: 1,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            const semanticConvId = conversations.conversations[0].id;
            const result = await memoryService.searchMessagesSemantic('authentication', {
                conversationId: semanticConvId,
                limit: 10,
            });
            expect(result.messages.length).toBeGreaterThan(0);
            // All messages should be from the specified conversation
            for (const msg of result.messages) {
                expect(msg.conversationId).toBe(semanticConvId);
            }
        });
        it('should filter by agent', async () => {
            const result = await memoryService.searchMessagesSemantic('authentication', {
                agentId: 'semantic-agent',
                limit: 10,
            });
            expect(result.messages.length).toBeGreaterThan(0);
        });
        it('should respect limit option', async () => {
            const result = await memoryService.searchMessagesSemantic('user security', {
                limit: 2,
            });
            expect(result.messages.length).toBeLessThanOrEqual(2);
        });
    });
    // ========================================================================
    // NEW: ax memory search --hybrid (Phase 4)
    // ========================================================================
    describe('memory hybrid search', () => {
        it('should combine FTS5 and vector results', async () => {
            const result = await memoryService.searchMessagesHybrid('JWT authentication', {
                limit: 10,
            });
            expect(result.messages.length).toBeGreaterThan(0);
            expect(result.searchMode).toBe('hybrid');
        });
        it('should return combined scores', async () => {
            const result = await memoryService.searchMessagesHybrid('authentication', {
                limit: 10,
            });
            expect(result.messages.length).toBeGreaterThan(0);
            for (const msg of result.messages) {
                expect(msg.score).toBeDefined();
                expect(msg.score).toBeGreaterThan(0);
            }
        });
        it('should show FTS and vector score breakdown', async () => {
            const result = await memoryService.searchMessagesHybrid('JWT', {
                limit: 10,
            });
            expect(result.messages.length).toBeGreaterThan(0);
            // At least one message should have both scores
            const hasBreakdown = result.messages.some(msg => msg.ftsScore !== undefined && msg.vectorScore !== undefined);
            expect(hasBreakdown).toBe(true);
        });
        it('should filter by conversation', async () => {
            const conversations = await memoryService.listConversations({
                agentId: 'semantic-agent',
                limit: 1,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            const semanticConvId = conversations.conversations[0].id;
            const result = await memoryService.searchMessagesHybrid('authentication', {
                conversationId: semanticConvId,
                limit: 10,
            });
            expect(result.messages.length).toBeGreaterThan(0);
            for (const msg of result.messages) {
                expect(msg.conversationId).toBe(semanticConvId);
            }
        });
    });
    // ========================================================================
    // NEW: ax memory index (Phase 4)
    // ========================================================================
    describe('memory index command', () => {
        beforeEach(async () => {
            // Clear embeddings but keep messages
            db.exec('DELETE FROM message_embeddings_metadata');
            db.exec('DELETE FROM message_embeddings');
        });
        it('should index all conversations', async () => {
            const result = await memoryService.indexExistingMessages(undefined, {
                batchSize: 100,
                force: false,
            });
            expect(result.indexed).toBeGreaterThan(0);
            expect(result.indexed).toBe(7); // 7 messages total
            expect(result.skipped).toBe(0);
            expect(result.failed).toBe(0);
            expect(result.duration).toBeGreaterThan(0);
        });
        it('should index specific conversation', async () => {
            const conversations = await memoryService.listConversations({
                agentId: 'semantic-agent',
                limit: 1,
                offset: 0,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            });
            const semanticConvId = conversations.conversations[0].id;
            const result = await memoryService.indexExistingMessages(semanticConvId, {
                batchSize: 100,
                force: false,
            });
            expect(result.indexed).toBe(3); // 3 messages in semantic conversation
            expect(result.skipped).toBe(0);
            expect(result.failed).toBe(0);
        });
        it('should skip already indexed messages', async () => {
            // First index
            await memoryService.indexExistingMessages(undefined, {
                batchSize: 100,
                force: false,
            });
            // Second index (should skip all)
            const result = await memoryService.indexExistingMessages(undefined, {
                batchSize: 100,
                force: false,
            });
            expect(result.indexed).toBe(0);
            expect(result.skipped).toBe(7); // All 7 messages skipped
            expect(result.failed).toBe(0);
        });
        it('should force re-index with --force', async () => {
            // First index
            await memoryService.indexExistingMessages(undefined, {
                batchSize: 100,
                force: false,
            });
            // Force re-index
            const result = await memoryService.indexExistingMessages(undefined, {
                batchSize: 100,
                force: true,
            });
            expect(result.indexed).toBe(7); // All 7 re-indexed
            expect(result.skipped).toBe(0);
            expect(result.failed).toBe(0);
        });
        it('should call progress callback', async () => {
            const progressUpdates = [];
            await memoryService.indexExistingMessages(undefined, {
                batchSize: 100,
                force: false,
                onProgress: (indexed, total) => {
                    progressUpdates.push({ indexed, total });
                },
            });
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[progressUpdates.length - 1].indexed).toBe(7);
            expect(progressUpdates[progressUpdates.length - 1].total).toBe(7);
        });
    });
    // ========================================================================
    // NEW: ax memory stats (embedding coverage) (Phase 4)
    // ========================================================================
    describe('memory stats with embeddings', () => {
        it('should include embedding coverage', async () => {
            const stats = await memoryService.getEmbeddingStats();
            expect(stats.totalEmbeddings).toBeDefined();
            expect(stats.totalMessages).toBeDefined();
            expect(stats.coveragePercent).toBeDefined();
        });
        it('should include model version', async () => {
            const stats = await memoryService.getEmbeddingStats();
            expect(stats.currentModelVersion).toBeDefined();
            expect(stats.currentModelVersion).toBe('all-MiniLM-L6-v2');
        });
        it('should calculate coverage percentage correctly', async () => {
            const stats = await memoryService.getEmbeddingStats();
            const expectedCoverage = (stats.totalEmbeddings / stats.totalMessages) * 100;
            expect(stats.coveragePercent).toBeCloseTo(expectedCoverage, 1);
        });
        it('should show 100% coverage when all messages indexed', async () => {
            const stats = await memoryService.getEmbeddingStats();
            // All messages have embeddings from beforeEach waitForEmbeddings()
            expect(stats.coveragePercent).toBe(100);
            expect(stats.totalEmbeddings).toBe(stats.totalMessages);
        });
    });
    // ========================================================================
    // NEW: Backward Compatibility (Phase 4)
    // ========================================================================
    describe('backward compatibility', () => {
        it('should still support exact search (FTS5-only)', async () => {
            const result = await memoryService.searchMessages({
                query: 'REST API',
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(result.messages.length).toBeGreaterThan(0);
            expect(result.messages[0].content).toContain('REST API');
        });
        it('should not break existing search tests', async () => {
            // This test ensures existing search functionality still works
            const result = await memoryService.searchMessages({
                query: 'database',
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            expect(result.messages.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=memory.test.js.map