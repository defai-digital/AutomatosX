# Day 83 Phase 4 Megathinking: Integration Tests

**Date**: 2025-11-10
**Phase**: Phase 4 - Integration Tests for Semantic Memory CLI
**Status**: Design Phase
**Methodology**: Megathinking with comprehensive research and analysis

---

## Table of Contents

1. [Context & Background](#context--background)
2. [Research Phase](#research-phase)
3. [Design Decisions](#design-decisions)
4. [Implementation Plan](#implementation-plan)
5. [Risk Assessment](#risk-assessment)
6. [Success Criteria](#success-criteria)

---

## Context & Background

### What We've Built (Phases 1-3)

**Phase 1: Database Layer (Complete)** ✅
- MessageEmbeddingDAO with vector search
- Migration 009: message_embeddings table with vec0
- FTS5 table for full-text search
- All CRUD operations validated

**Phase 2: Service Layer (Complete)** ✅
- `searchMessagesSemantic()` - vector-only search
- `searchMessagesHybrid()` - FTS5 + vector combined
- `indexExistingMessages()` - bulk embedding generation
- `getEmbeddingStats()` - coverage monitoring
- All methods tested with test-memory-service-semantic.ts

**Phase 3: CLI Integration (Complete)** ✅
- `ax memory search` with --semantic, --hybrid, --exact flags
- `ax memory index` command with progress display
- `ax memory stats` enhanced with embedding coverage
- Help text updated with examples
- ~180 lines added to memory.ts

### What Phase 4 Needs to Achieve

**Goal**: Create comprehensive integration tests that validate the entire semantic memory system end-to-end through the CLI interface.

**Key Requirements**:
1. Test semantic search via CLI (not just service layer)
2. Test hybrid search via CLI
3. Test exact search (existing, ensure not broken)
4. Test mutual exclusivity validation
5. Test index command
6. Test stats enhancement
7. Test error cases (no embeddings, invalid IDs, empty results)
8. Test edge cases (no FTS5 population, large datasets)

**Constraints**:
- Use existing Vitest testing framework
- Follow patterns from existing memory.test.ts
- Must run in in-memory SQLite database
- Must not require actual CLI execution (test service layer directly)
- Must wait for async embedding generation
- Must validate both FTS5 and vector results

---

## Research Phase

### Existing Test Patterns Analysis

#### Pattern 1: memory.test.ts (530 lines)

**Location**: `src/cli/commands/__tests__/memory.test.ts`

**Structure**:
```typescript
describe('Memory CLI Commands', () => {
  let db: Database.Database;
  let memoryService: MemoryService;
  let memoryExporter: MemoryExporter;

  beforeAll(() => {
    db = new Database(':memory:');
    const migrationSQL = readFileSync('008_create_memory_system.sql');
    db.exec(migrationSQL);
    memoryService = new MemoryService(db);
  });

  beforeEach(async () => {
    db.exec('DELETE FROM messages');
    db.exec('DELETE FROM conversations');
    // Create test data...
  });

  describe('memory search', () => {
    it('should search messages by query', async () => { ... });
    it('should filter search by agent', async () => { ... });
    it('should limit search results', async () => { ... });
  });
});
```

**Key Patterns**:
- ✅ Use in-memory database (`:memory:`)
- ✅ Load migration SQL from file
- ✅ Clear data in beforeEach
- ✅ Create test conversations and messages
- ✅ Test service layer directly (not CLI commands)
- ✅ Use descriptive test names
- ✅ Group tests by command (search, list, show, export, stats)

**What's Missing for Phase 4**:
- ❌ No tests for semantic search
- ❌ No tests for hybrid search
- ❌ No tests for embedding generation
- ❌ No tests for index command
- ❌ No tests for embedding stats
- ❌ No tests for async embedding wait

#### Pattern 2: memory-system.test.ts (534 lines)

**Location**: `src/__tests__/integration/memory-system.test.ts`

**Structure**:
```typescript
describe('Memory System Integration', () => {
  let db: Database.Database;
  let conversationDAO: ConversationDAO;
  let messageDAO: MessageDAO;

  describe('ReScript State Machine', () => { ... });
  describe('ConversationDAO', () => { ... });
  describe('MessageDAO', () => { ... });
  describe('End-to-End Memory Workflow', () => {
    it('should complete a full conversation lifecycle', () => {
      // Create state machine
      // Create conversation
      // Add messages
      // Search messages
      // Archive conversation
    });
  });
});
```

**Key Patterns**:
- ✅ Tests integration between layers (ReScript + DAOs)
- ✅ End-to-end workflow tests
- ✅ State machine transition validation
- ✅ Database state verification

**What's Relevant for Phase 4**:
- ✅ End-to-end workflow pattern
- ✅ Multi-layer integration testing
- ✅ State verification at each step

#### Pattern 3: find.test.ts (100 lines)

**Location**: `src/cli/commands/__tests__/find.test.ts`

**Structure**:
```typescript
describe('find command', () => {
  let command: Command;
  let program: Command;

  beforeEach(() => {
    command = createFindCommand();
    program = new Command();
    program.addCommand(command);
    vi.clearAllMocks();
  });

  describe('command registration', () => {
    it('should register find command', () => { ... });
    it('should have correct aliases', () => { ... });
  });

  describe('command options', () => {
    it('should have limit option', () => { ... });
  });

  describe('command execution', () => {
    it('should search with query only', async () => { ... });
  });
});
```

**Key Patterns**:
- ✅ Tests Commander.js command structure
- ✅ Tests options and aliases
- ✅ Mocks service layer with vi.mock()
- ✅ Tests command execution via program.parseAsync()

**What's NOT Relevant for Phase 4**:
- ❌ We're testing MemoryService directly, not Commander.js
- ❌ We don't need to mock services (we have real database)
- ❌ We don't need program.parseAsync() (direct service calls)

### Existing Test Data

From memory.test.ts beforeEach:
```typescript
const conv1 = await memoryService.createConversation({
  agentId: 'test-agent',
  userId: 'test-user',
  title: 'REST API Development',
});

await memoryService.addMessage({
  conversationId: conv1.id,
  role: 'user',
  content: 'How do I create a REST API?',
  tokens: 10,
});

await memoryService.addMessage({
  conversationId: conv1.id,
  role: 'assistant',
  content: 'To create a REST API, you need to define routes and handlers.',
  tokens: 20,
});
```

**For Phase 4**: We need similar data but specifically designed for semantic/hybrid search testing.

### Migration Requirements

**Existing**: Migration 008 (memory system)
- conversations table
- messages table
- messages_fts (FTS5)

**New**: Migration 009 (vector embeddings)
- message_embeddings (vec0)
- message_embeddings_metadata
- message_embedding_stats view

**Test Setup Requirement**:
- Load both migration 008 AND 009
- Populate FTS5 table with triggers or manual inserts
- Wait for async embedding generation

---

## Design Decisions

### Decision 1: Where to Add Tests?

**Options**:

**Option A: Extend existing memory.test.ts**
- **Pros**:
  - Reuse existing setup (beforeAll, migrations)
  - Keep all memory tests in one file
  - Familiar patterns for future developers
- **Cons**:
  - File becomes very large (530 → 800+ lines)
  - Mixes existing FTS5 tests with new semantic tests
  - Harder to run just semantic tests
- **Complexity**: Low

**Option B: Create new memory-semantic.test.ts**
- **Pros**:
  - Focused on semantic/hybrid search only
  - Can run semantic tests independently
  - Clear separation of concerns
  - Easier to refactor later
- **Cons**:
  - Duplicate setup code (migrations, beforeAll)
  - Two files to maintain
  - Split knowledge across files
- **Complexity**: Medium

**Option C: Create memory-cli-integration.test.ts**
- **Pros**:
  - Name clearly indicates scope (CLI integration)
  - Matches Phase 4 goal (end-to-end CLI tests)
  - Can include all three modes (semantic, hybrid, exact)
  - Fresh start, no legacy baggage
- **Cons**:
  - Most duplicate setup code
  - Three memory test files total
  - Potential confusion about which file to update
- **Complexity**: Medium

**DECISION**: **Option A - Extend memory.test.ts**

**Rationale**:
1. **Consistency**: Keep all memory command tests together
2. **Maintainability**: One file to update when memory system changes
3. **Simplicity**: Reuse existing setup, no duplication
4. **Discoverability**: Developers know where to find memory tests
5. **Migration**: Easy to refactor later if file becomes unwieldy

**Implementation**:
- Add new describe block: `describe('memory semantic search', () => { ... })`
- Add new describe block: `describe('memory hybrid search', () => { ... })`
- Add new describe block: `describe('memory index command', () => { ... })`
- Update beforeAll to load migration 009
- Update beforeEach to wait for embeddings

---

### Decision 2: How to Handle Async Embeddings?

**Context**: `addMessage()` generates embeddings asynchronously (fire-and-forget). Tests need to wait for embeddings before searching.

**Options**:

**Option A: Fixed timeout (await setTimeout(5000))**
- **Pros**:
  - Simple to implement
  - Works for small test datasets
  - Used in test-memory-service-semantic.ts
- **Cons**:
  - Slow (5 seconds per test)
  - Flaky (might be too short or too long)
  - Wastes time when embeddings finish early
- **Complexity**: Low

**Option B: Poll embedding stats until coverage = 100%**
- **Pros**:
  - Fast (returns as soon as ready)
  - Reliable (guaranteed embeddings exist)
  - Adaptive (scales with dataset size)
- **Cons**:
  - More complex implementation
  - Requires polling logic
  - Could infinite loop if embeddings fail
- **Complexity**: Medium
- **Code**:
  ```typescript
  async function waitForEmbeddings(memoryService, expectedCount, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const stats = await memoryService.getEmbeddingStats();
      if (stats.totalEmbeddings >= expectedCount) return;
      await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
    }
    throw new Error('Timeout waiting for embeddings');
  }
  ```

**Option C: Make indexExistingMessages() synchronous in tests**
- **Pros**:
  - Guaranteed embeddings before test proceeds
  - No polling or timeouts
  - Clear intent
- **Cons**:
  - Different behavior in tests vs production
  - Requires manual indexing call
  - Not testing real async behavior
- **Complexity**: Low

**DECISION**: **Option B - Poll embedding stats**

**Rationale**:
1. **Performance**: Only waits as long as needed (typically 100-500ms for 5 messages)
2. **Reliability**: Guaranteed 100% coverage before search tests
3. **Scalability**: Works for any dataset size
4. **Production-like**: Tests real async embedding generation
5. **Debuggability**: Clear error message if embeddings fail

**Implementation**:
```typescript
async function waitForEmbeddings(
  memoryService: MemoryService,
  expectedCount: number,
  timeoutMs: number = 10000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const stats = await memoryService.getEmbeddingStats();
    if (stats.totalEmbeddings >= expectedCount) {
      return; // Success
    }
    await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
  }
  throw new Error(
    `Timeout waiting for ${expectedCount} embeddings after ${timeoutMs}ms`
  );
}

// Usage in beforeEach:
await waitForEmbeddings(memoryService, 4); // 4 messages = 4 embeddings
```

---

### Decision 3: How to Populate FTS5 Table?

**Context**: Hybrid search requires both FTS5 and vector results. FTS5 table must be populated for tests.

**Options**:

**Option A: Manual INSERT INTO messages_fts**
- **Pros**:
  - Direct control over FTS5 content
  - Simple to understand
  - No migration changes needed
- **Cons**:
  - Must manually keep in sync with messages table
  - Error-prone (easy to forget)
  - Doesn't test real FTS5 population
- **Complexity**: Low

**Option B: Add FTS5 INSERT trigger in test setup**
- **Pros**:
  - Automatic FTS5 population
  - Matches production behavior
  - Tests real trigger logic
- **Cons**:
  - Requires adding trigger SQL
  - More complex setup
  - Could hide issues if trigger is wrong
- **Complexity**: Medium
- **Code**:
  ```sql
  CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages
  BEGIN
    INSERT INTO messages_fts (rowid, content)
    VALUES (NEW.rowid, NEW.content);
  END;
  ```

**Option C: Use MessageDAO.create() which includes trigger**
- **Pros**:
  - Cleanest (no manual SQL)
  - Tests real DAO behavior
  - Automatic sync
- **Cons**:
  - Assumes DAO has trigger (need to verify)
  - Less control if trigger is missing
- **Complexity**: Low (if trigger exists)

**DECISION**: **Option B - Add FTS5 trigger in test setup**

**Rationale**:
1. **Correctness**: Ensures FTS5 is always in sync with messages
2. **Production-like**: Tests trigger behavior (if we add it to production)
3. **Maintainability**: No manual FTS5 inserts needed
4. **Explicit**: Clear what's happening (trigger in beforeAll)

**Implementation**:
```typescript
beforeAll(() => {
  db = new Database(':memory:');

  // Load migrations
  db.exec(readFileSync('008_create_memory_system.sql'));
  db.exec(readFileSync('009_create_vector_embeddings.sql'));

  // Add FTS5 trigger (if not in migration)
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_insert
    AFTER INSERT ON messages
    BEGIN
      INSERT INTO messages_fts (rowid, content)
      VALUES (NEW.rowid, NEW.content);
    END;
  `);

  memoryService = new MemoryService(db);
});
```

---

### Decision 4: Test Data Design

**Context**: Need test messages that clearly differentiate semantic vs exact search results.

**Requirements**:
- Messages about different topics (authentication, databases, APIs)
- Semantic similarity without exact keyword match
- Clear ranking expectations

**Test Data Design**:

```typescript
const testMessages = [
  // Topic 1: Authentication (semantically similar)
  {
    content: 'How do I implement JWT authentication in Node.js?',
    topic: 'auth',
    keywords: ['JWT', 'authentication', 'Node.js']
  },
  {
    content: 'Can you help me secure user sessions with tokens?',
    topic: 'auth',
    keywords: ['secure', 'sessions', 'tokens']
    // NO 'JWT' keyword - tests semantic match
  },
  {
    content: 'What is the best practice for validating user credentials?',
    topic: 'auth',
    keywords: ['validating', 'credentials']
    // NO 'JWT' or 'token' - tests semantic match
  },

  // Topic 2: Database (different semantic space)
  {
    content: 'How do I normalize a database schema?',
    topic: 'database',
    keywords: ['normalize', 'database', 'schema']
  },
  {
    content: 'What are indexes and how do they improve query performance?',
    topic: 'database',
    keywords: ['indexes', 'query', 'performance']
  },
];
```

**Expected Search Results**:

| Query | Semantic Match | Exact Match | Hybrid Match |
|-------|----------------|-------------|--------------|
| "JWT token authentication" | All 3 auth messages (semantic) | Only message 1 (keyword) | Auth messages ranked higher |
| "database optimization" | Database messages (semantic) | No exact matches | Database messages only |
| "user sessions" | Auth messages (semantic) | Message 2 exact | Message 2 highest score |

**DECISION**: Use 5 test messages (3 auth, 2 database) with clear semantic/keyword distinction

---

### Decision 5: What to Test?

**P0 Tests (Must Have)**:
1. ✅ Semantic search returns vector-ranked results
2. ✅ Semantic search with filters (conversation, agent, limit)
3. ✅ Hybrid search returns combined FTS + vector results
4. ✅ Hybrid search shows score breakdown (ftsScore, vectorScore)
5. ✅ Exact search still works (backward compatibility)
6. ✅ Index command generates embeddings
7. ✅ Index command shows progress
8. ✅ Stats command shows embedding coverage
9. ✅ Stats command shows insights (warnings, success)

**P1 Tests (Nice to Have)**:
10. ⏸️ Semantic search with minScore filter
11. ⏸️ Hybrid search with custom weights
12. ⏸️ Error: Search before indexing (0 embeddings)
13. ⏸️ Error: Invalid conversation ID
14. ⏸️ Edge case: Empty query string
15. ⏸️ Edge case: Very large result set (100+ messages)

**P2 Tests (Future)**:
16. ⏸️ Performance: Search latency < 10ms
17. ⏸️ Performance: Index throughput > 50 messages/sec
18. ⏸️ Integration: CLI command parsing (not just service)
19. ⏸️ Integration: Error message formatting

**DECISION**: Implement P0 tests only for Phase 4, defer P1/P2 to future iterations

**Rationale**:
- P0 covers all new functionality from Phases 1-3
- P1 can be added incrementally without blocking
- P2 requires different test infrastructure (benchmark framework, CLI testing)

---

## Implementation Plan

### Task Breakdown

**Task 1: Update test setup** (Est: 15 minutes)
- Load migration 009 in beforeAll
- Add FTS5 trigger in beforeAll
- Add sqlite-vec loading
- Add waitForEmbeddings() helper function

**Task 2: Create semantic search test data** (Est: 10 minutes)
- Add 5 test messages (3 auth, 2 database)
- Update beforeEach to create semantic-optimized data
- Wait for embeddings after message creation

**Task 3: Write semantic search tests** (Est: 30 minutes)
- Test: Semantic search returns scored results
- Test: Semantic search filters by conversation
- Test: Semantic search filters by agent
- Test: Semantic search respects limit
- Test: Semantic search ranking correctness

**Task 4: Write hybrid search tests** (Est: 30 minutes)
- Test: Hybrid search returns combined results
- Test: Hybrid search shows score breakdown
- Test: Hybrid search ranks better than semantic or exact alone
- Test: Hybrid search with filters

**Task 5: Write index command tests** (Est: 20 minutes)
- Test: Index all conversations
- Test: Index specific conversation
- Test: Index with --force flag
- Test: Index returns correct counts (indexed/skipped/failed)

**Task 6: Write stats tests** (Est: 15 minutes)
- Test: Stats includes embedding coverage
- Test: Stats includes model version
- Test: Stats coverage percentage correct
- Test: Stats insights (warning/success messages)

**Task 7: Write backward compatibility tests** (Est: 10 minutes)
- Test: Exact search still works
- Test: Search without embeddings falls back gracefully
- Test: All existing tests still pass

**Task 8: Run and validate all tests** (Est: 10 minutes)
- Run: `npm test -- src/cli/commands/__tests__/memory.test.ts`
- Verify: All P0 tests pass
- Verify: No regressions in existing tests
- Fix: Any failures

**TOTAL ESTIMATED TIME**: 2 hours 20 minutes

### Test File Structure

```typescript
// src/cli/commands/__tests__/memory.test.ts

describe('Memory CLI Commands', () => {
  // ... existing setup ...

  beforeAll(() => {
    // ... existing migration 008 ...
    db.exec(readFileSync('009_create_vector_embeddings.sql'));
    db.exec(`CREATE TRIGGER ... FTS5 insert ...`);
    sqlite_vec.load(db); // NEW
  });

  beforeEach(async () => {
    // ... existing cleanup and basic test data ...

    // NEW: Wait for embeddings
    await waitForEmbeddings(memoryService, 4);
  });

  // ... existing tests (search, list, show, export, stats) ...

  // ============================================================================
  // NEW: ax memory search --semantic
  // ============================================================================
  describe('memory semantic search', () => {
    it('should search messages using vector similarity', async () => { ... });
    it('should return messages with similarity scores', async () => { ... });
    it('should rank by semantic relevance', async () => { ... });
    it('should filter by conversation', async () => { ... });
    it('should filter by agent', async () => { ... });
    it('should respect limit option', async () => { ... });
  });

  // ============================================================================
  // NEW: ax memory search --hybrid (default)
  // ============================================================================
  describe('memory hybrid search', () => {
    it('should combine FTS5 and vector results', async () => { ... });
    it('should return combined scores', async () => { ... });
    it('should show FTS and vector score breakdown', async () => { ... });
    it('should rank higher than semantic or exact alone', async () => { ... });
    it('should filter by conversation', async () => { ... });
  });

  // ============================================================================
  // NEW: ax memory index
  // ============================================================================
  describe('memory index command', () => {
    it('should index all conversations', async () => { ... });
    it('should index specific conversation', async () => { ... });
    it('should skip already indexed messages', async () => { ... });
    it('should force re-index with --force', async () => { ... });
    it('should return indexed/skipped/failed counts', async () => { ... });
    it('should call progress callback', async () => { ... });
  });

  // ============================================================================
  // NEW: ax memory stats (embedding coverage)
  // ============================================================================
  describe('memory stats with embeddings', () => {
    it('should include embedding coverage', async () => { ... });
    it('should include model version', async () => { ... });
    it('should calculate coverage percentage correctly', async () => { ... });
  });

  // ============================================================================
  // NEW: Backward compatibility
  // ============================================================================
  describe('backward compatibility', () => {
    it('should still support exact search (FTS5-only)', async () => { ... });
    it('should not break existing search tests', async () => { ... });
  });
});
```

**Total New Tests**: ~20 tests
**Estimated LOC**: ~400 lines (memory.test.ts: 530 → 930 lines)

---

## Risk Assessment

### Low Risk ✅

- **Reusing existing patterns**: memory.test.ts structure proven
- **In-memory database**: Fast, isolated, repeatable
- **Service layer testing**: No CLI complexity
- **Comprehensive test data**: Clear semantic/keyword distinction

### Medium Risk 🟡

- **Async embedding wait**: Polling logic could be flaky
  - **Mitigation**: 10-second timeout, 100ms polling
  - **Fallback**: Fixed timeout if polling fails

- **FTS5 trigger**: Must be correct for hybrid tests
  - **Mitigation**: Test trigger separately first
  - **Fallback**: Manual FTS5 inserts if trigger fails

- **Migration 009 loading**: Must apply cleanly
  - **Mitigation**: Test migration separately
  - **Fallback**: Inline migration SQL if file missing

### High Risk ⚠️

- **None identified**

---

## Success Criteria

### Phase 4 Complete When:

1. ✅ All P0 tests implemented (~20 tests)
2. ✅ All tests pass (`npm test -- memory.test.ts`)
3. ✅ No regressions in existing tests
4. ✅ Test coverage > 90% for new semantic methods
5. ✅ waitForEmbeddings() helper working reliably
6. ✅ FTS5 trigger populating correctly
7. ✅ Test data clearly demonstrates semantic vs exact search
8. ✅ Test execution time < 5 seconds total
9. ✅ Documentation: Inline comments explain test data design

### Acceptance Criteria:

**Semantic Search Tests**:
- ✅ Vector-only search returns scored results
- ✅ Ranking is correct (most similar first)
- ✅ Filters work (conversation, agent, limit)
- ✅ Semantic match without keyword match works

**Hybrid Search Tests**:
- ✅ Combined FTS5 + vector results
- ✅ Score breakdown shown (ftsScore, vectorScore)
- ✅ Ranking improves over semantic or exact alone

**Index Command Tests**:
- ✅ Generates embeddings for messages
- ✅ Returns correct counts
- ✅ --force flag re-indexes
- ✅ Progress callback invoked

**Stats Tests**:
- ✅ Embedding coverage displayed
- ✅ Model version displayed
- ✅ Coverage percentage correct

**Backward Compatibility**:
- ✅ Exact search unchanged
- ✅ All existing tests pass

---

## Next Steps After Phase 4

### Phase 5: Performance Benchmark
- Create 1000+ message dataset
- Measure search latency (semantic, hybrid, exact)
- Measure indexing throughput
- Document performance characteristics

### Documentation
- Update README with semantic search examples
- Add architecture diagram (FTS5 + vector flow)
- Document test data design patterns
- Create troubleshooting guide

---

## Summary

**Phase 4 Strategy**:
- ✅ Extend existing memory.test.ts (keep all memory tests together)
- ✅ Use polling for async embedding wait (fast, reliable)
- ✅ Add FTS5 trigger in test setup (automatic sync)
- ✅ Create 5 semantic-optimized test messages
- ✅ Implement 20 P0 tests (~400 LOC)
- ✅ Defer P1/P2 tests to future iterations

**Key Risks**:
- 🟡 Async embedding wait (mitigated with polling)
- 🟡 FTS5 trigger (mitigated with separate test)
- ✅ All other risks low

**ETA**: 2 hours 20 minutes

**Confidence**: HIGH (95%) - Clear patterns, proven approach, comprehensive plan

---

**Generated**: 2025-11-10
**Status**: Design Complete, Ready to Implement
**Next**: Task 1 - Update test setup
