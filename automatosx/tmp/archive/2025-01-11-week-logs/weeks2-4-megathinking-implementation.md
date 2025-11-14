# Weeks 2-4 - Megathinking Implementation Plan

**Date:** 2025-01-11
**Context:** Week 1 Complete, Week 2 Day 1 Complete
**Goal:** Complete Weeks 2-4 implementation
**Total Duration:** ~3 weeks (15 working days)

---

## 🤔 Strategic Analysis

### Current State Assessment

**Completed (Week 1 + Week 2 Day 1):**
- ✅ Interactive CLI (2,115 LOC, 13 commands)
- ✅ Core tests (36 tests, 100% passing)
- ✅ User documentation (960 lines)
- ✅ SQLite persistence working
- ✅ Agent & workflow integration

**Remaining Work:**
- ⏳ README update (~100 lines)
- ⏳ Architecture docs (~400 lines)
- 📋 TUI Dashboard (~1,400 LOC)
- 📋 Web UI Dashboard (~2,500 LOC)
- 📋 Integration & polish

### Three-Week Roadmap Overview

**Week 2 (Remaining 4 days):**
- Days 2-3: Complete documentation & polish
- Days 4-5: Start TUI Dashboard foundation

**Week 3 (5 days):**
- Complete TUI Dashboard with Ink
- Real-time metrics monitoring
- Terminal navigation & polish

**Week 4 (5 days):**
- Begin Web UI Dashboard (React)
- Or: LSP enhancements & editor integration
- Or: Advanced CLI features

---

## 📋 Week 2 Detailed Plan (Days 2-5)

### Day 2: Complete Core Documentation

**Morning: README.md Update (3 hours)**

**File:** `/Users/akiralam/code/automatosx2/README.md`

**Changes:**
1. Add Interactive CLI section after current features
2. Add command table
3. Add quick start example
4. Link to full documentation

**Implementation:**
```markdown
## Interactive CLI Mode

AutomatosX includes a ChatGPT-style Interactive CLI for natural language conversations with AI assistants.

### Quick Start

\`\`\`bash
# Launch Interactive CLI
ax cli

# Set an agent
> /agent BackendAgent

# Ask questions
> how do I handle database connections in Express?

# Run workflows
> /workflow run code-review
\`\`\`

### Features

- 🤖 Natural language conversations (Claude, Gemini, OpenAI)
- ⚡ 13 slash commands for system control
- 💾 Auto-save conversations (SQLite)
- 🎯 Agent collaboration (specialized AI personas)
- 🔄 Workflow integration (automated tasks)
- ⌨️  Tab autocomplete & history navigation

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show all commands | `/help` |
| `/agent <name>` | Set active agent | `/agent BackendAgent` |
| `/workflow run <name>` | Execute workflow | `/workflow run test-gen` |
| `/history [limit]` | View message history | `/history 20` |
| `/save <file>` | Export conversation | `/save session.json` |
| `/memory search <query>` | Search code index | `/memory search "getUserById"` |

**[Full Documentation →](docs/cli/interactive-mode.md)**

### Example Session

\`\`\`
> /agent BackendAgent
✓ Active agent set to: BackendAgent

> how do I implement rate limiting in Express?

BackendAgent: For Express rate limiting, I recommend using express-rate-limit...

[provides detailed implementation]

> show me the code

BackendAgent: Here's a complete example:

\`\`\`javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
\`\`\`

> /save rate-limit-session.json
✓ Conversation exported to: rate-limit-session.json
\`\`\`
```

**Estimated LOC:** ~120 lines

**Afternoon: Architecture Documentation (4 hours)**

**File:** `docs/cli/interactive-architecture.md`

**Structure:**
```markdown
# AutomatosX Interactive CLI - Architecture

## System Overview

The Interactive CLI is a ChatGPT-style REPL built on Node.js with TypeScript, providing natural language conversations with AI providers while maintaining conversation context and state.

### High-Level Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                      User Terminal                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                    REPLSession                           │
│  - readline interface                                    │
│  - Input routing (slash commands vs natural language)   │
│  - Autocomplete & history                                │
└───────────┬─────────────────────────┬───────────────────┘
            │                         │
            ↓                         ↓
┌─────────────────────┐   ┌──────────────────────────────┐
│ SlashCommandRegistry│   │   ConversationContext        │
│  - Command lookup   │   │    - Message history         │
│  - Alias resolution │   │    - Agent state             │
│  - Execute commands │   │    - Variables               │
└─────────┬───────────┘   │    - Snapshots               │
          │               └──────────┬───────────────────┘
          ↓                          │
┌─────────────────────┐             ↓
│   Command Classes   │   ┌──────────────────────────────┐
│  - HelpCommand      │   │    Database (SQLite)         │
│  - AgentCommand     │   │  - conversations table       │
│  - WorkflowCommand  │   │  - messages table            │
│  - SaveCommand      │   │  - ConversationDAO           │
│  - etc (13 total)   │   │  - MessageDAO                │
└─────────────────────┘   └──────────────────────────────┘
            │
            ↓
┌─────────────────────────────────────────────────────────┐
│              External Systems                            │
│  - ProviderRouter (Claude/Gemini/OpenAI)                │
│  - AgentRegistry (specialized AI personas)              │
│  - WorkflowEngine (automated tasks)                     │
│  - FileService (code memory search)                     │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Component Details

### 1. REPLSession

**Responsibility:** Main REPL manager with readline interface

**File:** `src/cli/interactive/REPLSession.ts` (220 LOC)

**Key Methods:**
- \`start()\` - Initialize REPL and display welcome
- \`stop()\` - Save conversation and exit gracefully
- \`handleInput(input)\` - Route to slash command or natural language
- \`handleSlashCommand(input)\` - Execute registered command
- \`handleNaturalLanguage(input)\` - Send to AI provider
- \`autocomplete(line)\` - Tab completion for commands

**Dependencies:**
- Node.js \`readline\` module
- ConversationContext (manages state)
- SlashCommandRegistry (command execution)
- StreamingHandler (loading indicators)
- ProviderRouterV2 (AI requests)

**Data Flow:**
\`\`\`
User Input → handleInput()
    ↓
Is it a slash command?
    ↓ YES                    ↓ NO
handleSlashCommand()   handleNaturalLanguage()
    ↓                        ↓
SlashCommandRegistry    ProviderRouter → AI
    ↓                        ↓
Command.execute()       Response → Display
\`\`\`

### 2. ConversationContext

**Responsibility:** Manages conversation state and persistence

**File:** `src/cli/interactive/ConversationContext.ts` (370 LOC)

**Key Features:**
- In-memory message storage (fast access)
- SQLite persistence (auto-save every 5 messages)
- Agent and workflow state tracking
- Context variables (key-value store)
- Snapshot/restore for save/load

**Key Methods:**
- \`addMessage(role, content)\` - Add user/assistant/system message
- \`getMessages()\` - Retrieve all messages
- \`getRecentMessages(limit)\` - Get last N messages for context
- \`setActiveAgent(name)\` - Set specialized AI agent
- \`setVariable(key, value)\` - Store context variable
- \`saveToDB()\` - Persist to SQLite
- \`loadFromDB(db, id)\` - Restore from database
- \`getSnapshot()\` - Create JSON snapshot
- \`restoreFromSnapshot(snapshot)\` - Restore from JSON

**Database Schema:**
\`\`\`sql
conversations:
  id TEXT PRIMARY KEY
  agent_id TEXT
  user_id TEXT
  title TEXT
  state TEXT
  message_count INTEGER
  metadata JSON  -- Contains: activeAgent, activeWorkflow, variables
  created_at INTEGER
  updated_at INTEGER

messages:
  id TEXT PRIMARY KEY
  conversation_id TEXT (FK)
  role TEXT (user|assistant|system)
  content TEXT
  tokens INTEGER
  metadata JSON
  created_at INTEGER
  updated_at INTEGER
\`\`\`

### 3. SlashCommandRegistry

**Responsibility:** Command registration and execution

**File:** `src/cli/interactive/SlashCommandRegistry.ts` (120 LOC)

**Key Features:**
- Command registration with aliases
- Conflict detection (duplicate names/aliases)
- Input parsing (slash removal, arg splitting)
- Command lookup by name or alias

**Key Methods:**
- \`register(command)\` - Add command to registry
- \`execute(input, context)\` - Parse and run command
- \`get(nameOrAlias)\` - Lookup command
- \`list()\` - Get all commands

**Command Interface:**
\`\`\`typescript
interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  category?: string;
  execute(args: string[], context: CommandContext): Promise<void>;
}
\`\`\`

### 4. Command Classes (13 commands, 985 LOC total)

**Command Categories:**

**Core (3):**
- HelpCommand - List all commands
- ExitCommand - Graceful shutdown
- ClearCommand - Clear terminal

**Conversation (2):**
- ContextCommand - Show conversation state
- HistoryCommand - Display message history

**Agent (2):**
- AgentCommand - Set/clear active agent
- AgentsCommand - List all agents

**System (2):**
- StatusCommand - System health check
- ConfigCommand - Show configuration

**Data (2):**
- SaveCommand - Export to JSON
- LoadCommand - Import from JSON

**Integration (2):**
- MemoryCommand - Search code index (delegates to \`ax memory\`)
- WorkflowCommand - Execute workflow (delegates to \`ax workflow\`)

**Dependency Injection:**
Commands receive ConversationContext via \`setConversationContext()\` after registry setup.

### 5. StreamingHandler

**Responsibility:** Professional loading indicators

**File:** `src/cli/interactive/StreamingHandler.ts` (90 LOC)

**Features:**
- ora spinner with "Thinking..." message
- Color-coded (cyan)
- Elapsed time tracking
- Success/error states

**Key Methods:**
- \`startThinking()\` - Show spinner
- \`stop()\` - Hide spinner
- \`stopSuccess(message)\` - Success with checkmark
- \`stopError(message)\` - Error with X

## Data Flow Patterns

### Natural Language Flow

\`\`\`
1. User types: "what is a REST API?"
2. REPLSession.handleInput() detects no slash
3. REPLSession.handleNaturalLanguage() called
4. StreamingHandler.startThinking() shows spinner
5. ConversationContext.addMessage('user', input)
6. ConversationContext.getRecentMessages(5) for context
7. ProviderRouter.request({ messages }) → AI provider
8. StreamingHandler.stop()
9. ConversationContext.addMessage('assistant', response)
10. Display response to terminal
11. Auto-save if messageCount % 5 === 0
\`\`\`

### Slash Command Flow

\`\`\`
1. User types: "/agent BackendAgent"
2. REPLSession.handleInput() detects slash
3. REPLSession.handleSlashCommand() called
4. SlashCommandRegistry.execute() parses input
5. Registry looks up "agent" command
6. AgentCommand.execute(['BackendAgent'], context)
7. Command updates ConversationContext
8. Display success message
\`\`\`

### Persistence Flow

\`\`\`
Auto-save (every 5 messages):
1. User sends message #5, #10, #15, etc.
2. ConversationContext.saveToDB() triggered
3. ConversationDAO.create() or update()
4. MessageDAO.create() for new messages
5. Silent save (no user feedback)

Manual save:
1. User types: "/save my-session.json"
2. SaveCommand.execute()
3. ConversationContext.getSnapshot()
4. JSON.stringify(snapshot)
5. fs.writeFile(filename, json)
6. Display success message

Exit save:
1. User types: "/exit" or CTRL+C
2. REPLSession.stop() called
3. ConversationContext.saveToDB()
4. Display "Saving conversation..."
5. Display "✓ Conversation saved"
6. process.exit(0)
\`\`\`

## Extension Guide

### Adding a New Slash Command

**Step 1: Create Command File**

\`\`\`typescript
// src/cli/interactive/commands/MyCommand.ts
import type { SlashCommand, CommandContext } from '../types.js';

export class MyCommand implements SlashCommand {
  name = 'mycommand';
  description = 'Does something useful';
  usage = '/mycommand <arg>';
  aliases = ['mc'];

  async execute(args: string[], context: CommandContext): Promise<void> {
    // Access conversation context
    const conversationId = context.conversationId;
    const activeAgent = context.activeAgent;

    // Your logic here
    console.log('Command executed!');
  }
}
\`\`\`

**Step 2: Register Command**

\`\`\`typescript
// src/cli/commands/cli.ts
import { MyCommand } from '../interactive/commands/MyCommand.js';

// ... in launchCLI() function:
const commandRegistry = new SlashCommandRegistry();
commandRegistry.register(new MyCommand());
\`\`\`

**Step 3: Add Tests**

\`\`\`typescript
// src/cli/interactive/commands/__tests__/MyCommand.test.ts
describe('MyCommand', () => {
  it('should execute successfully', async () => {
    const command = new MyCommand();
    const context = createMockContext();
    await command.execute(['arg'], context);
    // Assertions...
  });
});
\`\`\`

### Adding Context-Aware Features

Commands can access ConversationContext via \`setConversationContext()\`:

\`\`\`typescript
export class MyCommand implements SlashCommand {
  private conversationContext?: ConversationContext;

  setConversationContext(context: ConversationContext): void {
    this.conversationContext = context;
  }

  async execute(args: string[], context: CommandContext): Promise<void> {
    // Access conversation state
    const messageCount = this.conversationContext?.getMessageCount();
    const messages = this.conversationContext?.getMessages();
  }
}
\`\`\`

## Testing Guide

### Unit Testing Commands

\`\`\`typescript
import { describe, it, expect } from 'vitest';
import { MyCommand } from '../MyCommand.js';

describe('MyCommand', () => {
  it('should execute with arguments', async () => {
    const command = new MyCommand();
    const mockContext: CommandContext = {
      conversationId: 'test',
      userId: 'user',
      activeAgent: null,
      activeWorkflow: null,
      variables: {},
      db: {} as any,
      providerRouter: {} as any,
      agentRegistry: {} as any
    };

    await expect(command.execute(['arg1'], mockContext)).resolves.not.toThrow();
  });
});
\`\`\`

### Testing ConversationContext

\`\`\`typescript
import Database from 'better-sqlite3';

describe('ConversationContext', () => {
  let db: Database.Database;
  let context: ConversationContext;

  beforeEach(() => {
    db = new Database(':memory:');
    // Create minimal schema
    db.exec(\`CREATE TABLE conversations (...)\`);
    context = new ConversationContext(db, 'test-user');
  });

  it('should add messages', () => {
    context.addMessage('user', 'Hello');
    expect(context.getMessageCount()).toBe(1);
  });
});
\`\`\`

## Performance Considerations

1. **Message History Limit:** Only send last 5 messages to AI (balance context vs cost)
2. **Auto-save Frequency:** Every 5 messages (balance data safety vs performance)
3. **Database Queries:** Use prepared statements (already in DAO layer)
4. **Memory Usage:** Message history grows indefinitely (consider pruning old messages)

## Security Considerations

1. **API Keys:** Stored in environment variables, never in code
2. **Conversation Data:** Contains all user inputs and AI responses
3. **Database:** SQLite file is local-only by default
4. **Export Files:** JSON exports may contain sensitive information

---

**Document Version:** 1.0
**Last Updated:** 2025-01-11
**Status:** Production Ready
\`\`\`

**Estimated LOC:** ~450 lines

**Evening: Quick Performance Check (1 hour)**
- Profile command execution times
- Check memory usage after 50+ messages
- Verify auto-save doesn't block
- Document findings

---

### Day 3: Architecture Documentation Completion

**Morning: Add Diagrams & Examples (3 hours)**
- Create component relationship diagram
- Add data flow visualizations
- Include code examples for each pattern

**Afternoon: Testing Guide & Extension Examples (3 hours)**
- Detailed testing guide with examples
- Extension guide with step-by-step instructions
- Best practices and patterns

**Evening: Documentation Review (1 hour)**
- Review all documentation for consistency
- Ensure links work
- Final quality check

---

### Days 4-5: Start TUI Dashboard Foundation

**Day 4 Morning: TUI Setup & Project Structure (3 hours)**

**Install Dependencies:**
\`\`\`bash
npm install ink react
npm install --save-dev @types/react
\`\`\`

**Create Directory Structure:**
\`\`\`
src/tui/
  Dashboard.tsx              # Main dashboard component
  components/
    Header.tsx               # Top bar with logo
    MetricsPanel.tsx         # System metrics display
    AgentPanel.tsx           # Active agents list
    ConversationPanel.tsx    # Recent conversations
    StatusBar.tsx            # Bottom status bar
  hooks/
    useMetrics.ts            # Metrics data fetching
    useAgents.ts             # Agent data fetching
    useConversations.ts      # Conversation data fetching
  types.ts                   # TypeScript types
  styles.ts                  # Color schemes
\`\`\`

**Create CLI Entry Point:**
\`\`\`typescript
// src/cli/commands/dashboard.ts
import { render } from 'ink';
import React from 'react';
import { Dashboard } from '../../tui/Dashboard.js';

export async function launchDashboard(): Promise<void> {
  render(React.createElement(Dashboard));
}
\`\`\`

**Register Command:**
\`\`\`typescript
// src/cli/index.ts
program
  .command('dashboard')
  .description('Launch TUI dashboard')
  .action(async () => {
    await launchDashboard();
  });
\`\`\`

**Day 4 Afternoon: Main Dashboard Layout (4 hours)**

**Create Main Dashboard:**
\`\`\`typescript
// src/tui/Dashboard.tsx
import React, { useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import { Header } from './components/Header.js';
import { MetricsPanel } from './components/MetricsPanel.js';
import { StatusBar } from './components/StatusBar.js';

export function Dashboard() {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState<'metrics' | 'agents' | 'conversations'>('metrics');

  useInput((input, key) => {
    if (input === 'q') exit();
    if (key.tab) {
      setActiveTab(prev => {
        if (prev === 'metrics') return 'agents';
        if (prev === 'agents') return 'conversations';
        return 'metrics';
      });
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box flexGrow={1} padding={1}>
        {activeTab === 'metrics' && <MetricsPanel />}
        {/* Other panels... */}
      </Box>
      <StatusBar activeTab={activeTab} />
    </Box>
  );
}
\`\`\`

**Create Header Component:**
\`\`\`typescript
// src/tui/components/Header.tsx
import React from 'react';
import { Box, Text } from 'ink';

export function Header() {
  return (
    <Box borderStyle="double" borderColor="cyan" padding={1}>
      <Text bold color="cyan">
        🤖 AutomatosX Dashboard v8.0.0
      </Text>
    </Box>
  );
}
\`\`\`

**Day 5: Metrics Panel & Data Hooks (8 hours)**

**Create useMetrics Hook:**
\`\`\`typescript
// src/tui/hooks/useMetrics.ts
import { useState, useEffect } from 'react';
import { MetricsCollector } from '../../services/MetricsCollector.js';

export function useMetrics(refreshInterval: number = 1000) {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const collector = new MetricsCollector();
    const update = () => {
      setMetrics({
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        // ... more metrics
      });
    };

    update();
    const interval = setInterval(update, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return metrics;
}
\`\`\`

**Create MetricsPanel:**
\`\`\`typescript
// src/tui/components/MetricsPanel.tsx
import React from 'react';
import { Box, Text } from 'ink';
import { useMetrics } from '../hooks/useMetrics.js';

export function MetricsPanel() {
  const metrics = useMetrics();

  if (!metrics) return <Text>Loading...</Text>;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">📊 System Metrics</Text>
      <Box marginTop={1}>
        <Text>Memory (RSS): {formatBytes(metrics.memory.rss)}</Text>
      </Box>
      <Box>
        <Text>Uptime: {formatDuration(metrics.uptime)}</Text>
      </Box>
    </Box>
  );
}
\`\`\`

---

## Week 3 Detailed Plan (Days 6-10)

### Day 6: Agent & Conversation Panels

**Create AgentPanel:**
- Display all registered agents
- Show active/inactive status
- Color-code by category

**Create ConversationPanel:**
- List recent 10 conversations
- Show message count and timestamps
- Highlight active conversation

**Estimated LOC:** ~300 lines

### Day 7: Real-time Updates & Polish

**Add Auto-refresh:**
- Update metrics every 1 second
- Smooth transitions
- No flickering

**Keyboard Navigation:**
- Tab: Switch panels
- ↑/↓: Scroll (if needed)
- Q: Quit
- R: Force refresh
- H: Show help

**Estimated LOC:** ~200 lines

### Day 8: Provider Status & Charts

**Add ProviderPanel:**
- Show Claude/Gemini/OpenAI status
- Request counts
- Error rates
- Average latency

**Optional: Add simple charts:**
- Memory usage over time
- Request rate graph

**Estimated LOC:** ~250 lines

### Day 9: Testing TUI Components

**Create Component Tests:**
\`\`\`typescript
import { render } from 'ink-testing-library';
import React from 'react';
import { Dashboard } from '../Dashboard.js';

describe('Dashboard', () => {
  it('should render header', () => {
    const { lastFrame } = render(<Dashboard />);
    expect(lastFrame()).toContain('AutomatosX Dashboard');
  });

  it('should switch tabs on Tab key', () => {
    const { stdin, lastFrame } = render(<Dashboard />);
    stdin.write('\t');
    // Check tab changed
  });
});
\`\`\`

**Estimated LOC:** ~150 lines (tests)

### Day 10: TUI Documentation & Polish

**Create TUI User Guide:**
- How to launch dashboard
- Keyboard shortcuts
- Panel descriptions
- Customization options

**Final Polish:**
- Color scheme refinement
- Error handling
- Edge cases
- Performance check

**Estimated LOC:** ~200 lines (docs)

---

## Week 4 Options Analysis

### Option A: Web UI Dashboard (React)

**Scope:**
- React + Redux + Material-UI
- Real-time WebSocket updates
- Conversation browser
- Metrics visualization with Recharts
- Production deployment

**Estimated Time:** 10 days (needs 2 weeks)

**Pros:**
- Professional web interface
- Accessible from anywhere
- Rich visualizations
- Mobile-responsive

**Cons:**
- Large scope for 1 week
- Complex (frontend + backend)
- Requires WebSocket server

**Recommendation:** Save for Weeks 4-5 (dedicated 2-week sprint)

---

### Option B: LSP Enhancements

**Scope:**
- Enhance existing LSP server
- Add workflow support to LSP
- Real-time diagnostics
- Code actions from workflows
- VS Code extension improvements

**Estimated Time:** 5 days

**Pros:**
- Extends editor integration
- High practical value
- Builds on existing LSP

**Cons:**
- Less visible than Web UI
- Requires VS Code knowledge

---

### Option C: Advanced CLI Features

**Scope:**
- Enhanced memory commands (filters, facets)
- Workflow composition (chain workflows)
- Custom agent creation (define in YAML)
- Plugin system (load external commands)
- Advanced telemetry

**Estimated Time:** 7 days

**Pros:**
- Extends CLI capabilities
- Practical improvements
- Builds on solid foundation

**Cons:**
- Less cohesive than Web UI
- Incremental improvements

---

## 🎯 Recommended Path: Weeks 2-4

### Week 2 (Days 2-5): Documentation + TUI Foundation
- ✅ Complete all documentation (Days 2-3)
- ✅ Start TUI Dashboard (Days 4-5)
- ✅ Deliverable: Production-ready docs + TUI foundation

### Week 3 (Days 6-10): Complete TUI Dashboard
- ✅ Finish all TUI panels (Days 6-8)
- ✅ Add tests and docs (Days 9-10)
- ✅ Deliverable: Fully functional TUI Dashboard

### Week 4 (Days 11-15): Option B - LSP Enhancements
- ✅ Enhance LSP server (Days 11-13)
- ✅ VS Code extension improvements (Days 14-15)
- ✅ Deliverable: Better editor integration

**Rationale:**
1. **Completes documentation cleanly** - Week 2 finishes all docs
2. **Delivers visual feature** - TUI Dashboard in Week 3
3. **Practical enhancement** - LSP improvements in Week 4
4. **Saves Web UI for later** - Dedicated 2-week sprint (Weeks 5-6)

**Alternative Week 4 Option:**
If LSP is less important, could do "Advanced CLI Features" instead.

---

## 📊 Three-Week Summary

### Total Deliverables (Weeks 2-4)

| Week | Feature | LOC | Tests | Docs | Status |
|------|---------|-----|-------|------|--------|
| **Week 2 Days 2-3** | Complete docs | ~550 | - | ~550 | 📋 Planned |
| **Week 2 Days 4-5** | TUI foundation | ~400 | - | - | 📋 Planned |
| **Week 3** | Complete TUI | ~1,000 | ~150 | ~200 | 📋 Planned |
| **Week 4** | LSP enhancements | ~800 | ~100 | ~150 | 📋 Planned |
| **Total** | **All Features** | **~2,750** | **~250** | **~900** | **📋 Ready** |

### Cumulative Progress (Weeks 1-4)

| Metric | Week 1 | +Week 2 | +Week 3 | +Week 4 | Total |
|--------|--------|---------|---------|---------|-------|
| **LOC** | 2,115 | +950 | +1,400 | +800 | **5,265** |
| **Tests** | 0 | +186 | +150 | +100 | **436** |
| **Docs** | 0 | +1,510 | +200 | +150 | **1,860** |

---

## 🎉 Success Criteria

### Week 2 Gate Review
- [ ] README mentions Interactive CLI
- [ ] Architecture docs complete with diagrams
- [ ] TUI foundation compiles and runs
- [ ] No regression in existing features

### Week 3 Gate Review
- [ ] `ax dashboard` launches TUI
- [ ] Real-time metrics update every 1s
- [ ] All panels working (Metrics, Agents, Conversations)
- [ ] Keyboard navigation functional
- [ ] Tests passing
- [ ] User guide complete

### Week 4 Gate Review (LSP Option)
- [ ] LSP server enhanced with workflow support
- [ ] VS Code extension updated
- [ ] Real-time diagnostics working
- [ ] Code actions from workflows
- [ ] Tests passing
- [ ] Documentation updated

---

**Document Version:** 1.0
**Date:** 2025-01-11
**Status:** Ready for Implementation
**Recommendation:** Complete Weeks 2-4 as planned above
