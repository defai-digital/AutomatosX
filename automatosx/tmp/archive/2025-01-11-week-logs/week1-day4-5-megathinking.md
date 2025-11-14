# Week 1 Days 4-5 - Megathinking Implementation Plan

**Date:** 2025-01-11
**Status:** Planning Days 4-5 to Complete Week 1
**Context:** Days 1-3 complete (1,885 LOC, all 13 commands working)

---

## 📊 Current State Analysis

### What We Have (Days 1-3)
✅ **13 Commands Implemented:**
- Core: help, exit, clear
- Info: agents, status, config
- Context: context, history, agent
- File I/O: save, load
- Delegated: memory, workflow

✅ **ConversationContext System:**
- In-memory message storage
- Active agent/workflow tracking
- Variables management
- Snapshot for save/load
- SQLite stubs (saveToDB, loadFromDB)

✅ **Working Features:**
- Conversation history in AI requests
- TAB autocomplete
- Color-coded output
- Error handling
- Command injection pattern

### What's Missing (Days 4-5)

🔴 **Day 4: Persistence**
- SQLite conversation storage
- Database integration with ConversationDAO/MessageDAO
- Auto-save functionality
- Load on startup (optional)

🔴 **Day 5: Polish + Quality**
- Streaming with ora spinner
- Unit tests (20 critical tests)
- Documentation
- Quality gate review

---

## 🎯 Day 4: SQLite Persistence Implementation

### Objective
Replace in-memory conversation storage with SQLite persistence using existing DAOs.

### Strategy: Incremental Database Integration

**Phase 1: Understand Existing DAO Layer (30 minutes)**
- Read ConversationDAO and MessageDAO implementations
- Understand schema and table structure
- Check for any missing columns or methods

**Phase 2: Implement saveToDB() (2 hours)**
- Create/update conversation record in database
- Save all messages to messages table
- Handle conversation metadata (activeAgent, activeWorkflow, variables)
- Transaction support for atomicity

**Phase 3: Implement loadFromDB() (2 hours)**
- Load conversation by ID
- Load all associated messages
- Reconstruct ConversationContext from database
- Handle missing/corrupt data

**Phase 4: Auto-save Integration (1 hour)**
- Save on exit
- Save every N messages (configurable)
- Debounced save to avoid excessive writes

**Phase 5: Manual Testing (2 hours)**
- Test all 13 commands
- Test save → exit → relaunch → load
- Test error cases (corrupt DB, missing files, etc.)
- Verify data integrity

### Technical Implementation Details

#### saveToDB() Method Design

```typescript
async saveToDB(): Promise<void> {
  try {
    // 1. Save/update conversation record
    const conversationData = {
      id: this.conversationId,
      userId: this.userId,
      metadata: {
        activeAgent: this.activeAgent,
        activeWorkflow: this.activeWorkflow,
        variables: this.variables
      },
      createdAt: this.createdAt,
      updatedAt: new Date()
    };

    await conversationDAO.upsert(conversationData);

    // 2. Save messages (batch insert for efficiency)
    for (const message of this.messages) {
      await messageDAO.upsert({
        id: message.id,
        conversationId: this.conversationId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        metadata: message.metadata
      });
    }

  } catch (error) {
    console.error('[ConversationContext] Failed to save to DB:', error);
    throw error;
  }
}
```

#### loadFromDB() Method Design

```typescript
static async loadFromDB(
  db: Database,
  conversationId: string
): Promise<ConversationContext | null> {
  try {
    // 1. Load conversation record
    const conversation = await conversationDAO.get(conversationId);
    if (!conversation) return null;

    // 2. Load messages
    const messages = await messageDAO.getByConversationId(conversationId);

    // 3. Reconstruct ConversationContext
    const context = new ConversationContext(db, conversation.userId, conversationId);

    // 4. Restore state
    const snapshot: ContextSnapshot = {
      conversationId: conversation.id,
      userId: conversation.userId,
      messages: messages.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
        metadata: m.metadata || {}
      })),
      activeAgent: conversation.metadata?.activeAgent,
      activeWorkflow: conversation.metadata?.activeWorkflow,
      variables: conversation.metadata?.variables || {},
      createdAt: new Date(conversation.createdAt),
      updatedAt: new Date(conversation.updatedAt)
    };

    context.restoreFromSnapshot(snapshot);

    return context;

  } catch (error) {
    console.error('[ConversationContext] Failed to load from DB:', error);
    return null;
  }
}
```

### DAO Integration Points

**Need to Check:**
1. Does ConversationDAO exist? ✅ Yes (created in previous phases)
2. Does MessageDAO exist? ✅ Yes (created in previous phases)
3. Do they have required methods?
   - `upsert()` or `create()` + `update()`
   - `get(id)`
   - `getByConversationId()` for MessageDAO
4. What's the schema structure?
   - conversations table: id, userId, metadata (JSON), createdAt, updatedAt
   - messages table: id, conversationId, role, content, timestamp, metadata (JSON)

**Action:** Read DAO files first to understand API

### Auto-save Strategy

**Trigger Points:**
1. On exit (already stubbed in REPLSession.stop())
2. Every 5 messages (configurable via REPLOptions.contextSaveInterval)
3. On command completion (optional - may be too frequent)

**Implementation:**
```typescript
// In REPLSession.handleNaturalLanguage()
this.conversationContext.addMessage('assistant', response.content);
this.state.messageCount = this.conversationContext.getMessageCount();

// Auto-save check
if (this.state.messageCount % this.options.contextSaveInterval === 0) {
  await this.conversationContext.saveToDB();
}
```

### Error Handling

**Scenarios:**
1. Database write fails → Log error, continue (don't crash REPL)
2. Conversation not found on load → Return null, create new
3. Corrupt data in DB → Validate on load, skip invalid messages
4. Concurrent writes → Use transactions for atomicity

### Testing Checklist (Day 4)

**Persistence Tests:**
- [ ] Create conversation, save, verify in DB
- [ ] Load conversation, verify all messages restored
- [ ] Save with active agent, load, verify agent restored
- [ ] Save with variables, load, verify variables restored
- [ ] Save → exit → relaunch → load (full cycle)
- [ ] Auto-save every 5 messages works
- [ ] Handle non-existent conversation gracefully
- [ ] Handle corrupt data gracefully

**Command Tests (All 13):**
- [ ] /help - shows all commands
- [ ] /exit - saves and exits
- [ ] /clear - clears screen
- [ ] /agents - lists agents, filters work
- [ ] /status - shows correct stats
- [ ] /config - masks API keys
- [ ] /context - shows conversation state
- [ ] /history - shows messages with colors
- [ ] /agent - sets/clears active agent
- [ ] /save - exports to JSON file
- [ ] /load - imports from JSON file
- [ ] /memory - delegates to ax memory
- [ ] /workflow - delegates to ax workflow

---

## 🎯 Day 5: Streaming + Tests + Documentation

### Objective
Add professional polish, comprehensive testing, and documentation to complete Week 1.

### Part 1: StreamingHandler with ora (2 hours)

**Why ora instead of token-by-token streaming?**
- Week 1 MVP: Show progress, not full streaming
- ora provides professional spinners
- Easy to implement (10-20 LOC)
- Can add full streaming in Week 6

**Implementation:**

```typescript
// src/cli/interactive/StreamingHandler.ts (100 LOC)

import ora, { Ora } from 'ora';
import chalk from 'chalk';

export class StreamingHandler {
  private spinner: Ora | null = null;

  /**
   * Start thinking spinner
   */
  startThinking(): void {
    this.spinner = ora({
      text: chalk.gray('Thinking...'),
      color: 'cyan',
      spinner: 'dots'
    }).start();
  }

  /**
   * Update spinner text
   */
  updateText(text: string): void {
    if (this.spinner) {
      this.spinner.text = chalk.gray(text);
    }
  }

  /**
   * Stop spinner with success
   */
  stopSuccess(message?: string): void {
    if (this.spinner) {
      if (message) {
        this.spinner.succeed(chalk.green(message));
      } else {
        this.spinner.stop();
      }
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with error
   */
  stopError(message: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = null;
    }
  }

  /**
   * Stop spinner without message
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}
```

**Integration with REPLSession:**

```typescript
// In REPLSession.handleNaturalLanguage()

// Before:
console.log(chalk.gray('\n🤔 Thinking...'));

// After:
const streamingHandler = new StreamingHandler();
streamingHandler.startThinking();

try {
  const response = await this.providerRouter.request({ messages });

  streamingHandler.stop();
  console.log(chalk.white('\n' + response.content + '\n'));

} catch (error) {
  streamingHandler.stopError('Failed to get response');
  throw error;
}
```

**Enhanced Features (Optional):**
- Show elapsed time
- Show estimated tokens (if provider returns usage)
- Different spinners for different operations
- Color-coded status

### Part 2: Unit Tests (3-4 hours, 20 tests minimum)

**Testing Strategy:** Focus on critical paths and edge cases

#### Test Suite 1: ConversationContext (5 tests)

```typescript
// src/cli/interactive/__tests__/ConversationContext.test.ts

describe('ConversationContext', () => {
  test('should create new conversation with unique ID', () => {
    const context = new ConversationContext(db, 'user123');
    expect(context.getConversationId()).toBeTruthy();
    expect(context.getUserId()).toBe('user123');
  });

  test('should add and retrieve messages', () => {
    const context = new ConversationContext(db, 'user123');
    context.addMessage('user', 'Hello');
    context.addMessage('assistant', 'Hi there');

    const messages = context.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi there');
  });

  test('should manage active agent', () => {
    const context = new ConversationContext(db, 'user123');
    expect(context.getActiveAgent()).toBeUndefined();

    context.setActiveAgent('BackendAgent');
    expect(context.getActiveAgent()).toBe('BackendAgent');

    context.setActiveAgent(undefined);
    expect(context.getActiveAgent()).toBeUndefined();
  });

  test('should create and restore from snapshot', () => {
    const context = new ConversationContext(db, 'user123');
    context.addMessage('user', 'Test message');
    context.setActiveAgent('TestAgent');
    context.setVariable('key', 'value');

    const snapshot = context.getSnapshot();

    const newContext = new ConversationContext(db, 'user456');
    newContext.restoreFromSnapshot(snapshot);

    expect(newContext.getMessageCount()).toBe(1);
    expect(newContext.getActiveAgent()).toBe('TestAgent');
    expect(newContext.getVariable('key')).toBe('value');
  });

  test('should persist to and load from database', async () => {
    const context = new ConversationContext(db, 'user123');
    const conversationId = context.getConversationId();

    context.addMessage('user', 'Hello');
    context.setActiveAgent('BackendAgent');

    await context.saveToDB();

    const loaded = await ConversationContext.loadFromDB(db, conversationId);
    expect(loaded).toBeTruthy();
    expect(loaded!.getMessageCount()).toBe(1);
    expect(loaded!.getActiveAgent()).toBe('BackendAgent');
  });
});
```

#### Test Suite 2: SlashCommandRegistry (3 tests)

```typescript
// src/cli/interactive/__tests__/SlashCommandRegistry.test.ts

describe('SlashCommandRegistry', () => {
  test('should register and execute command', async () => {
    const registry = new SlashCommandRegistry();
    const mockCommand: SlashCommand = {
      name: 'test',
      description: 'Test command',
      usage: '/test',
      execute: vi.fn()
    };

    registry.register(mockCommand);

    await registry.execute('/test arg1', mockContext);
    expect(mockCommand.execute).toHaveBeenCalledWith(['arg1'], mockContext);
  });

  test('should resolve aliases to command name', () => {
    const registry = new SlashCommandRegistry();
    const mockCommand: SlashCommand = {
      name: 'help',
      description: 'Help',
      usage: '/help',
      aliases: ['h', '?'],
      execute: vi.fn()
    };

    registry.register(mockCommand);

    expect(registry.get('help')).toBe(mockCommand);
    expect(registry.get('h')).toBe(mockCommand);
    expect(registry.get('?')).toBe(mockCommand);
  });

  test('should throw on duplicate command registration', () => {
    const registry = new SlashCommandRegistry();
    const mockCommand: SlashCommand = {
      name: 'test',
      description: 'Test',
      usage: '/test',
      execute: vi.fn()
    };

    registry.register(mockCommand);
    expect(() => registry.register(mockCommand)).toThrow();
  });
});
```

#### Test Suite 3: Commands (9 tests, 1-2 per category)

```typescript
// src/cli/interactive/commands/__tests__/HelpCommand.test.ts

describe('HelpCommand', () => {
  test('should list all commands', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const helpCommand = new HelpCommand(mockRegistry);

    await helpCommand.execute([], mockContext);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Available Commands')
    );
  });
});

// src/cli/interactive/commands/__tests__/ContextCommand.test.ts

describe('ContextCommand', () => {
  test('should display conversation context', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const contextCommand = new ContextCommand();
    contextCommand.setConversationContext(mockConversationContext);

    await contextCommand.execute([], mockContext);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Conversation Context')
    );
  });
});

// src/cli/interactive/commands/__tests__/SaveCommand.test.ts

describe('SaveCommand', () => {
  test('should save conversation to JSON file', async () => {
    const saveCommand = new SaveCommand();
    saveCommand.setConversationContext(mockConversationContext);

    await saveCommand.execute(['test.json'], mockContext);

    expect(fs.existsSync('test.json')).toBe(true);
    const content = JSON.parse(fs.readFileSync('test.json', 'utf-8'));
    expect(content.conversationId).toBeTruthy();
  });
});

// ... 6 more command tests (load, agent, history, memory, workflow, agents)
```

#### Test Suite 4: REPLSession Integration (3 tests)

```typescript
// src/cli/interactive/__tests__/REPLSession.test.ts

describe('REPLSession', () => {
  test('should create conversation context on init', () => {
    const repl = new REPLSession(db, mockProviderRouter, mockAgentRegistry, mockCommandRegistry);
    const context = repl.getConversationContext();

    expect(context).toBeTruthy();
    expect(context.getUserId()).toBeTruthy();
  });

  test('should track messages on natural language input', async () => {
    const repl = new REPLSession(db, mockProviderRouter, mockAgentRegistry, mockCommandRegistry);
    const context = repl.getConversationContext();

    // Simulate natural language input
    await repl['handleNaturalLanguage']('What is a REST API?');

    expect(context.getMessageCount()).toBeGreaterThan(0);
  });

  test('should save context on stop', async () => {
    const repl = new REPLSession(db, mockProviderRouter, mockAgentRegistry, mockCommandRegistry);
    const context = repl.getConversationContext();

    const saveSpy = vi.spyOn(context, 'saveToDB');

    // Note: Can't actually call stop() as it exits process
    // Test the save logic separately
    await context.saveToDB();

    expect(saveSpy).toHaveBeenCalled();
  });
});
```

### Part 3: Documentation (2 hours)

**Documents to Create:**

#### 1. User Guide: `docs/cli/interactive-mode.md` (500 lines)

```markdown
# AutomatosX Interactive CLI - User Guide

## Overview
The Interactive CLI provides a ChatGPT-style REPL interface for AutomatosX...

## Getting Started
### Launch
npm run cli -- cli

### Basic Commands
- `/help` - Show all commands
- `/exit` - Exit REPL
...

## Features
### Conversation History
...

### Active Agents
...

### Save & Load
...

## Examples
### Example 1: Code Review Session
...

## Troubleshooting
...
```

#### 2. Command Reference: Quick reference in README

```markdown
## Interactive CLI Mode

Launch: `npm run cli -- cli`

### All Commands (13)
| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
...
```

#### 3. Architecture Doc: `docs/cli/interactive-architecture.md` (300 lines)

```markdown
# Interactive CLI Architecture

## Component Overview
- REPLSession: Main session manager
- SlashCommandRegistry: Command routing
- ConversationContext: State management
...

## Data Flow
...

## Extension Guide
How to add new commands...
```

---

## 🎯 Quality Gate Criteria (Week 1 Completion)

### Functional Requirements (All Must Pass)

- [ ] **REPL launches successfully** with `npm run cli -- cli`
- [ ] **All 13 commands work** without errors
- [ ] **Natural language routing** works with conversation history
- [ ] **Context persists** across sessions (SQLite)
- [ ] **Graceful shutdown** (CTRL+C, CTRL+D)
- [ ] **Streaming responses** with ora spinner

### Quality Requirements

- [ ] **>60% test coverage** (20+ tests passing)
- [ ] **<200ms input latency** (measured with simple timer)
- [ ] **No crashes** on invalid input
- [ ] **Clear error messages** with actionable hints
- [ ] **Memory stable** (no leaks in 100+ message session)

### Documentation Requirements

- [ ] **README updated** with Interactive CLI section
- [ ] **User guide** complete with examples
- [ ] **Command reference** documented
- [ ] **Troubleshooting guide** with common issues

### Code Quality

- [ ] **TypeScript compiles** without errors in new files
- [ ] **No console.log debugging** statements left in code
- [ ] **Consistent code style** (matches existing codebase)
- [ ] **All TODOs addressed** or moved to backlog

---

## 📊 Implementation Timeline

### Day 4: SQLite Persistence (6-8 hours)

**Morning (4 hours)**
- 09:00-09:30: Read ConversationDAO and MessageDAO
- 09:30-11:30: Implement saveToDB()
- 11:30-12:00: Quick test of save functionality

**Afternoon (4 hours)**
- 13:00-15:00: Implement loadFromDB()
- 15:00-16:00: Auto-save integration
- 16:00-17:00: Manual testing all 13 commands

### Day 5: Polish + Quality (7-8 hours)

**Morning (4 hours)**
- 09:00-11:00: StreamingHandler implementation
- 11:00-13:00: Unit tests (ConversationContext + SlashCommandRegistry)

**Afternoon (4 hours)**
- 13:00-15:00: Command tests + REPLSession tests
- 15:00-17:00: Documentation (user guide + README)

**Evening (Optional 1 hour)**
- 17:00-18:00: Quality gate review + final polish

---

## 🔧 Technical Decisions

### Decision 1: Database Schema for Conversations

**Question:** How to store conversation metadata (activeAgent, variables)?

**Options:**
1. Separate columns for each field
2. JSON column for all metadata
3. Separate tables for variables

**Decision:** Option 2 - JSON column

**Rationale:**
- Flexible (easy to add new fields)
- Matches existing schema pattern
- Simple to query and update
- Variables may be arbitrary structure

**Schema:**
```sql
conversations:
  id TEXT PRIMARY KEY
  userId TEXT NOT NULL
  metadata TEXT (JSON: {activeAgent?, activeWorkflow?, variables})
  createdAt TEXT
  updatedAt TEXT
```

### Decision 2: Auto-save Frequency

**Question:** How often to auto-save to database?

**Options:**
1. Every message (heavy DB writes)
2. Every 5 messages (balanced)
3. Only on exit (risk of data loss)
4. Debounced (complex)

**Decision:** Option 2 + Option 3

**Rationale:**
- Every 5 messages: Balances writes vs safety
- On exit: Ensures final state saved
- Configurable via REPLOptions
- User can manually save with `/save` for JSON backup

### Decision 3: Load Conversation on Startup

**Question:** Should REPL automatically load last conversation on startup?

**Options:**
1. Yes - Auto-load most recent
2. No - Always start fresh
3. Ask user on startup
4. Add `/load recent` command

**Decision:** Option 2 for Week 1, Option 4 for future

**Rationale:**
- Week 1 MVP: Simple behavior (start fresh)
- User has explicit control with `/load <id>`
- Avoids surprising behavior
- Can add "resume session" in Week 6

### Decision 4: Test Coverage Target

**Question:** How many tests for Week 1?

**Options:**
1. 100% coverage (too ambitious)
2. 80% coverage (standard goal)
3. 60% coverage (pragmatic for Week 1)
4. Critical paths only (~20 tests)

**Decision:** Option 4

**Rationale:**
- Week 1 is MVP, not production release
- 20 well-chosen tests cover critical functionality
- More tests in Week 6 (polish phase)
- Focus on integration tests over unit tests

**Critical Paths:**
- Message persistence (save/load cycle)
- Command execution
- Context management
- Error handling

### Decision 5: Streaming Implementation

**Question:** Token-by-token streaming or ora spinner?

**Options:**
1. Full token-by-token streaming (complex)
2. Ora spinner only (simple)
3. Hybrid (spinner + partial updates)

**Decision:** Option 2 for Week 1

**Rationale:**
- ora is professional and sufficient
- Saves 4-6 hours implementation time
- Can upgrade to full streaming in Week 6
- User feedback: "just show me it's working"

---

## 🐛 Anticipated Issues & Mitigations

### Issue 1: DAO API Mismatch

**Risk:** ConversationDAO/MessageDAO may not have expected methods

**Mitigation:**
- Read DAO files first (30 min invested upfront)
- May need to add upsert() methods
- May need to add getByConversationId() to MessageDAO
- Budget 1 hour for DAO enhancements

### Issue 2: Database Schema Mismatch

**Risk:** conversations/messages tables may not exist or have different schema

**Mitigation:**
- Check migrations first
- May need to create migration 014_create_conversations_messages.sql
- Use existing migration pattern
- Budget 30 min for migration creation

### Issue 3: Transaction Support

**Risk:** Need atomic save (conversation + messages together)

**Mitigation:**
- Use db.transaction() if available
- If not, accept risk of partial save (unlikely in Week 1)
- Add transaction support in Week 6 if needed

### Issue 4: Test Environment Setup

**Risk:** Tests need in-memory database, mocks for providers

**Mitigation:**
- Use `:memory:` SQLite database for tests
- Mock ProviderRouterV2 with simple responses
- Mock AgentRegistry with test agents
- Copy patterns from existing tests

### Issue 5: Time Overrun

**Risk:** Day 4-5 tasks may take longer than estimated

**Mitigation:**
- Cut scope if needed:
  - Skip auto-load on startup (not critical)
  - Reduce tests from 20 to 15 (still acceptable)
  - Reduce docs (focus on README only)
- Quality gate > polish
- Week 6 is buffer for remaining items

---

## 📝 Detailed Task Breakdown

### Day 4 Tasks (6-8 hours)

**Task 4.1: Understand DAO Layer (30 min)**
- Read src/database/dao/ConversationDAO.ts
- Read src/database/dao/MessageDAO.ts
- Check migrations for conversations/messages tables
- List required methods: create, get, update, getByConversationId

**Task 4.2: Implement saveToDB() (2 hours)**
- Add upsert() to ConversationDAO if missing
- Add upsert() to MessageDAO if missing
- Implement ConversationContext.saveToDB():
  - Save conversation metadata to conversations table
  - Batch save messages to messages table
  - Handle errors gracefully
  - Add logging for debugging

**Task 4.3: Implement loadFromDB() (2 hours)**
- Add getByConversationId() to MessageDAO if missing
- Implement ConversationContext.loadFromDB():
  - Load conversation record
  - Load all messages
  - Reconstruct ConversationContext
  - Restore all state (agent, workflow, variables)
  - Handle missing conversation (return null)

**Task 4.4: Auto-save Integration (1 hour)**
- Update REPLSession.stop() to call saveToDB()
- Add auto-save every N messages in handleNaturalLanguage()
- Make save interval configurable
- Test auto-save doesn't block REPL

**Task 4.5: Manual Testing (2 hours)**
- Test each command individually
- Test save/load cycle:
  1. Create conversation, add messages
  2. /save to JSON
  3. Set active agent
  4. Exit (auto-saves to DB)
  5. Relaunch
  6. /load from JSON
  7. Verify state restored
- Test error cases
- Fix bugs found

### Day 5 Tasks (7-8 hours)

**Task 5.1: StreamingHandler (2 hours)**
- Create src/cli/interactive/StreamingHandler.ts
- Implement spinner methods:
  - startThinking()
  - updateText()
  - stopSuccess()
  - stopError()
- Integrate with REPLSession.handleNaturalLanguage()
- Test spinner appearance
- Optional: Add elapsed time display

**Task 5.2: ConversationContext Tests (1 hour)**
- Create __tests__/ConversationContext.test.ts
- Write 5 tests:
  1. Create conversation
  2. Add/retrieve messages
  3. Manage active agent
  4. Snapshot save/restore
  5. Database persistence

**Task 5.3: SlashCommandRegistry Tests (30 min)**
- Create __tests__/SlashCommandRegistry.test.ts
- Write 3 tests:
  1. Register and execute
  2. Alias resolution
  3. Duplicate registration error

**Task 5.4: Command Tests (2 hours)**
- Create __tests__/commands/ directory
- Write 9 command tests:
  - HelpCommand: lists commands
  - ContextCommand: displays context
  - HistoryCommand: displays history
  - AgentCommand: sets agent
  - SaveCommand: exports JSON
  - LoadCommand: imports JSON
  - MemoryCommand: delegates (mock spawn)
  - WorkflowCommand: delegates (mock spawn)
  - AgentsCommand: lists and filters

**Task 5.5: REPLSession Tests (30 min)**
- Create __tests__/REPLSession.test.ts
- Write 3 tests:
  1. Creates context on init
  2. Tracks messages
  3. Saves on stop (indirect test)

**Task 5.6: Documentation (2 hours)**
- Update README.md:
  - Add "Interactive CLI Mode" section
  - Command reference table
  - Quick start guide
- Create docs/cli/interactive-mode.md:
  - Full user guide
  - Examples
  - Troubleshooting
- Optional: Create architecture doc

**Task 5.7: Quality Gate Review (30 min)**
- Run all tests: `npm test`
- Run full build: `npm run build`
- Launch REPL: `npm run cli -- cli`
- Test all 13 commands manually
- Check documentation renders correctly
- Review checklist (functional, quality, docs)
- Create Week 1 completion report

---

## 🎉 Success Criteria

### Week 1 Complete When:

✅ All 13 commands working
✅ Conversation persistence (SQLite)
✅ Ora spinner for AI requests
✅ 20+ unit tests passing
✅ Documentation complete
✅ Quality gate criteria met
✅ No critical bugs
✅ Code committed to git
✅ Week 1 summary document created

### Deliverables

1. **Code:**
   - ConversationContext with SQLite persistence
   - StreamingHandler with ora
   - 13 working slash commands
   - 20+ unit tests

2. **Documentation:**
   - README updated
   - User guide (docs/cli/interactive-mode.md)
   - Week 1 completion summary

3. **Quality:**
   - All tests passing
   - No TypeScript errors in new files
   - Manual testing complete
   - Quality gate review passed

---

## 📊 Risk Assessment

### High Priority Risks (Must Address)

**Risk 1: DAO Methods Missing**
- **Probability:** Medium
- **Impact:** High (blocks Day 4)
- **Mitigation:** Read DAO files first, budget time for additions
- **Contingency:** Implement minimal DAO methods inline if needed

**Risk 2: Time Overrun**
- **Probability:** Medium
- **Impact:** Medium (delays completion)
- **Mitigation:** Cut optional features first (auto-load, extra tests)
- **Contingency:** Extend to Day 6 if absolutely necessary

### Medium Priority Risks

**Risk 3: Test Setup Complexity**
- **Probability:** Low
- **Impact:** Medium (slows Day 5)
- **Mitigation:** Copy existing test patterns, use simple mocks
- **Contingency:** Reduce test count to 15 critical tests

**Risk 4: Database Migration Issues**
- **Probability:** Low
- **Impact:** Medium (blocks persistence)
- **Mitigation:** Check migrations first, follow existing patterns
- **Contingency:** Create minimal schema if migrations incomplete

### Low Priority Risks

**Risk 5: ora Integration Issues**
- **Probability:** Very Low
- **Impact:** Low (fallback to console.log)
- **Mitigation:** ora is simple, well-documented library
- **Contingency:** Use console.log with emojis if ora fails

---

## 🚀 Implementation Order (Optimized)

### Phase 1: Critical Path (Day 4 Morning)
1. Read DAO files (understand existing API)
2. Check database schema/migrations
3. Implement saveToDB() (core persistence)
4. Quick smoke test (can save work!)

### Phase 2: Load Functionality (Day 4 Afternoon)
5. Implement loadFromDB() (restore conversations)
6. Auto-save integration (don't lose work)
7. Manual testing (verify persistence works end-to-end)

### Phase 3: Polish (Day 5 Morning)
8. StreamingHandler (better UX)
9. Core tests (ConversationContext, SlashCommandRegistry)

### Phase 4: Quality (Day 5 Afternoon)
10. Command tests (verify behavior)
11. Documentation (enable users)
12. Quality gate review (ensure readiness)

**Rationale:**
- Persistence first (highest value, enables everything else)
- Tests after implementation (verify what's built)
- Documentation last (document what exists)
- Streaming early in Day 5 (easy win, improves UX)

---

## 📋 Pre-flight Checklist

Before starting Day 4 implementation:

**Code Readiness:**
- [ ] Days 1-3 code committed to git
- [ ] All 13 commands working in current state
- [ ] No blocking TypeScript errors in new files
- [ ] Database connection working

**DAO Readiness:**
- [ ] ConversationDAO file exists and readable
- [ ] MessageDAO file exists and readable
- [ ] Database schema understood
- [ ] Migration pattern understood

**Testing Readiness:**
- [ ] Vitest configured and working
- [ ] Existing tests run successfully
- [ ] Test patterns understood (mocking, assertions)
- [ ] In-memory DB setup known

**Documentation Readiness:**
- [ ] README structure understood
- [ ] docs/ directory accessible
- [ ] Markdown preview working
- [ ] Examples to reference

---

## 💡 Key Insights

### Insight 1: Incremental Value Delivery
Each sub-task delivers user value:
- saveToDB() → Don't lose work on crash
- loadFromDB() → Resume conversations
- Auto-save → Invisible safety net
- Streaming → Professional feel
- Tests → Confidence in quality
- Docs → Enable users

### Insight 2: MVP-first Philosophy
Week 1 is about **working** not **perfect**:
- In-memory before SQLite ✅
- Ora spinner before full streaming ✅
- 20 tests before 100% coverage ✅
- README before full docs suite ✅

Can enhance in Week 6 (polish phase).

### Insight 3: Risk Management Through Order
By doing persistence first:
- If time runs short, have working persistence
- Tests can verify real persistence
- Documentation can describe real behavior
- Quality gate can test actual features

### Insight 4: Leverage Existing Patterns
Don't reinvent:
- Use existing DAO patterns
- Copy existing test structure
- Follow existing migration format
- Match existing code style

Saves hours of decision-making.

---

## 🎯 Next Actions (Starting Day 4)

**Immediate (Next 30 minutes):**
1. Read ConversationDAO.ts fully
2. Read MessageDAO.ts fully
3. Check database schema in migrations
4. List any missing methods needed

**Then (Next 2 hours):**
5. Implement saveToDB() method
6. Test save to database manually
7. Verify data in .automatosx/db/*.db

**Then (Next 2 hours):**
8. Implement loadFromDB() method
9. Test load from database
10. Verify full round-trip (save → load → verify)

**Today Goal (End of Day 4):**
- ✅ Conversation persistence working
- ✅ All 13 commands manually tested
- ✅ Save/load cycle verified
- ✅ Ready for Day 5 (polish)

---

**Document Version:** 1.0
**Date:** 2025-01-11
**Status:** Ready to Implement Days 4-5
**Estimated Completion:** End of Day 5 (Week 1 Complete)
