/**
 * memory-examples.ts
 *
 * Code examples for AutomatosX Memory System
 * Demonstrates common usage patterns and best practices
 */

import { getDatabase } from '../src/database/connection.js';
import { MemoryService } from '../src/memory/MemoryService.js';
import { ConversationManager } from '../src/memory/ConversationManager.js';
import { MemoryCache } from '../src/memory/MemoryCache.js';
import { MemoryAnalytics } from '../src/memory/MemoryAnalytics.js';
import { MemoryExporter } from '../src/memory/MemoryExporter.js';

// ============================================================================
// Example 1: Basic Conversation Management
// ============================================================================

async function example1_BasicConversation() {
  console.log('\n=== Example 1: Basic Conversation Management ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);

  // Create a new conversation
  const conversation = await memoryService.createConversation({
    agentId: 'backend',
    userId: 'user-123',
    title: 'REST API Development',
    metadata: {
      project: 'api-v2',
      priority: 'high',
      tags: 'authentication,jwt,express',
    },
  });

  console.log(`Created conversation: ${conversation.id}`);
  console.log(`Title: ${conversation.title}`);
  console.log(`Agent: ${conversation.agentId}`);

  // Add user message
  const userMessage = await memoryService.addMessage({
    conversationId: conversation.id,
    role: 'user',
    content: 'How do I implement JWT authentication in Express?',
    tokens: 12,
    metadata: { language: 'en' },
  });

  console.log(`\nUser: ${userMessage.content}`);

  // Add assistant response
  const assistantMessage = await memoryService.addMessage({
    conversationId: conversation.id,
    role: 'assistant',
    content:
      'To implement JWT authentication in Express, you need to:\n' +
      '1. Install jsonwebtoken package\n' +
      '2. Create middleware for token verification\n' +
      '3. Protect routes with the middleware\n' +
      '4. Generate tokens on login',
    tokens: 85,
    metadata: { confidence: '0.95' },
  });

  console.log(`\nAssistant: ${assistantMessage.content}`);

  // Get conversation with all messages
  const fullConversation = await memoryService.getConversationWithMessages(
    conversation.id
  );

  console.log(`\nTotal messages: ${fullConversation?.messages?.length}`);
  console.log(`Total tokens: ${fullConversation?.totalTokens}`);
}

// ============================================================================
// Example 2: Full-Text Search
// ============================================================================

async function example2_FullTextSearch() {
  console.log('\n=== Example 2: Full-Text Search ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);

  // Create sample conversations
  await memoryService.createConversation({
    agentId: 'backend',
    title: 'Authentication System',
  });

  await memoryService.addMessage({
    conversationId: (
      await memoryService.getRecentConversations('backend', 1)
    )[0].id,
    role: 'user',
    content: 'Explain JWT token authentication',
    tokens: 5,
  });

  // Simple search
  console.log('1. Simple search for "authentication":');
  const simpleResult = await memoryService.searchMessages({
    query: 'authentication',
    limit: 5,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`Found ${simpleResult.total} messages`);
  for (const msg of simpleResult.messages) {
    console.log(`  [${msg.role}] ${msg.content.substring(0, 50)}...`);
  }

  // Boolean search
  console.log('\n2. Boolean search "JWT AND authentication":');
  const booleanResult = await memoryService.searchMessages({
    query: 'JWT AND authentication',
    limit: 5,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`Found ${booleanResult.total} messages`);

  // Phrase search
  console.log('\n3. Phrase search "JWT token":');
  const phraseResult = await memoryService.searchMessages({
    query: '"JWT token"',
    limit: 5,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`Found ${phraseResult.total} messages`);

  // Search with filters
  console.log('\n4. Search with agent filter:');
  const filteredResult = await memoryService.searchMessages({
    query: 'authentication',
    agentId: 'backend',
    limit: 5,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`Found ${filteredResult.total} messages from backend agent`);
}

// ============================================================================
// Example 3: Session Management
// ============================================================================

async function example3_SessionManagement() {
  console.log('\n=== Example 3: Session Management ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);
  const conversationManager = new ConversationManager(memoryService, {
    maxConversations: 10,
    inactivityThreshold: 15 * 60 * 1000, // 15 minutes
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  });

  // Start a new session
  console.log('1. Starting new session...');
  const session1 = await conversationManager.startConversation({
    agentId: 'backend',
    title: 'Session 1',
  });

  console.log(`Started session: ${session1.id}`);

  // Start another session
  console.log('\n2. Starting another session...');
  const session2 = await conversationManager.startConversation({
    agentId: 'frontend',
    title: 'Session 2',
  });

  console.log(`Started session: ${session2.id}`);

  // Get statistics
  console.log('\n3. Session statistics:');
  const stats = conversationManager.getStatistics();
  console.log(`  Active conversations: ${stats.activeConversations}`);
  console.log(`  Total started: ${stats.totalConversationsStarted}`);
  console.log(`  Total ended: ${stats.totalConversationsEnded}`);

  // Resume a session
  console.log('\n4. Resuming session 1...');
  const resumed = await conversationManager.resumeConversation(session1.id);

  if (resumed) {
    console.log(`Resumed: ${resumed.title}`);
    console.log(`Messages: ${resumed.messages?.length || 0}`);
  }

  // End a session
  console.log('\n5. Ending session 1...');
  await conversationManager.endConversation(session1.id);
  console.log('Session ended and archived');

  // Final statistics
  console.log('\n6. Final statistics:');
  const finalStats = conversationManager.getStatistics();
  console.log(`  Active conversations: ${finalStats.activeConversations}`);
  console.log(`  Total ended: ${finalStats.totalConversationsEnded}`);

  // Cleanup
  conversationManager.destroy();
}

// ============================================================================
// Example 4: Caching
// ============================================================================

async function example4_Caching() {
  console.log('\n=== Example 4: Caching ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);
  const cache = new MemoryCache({
    maxSize: 100,
    ttlMs: 5 * 60 * 1000, // 5 minutes
  });

  // Create a conversation
  const conversation = await memoryService.createConversation({
    agentId: 'backend',
    title: 'Cache Test',
  });

  // First access - cache miss
  console.log('1. First access (cache miss):');
  let cached = cache.getConversation(conversation.id);
  console.log(`  Cache hit: ${cached !== null}`);

  const fromDb = await memoryService.getConversation(conversation.id);
  if (fromDb) {
    cache.setConversation(conversation.id, fromDb);
    console.log('  Stored in cache');
  }

  // Second access - cache hit
  console.log('\n2. Second access (cache hit):');
  cached = cache.getConversation(conversation.id);
  console.log(`  Cache hit: ${cached !== null}`);

  // Cache statistics
  console.log('\n3. Cache statistics:');
  const stats = cache.getStats();
  console.log(`  Hits: ${stats.hits}`);
  console.log(`  Misses: ${stats.misses}`);
  console.log(`  Hit rate: ${stats.hitRate.toFixed(2)}%`);
  console.log(`  Size: ${stats.size}/${cache.maxSize}`);

  // Cache search results
  console.log('\n4. Caching search results:');
  const searchResult = await memoryService.searchMessages({
    query: 'test',
    limit: 10,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  cache.setSearchResults('test', searchResult.messages);
  console.log('  Search results cached');

  const cachedSearch = cache.getSearchResults('test');
  console.log(`  Retrieved ${cachedSearch?.length || 0} cached results`);

  // Clear cache
  console.log('\n5. Clearing cache:');
  cache.clear();
  console.log('  Cache cleared');
  console.log(`  Size: ${cache.getStats().size}`);
}

// ============================================================================
// Example 5: Analytics
// ============================================================================

async function example5_Analytics() {
  console.log('\n=== Example 5: Analytics ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);
  const analytics = new MemoryAnalytics(memoryService);

  // Create sample data
  console.log('1. Creating sample data...');
  const conv1 = await memoryService.createConversation({
    agentId: 'backend',
    title: 'Conversation 1',
  });

  analytics.trackConversationCreated(conv1.id, 'backend');

  await memoryService.addMessage({
    conversationId: conv1.id,
    role: 'user',
    content: 'Test message 1',
    tokens: 5,
  });

  analytics.trackMessageAdded(conv1.id, 'backend', 5);

  await memoryService.addMessage({
    conversationId: conv1.id,
    role: 'assistant',
    content: 'Test response 1',
    tokens: 10,
  });

  analytics.trackMessageAdded(conv1.id, 'backend', 10);

  // Conversation metrics
  console.log('\n2. Conversation metrics:');
  const convMetrics = await analytics.getConversationMetrics(conv1.id);

  if (convMetrics) {
    console.log(`  Messages: ${convMetrics.messageCount}`);
    console.log(`  Total tokens: ${convMetrics.totalTokens}`);
    console.log(`  Avg tokens/message: ${convMetrics.averageTokensPerMessage}`);
    console.log(`  Duration: ${convMetrics.durationMs}ms`);
  }

  // Agent metrics
  console.log('\n3. Agent metrics:');
  const agentMetrics = await analytics.getAgentMetrics('backend');
  console.log(`  Conversations: ${agentMetrics.conversationCount}`);
  console.log(`  Total messages: ${agentMetrics.totalMessages}`);
  console.log(`  Total tokens: ${agentMetrics.totalTokens}`);
  console.log(
    `  Avg messages/conversation: ${agentMetrics.averageMessagesPerConversation.toFixed(1)}`
  );

  // Daily metrics
  console.log('\n4. Daily metrics:');
  const daily = await analytics.getDailyMetrics();
  console.log(`  Conversations today: ${daily.conversationCount}`);
  console.log(`  Messages today: ${daily.messageCount}`);
  console.log(`  Active agents: ${daily.activeAgents.join(', ')}`);

  // Event counts
  console.log('\n5. Event counts:');
  const eventCounts = analytics.getEventCounts();
  console.log(JSON.stringify(eventCounts, null, 2));
}

// ============================================================================
// Example 6: Export/Import
// ============================================================================

async function example6_ExportImport() {
  console.log('\n=== Example 6: Export/Import ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);
  const exporter = new MemoryExporter(memoryService);

  // Create sample data
  console.log('1. Creating sample data...');
  const conv = await memoryService.createConversation({
    agentId: 'backend',
    title: 'Export Test',
  });

  await memoryService.addMessage({
    conversationId: conv.id,
    role: 'user',
    content: 'Test message',
    tokens: 5,
  });

  // Export to JSON
  console.log('\n2. Exporting to JSON...');
  const jsonResult = await exporter.exportToJSON('/tmp/memory-export.json', {
    agentId: 'backend',
  });

  console.log(`  Exported ${jsonResult.conversationCount} conversations`);
  console.log(`  Messages: ${jsonResult.messageCount}`);
  console.log(`  File size: ${jsonResult.sizeBytes} bytes`);

  // Export to CSV
  console.log('\n3. Exporting to CSV...');
  const csvResult = await exporter.exportToCSV('/tmp/memory-export.csv', {
    agentId: 'backend',
  });

  console.log(`  Exported ${csvResult.conversationCount} conversations`);
  console.log(`  File size: ${csvResult.sizeBytes} bytes`);

  // Export to Markdown
  console.log('\n4. Exporting to Markdown...');
  const mdResult = await exporter.exportToMarkdown('/tmp/memory-export.md', {
    agentId: 'backend',
  });

  console.log(`  Exported ${mdResult.conversationCount} conversations`);
  console.log(`  File size: ${mdResult.sizeBytes} bytes`);

  // Create full backup
  console.log('\n5. Creating full backup...');
  const backup = await exporter.createBackup('/tmp/memory-backup.json');

  console.log(`  Backed up ${backup.conversationCount} conversations`);
  console.log(`  File size: ${backup.sizeBytes} bytes`);
}

// ============================================================================
// Example 7: Context-Aware Agent
// ============================================================================

async function example7_ContextAwareAgent() {
  console.log('\n=== Example 7: Context-Aware Agent ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);

  // Create past conversations
  console.log('1. Creating conversation history...');

  const pastConv1 = await memoryService.createConversation({
    agentId: 'backend',
    title: 'JWT Authentication',
  });

  await memoryService.addMessage({
    conversationId: pastConv1.id,
    role: 'user',
    content: 'How do I implement JWT authentication?',
    tokens: 8,
  });

  await memoryService.addMessage({
    conversationId: pastConv1.id,
    role: 'assistant',
    content:
      'JWT authentication requires jsonwebtoken package, middleware, and route protection...',
    tokens: 50,
  });

  const pastConv2 = await memoryService.createConversation({
    agentId: 'backend',
    title: 'Session vs JWT',
  });

  await memoryService.addMessage({
    conversationId: pastConv2.id,
    role: 'user',
    content: 'What is the difference between session and JWT authentication?',
    tokens: 12,
  });

  await memoryService.addMessage({
    conversationId: pastConv2.id,
    role: 'assistant',
    content:
      'Sessions store state on server, JWT stores state in token on client...',
    tokens: 60,
  });

  // New question - search for context
  console.log('\n2. New question with context retrieval:');
  const userQuestion = 'Should I use JWT for my API?';
  console.log(`  Question: ${userQuestion}`);

  // Search for relevant context
  const relevantContext = await memoryService.searchMessages({
    query: 'JWT authentication',
    agentId: 'backend',
    limit: 3,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`\n  Found ${relevantContext.total} relevant messages:`);
  for (const msg of relevantContext.messages) {
    console.log(`    [${msg.role}] ${msg.content.substring(0, 60)}...`);
  }

  // Create new conversation with context
  const newConv = await memoryService.createConversation({
    agentId: 'backend',
    title: 'JWT Decision',
    metadata: {
      contextConversations: relevantContext.messages
        .map((m) => m.conversationId)
        .filter((id, index, self) => self.indexOf(id) === index)
        .join(','),
    },
  });

  console.log(`\n  Created conversation with context: ${newConv.id}`);
  console.log(
    `  Context from: ${newConv.metadata.contextConversations?.split(',').length || 0} past conversations`
  );

  // In real implementation, you would:
  // 1. Pass context to LLM
  // 2. Get informed response
  // 3. Add response to conversation
}

// ============================================================================
// Example 8: Multi-Agent Workflow
// ============================================================================

async function example8_MultiAgentWorkflow() {
  console.log('\n=== Example 8: Multi-Agent Workflow ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);

  // Phase 1: Product agent creates design
  console.log('1. Product agent creates design:');
  const designConv = await memoryService.createConversation({
    agentId: 'product',
    title: 'Authentication System Design',
    metadata: {
      phase: 'design',
      status: 'in-progress',
    },
  });

  await memoryService.addMessage({
    conversationId: designConv.id,
    role: 'assistant',
    content:
      'Designed authentication system with:\n' +
      '- JWT tokens for API\n' +
      '- Refresh token rotation\n' +
      '- Role-based access control\n' +
      '- OAuth2 integration',
    tokens: 100,
  });

  console.log(`  Created design: ${designConv.id}`);

  // Phase 2: Backend agent searches for design
  console.log('\n2. Backend agent searches for design:');
  const designDocs = await memoryService.searchMessages({
    query: 'authentication design JWT',
    agentId: 'product',
    limit: 5,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`  Found ${designDocs.total} design documents`);

  // Phase 3: Backend agent implements
  console.log('\n3. Backend agent implements:');
  const implConv = await memoryService.createConversation({
    agentId: 'backend',
    title: 'Authentication Implementation',
    metadata: {
      phase: 'implementation',
      status: 'in-progress',
      designRef: designConv.id,
    },
  });

  await memoryService.addMessage({
    conversationId: implConv.id,
    role: 'assistant',
    content:
      'Implemented authentication system:\n' +
      '- Created JWT middleware\n' +
      '- Added refresh token logic\n' +
      '- Implemented RBAC checks\n' +
      '- Integrated OAuth2 provider',
    tokens: 120,
  });

  console.log(`  Created implementation: ${implConv.id}`);

  // Phase 4: Security agent audits
  console.log('\n4. Security agent audits:');
  const implDocs = await memoryService.searchMessages({
    query: 'authentication implementation',
    agentId: 'backend',
    limit: 5,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  const auditConv = await memoryService.createConversation({
    agentId: 'security',
    title: 'Authentication Security Audit',
    metadata: {
      phase: 'audit',
      status: 'in-progress',
      implRef: implConv.id,
      designRef: designConv.id,
    },
  });

  await memoryService.addMessage({
    conversationId: auditConv.id,
    role: 'assistant',
    content:
      'Security audit findings:\n' +
      '✓ JWT tokens use secure algorithm (RS256)\n' +
      '✓ Refresh token rotation implemented\n' +
      '⚠ Add rate limiting to login endpoint\n' +
      '⚠ Implement token blacklist for logout',
    tokens: 90,
  });

  console.log(`  Created audit: ${auditConv.id}`);

  // Summary
  console.log('\n5. Workflow summary:');
  console.log(`  Design: ${designConv.id} (product agent)`);
  console.log(`  Implementation: ${implConv.id} (backend agent)`);
  console.log(`  Audit: ${auditConv.id} (security agent)`);

  // Track lineage
  console.log('\n6. Lineage tracking:');
  console.log(
    `  Audit references: design=${auditConv.metadata.designRef}, impl=${auditConv.metadata.implRef}`
  );
}

// ============================================================================
// Example 9: Advanced Search Patterns
// ============================================================================

async function example9_AdvancedSearch() {
  console.log('\n=== Example 9: Advanced Search Patterns ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);

  // Create diverse sample data
  console.log('1. Creating sample data...');
  const conv1 = await memoryService.createConversation({
    agentId: 'backend',
    title: 'REST API Development',
  });

  await memoryService.addMessage({
    conversationId: conv1.id,
    role: 'user',
    content: 'How to create REST API with Express and PostgreSQL?',
    tokens: 10,
  });

  const conv2 = await memoryService.createConversation({
    agentId: 'backend',
    title: 'GraphQL API Development',
  });

  await memoryService.addMessage({
    conversationId: conv2.id,
    role: 'user',
    content: 'How to create GraphQL API with Apollo Server?',
    tokens: 10,
  });

  // Pattern 1: OR search
  console.log('\n2. OR search (REST OR GraphQL):');
  const orResult = await memoryService.searchMessages({
    query: 'REST OR GraphQL',
    limit: 10,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`  Found ${orResult.total} messages`);

  // Pattern 2: AND search
  console.log('\n3. AND search (API AND Express):');
  const andResult = await memoryService.searchMessages({
    query: 'API AND Express',
    limit: 10,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`  Found ${andResult.total} messages`);

  // Pattern 3: NOT search
  console.log('\n4. NOT search (API NOT GraphQL):');
  const notResult = await memoryService.searchMessages({
    query: 'API NOT GraphQL',
    limit: 10,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`  Found ${notResult.total} messages`);

  // Pattern 4: Phrase search
  console.log('\n5. Phrase search ("REST API"):');
  const phraseResult = await memoryService.searchMessages({
    query: '"REST API"',
    limit: 10,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`  Found ${phraseResult.total} messages`);

  // Pattern 5: Prefix search
  console.log('\n6. Prefix search (Exp*):');
  const prefixResult = await memoryService.searchMessages({
    query: 'Exp*',
    limit: 10,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`  Found ${prefixResult.total} messages`);

  // Pattern 6: Complex query
  console.log('\n7. Complex query (("REST API" OR "GraphQL API") AND server):');
  const complexResult = await memoryService.searchMessages({
    query: '("REST API" OR "GraphQL API") AND server',
    limit: 10,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  console.log(`  Found ${complexResult.total} messages`);
}

// ============================================================================
// Example 10: Pagination
// ============================================================================

async function example10_Pagination() {
  console.log('\n=== Example 10: Pagination ===\n');

  const db = getDatabase();
  const memoryService = new MemoryService(db);

  // Create sample data
  console.log('1. Creating sample data...');
  for (let i = 1; i <= 25; i++) {
    const conv = await memoryService.createConversation({
      agentId: 'backend',
      title: `Conversation ${i}`,
    });

    await memoryService.addMessage({
      conversationId: conv.id,
      role: 'user',
      content: `Message ${i}`,
      tokens: 5,
    });
  }

  // List with pagination
  console.log('\n2. Paginated listing:');

  const pageSize = 10;
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 3) {
    const offset = (page - 1) * pageSize;

    const result = await memoryService.listConversations({
      limit: pageSize,
      offset,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    console.log(`\n  Page ${page}:`);
    console.log(`    Conversations: ${result.conversations.length}`);
    console.log(`    Total: ${result.total}`);
    console.log(`    Has more: ${result.hasMore}`);

    hasMore = result.hasMore;
    page++;
  }

  // Search with pagination
  console.log('\n3. Paginated search:');

  page = 1;
  hasMore = true;

  while (hasMore && page <= 2) {
    const offset = (page - 1) * pageSize;

    const result = await memoryService.searchMessages({
      query: 'Message',
      limit: pageSize,
      offset,
      sortBy: 'relevance',
      sortOrder: 'desc',
    });

    console.log(`\n  Page ${page}:`);
    console.log(`    Messages: ${result.messages.length}`);
    console.log(`    Total: ${result.total}`);
    console.log(`    Has more: ${result.hasMore}`);

    hasMore = result.hasMore;
    page++;
  }
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  console.log('\n' + '='.repeat(60));
  console.log('AutomatosX Memory System - Code Examples');
  console.log('='.repeat(60));

  try {
    await example1_BasicConversation();
    await example2_FullTextSearch();
    await example3_SessionManagement();
    await example4_Caching();
    await example5_Analytics();
    await example6_ExportImport();
    await example7_ContextAwareAgent();
    await example8_MultiAgentWorkflow();
    await example9_AdvancedSearch();
    await example10_Pagination();

    console.log('\n' + '='.repeat(60));
    console.log('All examples completed successfully!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

// Export examples for selective execution
export {
  example1_BasicConversation,
  example2_FullTextSearch,
  example3_SessionManagement,
  example4_Caching,
  example5_Analytics,
  example6_ExportImport,
  example7_ContextAwareAgent,
  example8_MultiAgentWorkflow,
  example9_AdvancedSearch,
  example10_Pagination,
  runAllExamples,
};
