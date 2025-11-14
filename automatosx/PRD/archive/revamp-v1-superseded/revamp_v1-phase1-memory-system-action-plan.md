# Phase 1: Memory System - Action Plan

**Duration:** 4 weeks (November 10 - December 7, 2025)
**Phase:** Migration Phase 1 of 5
**Goal:** Integrate v1 memory system with v2 database infrastructure

---

## Phase Overview

### Objectives

1. Design and implement memory database schema (conversations, messages, agent_state)
2. Create MemoryService with SQLite FTS5 full-text search
3. Build ConversationManager for session management
4. Integrate memory API with v2 database connection
5. Write 30+ comprehensive tests
6. Document memory API and usage patterns

### Success Criteria

- ✅ Memory searches return results in <1ms (cached) / <5ms (uncached)
- ✅ Conversation CRUD operations working
- ✅ FTS5 search across conversation history functional
- ✅ 100% test pass rate for all new tests
- ✅ No regression in existing v2 tests (245+ tests still passing)
- ✅ Complete API documentation

---

## Week 1: Database Schema & Migrations

### Day 1-2: Schema Design & Implementation

**Tasks:**

1. **Create Migration 008: Memory System Tables**
   - File: `src/migrations/008_create_memory_system.sql`
   - Tables: conversations, messages, messages_fts, agents, agent_state, workflows

```sql
-- Example schema (detailed in migration file)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER,
  provider TEXT,
  created_at INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- Triggers for FTS5 sync
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  UPDATE messages_fts SET content = new.content WHERE rowid = new.rowid;
END;
```

2. **Define Zod Schemas**
   - File: `src/types/schemas/memory.schema.ts`
   - Schemas: ConversationSchema, MessageSchema, AgentSchema, AgentStateSchema

```typescript
import { z } from 'zod';

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string().min(1),
  tokens: z.number().int().positive().optional(),
  provider: z.enum(['claude', 'gemini', 'openai']).optional(),
  createdAt: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  userId: z.string().optional(),
  title: z.string().min(1).max(200),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
```

3. **Update Database Connection**
   - File: `src/database/connection.ts`
   - Add migrations check for 008_create_memory_system.sql

**Deliverables:**
- ✅ Migration 008 SQL file
- ✅ Zod schemas for memory types
- ✅ Updated database connection with migration support
- ✅ Manual migration test (run migration, verify schema)

**Tests to Write:**
- Migration applies cleanly
- Tables created with correct schema
- FTS5 triggers working
- Foreign key constraints enforced

---

### Day 3-4: DAO Layer Implementation

**Tasks:**

1. **Create ConversationDAO**
   - File: `src/database/dao/ConversationDAO.ts`
   - Methods: create, findById, findByAgentId, findByUserId, update, delete, list

```typescript
import type { Database } from 'better-sqlite3';
import type { Conversation } from '../../types/schemas/memory.schema.js';

export class ConversationDAO {
  constructor(private db: Database) {}

  create(conversation: Conversation): void {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, agent_id, user_id, title, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      conversation.id,
      conversation.agentId,
      conversation.userId || null,
      conversation.title,
      conversation.createdAt,
      conversation.updatedAt,
      conversation.metadata ? JSON.stringify(conversation.metadata) : null
    );
  }

  findById(id: string): Conversation | null {
    const stmt = this.db.prepare(`
      SELECT id, agent_id, user_id, title, created_at, updated_at, metadata
      FROM conversations
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    return row ? this.mapRowToConversation(row) : null;
  }

  findByAgentId(agentId: string, limit = 10): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT id, agent_id, user_id, title, created_at, updated_at, metadata
      FROM conversations
      WHERE agent_id = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(agentId, limit) as any[];
    return rows.map(row => this.mapRowToConversation(row));
  }

  private mapRowToConversation(row: any): Conversation {
    return {
      id: row.id,
      agentId: row.agent_id,
      userId: row.user_id || undefined,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
```

2. **Create MessageDAO**
   - File: `src/database/dao/MessageDAO.ts`
   - Methods: create, findById, findByConversationId, search (FTS5), delete, count

```typescript
export class MessageDAO {
  constructor(private db: Database) {}

  create(message: Message): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, tokens, provider, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.conversationId,
      message.role,
      message.content,
      message.tokens || null,
      message.provider || null,
      message.createdAt,
      message.metadata ? JSON.stringify(message.metadata) : null
    );
  }

  findByConversationId(conversationId: string, limit = 100): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, conversation_id, role, content, tokens, provider, created_at, metadata
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT ?
    `);

    const rows = stmt.all(conversationId, limit) as any[];
    return rows.map(row => this.mapRowToMessage(row));
  }

  search(query: string, limit = 10): Message[] {
    const stmt = this.db.prepare(`
      SELECT m.id, m.conversation_id, m.role, m.content, m.tokens, m.provider, m.created_at, m.metadata
      FROM messages_fts fts
      JOIN messages m ON m.rowid = fts.rowid
      WHERE messages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(query, limit) as any[];
    return rows.map(row => this.mapRowToMessage(row));
  }

  private mapRowToMessage(row: any): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      tokens: row.tokens || undefined,
      provider: row.provider || undefined,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
```

3. **Create AgentDAO**
   - File: `src/database/dao/AgentDAO.ts`
   - Methods: create, findById, list, update, delete, findByCategory

**Deliverables:**
- ✅ ConversationDAO with full CRUD
- ✅ MessageDAO with FTS5 search
- ✅ AgentDAO with query methods
- ✅ TypeScript types for all entities

**Tests to Write:**
- ConversationDAO CRUD operations (5 tests)
- MessageDAO CRUD operations (5 tests)
- MessageDAO FTS5 search (3 tests)
- AgentDAO operations (4 tests)

---

### Day 5: DAO Testing

**Tasks:**

1. **Write DAO Tests**
   - File: `src/database/dao/__tests__/ConversationDAO.test.ts`
   - File: `src/database/dao/__tests__/MessageDAO.test.ts`
   - File: `src/database/dao/__tests__/AgentDAO.test.ts`

2. **Test Coverage:**
   - Basic CRUD operations
   - Foreign key constraint violations
   - FTS5 search accuracy
   - Edge cases (empty results, large datasets)
   - Performance (queries <5ms)

**Deliverables:**
- ✅ 17+ DAO tests passing
- ✅ 100% code coverage for DAOs

---

## Week 2: Service Layer Implementation

### Day 6-7: MemoryService Core

**Tasks:**

1. **Create MemoryService**
   - File: `src/memory/MemoryService.ts`
   - Methods: createConversation, getConversation, addMessage, searchMessages, getRecentConversations

```typescript
import { ConversationDAO } from '../database/dao/ConversationDAO.js';
import { MessageDAO } from '../database/dao/MessageDAO.js';
import type { Conversation, Message } from '../types/schemas/memory.schema.js';
import { v4 as uuidv4 } from 'uuid';

export interface MemorySearchOptions {
  limit?: number;
  agentId?: string;
  dateFrom?: number;
  dateTo?: number;
}

export class MemoryService {
  private conversationDAO: ConversationDAO;
  private messageDAO: MessageDAO;

  constructor(conversationDAO: ConversationDAO, messageDAO: MessageDAO) {
    this.conversationDAO = conversationDAO;
    this.messageDAO = messageDAO;
  }

  async createConversation(agentId: string, title: string, userId?: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: uuidv4(),
      agentId,
      userId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.conversationDAO.create(conversation);
    return conversation;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const conversation = this.conversationDAO.findById(id);
    if (!conversation) return null;

    // Load messages
    const messages = this.messageDAO.findByConversationId(id);
    return {
      ...conversation,
      messages,
    };
  }

  async addMessage(conversationId: string, role: string, content: string, metadata?: Record<string, unknown>): Promise<Message> {
    const message: Message = {
      id: uuidv4(),
      conversationId,
      role: role as 'user' | 'assistant' | 'system',
      content,
      createdAt: Date.now(),
      metadata,
    };

    this.messageDAO.create(message);

    // Update conversation updated_at
    const conversation = this.conversationDAO.findById(conversationId);
    if (conversation) {
      conversation.updatedAt = Date.now();
      this.conversationDAO.update(conversation);
    }

    return message;
  }

  async searchMessages(query: string, options: MemorySearchOptions = {}): Promise<Message[]> {
    const { limit = 10 } = options;
    return this.messageDAO.search(query, limit);
  }

  async getRecentConversations(agentId?: string, limit = 10): Promise<Conversation[]> {
    if (agentId) {
      return this.conversationDAO.findByAgentId(agentId, limit);
    }
    return this.conversationDAO.list(limit);
  }
}
```

2. **Create ConversationManager**
   - File: `src/memory/ConversationManager.ts`
   - Methods: startConversation, endConversation, getActiveConversations, resumeConversation

```typescript
export class ConversationManager {
  private activeConversations: Map<string, Conversation> = new Map();
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  async startConversation(agentId: string, title: string, userId?: string): Promise<Conversation> {
    const conversation = await this.memoryService.createConversation(agentId, title, userId);
    this.activeConversations.set(conversation.id, conversation);
    return conversation;
  }

  async endConversation(conversationId: string): Promise<void> {
    this.activeConversations.delete(conversationId);
  }

  getActiveConversations(): Conversation[] {
    return Array.from(this.activeConversations.values());
  }

  async resumeConversation(conversationId: string): Promise<Conversation | null> {
    const conversation = await this.memoryService.getConversation(conversationId);
    if (conversation) {
      this.activeConversations.set(conversationId, conversation);
    }
    return conversation;
  }

  isConversationActive(conversationId: string): boolean {
    return this.activeConversations.has(conversationId);
  }
}
```

**Deliverables:**
- ✅ MemoryService with all core methods
- ✅ ConversationManager for session tracking
- ✅ Type-safe APIs with Zod validation

**Tests to Write:**
- MemoryService.createConversation (2 tests)
- MemoryService.getConversation (2 tests)
- MemoryService.addMessage (3 tests)
- MemoryService.searchMessages (4 tests)
- ConversationManager lifecycle (3 tests)

---

### Day 8-9: Advanced Memory Features

**Tasks:**

1. **Implement Memory Caching**
   - File: `src/memory/MemoryCache.ts`
   - LRU cache for frequently accessed conversations
   - Cache invalidation on updates

2. **Implement Memory Analytics**
   - File: `src/memory/MemoryAnalytics.ts`
   - Track conversation metrics (message count, token usage, duration)
   - Export analytics to telemetry system

3. **Implement Memory Export/Import**
   - File: `src/memory/MemoryExporter.ts`
   - Export conversations to JSON, Markdown
   - Import backup files

**Deliverables:**
- ✅ MemoryCache with LRU eviction
- ✅ MemoryAnalytics for tracking
- ✅ MemoryExporter for backup/restore

**Tests to Write:**
- MemoryCache hit/miss (3 tests)
- MemoryAnalytics tracking (2 tests)
- MemoryExporter export/import (3 tests)

---

### Day 10: Integration Testing

**Tasks:**

1. **Write Integration Tests**
   - File: `src/memory/__tests__/memory-integration.test.ts`
   - Test full workflows: create conversation, add messages, search, retrieve

2. **Performance Testing**
   - Benchmark memory search (<5ms uncached, <1ms cached)
   - Load testing with 1000+ conversations and 10K+ messages
   - Verify FTS5 performance

**Deliverables:**
- ✅ 10+ integration tests
- ✅ Performance benchmarks documented
- ✅ Load test results (scalability validation)

---

## Week 3: CLI and API Integration

### Day 11-12: Memory CLI Commands

**Tasks:**

1. **Implement `ax memory` Commands**
   - File: `src/cli/commands/memory.ts`
   - Commands: search, list, show, export, clear

```typescript
import { Command } from 'commander';
import { MemoryService } from '../../memory/MemoryService.js';

export function registerMemoryCommands(program: Command): void {
  const memory = program.command('memory').description('Memory and conversation management');

  memory
    .command('search')
    .description('Search conversation history')
    .argument('<query>', 'Search query')
    .option('-l, --limit <number>', 'Limit results', '10')
    .option('-a, --agent <agent>', 'Filter by agent')
    .action(async (query, options) => {
      const memoryService = getMemoryService();
      const results = await memoryService.searchMessages(query, {
        limit: parseInt(options.limit),
        agentId: options.agent,
      });

      console.log(`Found ${results.length} messages:`);
      results.forEach(msg => {
        console.log(`[${new Date(msg.createdAt).toLocaleString()}] ${msg.role}: ${msg.content.substring(0, 100)}...`);
      });
    });

  memory
    .command('list')
    .description('List recent conversations')
    .option('-a, --agent <agent>', 'Filter by agent')
    .option('-l, --limit <number>', 'Limit results', '10')
    .action(async (options) => {
      const memoryService = getMemoryService();
      const conversations = await memoryService.getRecentConversations(
        options.agent,
        parseInt(options.limit)
      );

      console.log(`Found ${conversations.length} conversations:`);
      conversations.forEach(conv => {
        console.log(`${conv.id}: ${conv.title} (${conv.agentId}) - ${new Date(conv.updatedAt).toLocaleString()}`);
      });
    });

  memory
    .command('show')
    .description('Show conversation details')
    .argument('<id>', 'Conversation ID')
    .action(async (id) => {
      const memoryService = getMemoryService();
      const conversation = await memoryService.getConversation(id);

      if (!conversation) {
        console.error(`Conversation ${id} not found`);
        return;
      }

      console.log(`Conversation: ${conversation.title}`);
      console.log(`Agent: ${conversation.agentId}`);
      console.log(`Created: ${new Date(conversation.createdAt).toLocaleString()}`);
      console.log(`\nMessages:`);

      conversation.messages?.forEach(msg => {
        console.log(`\n[${msg.role}] ${new Date(msg.createdAt).toLocaleString()}`);
        console.log(msg.content);
      });
    });

  memory
    .command('export')
    .description('Export conversations to file')
    .option('-o, --output <file>', 'Output file', 'memory-export.json')
    .option('-a, --agent <agent>', 'Filter by agent')
    .action(async (options) => {
      const memoryService = getMemoryService();
      const conversations = await memoryService.getRecentConversations(options.agent, 1000);

      fs.writeFileSync(options.output, JSON.stringify(conversations, null, 2));
      console.log(`Exported ${conversations.length} conversations to ${options.output}`);
    });
}
```

2. **Register Commands in Main CLI**
   - File: `src/cli/index.ts`
   - Add memory commands to main CLI

**Deliverables:**
- ✅ `ax memory search` command
- ✅ `ax memory list` command
- ✅ `ax memory show` command
- ✅ `ax memory export` command
- ✅ Help documentation for all commands

**Tests to Write:**
- CLI command execution (5 tests)
- Command option parsing (3 tests)
- Error handling (2 tests)

---

### Day 13-14: API Documentation

**Tasks:**

1. **Write API Documentation**
   - File: `automatosx/PRD/memory-api-reference.md`
   - Document all MemoryService methods
   - Include code examples and use cases

2. **Write User Guide**
   - File: `automatosx/PRD/memory-user-guide.md`
   - How to use memory commands
   - Best practices for conversation management
   - Troubleshooting common issues

3. **Create Code Examples**
   - File: `examples/memory-examples.ts`
   - Example usage scenarios
   - Integration patterns

**Deliverables:**
- ✅ Complete API reference documentation
- ✅ User guide with examples
- ✅ Example code snippets

---

## Week 4: Testing, Optimization & Phase Gate

### Day 15-16: Comprehensive Testing

**Tasks:**

1. **Complete Test Suite**
   - Ensure 30+ tests written and passing
   - Verify 100% code coverage for critical paths
   - Run full test suite (v2 + memory) and ensure no regressions

2. **Performance Testing**
   - Run memory search benchmarks
   - Verify <5ms uncached, <1ms cached targets
   - Load testing with 10K+ messages

3. **Error Handling Tests**
   - Test database failures
   - Test invalid inputs
   - Test edge cases

**Deliverables:**
- ✅ 30+ memory system tests passing
- ✅ Performance benchmarks met
- ✅ No regression in v2 tests (245+ still passing)

---

### Day 17-18: Optimization & Bug Fixes

**Tasks:**

1. **Performance Optimization**
   - Profile memory queries
   - Optimize FTS5 queries
   - Add database indexes if needed

2. **Bug Fixes**
   - Fix any issues found in testing
   - Address edge cases
   - Improve error messages

3. **Code Review**
   - Review all new code
   - Refactor if needed
   - Ensure code quality standards

**Deliverables:**
- ✅ All performance targets met
- ✅ Zero known bugs
- ✅ Code review complete

---

### Day 19-20: Documentation & Phase Gate Review

**Tasks:**

1. **Finalize Documentation**
   - Complete all API docs
   - Update user guides
   - Add troubleshooting section

2. **Phase Gate Review**
   - Verify all success criteria met
   - Demo memory system functionality
   - Get stakeholder sign-off

3. **Prepare for Phase 2**
   - Document lessons learned
   - Identify dependencies for Phase 2
   - Create Phase 2 kickoff plan

**Deliverables:**
- ✅ Complete documentation
- ✅ Phase gate review passed
- ✅ Ready to start Phase 2 (AI Provider Layer)

---

## Phase 1 Success Criteria Checklist

### Technical Requirements

- [ ] Migration 008 applied successfully
- [ ] 6 new database tables created (conversations, messages, messages_fts, agents, agent_state, workflows)
- [ ] FTS5 full-text search working correctly
- [ ] ConversationDAO, MessageDAO, AgentDAO implemented
- [ ] MemoryService with all core methods
- [ ] ConversationManager for session management
- [ ] MemoryCache with LRU eviction
- [ ] MemoryAnalytics for metrics tracking
- [ ] MemoryExporter for backup/restore

### CLI Requirements

- [ ] `ax memory search` command working
- [ ] `ax memory list` command working
- [ ] `ax memory show` command working
- [ ] `ax memory export` command working
- [ ] Help documentation complete

### Testing Requirements

- [ ] 30+ unit tests written and passing
- [ ] 10+ integration tests passing
- [ ] 0 regressions in v2 tests (245+ still passing)
- [ ] Performance benchmarks met (<5ms uncached, <1ms cached)
- [ ] Load testing passed (1000+ conversations, 10K+ messages)

### Documentation Requirements

- [ ] API reference documentation complete
- [ ] User guide written
- [ ] Code examples provided
- [ ] Troubleshooting guide created

### Quality Requirements

- [ ] Code review completed
- [ ] Zero P0/P1 bugs
- [ ] Code coverage >85%
- [ ] Performance targets met
- [ ] Security review passed

---

## Risks and Mitigation

### Risk 1: FTS5 Performance Issues
**Probability:** Low
**Impact:** High
**Mitigation:** Benchmark early (Day 5), optimize queries, add indexes if needed

### Risk 2: Schema Conflicts with v2
**Probability:** Low
**Impact:** High
**Mitigation:** Careful migration design, thorough testing, rollback plan

### Risk 3: Test Coverage Gaps
**Probability:** Medium
**Impact:** Medium
**Mitigation:** Write tests alongside implementation, aim for >85% coverage

### Risk 4: Schedule Slip
**Probability:** Medium
**Impact:** Medium
**Mitigation:** Daily progress tracking, adjust scope if needed, 20% buffer built in

---

## Daily Standup Template

**What I completed yesterday:**
- [Task 1]
- [Task 2]

**What I'm working on today:**
- [Task 1]
- [Task 2]

**Blockers:**
- [Blocker 1]
- [Blocker 2]

**Progress:** X% complete (vs Y% expected)

---

## Phase 1 Completion Checklist

At the end of Week 4, verify:

1. ✅ All 20 days of tasks completed
2. ✅ All deliverables produced
3. ✅ All tests passing (275+ total: 245 v2 + 30 memory)
4. ✅ Performance benchmarks met
5. ✅ Documentation complete
6. ✅ Code review and stakeholder sign-off
7. ✅ Ready to start Phase 2

**Phase Gate Approval:** ___________  Date: ___________

---

**Next Phase:** Phase 2 - AI Provider Layer (3 weeks)
**Phase 2 Start Date:** December 8, 2025
