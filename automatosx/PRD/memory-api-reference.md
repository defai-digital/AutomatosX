# Memory System API Reference

**AutomatosX Memory System - Phase 1 Week 3**

Complete API reference for the AutomatosX Memory System including service classes, DAOs, CLI commands, and type definitions.

---

## Table of Contents

1. [MemoryService API](#memoryservice-api)
2. [ConversationManager API](#conversationmanager-api)
3. [MemoryCache API](#memorycache-api)
4. [MemoryAnalytics API](#memoryanalytics-api)
5. [MemoryExporter API](#memoryexporter-api)
6. [ConversationDAO API](#conversationdao-api)
7. [MessageDAO API](#messagedao-api)
8. [CLI Commands](#cli-commands)
9. [Type Definitions](#type-definitions)

---

## MemoryService API

High-level service for memory management, orchestrating ConversationDAO and MessageDAO operations.

### Constructor

```typescript
constructor(db: Database)
```

**Parameters:**
- `db: Database` - SQLite database instance (better-sqlite3)

**Example:**
```typescript
import { getDatabase } from '../database/connection.js';
import { MemoryService } from '../memory/MemoryService.js';

const db = getDatabase();
const memoryService = new MemoryService(db);
```

---

### Conversation Operations

#### `createConversation(data: CreateConversation): Promise<Conversation>`

Create a new conversation.

**Parameters:**
- `data.agentId: string` - Agent identifier (required)
- `data.userId?: string` - User identifier (optional)
- `data.title: string` - Conversation title (required)
- `data.metadata?: Record<string, string>` - Additional metadata (optional)

**Returns:** `Promise<Conversation>` - Created conversation with generated ID

**Example:**
```typescript
const conversation = await memoryService.createConversation({
  agentId: 'backend',
  userId: 'user-123',
  title: 'REST API Development',
  metadata: { priority: 'high', project: 'api-v2' }
});

console.log(conversation.id); // Generated UUID
```

---

#### `getConversation(id: string): Promise<Conversation | null>`

Get conversation by ID.

**Parameters:**
- `id: string` - Conversation ID (UUID)

**Returns:** `Promise<Conversation | null>` - Conversation or null if not found

**Example:**
```typescript
const conversation = await memoryService.getConversation('conv-uuid');
if (conversation) {
  console.log(conversation.title);
}
```

---

#### `getConversationWithMessages(id: string): Promise<ConversationWithMessages | null>`

Get conversation with all messages.

**Parameters:**
- `id: string` - Conversation ID (UUID)

**Returns:** `Promise<ConversationWithMessages | null>` - Conversation with messages array or null

**Example:**
```typescript
const full = await memoryService.getConversationWithMessages('conv-uuid');
if (full) {
  console.log(`${full.title} has ${full.messages.length} messages`);
}
```

---

#### `updateConversation(id: string, updates: UpdateData): Promise<Conversation>`

Update conversation metadata.

**Parameters:**
- `id: string` - Conversation ID
- `updates.title?: string` - New title
- `updates.state?: string` - New state (idle/active/archived/deleted)
- `updates.metadata?: Record<string, string>` - New metadata

**Returns:** `Promise<Conversation>` - Updated conversation

**Example:**
```typescript
const updated = await memoryService.updateConversation('conv-uuid', {
  title: 'Updated Title',
  state: 'active'
});
```

---

#### `archiveConversation(id: string): Promise<boolean>`

Archive a conversation.

**Parameters:**
- `id: string` - Conversation ID

**Returns:** `Promise<boolean>` - True if archived successfully

**Example:**
```typescript
await memoryService.archiveConversation('conv-uuid');
```

---

#### `restoreConversation(id: string): Promise<boolean>`

Restore archived conversation.

**Parameters:**
- `id: string` - Conversation ID

**Returns:** `Promise<boolean>` - True if restored successfully

**Example:**
```typescript
await memoryService.restoreConversation('conv-uuid');
```

---

#### `deleteConversation(id: string): Promise<boolean>`

Soft delete conversation.

**Parameters:**
- `id: string` - Conversation ID

**Returns:** `Promise<boolean>` - True if deleted successfully

**Example:**
```typescript
await memoryService.deleteConversation('conv-uuid');
```

---

#### `permanentlyDeleteConversation(id: string): Promise<boolean>`

Permanently delete conversation and all messages.

**Parameters:**
- `id: string` - Conversation ID

**Returns:** `Promise<boolean>` - True if deleted successfully

**Example:**
```typescript
await memoryService.permanentlyDeleteConversation('conv-uuid');
```

---

#### `listConversations(options: ConversationListOptions): Promise<ConversationListResult>`

List conversations with filters and pagination.

**Parameters:**
- `options.agentId?: string` - Filter by agent
- `options.userId?: string` - Filter by user
- `options.state?: string` - Filter by state
- `options.limit: number` - Max results (1-100)
- `options.offset: number` - Skip N results
- `options.sortBy: string` - Sort field (createdAt/updatedAt/title)
- `options.sortOrder: 'asc' | 'desc'` - Sort direction
- `options.includeArchived?: boolean` - Include archived
- `options.includeDeleted?: boolean` - Include deleted

**Returns:** `Promise<ConversationListResult>` - Paginated result

**Example:**
```typescript
const result = await memoryService.listConversations({
  agentId: 'backend',
  limit: 10,
  offset: 0,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  includeArchived: false,
  includeDeleted: false
});

console.log(`Found ${result.total} conversations`);
console.log(`Showing ${result.conversations.length}`);
console.log(`Has more: ${result.hasMore}`);
```

---

#### `getRecentConversations(agentId?: string, limit: number = 10): Promise<Conversation[]>`

Get recent conversations (shorthand method).

**Parameters:**
- `agentId?: string` - Optional agent filter
- `limit: number` - Max results (default: 10)

**Returns:** `Promise<Conversation[]>` - Recent conversations

**Example:**
```typescript
const recent = await memoryService.getRecentConversations('backend', 5);
```

---

#### `searchConversationsByTitle(query: string, limit: number = 10): Promise<Conversation[]>`

Search conversations by title.

**Parameters:**
- `query: string` - Search query
- `limit: number` - Max results (default: 10)

**Returns:** `Promise<Conversation[]>` - Matching conversations

**Example:**
```typescript
const conversations = await memoryService.searchConversationsByTitle('API');
```

---

### Message Operations

#### `addMessage(data: CreateMessage): Promise<Message>`

Add message to conversation.

**Parameters:**
- `data.conversationId: string` - Conversation ID (required)
- `data.role: 'user' | 'assistant' | 'system'` - Message role (required)
- `data.content: string` - Message content (required)
- `data.tokens?: number` - Token count (optional)
- `data.metadata?: Record<string, string>` - Additional metadata (optional)

**Returns:** `Promise<Message>` - Created message with generated ID

**Example:**
```typescript
const message = await memoryService.addMessage({
  conversationId: 'conv-uuid',
  role: 'user',
  content: 'How do I create a REST API?',
  tokens: 10,
  metadata: { language: 'en' }
});
```

---

#### `getMessage(id: string): Promise<Message | null>`

Get message by ID.

**Parameters:**
- `id: string` - Message ID (UUID)

**Returns:** `Promise<Message | null>` - Message or null

**Example:**
```typescript
const message = await memoryService.getMessage('msg-uuid');
```

---

#### `updateMessage(id: string, content: string, tokens?: number): Promise<Message>`

Update message content.

**Parameters:**
- `id: string` - Message ID
- `content: string` - New content
- `tokens?: number` - Updated token count

**Returns:** `Promise<Message>` - Updated message

**Example:**
```typescript
const updated = await memoryService.updateMessage('msg-uuid', 'Updated content', 12);
```

---

#### `deleteMessage(id: string): Promise<boolean>`

Delete message.

**Parameters:**
- `id: string` - Message ID

**Returns:** `Promise<boolean>` - True if deleted successfully

**Example:**
```typescript
await memoryService.deleteMessage('msg-uuid');
```

---

#### `listMessages(options: MessageListOptions): Promise<MessageListResult>`

List messages with filters and pagination.

**Parameters:**
- `options.conversationId: string` - Conversation ID (required)
- `options.role?: 'user' | 'assistant' | 'system'` - Filter by role
- `options.limit: number` - Max results (1-100)
- `options.offset: number` - Skip N results
- `options.sortBy: 'createdAt'` - Sort field
- `options.sortOrder: 'asc' | 'desc'` - Sort direction

**Returns:** `Promise<MessageListResult>` - Paginated result

**Example:**
```typescript
const result = await memoryService.listMessages({
  conversationId: 'conv-uuid',
  limit: 50,
  offset: 0,
  sortBy: 'createdAt',
  sortOrder: 'asc'
});
```

---

#### `getMessagesByConversation(conversationId: string, limit: number = 100): Promise<Message[]>`

Get messages for a conversation (shorthand method).

**Parameters:**
- `conversationId: string` - Conversation ID
- `limit: number` - Max results (default: 100)

**Returns:** `Promise<Message[]>` - Messages

**Example:**
```typescript
const messages = await memoryService.getMessagesByConversation('conv-uuid', 50);
```

---

### Search Operations

#### `searchMessages(options: MemorySearchOptions): Promise<MemorySearchResult>`

Full-text search using SQLite FTS5.

**Parameters:**
- `options.query: string` - Search query (FTS5 syntax)
- `options.conversationId?: string` - Filter by conversation
- `options.agentId?: string` - Filter by agent
- `options.userId?: string` - Filter by user
- `options.role?: string` - Filter by message role
- `options.limit: number` - Max results (1-100)
- `options.offset: number` - Skip N results
- `options.sortBy: 'relevance' | 'createdAt'` - Sort field
- `options.sortOrder: 'asc' | 'desc'` - Sort direction
- `options.includeArchived?: boolean` - Include archived conversations
- `options.includeDeleted?: boolean` - Include deleted conversations

**Returns:** `Promise<MemorySearchResult>` - Search result with messages and conversations

**Example:**
```typescript
const result = await memoryService.searchMessages({
  query: 'REST API',
  agentId: 'backend',
  limit: 10,
  offset: 0,
  sortBy: 'relevance',
  sortOrder: 'desc',
  includeArchived: false,
  includeDeleted: false
});

console.log(`Found ${result.total} messages`);
for (const msg of result.messages) {
  console.log(`[${msg.role}] ${msg.content}`);
}
```

**FTS5 Query Syntax:**
```typescript
// Simple search
query: 'API'

// Boolean operators
query: 'API AND authentication'
query: 'REST OR GraphQL'
query: 'database NOT postgres'

// Phrase search
query: '"REST API design"'

// Prefix search
query: 'auth*'
```

---

#### `searchMessagesByQuery(query: string, conversationId?: string, limit: number = 10): Promise<Message[]>`

Simple search (shorthand method).

**Parameters:**
- `query: string` - Search query
- `conversationId?: string` - Optional conversation filter
- `limit: number` - Max results (default: 10)

**Returns:** `Promise<Message[]>` - Matching messages

**Example:**
```typescript
const messages = await memoryService.searchMessagesByQuery('authentication');
```

---

### Statistics Operations

#### `getMessageCount(conversationId: string): Promise<number>`

Get message count for conversation.

**Parameters:**
- `conversationId: string` - Conversation ID

**Returns:** `Promise<number>` - Message count

**Example:**
```typescript
const count = await memoryService.getMessageCount('conv-uuid');
```

---

#### `getTotalTokens(conversationId: string): Promise<number>`

Get total tokens for conversation.

**Parameters:**
- `conversationId: string` - Conversation ID

**Returns:** `Promise<number>` - Total tokens

**Example:**
```typescript
const tokens = await memoryService.getTotalTokens('conv-uuid');
```

---

#### `getConversationCountByState(state: string): Promise<number>`

Get conversation count by state.

**Parameters:**
- `state: string` - State filter (active/idle/archived/deleted)

**Returns:** `Promise<number>` - Count

**Example:**
```typescript
const activeCount = await memoryService.getConversationCountByState('active');
```

---

#### `getMemoryStats(): Promise<MemoryStats>`

Get overall memory system statistics.

**Returns:** `Promise<MemoryStats>` - System statistics

**Example:**
```typescript
const stats = await memoryService.getMemoryStats();

console.log(`Total conversations: ${stats.totalConversations}`);
console.log(`Active conversations: ${stats.activeConversations}`);
console.log(`Total messages: ${stats.totalMessages}`);
console.log(`Total tokens: ${stats.totalTokens}`);
console.log(`Avg messages/conversation: ${stats.averageMessagesPerConversation}`);
console.log(`Avg tokens/message: ${stats.averageTokensPerMessage}`);
```

---

### Bulk Operations

#### `deleteConversationMessages(conversationId: string): Promise<number>`

Delete all messages in a conversation.

**Parameters:**
- `conversationId: string` - Conversation ID

**Returns:** `Promise<number>` - Number of deleted messages

**Example:**
```typescript
const deleted = await memoryService.deleteConversationMessages('conv-uuid');
console.log(`Deleted ${deleted} messages`);
```

---

#### `exportConversation(conversationId: string): Promise<ConversationWithMessages | null>`

Export conversation with messages.

**Parameters:**
- `conversationId: string` - Conversation ID

**Returns:** `Promise<ConversationWithMessages | null>` - Conversation with messages

**Example:**
```typescript
const exported = await memoryService.exportConversation('conv-uuid');
```

---

#### `exportAgentConversations(agentId: string, includeMessages: boolean = true): Promise<Array<Conversation | ConversationWithMessages>>`

Export all conversations for an agent.

**Parameters:**
- `agentId: string` - Agent ID
- `includeMessages: boolean` - Include messages (default: true)

**Returns:** `Promise<Array<Conversation | ConversationWithMessages>>` - Exported conversations

**Example:**
```typescript
const conversations = await memoryService.exportAgentConversations('backend', true);
console.log(`Exported ${conversations.length} conversations`);
```

---

## ConversationManager API

Manages active conversation sessions with LRU eviction and automatic cleanup.

### Constructor

```typescript
constructor(
  memoryService: MemoryService,
  options?: {
    maxConversations?: number;  // Default: 100
    inactivityThreshold?: number; // Default: 30 minutes
    cleanupInterval?: number; // Default: 5 minutes
  }
)
```

**Example:**
```typescript
const manager = new ConversationManager(memoryService, {
  maxConversations: 50,
  inactivityThreshold: 15 * 60 * 1000, // 15 minutes
  cleanupInterval: 2 * 60 * 1000 // 2 minutes
});
```

---

### Session Management

#### `async startConversation(data: CreateConversation): Promise<Conversation>`

Start new conversation session.

**Returns:** `Promise<Conversation>` - Started conversation

**Example:**
```typescript
const conversation = await manager.startConversation({
  agentId: 'backend',
  title: 'New Session'
});
```

---

#### `async resumeConversation(conversationId: string): Promise<ConversationWithMessages | null>`

Resume existing conversation.

**Returns:** `Promise<ConversationWithMessages | null>` - Conversation with messages

**Example:**
```typescript
const conversation = await manager.resumeConversation('conv-uuid');
```

---

#### `async endConversation(conversationId: string): Promise<void>`

End conversation session.

**Example:**
```typescript
await manager.endConversation('conv-uuid');
```

---

#### `getActiveConversation(conversationId: string): Conversation | null`

Get active conversation from memory.

**Example:**
```typescript
const conversation = manager.getActiveConversation('conv-uuid');
```

---

#### `getStatistics(): ConversationManagerStats`

Get manager statistics.

**Example:**
```typescript
const stats = manager.getStatistics();
console.log(`Active: ${stats.activeConversations}`);
console.log(`Total started: ${stats.totalConversationsStarted}`);
```

---

#### `destroy(): void`

Cleanup and destroy manager.

**Example:**
```typescript
manager.destroy();
```

---

## MemoryCache API

LRU cache with TTL support for conversations, messages, and search results.

### Constructor

```typescript
constructor(options?: {
  maxSize?: number;      // Default: 1000
  ttlMs?: number;        // Default: 5 minutes
})
```

**Example:**
```typescript
const cache = new MemoryCache({
  maxSize: 500,
  ttlMs: 10 * 60 * 1000 // 10 minutes
});
```

---

### Conversation Cache

#### `getConversation(id: string): Conversation | null`
#### `setConversation(id: string, conversation: Conversation): void`
#### `deleteConversation(id: string): void`

**Example:**
```typescript
cache.setConversation('conv-uuid', conversation);
const cached = cache.getConversation('conv-uuid');
cache.deleteConversation('conv-uuid');
```

---

### Message Cache

#### `getMessage(id: string): Message | null`
#### `setMessage(id: string, message: Message): void`
#### `deleteMessage(id: string): void`

**Example:**
```typescript
cache.setMessage('msg-uuid', message);
const cached = cache.getMessage('msg-uuid');
cache.deleteMessage('msg-uuid');
```

---

### Search Results Cache

#### `getSearchResults(query: string): Message[] | null`
#### `setSearchResults(query: string, results: Message[]): void`

**Example:**
```typescript
cache.setSearchResults('REST API', messages);
const cached = cache.getSearchResults('REST API');
```

---

### Cache Management

#### `clear(): void`

Clear all caches.

**Example:**
```typescript
cache.clear();
```

---

#### `clearExpired(): void`

Remove expired entries.

**Example:**
```typescript
cache.clearExpired();
```

---

#### `getStats(): CacheStats`

Get cache statistics.

**Example:**
```typescript
const stats = cache.getStats();
console.log(`Hits: ${stats.hits}`);
console.log(`Misses: ${stats.misses}`);
console.log(`Hit rate: ${stats.hitRate.toFixed(2)}%`);
console.log(`Size: ${stats.size}`);
```

---

#### `resetStats(): void`

Reset statistics.

**Example:**
```typescript
cache.resetStats();
```

---

## MemoryAnalytics API

Track memory system usage and provide insights.

### Constructor

```typescript
constructor(memoryService: MemoryService, maxEvents: number = 10000)
```

**Example:**
```typescript
const analytics = new MemoryAnalytics(memoryService, 5000);
```

---

### Event Tracking

#### `trackEvent(event: AnalyticsEvent): void`

Track custom event.

**Example:**
```typescript
analytics.trackEvent({
  eventType: 'conversation_created',
  conversationId: 'conv-uuid',
  agentId: 'backend',
  timestamp: Date.now()
});
```

---

#### `trackConversationCreated(conversationId: string, agentId: string): void`
#### `trackMessageAdded(conversationId: string, agentId: string, tokens?: number): void`
#### `trackSearchPerformed(query: string, resultCount: number): void`
#### `trackConversationArchived(conversationId: string, agentId: string): void`
#### `trackConversationDeleted(conversationId: string, agentId: string): void`

**Example:**
```typescript
analytics.trackConversationCreated('conv-uuid', 'backend');
analytics.trackMessageAdded('conv-uuid', 'backend', 50);
analytics.trackSearchPerformed('REST API', 10);
```

---

### Conversation Metrics

#### `async getConversationMetrics(conversationId: string): Promise<ConversationMetrics | null>`

Get metrics for specific conversation.

**Example:**
```typescript
const metrics = await analytics.getConversationMetrics('conv-uuid');
if (metrics) {
  console.log(`Messages: ${metrics.messageCount}`);
  console.log(`Tokens: ${metrics.totalTokens}`);
  console.log(`Duration: ${metrics.durationMs}ms`);
}
```

---

#### `async getTopConversationsByMessages(limit: number = 10): Promise<ConversationMetrics[]>`
#### `async getTopConversationsByTokens(limit: number = 10): Promise<ConversationMetrics[]>`

**Example:**
```typescript
const topByMessages = await analytics.getTopConversationsByMessages(5);
const topByTokens = await analytics.getTopConversationsByTokens(5);
```

---

### Agent Metrics

#### `async getAgentMetrics(agentId: string): Promise<AgentMetrics>`

Get metrics for specific agent.

**Example:**
```typescript
const metrics = await analytics.getAgentMetrics('backend');
console.log(`Conversations: ${metrics.conversationCount}`);
console.log(`Total messages: ${metrics.totalMessages}`);
console.log(`Total tokens: ${metrics.totalTokens}`);
```

---

#### `async getAllAgentMetrics(): Promise<AgentMetrics[]>`

Get metrics for all agents.

**Example:**
```typescript
const allMetrics = await analytics.getAllAgentMetrics();
```

---

### Time Range Metrics

#### `async getTimeRangeMetrics(startTime: number, endTime: number): Promise<TimeRangeMetrics>`
#### `async getDailyMetrics(date: Date = new Date()): Promise<TimeRangeMetrics>`
#### `async getWeeklyMetrics(date: Date = new Date()): Promise<TimeRangeMetrics>`
#### `async getMonthlyMetrics(date: Date = new Date()): Promise<TimeRangeMetrics>`

**Example:**
```typescript
const daily = await analytics.getDailyMetrics();
console.log(`Today: ${daily.conversationCount} conversations`);
console.log(`Peak hour: ${daily.peakHour}`);

const weekly = await analytics.getWeeklyMetrics();
const monthly = await analytics.getMonthlyMetrics();
```

---

### Memory Usage

#### `async getMemoryUsageMetrics(): Promise<MemoryUsageMetrics>`

Get overall memory usage metrics.

**Example:**
```typescript
const usage = await analytics.getMemoryUsageMetrics();
console.log(`Storage estimate: ${usage.storageEstimateMB} MB`);
```

---

### Event Analytics

#### `getEventCounts(): Record<string, number>`
#### `getEventsInRange(startTime: number, endTime: number): AnalyticsEvent[]`
#### `getRecentEvents(limit: number = 100): AnalyticsEvent[]`
#### `clearEvents(): void`
#### `exportEvents(): string`

**Example:**
```typescript
const counts = analytics.getEventCounts();
console.log(JSON.stringify(counts, null, 2));

const recent = analytics.getRecentEvents(50);
const eventsJson = analytics.exportEvents();
```

---

## MemoryExporter API

Export and import memory data in multiple formats.

### Constructor

```typescript
constructor(memoryService: MemoryService)
```

**Example:**
```typescript
const exporter = new MemoryExporter(memoryService);
```

---

### Export Operations

#### `async exportToJSON(filePath: string, options?: MemoryExportOptions): Promise<ExportResult>`
#### `async exportToCSV(filePath: string, options?: MemoryExportOptions): Promise<ExportResult>`
#### `async exportToMarkdown(filePath: string, options?: MemoryExportOptions): Promise<ExportResult>`

**Example:**
```typescript
// Export to JSON
const jsonResult = await exporter.exportToJSON('/path/to/export.json', {
  agentId: 'backend',
  includeArchived: true
});

// Export to CSV
const csvResult = await exporter.exportToCSV('/path/to/export.csv');

// Export to Markdown
const mdResult = await exporter.exportToMarkdown('/path/to/export.md');

console.log(`Exported ${jsonResult.conversationCount} conversations`);
console.log(`File size: ${jsonResult.sizeBytes} bytes`);
```

---

#### `async export(filePath: string, format: 'json' | 'csv' | 'markdown' = 'json', options?: MemoryExportOptions): Promise<ExportResult>`

Generic export method.

**Example:**
```typescript
const result = await exporter.export('/path/to/export.json', 'json', {
  agentId: 'backend',
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
  endDate: Date.now()
});
```

---

### Import Operations

#### `async importFromJSON(filePath: string): Promise<ImportResult>`
#### `async import(filePath: string): Promise<ImportResult>`

**Example:**
```typescript
const result = await exporter.importFromJSON('/path/to/import.json');
console.log(`Imported ${result.conversationsImported} conversations`);
console.log(`Imported ${result.messagesImported} messages`);
if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}
```

---

### Backup and Restore

#### `async createBackup(filePath: string): Promise<ExportResult>`
#### `async restoreBackup(filePath: string): Promise<ImportResult>`

**Example:**
```typescript
// Create full backup
const backup = await exporter.createBackup('/path/to/backup.json');

// Restore from backup
const restore = await exporter.restoreBackup('/path/to/backup.json');
```

---

### Specialized Export

#### `async exportConversation(conversationId: string, filePath: string, format: 'json' | 'markdown' = 'json'): Promise<ExportResult>`
#### `async exportAgentConversations(agentId: string, filePath: string, format: 'json' | 'markdown' = 'json'): Promise<ExportResult>`
#### `async exportUserConversations(userId: string, filePath: string, format: 'json' | 'markdown' = 'json'): Promise<ExportResult>`
#### `async exportByDateRange(startDate: number, endDate: number, filePath: string, format: 'json' | 'markdown' = 'json'): Promise<ExportResult>`

**Example:**
```typescript
// Export single conversation
await exporter.exportConversation('conv-uuid', '/path/to/conv.json');

// Export all conversations for agent
await exporter.exportAgentConversations('backend', '/path/to/backend.json');

// Export by date range
const lastWeek = Date.now() - 7 * 24 * 60 * 60 * 1000;
await exporter.exportByDateRange(lastWeek, Date.now(), '/path/to/recent.json');
```

---

## ConversationDAO API

Low-level database access for conversations table.

### Constructor

```typescript
constructor(db: Database)
```

---

### CRUD Operations

#### `create(data: CreateConversation): Conversation`
#### `getById(id: string): Conversation | null`
#### `update(data: UpdateConversation): Conversation`
#### `delete(id: string): boolean`
#### `permanentlyDelete(id: string): boolean`

**Example:**
```typescript
const dao = new ConversationDAO(db);

const conversation = dao.create({
  agentId: 'backend',
  title: 'Test'
});

const retrieved = dao.getById(conversation.id);
dao.delete(conversation.id);
```

---

### Query Operations

#### `getByAgent(agentId: string, limit: number): Conversation[]`
#### `getByUser(userId: string, limit: number): Conversation[]`
#### `getByState(state: string, limit: number): Conversation[]`
#### `searchByTitle(query: string, limit: number): Conversation[]`

---

### List and Pagination

#### `list(options: ConversationListOptions): ConversationListResult`

---

### State Management

#### `archive(id: string): boolean`
#### `restore(id: string): boolean`
#### `setState(id: string, state: string): boolean`

---

### Statistics

#### `getCountByAgent(agentId: string): number`
#### `getCountByState(state: string): number`
#### `getTotalCount(): number`

---

### Associations

#### `getWithMessages(id: string): ConversationWithMessages | null`
#### `incrementMessageCount(id: string, tokens: number): void`

---

## MessageDAO API

Low-level database access for messages table.

### Constructor

```typescript
constructor(db: Database)
```

---

### CRUD Operations

#### `create(data: CreateMessage): Message`
#### `getById(id: string): Message | null`
#### `update(id: string, content: string, tokens?: number): Message`
#### `delete(id: string): boolean`

**Example:**
```typescript
const dao = new MessageDAO(db);

const message = dao.create({
  conversationId: 'conv-uuid',
  role: 'user',
  content: 'Hello'
});

const retrieved = dao.getById(message.id);
dao.delete(message.id);
```

---

### Query Operations

#### `getByConversation(conversationId: string, limit: number): Message[]`
#### `getRecent(limit: number): Message[]`

---

### List and Pagination

#### `list(options: MessageListOptions): MessageListResult`

---

### Search Operations

#### `search(options: MemorySearchOptions): MemorySearchResult`

FTS5 full-text search with conversation metadata.

---

### Statistics

#### `getCountByConversation(conversationId: string): number`
#### `getTotalTokensByConversation(conversationId: string): number`

---

### Bulk Operations

#### `deleteByConversation(conversationId: string): number`

---

## CLI Commands

Command-line interface for memory management.

### `ax memory search <query>`

Search conversation history using full-text search.

**Options:**
- `-l, --limit <number>` - Limit results (default: 10)
- `-a, --agent <agent>` - Filter by agent ID
- `-u, --user <user>` - Filter by user ID
- `-v, --verbose` - Show full message content

**Examples:**
```bash
# Simple search
ax memory search "REST API"

# Filter by agent
ax memory search "authentication" --agent backend

# Show more results
ax memory search "database" --limit 20 --verbose
```

---

### `ax memory list`

List recent conversations.

**Options:**
- `-a, --agent <agent>` - Filter by agent ID
- `-u, --user <user>` - Filter by user ID
- `-s, --state <state>` - Filter by state (idle/active/archived)
- `-l, --limit <number>` - Limit results (default: 10)
- `--archived` - Include archived conversations
- `--json` - Output as JSON

**Examples:**
```bash
# List recent conversations
ax memory list

# Filter by agent
ax memory list --agent backend

# Include archived
ax memory list --archived --limit 20

# JSON output
ax memory list --json
```

---

### `ax memory show <conversation-id>`

Show conversation details with messages.

**Options:**
- `-l, --limit <number>` - Limit messages shown (default: 100)
- `--json` - Output as JSON

**Examples:**
```bash
# Show conversation
ax memory show conv-uuid-123

# Limit messages
ax memory show conv-uuid-123 --limit 10

# JSON output
ax memory show conv-uuid-123 --json
```

---

### `ax memory export`

Export conversations to file.

**Options:**
- `-o, --output <file>` - Output file (default: memory-export.json)
- `-f, --format <format>` - Format: json, csv, markdown (default: json)
- `-a, --agent <agent>` - Filter by agent ID
- `-u, --user <user>` - Filter by user ID
- `--archived` - Include archived conversations
- `--deleted` - Include deleted conversations

**Examples:**
```bash
# Export to JSON
ax memory export --output backup.json

# Export to CSV
ax memory export --format csv --output export.csv

# Export specific agent
ax memory export --agent backend --output backend.json

# Include archived
ax memory export --archived --output full-backup.json

# Export to Markdown
ax memory export --format markdown --output conversations.md
```

---

### `ax memory stats`

Show memory system statistics.

**Options:**
- `-v, --verbose` - Show detailed statistics

**Examples:**
```bash
# Basic statistics
ax memory stats

# Detailed statistics
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
```

---

## Type Definitions

### Core Types

```typescript
// Conversation
interface Conversation {
  id: string;
  agentId: string;
  userId: string | null;
  title: string;
  state: 'idle' | 'active' | 'archived' | 'deleted';
  messageCount: number;
  totalTokens: number;
  metadata: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  deletedAt: number | null;
}

// Message
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens: number | null;
  metadata: Record<string, string>;
  createdAt: number;
}

// Conversation with messages
interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
```

---

### Create/Update Types

```typescript
interface CreateConversation {
  agentId: string;
  userId?: string;
  title: string;
  metadata?: Record<string, string>;
}

interface CreateMessage {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  metadata?: Record<string, string>;
}
```

---

### Query Options

```typescript
interface ConversationListOptions {
  agentId?: string;
  userId?: string;
  state?: string;
  limit: number;        // 1-100
  offset: number;
  sortBy: 'createdAt' | 'updatedAt' | 'title';
  sortOrder: 'asc' | 'desc';
  includeArchived?: boolean;
  includeDeleted?: boolean;
}

interface MessageListOptions {
  conversationId: string;
  role?: 'user' | 'assistant' | 'system';
  limit: number;        // 1-100
  offset: number;
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
}

interface MemorySearchOptions {
  query: string;
  conversationId?: string;
  agentId?: string;
  userId?: string;
  role?: string;
  limit: number;        // 1-100
  offset: number;
  sortBy: 'relevance' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  includeArchived?: boolean;
  includeDeleted?: boolean;
}
```

---

### Result Types

```typescript
interface ConversationListResult {
  conversations: Conversation[];
  total: number;
  hasMore: boolean;
}

interface MessageListResult {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

interface MemorySearchResult {
  messages: Message[];
  conversations: Conversation[];
  total: number;
  hasMore: boolean;
}
```

---

### Statistics Types

```typescript
interface MemoryStats {
  totalConversations: number;
  activeConversations: number;
  archivedConversations: number;
  deletedConversations: number;
  totalMessages: number;
  totalTokens: number;
  averageMessagesPerConversation: number;
  averageTokensPerMessage: number;
  oldestConversation?: number;
  newestConversation?: number;
}

interface ConversationMetrics {
  conversationId: string;
  agentId: string;
  messageCount: number;
  totalTokens: number;
  durationMs: number;
  averageTokensPerMessage: number;
  createdAt: number;
  lastActivityAt: number;
}

interface AgentMetrics {
  agentId: string;
  conversationCount: number;
  totalMessages: number;
  totalTokens: number;
  averageMessagesPerConversation: number;
  averageTokensPerMessage: number;
  averageConversationDuration: number;
}

interface TimeRangeMetrics {
  startTime: number;
  endTime: number;
  conversationCount: number;
  messageCount: number;
  totalTokens: number;
  activeAgents: string[];
  peakHour: number | null;
}
```

---

### Export Types

```typescript
interface MemoryExportOptions {
  conversationId?: string;
  agentId?: string;
  userId?: string;
  startDate?: number;
  endDate?: number;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  format?: 'json' | 'csv' | 'markdown';
}

interface ExportResult {
  filePath: string;
  format: 'json' | 'csv' | 'markdown';
  conversationCount: number;
  messageCount: number;
  exportedAt: number;
  sizeBytes: number;
}

interface ImportResult {
  conversationsImported: number;
  messagesImported: number;
  errors: string[];
}

interface MemoryExport {
  conversations: ConversationWithMessages[];
  exportedAt: number;
  exportOptions: MemoryExportOptions;
  stats: MemoryStats;
}
```

---

### Cache Types

```typescript
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  conversationCacheSize: number;
  messageCacheSize: number;
  searchCacheSize: number;
}
```

---

### Analytics Types

```typescript
interface AnalyticsEvent {
  eventType: 'conversation_created' | 'message_added' | 'search_performed' | 'conversation_archived' | 'conversation_deleted';
  conversationId?: string;
  agentId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

---

## Error Handling

All async methods may throw the following errors:

```typescript
try {
  const conversation = await memoryService.createConversation(data);
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT') {
    console.error('Constraint violation:', error.message);
  } else if (error.code === 'SQLITE_ERROR') {
    console.error('Database error:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

**Common Error Codes:**
- `SQLITE_CONSTRAINT` - Foreign key or unique constraint violation
- `SQLITE_ERROR` - General SQL error
- `SQLITE_NOTFOUND` - Query returned no results
- `TypeError` - Invalid parameter type
- `RangeError` - Parameter out of valid range

---

## Performance Tips

1. **Use caching** - MemoryCache provides 10-100x speedup for repeated queries
2. **Limit results** - Use appropriate limit values (10-50 for UI, 100 for bulk)
3. **Batch operations** - Group multiple operations together
4. **Index usage** - Database has indexes on conversationId, agentId, userId
5. **FTS5 optimization** - Use specific queries instead of `*` wildcard

---

## Best Practices

1. **Always specify limits** - Protect against unbounded result sets
2. **Use pagination** - For large result sets, use offset/limit
3. **Cache aggressively** - Cache frequently accessed conversations
4. **Track analytics** - Use MemoryAnalytics for insights
5. **Regular exports** - Create backups using MemoryExporter
6. **Monitor statistics** - Use getMemoryStats() to track system health
7. **Clean up inactive** - Archive or delete old conversations periodically

---

## Migration Guide

### From Direct DAO Usage to MemoryService

**Before:**
```typescript
const dao = new ConversationDAO(db);
const conversation = dao.create(data);
```

**After:**
```typescript
const service = new MemoryService(db);
const conversation = await service.createConversation(data);
```

### Adding Caching

```typescript
// Create cache
const cache = new MemoryCache();

// Wrap service calls
let conversation = cache.getConversation(id);
if (!conversation) {
  conversation = await service.getConversation(id);
  if (conversation) {
    cache.setConversation(id, conversation);
  }
}
```

### Adding Analytics

```typescript
const analytics = new MemoryAnalytics(service);

// Track events
const conversation = await service.createConversation(data);
analytics.trackConversationCreated(conversation.id, conversation.agentId);

// Get insights
const metrics = await analytics.getAgentMetrics('backend');
```

---

## Version History

- **v2.0.0** (Phase 1 Week 3) - CLI commands, API documentation, user guide
- **v2.0.0-alpha.2** (Phase 1 Week 2) - Service layer (MemoryService, ConversationManager, MemoryCache, MemoryAnalytics, MemoryExporter)
- **v2.0.0-alpha.1** (Phase 1 Week 1) - Database foundation (schema, DAOs, migrations)

---

## Support

For issues, questions, or feature requests:
- GitHub: https://github.com/defai-digital/automatosx
- Documentation: `automatosx/PRD/memory-user-guide.md`
- Examples: `examples/memory-examples.ts`
