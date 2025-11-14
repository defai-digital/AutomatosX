# AutomatosX Memory System - User Guide

**Version 2.0.0 | Phase 1 Week 3**

Complete guide to using the AutomatosX Memory System for persistent conversation storage, full-text search, and intelligent agent memory management.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [CLI Usage](#cli-usage)
5. [Programmatic Usage](#programmatic-usage)
6. [Search Guide](#search-guide)
7. [Advanced Features](#advanced-features)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Introduction

The AutomatosX Memory System provides persistent storage and intelligent retrieval of conversations between users and AI agents. It's designed to enable agents to "remember" past interactions and make informed decisions based on conversation history.

### Key Features

- **Persistent Storage** - All conversations saved to SQLite database
- **Full-Text Search** - SQLite FTS5 for fast natural language search
- **Multi-Agent Support** - Track conversations per agent
- **Export/Import** - Backup and restore in JSON, CSV, or Markdown
- **Analytics** - Track usage patterns and conversation metrics
- **Caching** - LRU cache with TTL for performance
- **Session Management** - Active conversation tracking with auto-cleanup

### Use Cases

- **Agent Memory** - Agents recall past conversations and decisions
- **Context Retrieval** - Search for relevant past discussions
- **Audit Trail** - Complete history of agent interactions
- **Knowledge Base** - Export conversations as documentation
- **Analytics** - Understand agent usage patterns

---

## Quick Start

### Installation

The Memory System is included in AutomatosX v2. No additional installation required.

### Basic Usage

```bash
# Search for past conversations
ax memory search "authentication"

# List recent conversations
ax memory list

# Show conversation details
ax memory show <conversation-id>

# Export conversations
ax memory export --output backup.json

# View statistics
ax memory stats
```

### First Steps

1. **Create a conversation** (done automatically by agents)
2. **Search your history** - `ax memory search "your query"`
3. **View statistics** - `ax memory stats`
4. **Export a backup** - `ax memory export --output backup.json`

---

## Core Concepts

### Conversations

A **conversation** represents a session between a user and an AI agent.

**Properties:**
- `id` - Unique identifier (UUID)
- `agentId` - Which agent participated
- `userId` - Which user participated (optional)
- `title` - Conversation title
- `state` - Current state (idle/active/archived/deleted)
- `messageCount` - Number of messages
- `totalTokens` - Total tokens used
- `metadata` - Custom key-value data
- `createdAt` - Creation timestamp
- `updatedAt` - Last modification timestamp

**States:**
- `idle` - Not currently active
- `active` - Currently in use
- `archived` - Archived for long-term storage
- `deleted` - Soft-deleted (can be recovered)

**Lifecycle:**
```
Created (idle) → Active → Idle → Archived → Deleted
                   ↓
                Resume
```

---

### Messages

A **message** is a single exchange in a conversation.

**Properties:**
- `id` - Unique identifier (UUID)
- `conversationId` - Parent conversation
- `role` - Who sent it (user/assistant/system)
- `content` - Message text
- `tokens` - Token count (optional)
- `metadata` - Custom key-value data
- `createdAt` - Creation timestamp

**Roles:**
- `user` - User-generated message
- `assistant` - AI agent response
- `system` - System notification

---

### Agents

An **agent** is an AI entity that participates in conversations. Each conversation belongs to exactly one agent.

Examples:
- `backend` - Backend development agent
- `frontend` - Frontend development agent
- `product` - Product management agent

---

## CLI Usage

### Search Conversations

Find messages using full-text search.

**Basic Search:**
```bash
ax memory search "REST API"
```

**Filter by Agent:**
```bash
ax memory search "authentication" --agent backend
```

**Limit Results:**
```bash
ax memory search "database" --limit 20
```

**Show Full Content:**
```bash
ax memory search "error handling" --verbose
```

**Output:**
```
🔍 Searching for: "REST API"

Found 5 messages (showing 5):

[USER] 11/9/2024, 2:30:00 PM
  Conversation: REST API Development (backend)
  How do I create a REST API with Express?
  Tokens: 10

[ASSISTANT] 11/9/2024, 2:30:15 PM
  Conversation: REST API Development (backend)
  To create a REST API with Express, you need to install express, define routes...
  Tokens: 150

...
```

---

### List Conversations

View recent conversations with filters.

**List Recent:**
```bash
ax memory list
```

**Filter by Agent:**
```bash
ax memory list --agent backend
```

**Filter by State:**
```bash
ax memory list --state active
```

**Include Archived:**
```bash
ax memory list --archived
```

**JSON Output:**
```bash
ax memory list --json
```

**Output:**
```
💬 Conversations (25 total, showing 10):

ID                                    Title                    Agent      Messages  Tokens  Updated
abc123-...                            REST API Development     backend    15        1,500   11/9/24, 2:30 PM
def456-...                            Database Design          backend    8         800     11/8/24, 5:15 PM
...
```

---

### Show Conversation

View full conversation with all messages.

**Show Conversation:**
```bash
ax memory show abc123-def456-...
```

**Limit Messages:**
```bash
ax memory show abc123-def456-... --limit 10
```

**JSON Output:**
```bash
ax memory show abc123-def456-... --json
```

**Output:**
```
📝 Conversation Details:

ID              abc123-def456-...
Title           REST API Development
Agent           backend
State           active
Messages        15
Total Tokens    1,500
Created         11/9/2024, 2:00:00 PM
Updated         11/9/2024, 2:30:00 PM

💬 Messages (15 of 15):

[USER] 11/9/2024, 2:00:15 PM
How do I create a REST API?

[ASSISTANT] 11/9/2024, 2:00:30 PM
To create a REST API, you need to...
Tokens: 150

...
```

---

### Export Conversations

Backup and export conversations to files.

**Export to JSON (default):**
```bash
ax memory export --output backup.json
```

**Export to CSV:**
```bash
ax memory export --format csv --output export.csv
```

**Export to Markdown:**
```bash
ax memory export --format markdown --output docs.md
```

**Filter by Agent:**
```bash
ax memory export --agent backend --output backend-backup.json
```

**Include Archived:**
```bash
ax memory export --archived --output full-backup.json
```

**Include Deleted:**
```bash
ax memory export --deleted --archived --output complete-backup.json
```

**Output:**
```
📦 Exporting conversations...

✓ Successfully exported 25 conversations
  Messages: 250
  Format: json
  Size: 125.50 KB
  File: /path/to/backup.json
```

---

### View Statistics

Monitor memory system health and usage.

**Basic Statistics:**
```bash
ax memory stats
```

**Detailed Statistics:**
```bash
ax memory stats --verbose
```

**Output:**
```
📊 Memory System Statistics

Metric                          Value
Total Conversations             150
Active Conversations            45
Archived Conversations          100
Deleted Conversations           5
Total Messages                  1,250
Total Tokens                    125,000
Avg Messages/Conversation       8.3
Avg Tokens/Message              100.0
Storage Estimate                25.50 MB

📅 Time Range:
  Oldest: 1/1/2024, 10:00:00 AM
  Newest: 11/9/2024, 10:00:00 PM
  Span: 312d 12h

💡 Insights:
  ✓ Good conversation engagement with multiple messages
  ℹ Many archived conversations - consider cleaning up old archives
```

---

## Programmatic Usage

### Setup

```typescript
import { getDatabase } from './database/connection.js';
import { MemoryService } from './memory/MemoryService.js';
import { ConversationManager } from './memory/ConversationManager.js';
import { MemoryCache } from './memory/MemoryCache.js';
import { MemoryAnalytics } from './memory/MemoryAnalytics.js';
import { MemoryExporter } from './memory/MemoryExporter.js';

// Initialize database
const db = getDatabase();

// Initialize services
const memoryService = new MemoryService(db);
const conversationManager = new ConversationManager(memoryService);
const memoryCache = new MemoryCache();
const memoryAnalytics = new MemoryAnalytics(memoryService);
const memoryExporter = new MemoryExporter(memoryService);
```

---

### Basic Operations

**Create Conversation:**
```typescript
const conversation = await memoryService.createConversation({
  agentId: 'backend',
  userId: 'user-123',
  title: 'REST API Development',
  metadata: { project: 'api-v2', priority: 'high' }
});

console.log(`Created conversation: ${conversation.id}`);
```

**Add Messages:**
```typescript
// User message
await memoryService.addMessage({
  conversationId: conversation.id,
  role: 'user',
  content: 'How do I create a REST API?',
  tokens: 10
});

// Assistant response
await memoryService.addMessage({
  conversationId: conversation.id,
  role: 'assistant',
  content: 'To create a REST API, you need to...',
  tokens: 150
});
```

**Search Messages:**
```typescript
const result = await memoryService.searchMessages({
  query: 'REST API',
  agentId: 'backend',
  limit: 10,
  offset: 0,
  sortBy: 'relevance',
  sortOrder: 'desc'
});

console.log(`Found ${result.total} messages`);
for (const msg of result.messages) {
  console.log(`[${msg.role}] ${msg.content}`);
}
```

---

### Session Management

**Start Session:**
```typescript
const conversation = await conversationManager.startConversation({
  agentId: 'backend',
  title: 'New Session'
});

// Session is now active and tracked
```

**Resume Session:**
```typescript
const conversation = await conversationManager.resumeConversation('conv-id');

if (conversation) {
  console.log(`Resumed: ${conversation.title}`);
  console.log(`Messages: ${conversation.messages.length}`);
}
```

**End Session:**
```typescript
await conversationManager.endConversation('conv-id');

// Session is archived
```

**Get Statistics:**
```typescript
const stats = conversationManager.getStatistics();

console.log(`Active conversations: ${stats.activeConversations}`);
console.log(`Total started: ${stats.totalConversationsStarted}`);
console.log(`Total ended: ${stats.totalConversationsEnded}`);
```

---

### Caching

**Setup Cache:**
```typescript
const cache = new MemoryCache({
  maxSize: 1000,
  ttlMs: 5 * 60 * 1000 // 5 minutes
});
```

**Use Cache:**
```typescript
// Check cache first
let conversation = cache.getConversation(id);

if (!conversation) {
  // Cache miss - load from database
  conversation = await memoryService.getConversation(id);

  if (conversation) {
    // Store in cache
    cache.setConversation(id, conversation);
  }
}
```

**Cache Statistics:**
```typescript
const stats = cache.getStats();

console.log(`Hits: ${stats.hits}`);
console.log(`Misses: ${stats.misses}`);
console.log(`Hit rate: ${stats.hitRate.toFixed(2)}%`);
console.log(`Size: ${stats.size}/${cache.maxSize}`);
```

---

### Analytics

**Track Events:**
```typescript
// Automatic tracking
analytics.trackConversationCreated(conversation.id, 'backend');
analytics.trackMessageAdded(conversation.id, 'backend', 50);
analytics.trackSearchPerformed('REST API', 10);
```

**Conversation Metrics:**
```typescript
const metrics = await analytics.getConversationMetrics('conv-id');

console.log(`Messages: ${metrics.messageCount}`);
console.log(`Tokens: ${metrics.totalTokens}`);
console.log(`Duration: ${metrics.durationMs}ms`);
console.log(`Avg tokens/message: ${metrics.averageTokensPerMessage}`);
```

**Agent Metrics:**
```typescript
const metrics = await analytics.getAgentMetrics('backend');

console.log(`Conversations: ${metrics.conversationCount}`);
console.log(`Total messages: ${metrics.totalMessages}`);
console.log(`Total tokens: ${metrics.totalTokens}`);
console.log(`Avg messages/conversation: ${metrics.averageMessagesPerConversation}`);
```

**Time Range Metrics:**
```typescript
// Daily metrics
const daily = await analytics.getDailyMetrics();
console.log(`Today: ${daily.conversationCount} conversations`);
console.log(`Peak hour: ${daily.peakHour}`);

// Weekly metrics
const weekly = await analytics.getWeeklyMetrics();
console.log(`This week: ${weekly.conversationCount} conversations`);

// Monthly metrics
const monthly = await analytics.getMonthlyMetrics();
console.log(`This month: ${monthly.conversationCount} conversations`);
```

---

### Export/Import

**Export to JSON:**
```typescript
const result = await memoryExporter.exportToJSON('/path/to/backup.json', {
  agentId: 'backend',
  includeArchived: true
});

console.log(`Exported ${result.conversationCount} conversations`);
console.log(`File size: ${result.sizeBytes} bytes`);
```

**Export to CSV:**
```typescript
const result = await memoryExporter.exportToCSV('/path/to/export.csv', {
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
  endDate: Date.now()
});
```

**Export to Markdown:**
```typescript
const result = await memoryExporter.exportToMarkdown('/path/to/docs.md', {
  userId: 'user-123'
});
```

**Import from JSON:**
```typescript
const result = await memoryExporter.importFromJSON('/path/to/backup.json');

console.log(`Imported ${result.conversationsImported} conversations`);
console.log(`Imported ${result.messagesImported} messages`);

if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}
```

**Create Backup:**
```typescript
// Full backup (includes archived and deleted)
const result = await memoryExporter.createBackup('/path/to/backup.json');
```

**Restore Backup:**
```typescript
const result = await memoryExporter.restoreBackup('/path/to/backup.json');
```

---

## Search Guide

### FTS5 Query Syntax

The Memory System uses SQLite FTS5 for full-text search with advanced query capabilities.

**Simple Search:**
```typescript
query: 'authentication'
```

**Boolean Operators:**
```typescript
// AND - both terms must appear
query: 'authentication AND database'

// OR - either term must appear
query: 'REST OR GraphQL'

// NOT - exclude term
query: 'database NOT postgres'
```

**Phrase Search:**
```typescript
// Exact phrase
query: '"REST API design"'

// Multiple phrases
query: '"user authentication" OR "JWT tokens"'
```

**Prefix Search:**
```typescript
// Match any word starting with "auth"
query: 'auth*'

// Multiple prefixes
query: 'auth* AND data*'
```

**Column Search:**
```typescript
// Search in specific column (content only for now)
query: 'content: authentication'
```

**Complex Queries:**
```typescript
// Combine all operators
query: '("REST API" OR "GraphQL API") AND authentication NOT deprecated'
```

---

### Search Best Practices

**1. Use Specific Queries**
```typescript
// Good - specific
query: 'JWT authentication implementation'

// Bad - too broad
query: 'API'
```

**2. Use Filters**
```typescript
// Filter by agent
{
  query: 'authentication',
  agentId: 'backend'
}

// Filter by conversation
{
  query: 'error',
  conversationId: 'conv-id'
}
```

**3. Pagination**
```typescript
// First page
const page1 = await memoryService.searchMessages({
  query: 'authentication',
  limit: 10,
  offset: 0
});

// Second page
const page2 = await memoryService.searchMessages({
  query: 'authentication',
  limit: 10,
  offset: 10
});
```

**4. Sort Results**
```typescript
// Sort by relevance (default for search)
{
  query: 'authentication',
  sortBy: 'relevance',
  sortOrder: 'desc'
}

// Sort by date
{
  query: 'authentication',
  sortBy: 'createdAt',
  sortOrder: 'desc'
}
```

---

## Advanced Features

### Multi-Agent Workflows

**Scenario:** Multiple agents collaborating on a project.

```typescript
// Product agent creates initial design
const designConv = await memoryService.createConversation({
  agentId: 'product',
  title: 'Authentication System Design'
});

await memoryService.addMessage({
  conversationId: designConv.id,
  role: 'assistant',
  content: 'Designed authentication with JWT...',
  metadata: { phase: 'design' }
});

// Backend agent searches for design
const designDocs = await memoryService.searchMessages({
  query: 'authentication design',
  agentId: 'product',
  limit: 5
});

// Backend agent implements based on design
const implConv = await memoryService.createConversation({
  agentId: 'backend',
  title: 'Authentication Implementation',
  metadata: { designRef: designConv.id }
});

// Security agent audits implementation
const auditConv = await memoryService.createConversation({
  agentId: 'security',
  title: 'Authentication Audit',
  metadata: { implRef: implConv.id }
});
```

---

### Context-Aware Agents

**Scenario:** Agent recalls relevant past conversations.

```typescript
async function answerWithContext(agentId: string, userQuestion: string) {
  // Search for relevant past conversations
  const pastContext = await memoryService.searchMessages({
    query: userQuestion,
    agentId,
    limit: 3,
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  // Build context from past conversations
  const context = pastContext.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  // Create new conversation with context
  const conversation = await memoryService.createConversation({
    agentId,
    title: `Question about ${userQuestion}`,
    metadata: {
      contextConversations: pastContext.messages
        .map(m => m.conversationId)
        .join(',')
    }
  });

  // Agent uses context to provide informed answer
  // ... (call LLM with context) ...

  return conversation;
}
```

---

### Conversation Templates

**Scenario:** Reuse common conversation patterns.

```typescript
// Template for code review
async function createCodeReviewConversation(
  agentId: string,
  prUrl: string,
  files: string[]
) {
  const conversation = await memoryService.createConversation({
    agentId,
    title: `Code Review: ${prUrl}`,
    metadata: {
      type: 'code-review',
      prUrl,
      files: files.join(','),
      status: 'in-progress'
    }
  });

  // Add system message with instructions
  await memoryService.addMessage({
    conversationId: conversation.id,
    role: 'system',
    content: `Reviewing PR: ${prUrl}\nFiles: ${files.join(', ')}`
  });

  return conversation;
}

// Template for bug investigation
async function createBugInvestigationConversation(
  agentId: string,
  issueId: string,
  errorMessage: string
) {
  const conversation = await memoryService.createConversation({
    agentId,
    title: `Bug Investigation: ${issueId}`,
    metadata: {
      type: 'bug-investigation',
      issueId,
      status: 'investigating'
    }
  });

  await memoryService.addMessage({
    conversationId: conversation.id,
    role: 'system',
    content: `Error: ${errorMessage}`
  });

  return conversation;
}
```

---

### Scheduled Archiving

**Scenario:** Automatically archive old conversations.

```typescript
async function archiveOldConversations(daysOld: number = 30) {
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;

  // Find old idle conversations
  const conversations = await memoryService.listConversations({
    state: 'idle',
    limit: 100,
    offset: 0,
    sortBy: 'updatedAt',
    sortOrder: 'asc'
  });

  let archived = 0;

  for (const conv of conversations.conversations) {
    if (conv.updatedAt < cutoff) {
      await memoryService.archiveConversation(conv.id);
      archived++;
    }
  }

  console.log(`Archived ${archived} conversations`);
  return archived;
}

// Run daily
setInterval(() => {
  archiveOldConversations(30);
}, 24 * 60 * 60 * 1000);
```

---

## Best Practices

### 1. Conversation Lifecycle

**DO:**
- Create conversations with descriptive titles
- Archive inactive conversations after 30 days
- Delete conversations only when absolutely necessary
- Use soft delete first, hard delete only for cleanup

**DON'T:**
- Leave conversations in `active` state indefinitely
- Hard delete conversations without backing up
- Create too many conversations for simple queries

---

### 2. Message Management

**DO:**
- Include token counts for cost tracking
- Add metadata for filtering and analysis
- Keep message content focused and concise
- Use system messages for context

**DON'T:**
- Store large binary data in messages
- Duplicate messages across conversations
- Exceed recommended token limits

---

### 3. Search Optimization

**DO:**
- Use specific search queries
- Apply filters (agent, user, date range)
- Paginate large result sets
- Cache frequent searches

**DON'T:**
- Search with overly broad queries
- Load all results at once
- Search without filters on large datasets

---

### 4. Performance

**DO:**
- Use MemoryCache for frequent lookups
- Batch operations when possible
- Monitor cache hit rates
- Regular database vacuuming

**DON'T:**
- Query database directly without caching
- Load entire conversation histories
- Ignore performance metrics

---

### 5. Data Management

**DO:**
- Regular exports for backup
- Monitor storage usage with `ax memory stats`
- Archive old conversations
- Clean up deleted conversations periodically

**DON'T:**
- Skip backups
- Let database grow unbounded
- Keep all data forever

---

## Troubleshooting

### Search Returns No Results

**Problem:** `ax memory search "query"` returns 0 results.

**Solutions:**
1. Check if conversations exist: `ax memory list`
2. Verify FTS5 index is populated
3. Try broader search terms
4. Check if conversations are archived: `ax memory list --archived`

---

### Slow Search Performance

**Problem:** Searches take >5 seconds.

**Solutions:**
1. Enable caching:
   ```typescript
   const cache = new MemoryCache({ maxSize: 1000 });
   ```
2. Add filters to narrow results:
   ```typescript
   { query: 'auth', agentId: 'backend', limit: 10 }
   ```
3. Run `VACUUM` on database:
   ```bash
   sqlite3 .automatosx/memory/memories.db "VACUUM;"
   ```

---

### Database Locked Error

**Problem:** `SQLITE_BUSY: database is locked`

**Solutions:**
1. Check for long-running transactions
2. Enable WAL mode (automatic in AutomatosX)
3. Close unused database connections
4. Retry with exponential backoff

---

### Memory Usage Growing

**Problem:** Database file size growing rapidly.

**Solutions:**
1. Check statistics:
   ```bash
   ax memory stats
   ```
2. Archive old conversations:
   ```bash
   # Find old conversations
   ax memory list --state idle

   # Archive programmatically
   ```
3. Delete unnecessary conversations:
   ```bash
   # Export first!
   ax memory export --output backup.json

   # Then delete
   ```
4. Run VACUUM:
   ```bash
   sqlite3 .automatosx/memory/memories.db "VACUUM;"
   ```

---

### Export Fails

**Problem:** `ax memory export` fails with error.

**Solutions:**
1. Check disk space
2. Verify write permissions
3. Try smaller exports:
   ```bash
   ax memory export --agent backend --output backend-only.json
   ```
4. Use different format:
   ```bash
   ax memory export --format csv --output export.csv
   ```

---

## FAQ

### How much storage does Memory System use?

**Answer:** Approximately:
- 200 bytes per conversation
- 500 bytes per message (average)
- FTS5 index adds ~30% overhead

Example: 1000 conversations with 10 messages each = ~5-7 MB

---

### Can I use Memory System with multiple databases?

**Answer:** Yes, create separate `MemoryService` instances:

```typescript
const db1 = new Database('/path/to/db1.sqlite');
const service1 = new MemoryService(db1);

const db2 = new Database('/path/to/db2.sqlite');
const service2 = new MemoryService(db2);
```

---

### How do I migrate from v1 to v2?

**Answer:**
1. Export v1 data: `ax memory export --output v1-backup.json`
2. Upgrade to v2
3. Import data: Use `MemoryExporter.importFromJSON()`

---

### Can I customize conversation states?

**Answer:** The default states (idle/active/archived/deleted) cover most use cases. Custom states require schema changes.

---

### How do I backup conversations?

**Answer:** Regular backups:

```bash
# Daily backup
ax memory export --output daily-$(date +%Y%m%d).json

# Weekly backup with archives
ax memory export --archived --output weekly-$(date +%Y%m%d).json
```

---

### What's the maximum conversation size?

**Answer:**
- SQLite limit: 1GB per database (default)
- Practical limit: 100K messages per conversation
- Recommended: Archive conversations >1000 messages

---

### How do I delete all data?

**Answer:**
```bash
# Export first!
ax memory export --archived --deleted --output full-backup.json

# Delete database file
rm -rf .automatosx/memory/
```

---

### Can agents share conversations?

**Answer:** No, each conversation belongs to one agent. For multi-agent workflows, use metadata to link conversations:

```typescript
{
  metadata: {
    relatedConversations: 'conv-id-1,conv-id-2',
    collaboratingAgents: 'backend,frontend,security'
  }
}
```

---

### How do I optimize search?

**Answer:**
1. Use specific queries instead of wildcards
2. Apply filters (agent, date, user)
3. Enable caching
4. Limit result size
5. Use pagination

---

### What happens when cache is full?

**Answer:** MemoryCache uses LRU eviction:
1. Least recently used entry is evicted
2. New entry is added
3. No data is lost (database is source of truth)

---

## Next Steps

- **Read API Reference** - `automatosx/PRD/memory-api-reference.md`
- **Try Code Examples** - `examples/memory-examples.ts`
- **Explore Advanced Features** - See [Advanced Features](#advanced-features)
- **Join Community** - https://github.com/defai-digital/automatosx

---

## Support

- **Documentation**: This guide + API reference
- **Examples**: `examples/memory-examples.ts`
- **Issues**: https://github.com/defai-digital/automatosx/issues
- **Discord**: [Join our community](https://discord.gg/automatosx)

---

## Version History

- **v2.0.0** (Nov 2024) - Phase 1 complete with CLI, API, and documentation
- **v2.0.0-alpha.2** (Nov 2024) - Service layer implementation
- **v2.0.0-alpha.1** (Nov 2024) - Database foundation

---

**Happy Building!**

The AutomatosX Team
