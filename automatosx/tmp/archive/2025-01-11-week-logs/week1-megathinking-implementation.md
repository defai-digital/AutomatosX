# Week 1 Interactive CLI - Megathinking Implementation Analysis

**Date:** 2025-01-11
**Goal:** Implement Interactive CLI Mode (Days 1-5)
**Status:** Planning → Implementation

---

## 🧠 Megathinking: Implementation Strategy

### Context Analysis

**What We Have (v8.0.0 current):**
- ✅ `ProviderRouterV2` - Multi-provider AI integration (580 LOC, battle-tested)
- ✅ `AgentRegistry` - 21 agents with capability matching (303 LOC)
- ✅ `ConversationDAO` + `MessageDAO` - SQLite persistence ready
- ✅ `WorkflowEngineV2` - Workflow execution (567 LOC)
- ✅ Commander.js CLI framework in place
- ✅ Database schema with `conversations` and `messages` tables

**What We Need to Build:**
- ❌ REPLSession - Readline interface with input routing
- ❌ SlashCommandRegistry - 13 commands with execution
- ❌ StreamingHandler - Token-by-token output
- ❌ ConversationContext - Context management (builds on existing DAOs)
- ❌ NaturalLanguageRouter - Intent classification (simple for Week 1)

**Critical Insight:** We're NOT building from scratch - we're creating a thin REPL layer over existing infrastructure. This is a 5-day integration task, not a 2-week greenfield project.

---

## 🎯 Week 1 Refined Strategy

### Day 1-2: Core REPL (Minimum Viable)

**Philosophy:** Get a working REPL loop FAST, then iterate.

**Minimum Viable REPL (4 hours):**
1. Basic readline interface
2. Input → echo back
3. CTRL+C handling
4. `/exit` command

**Then Build Up (12 hours):**
1. Route `/` to SlashCommandRegistry (stub)
2. Route natural language to ProviderRouter (direct pass-through)
3. Add autocomplete for slash commands
4. Add command history (readline built-in)

**Key Decision:** Start with SYNC execution for simplicity, add streaming in Day 5.

**Files:**
- `src/cli/interactive/REPLSession.ts` (Start: 50 LOC → End: 150 LOC)
- `src/cli/interactive/types.ts` (Shared types)

**Tests:**
- REPLSession initialization
- Input routing (slash vs natural)
- Graceful shutdown

---

### Day 3-4: Slash Commands (Progressive Enhancement)

**Philosophy:** Build 3 commands deeply, then clone pattern for remaining 10.

**Priority Order (by complexity):**

**Tier 1 - Simple (no external deps):**
1. `/help` - List all commands (15 min)
2. `/exit` - Close REPL (5 min, already done)
3. `/clear` - Clear screen (10 min)

**Tier 2 - Read-only (existing infrastructure):**
4. `/agents` - List agents from AgentRegistry (30 min)
5. `/status` - System status from existing `ax status` (30 min)
6. `/config` - Show config from existing `ax config` (30 min)
7. `/context` - Show current context (30 min)

**Tier 3 - Stateful (context manipulation):**
8. `/history [n]` - Show last n messages from MessageDAO (45 min)
9. `/agent <name>` - Set active agent in context (30 min)

**Tier 4 - Complex (file I/O):**
10. `/save <path>` - Export conversation JSON (60 min)
11. `/load <path>` - Import conversation JSON (60 min)

**Tier 5 - Delegated (call existing commands):**
12. `/memory <query>` - Call `ax memory search` (30 min)
13. `/workflow <path>` - Call `ax workflow run` (30 min)

**Key Decision:** Commands 12-13 delegate to existing CLI commands via child_process for Week 1. Week 2 can refactor to direct calls.

**Files:**
- `src/cli/interactive/SlashCommandRegistry.ts` (150 LOC)
- `src/cli/interactive/commands/HelpCommand.ts` (50 LOC)
- `src/cli/interactive/commands/AgentsCommand.ts` (60 LOC)
- ... (11 more command files, ~50-80 LOC each)

**Tests:**
- Registry register/list/execute
- Each command in isolation

---

### Day 5: Streaming (Polish Layer)

**Philosophy:** Streaming is UX polish, not core functionality. Add last.

**Approach:**
1. Create `StreamingHandler.ts` with ora spinners
2. Wrap ProviderRouter responses
3. Token-by-token display (use `process.stdout.write`)

**Key Decision:** For Week 1, even without full streaming, we can show "thinking..." spinner and then display full response. True token-by-token can be Week 2 enhancement if time is tight.

**Files:**
- `src/cli/interactive/StreamingHandler.ts` (100 LOC)

**Tests:**
- Token streaming
- Spinner start/stop
- Color coding

---

## 🔧 Technical Decisions

### Decision 1: Readline vs Inquirer vs Custom

**Options:**
- A) Readline (built-in, lightweight, manual)
- B) Inquirer (rich prompts, heavier, opinionated)
- C) Custom (full control, most work)

**Choice: A) Readline**

**Rationale:**
- Built-in (no dependency)
- Sufficient for REPL needs (prompt, autocomplete, history)
- We control the loop, not the library
- Can upgrade to Inquirer later if needed

---

### Decision 2: Sync vs Async Command Execution

**Options:**
- A) All commands async (Future-proof, complex)
- B) All commands sync (Simple, blocking)
- C) Hybrid (async for I/O, sync for simple)

**Choice: A) All commands async**

**Rationale:**
- Slash commands may call ProviderRouter (async)
- Slash commands may read/write files (async)
- Readline supports async naturally with `.on('line', async (input) => ...)`
- Only minor complexity cost

---

### Decision 3: Context Storage (In-Memory vs SQLite)

**Options:**
- A) In-memory Map (fast, lost on exit)
- B) SQLite immediate (persistent, slower)
- C) In-memory + SQLite periodic save (best of both)

**Choice: C) In-memory + SQLite periodic save**

**Rationale:**
- Fast reads during REPL session (in-memory)
- Persistent across sessions (SQLite)
- Save context every 5 messages or on `/save` or CTRL+C
- Use existing ConversationDAO/MessageDAO

---

### Decision 4: Natural Language Routing (Week 1)

**Options:**
- A) Direct pass-through to ProviderRouter (simplest)
- B) Pattern matching + ProviderRouter (Week 6 NL interface)
- C) Full NLP with IntentClassifier (overkill for Week 1)

**Choice: A) Direct pass-through to ProviderRouter**

**Rationale:**
- Week 1 focus: Get REPL working
- Week 6: Sophisticated NL command mapping
- For now: User types natural language → send to Claude → display response
- Good enough to demonstrate Interactive CLI value

---

## 🚧 Implementation Risks & Mitigations

### Risk 1: Readline Blocking Main Thread

**Issue:** Long-running commands block input

**Mitigation:**
- Mark REPL as "processing" (disable new input)
- Show spinner during execution
- CTRL+C cancels current operation
- Async commands don't block (naturally)

---

### Risk 2: Context Serialization Failures

**Issue:** Complex objects may not JSON.stringify cleanly

**Mitigation:**
- Store only serializable primitives in context
- Use `JSON.stringify(context, null, 2)` with error handling
- Fallback to error message if serialization fails

---

### Risk 3: Command Registration Conflicts

**Issue:** Two commands with same name or alias

**Mitigation:**
- SlashCommandRegistry throws on duplicate registration
- Unit tests verify all 13 commands have unique names
- Aliases array checked for conflicts

---

### Risk 4: Streaming Latency

**Issue:** Token-by-token may feel slow if latency is high

**Mitigation:**
- Batch tokens in 50ms windows (10-20 tokens at once)
- Only stream for responses >100 tokens
- Short responses display immediately
- Spinner for first token latency (<2s expected)

---

## 📋 Day-by-Day Execution Plan

### Day 1 (Monday) - REPLSession Foundation

**Morning (4 hours):**
1. Create `src/cli/interactive/types.ts` (30 min)
   - Define interfaces: `REPLOptions`, `REPLState`, `CommandContext`

2. Create `src/cli/interactive/REPLSession.ts` (2 hours)
   - Readline interface setup
   - Basic input loop
   - `/exit` command
   - CTRL+C, CTRL+D handling

3. Create entry point: `src/cli/commands/cli.ts` (30 min)
   - New command: `ax cli`
   - Launch REPLSession

4. Manual testing (1 hour)
   - Build and run: `npm run build && npm run cli -- cli`
   - Verify input/output works
   - Test CTRL+C behavior

**Afternoon (4 hours):**
5. Add input routing logic (1.5 hours)
   - Detect `/` prefix → slash command path
   - Otherwise → natural language path
   - Stub handlers for both

6. Unit tests (1.5 hours)
   - `REPLSession.test.ts`
   - Test initialization, routing, shutdown

7. Add autocomplete skeleton (1 hour)
   - Register readline completer
   - Return slash command names

**Deliverable:** Working REPL that echoes input and handles `/exit`

---

### Day 2 (Tuesday) - SlashCommandRegistry Foundation

**Morning (4 hours):**
1. Create `src/cli/interactive/SlashCommandRegistry.ts` (2 hours)
   - Interface: `SlashCommand`
   - Registry: register, get, list, execute
   - Error handling for unknown commands

2. Create `src/cli/interactive/commands/HelpCommand.ts` (1 hour)
   - List all registered commands
   - Show usage and description

3. Create `src/cli/interactive/commands/ExitCommand.ts` (30 min)
   - Signal REPLSession to stop

4. Integrate with REPLSession (30 min)
   - Instantiate registry
   - Route `/` commands to registry

**Afternoon (4 hours):**
5. Create Tier 1 commands (1 hour)
   - `ClearCommand.ts` - Clear screen

6. Create Tier 2 commands (2 hours)
   - `AgentsCommand.ts` - List agents
   - `StatusCommand.ts` - System status
   - `ConfigCommand.ts` - Show config

7. Unit tests (1 hour)
   - `SlashCommandRegistry.test.ts`
   - Test each command

**Deliverable:** 6 slash commands working (`/help`, `/exit`, `/clear`, `/agents`, `/status`, `/config`)

---

### Day 3 (Wednesday) - Context Management

**Morning (4 hours):**
1. Create `src/cli/interactive/ConversationContext.ts` (2.5 hours)
   - ContextManager class
   - In-memory context state
   - Integration with ConversationDAO/MessageDAO
   - Session create/load/save

2. Create `ContextCommand.ts` (30 min)
   - Display current context (JSON pretty-print)

3. Create `HistoryCommand.ts` (1 hour)
   - Query MessageDAO for last N messages
   - Format and display

**Afternoon (4 hours):**
4. Create `AgentCommand.ts` (set active agent) (1 hour)
   - Update context.activeAgent
   - Verify agent exists in registry

5. Integration with REPLSession (1 hour)
   - Create ContextManager on startup
   - Pass context to all commands
   - Save context on shutdown

6. Unit tests (2 hours)
   - `ConversationContext.test.ts`
   - Context persistence tests

**Deliverable:** Context persists across sessions, `/context`, `/history`, `/agent` commands work

---

### Day 4 (Thursday) - File I/O Commands

**Morning (4 hours):**
1. Create `SaveCommand.ts` (2 hours)
   - Export conversation to JSON file
   - Include messages + context + metadata
   - Error handling (file permissions, etc.)

2. Create `LoadCommand.ts` (2 hours)
   - Import conversation from JSON file
   - Validate schema
   - Merge into current session or replace

**Afternoon (4 hours):**
3. Create delegated commands (2 hours)
   - `MemoryCommand.ts` - Call `ax memory search <query>`
   - `WorkflowCommand.ts` - Call `ax workflow run <path>`
   - Use child_process.spawn
   - Stream output back to REPL

4. Unit tests (2 hours)
   - Test save/load with fixtures
   - Test delegated commands with mocks

**Deliverable:** All 13 slash commands implemented and tested

---

### Day 5 (Friday) - Streaming & Polish

**Morning (4 hours):**
1. Create `src/cli/interactive/StreamingHandler.ts` (2 hours)
   - Token-by-token output with `process.stdout.write`
   - Ora spinner for "thinking"
   - Color-coded output (chalk)

2. Integrate streaming with ProviderRouter (1 hour)
   - Detect streaming support in provider response
   - Fall back to full response if no streaming

3. Natural language routing (1 hour)
   - Send input to ProviderRouter
   - Stream response back with StreamingHandler

**Afternoon (4 hours):**
4. Polish and bug fixes (2 hours)
   - Welcome message on startup
   - Better error messages
   - Handle edge cases

5. Integration testing (1 hour)
   - Full end-to-end manual test
   - All 13 commands
   - Natural language input
   - Context persistence

6. Documentation (1 hour)
   - Update README with `ax cli` usage
   - Add examples of slash commands

**Deliverable:** Interactive CLI complete with streaming, all commands working, ready for Week 2

---

## 🧪 Testing Strategy (Week 1)

### Unit Tests (40 tests)

**REPLSession.test.ts (8 tests):**
- [x] Initialize readline interface
- [x] Route slash commands
- [x] Route natural language
- [x] Handle CTRL+C
- [x] Handle CTRL+D (EOF)
- [x] Autocomplete suggestions
- [x] Ignore empty input
- [x] Trim whitespace

**SlashCommandRegistry.test.ts (6 tests):**
- [x] Register command
- [x] Get command by name
- [x] Get command by alias
- [x] List all commands
- [x] Execute command
- [x] Throw on unknown command

**Commands (13 tests, one per command):**
- [x] HelpCommand
- [x] ExitCommand
- [x] ClearCommand
- [x] AgentsCommand
- [x] StatusCommand
- [x] ConfigCommand
- [x] ContextCommand
- [x] HistoryCommand
- [x] AgentCommand
- [x] SaveCommand
- [x] LoadCommand
- [x] MemoryCommand
- [x] WorkflowCommand

**ConversationContext.test.ts (8 tests):**
- [x] Create session
- [x] Load session
- [x] Add message
- [x] Get history
- [x] Clear history
- [x] Set variable
- [x] Set active agent
- [x] Save/restore context

**StreamingHandler.test.ts (5 tests):**
- [x] Start/stop spinner
- [x] Stream tokens
- [x] Handle line breaks
- [x] Display error
- [x] Display success

**Total: 40 tests**

---

### Integration Tests (5 tests)

**interactive-cli.test.ts:**
1. Full conversation flow (user input → response)
2. Slash command execution
3. Context persistence across restart
4. Save/load conversation
5. Streaming response

---

### Manual Testing Checklist

- [ ] Launch: `ax cli`
- [ ] Welcome screen displays
- [ ] Type natural language, get response
- [ ] Type `/help`, see all commands
- [ ] Type `/agents`, see agent list
- [ ] Type `/status`, see system status
- [ ] Type `/history`, see conversation
- [ ] Type `/context`, see current context
- [ ] Type `/agent security`, set active agent
- [ ] Type `/save test.json`, export conversation
- [ ] Type `/load test.json`, import conversation
- [ ] Type `/memory "test"`, search memory
- [ ] Type `/workflow workflows/test.yaml`, run workflow
- [ ] Press CTRL+C, session saves and exits
- [ ] Restart, context restored
- [ ] Autocomplete works (TAB)
- [ ] Arrow up/down navigate history
- [ ] Streaming displays smoothly

---

## 📦 Dependencies Check

### Existing (Already Installed)
- ✅ `readline` (Node.js built-in)
- ✅ `chalk` (terminal colors)
- ✅ `commander` (CLI framework)

### New (Need to Install)
- ❌ `ora` - Loading spinners
- ❌ `inquirer` - (Optional, not using in Week 1)

**Action:**
```bash
npm install --save ora
npm install --save-dev @types/ora
```

---

## 🎯 Success Criteria (Week 1 Gate)

### Functional Requirements
- ✅ `ax cli` launches REPL
- ✅ All 13 slash commands work
- ✅ Natural language input → provider response
- ✅ Context persists across sessions
- ✅ Graceful shutdown (CTRL+C)
- ✅ Streaming responses (or spinner + full response)

### Quality Requirements
- ✅ >80% test coverage (40+ unit tests)
- ✅ <200ms input latency (input to first output)
- ✅ No crashes on invalid input
- ✅ Error messages are clear and helpful

### Documentation Requirements
- ✅ README updated with `ax cli` usage
- ✅ Examples of slash commands
- ✅ Troubleshooting guide

---

## 🔄 Iteration Strategy

### Minimum Viable Product (MVP) - By End of Day 3
- REPL launches
- 6 slash commands work (`/help`, `/exit`, `/clear`, `/agents`, `/status`, `/config`)
- Natural language pass-through to provider
- Context in-memory (no persistence yet)

### Complete Feature Set - By End of Day 4
- All 13 slash commands
- Context persistence with SQLite
- Save/load conversations

### Polish - Day 5
- Streaming
- Error handling
- Documentation
- Testing

**Key Insight:** If we're blocked on streaming (Day 5), we can ship Week 1 with spinner + full response and add streaming in Week 2. The core REPL loop is more important than streaming polish.

---

## 🚀 Ready to Implement

**Next Steps:**
1. Use ax agent to validate this plan
2. Begin Day 1 implementation
3. Daily check-ins with quality gates
4. Adjust plan if needed based on progress

**Confidence:** HIGH
- Clear day-by-day plan
- Realistic scope (5 days, 40 hours)
- Building on solid foundation (existing v8.0.0 infrastructure)
- Escape hatches if behind (MVP by Day 3, skip streaming if needed)

---

**Document Version:** 1.0
**Date:** 2025-01-11
**Status:** Ready for validation with ax agent
