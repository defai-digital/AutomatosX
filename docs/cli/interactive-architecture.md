# AutomatosX Interactive CLI - Architecture Documentation

**Version:** 8.0.0
**Last Updated:** 2025-01-11
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Breakdown](#component-breakdown)
3. [Data Flow Patterns](#data-flow-patterns)
4. [Extension Guide](#extension-guide)
5. [Testing Guide](#testing-guide)
6. [Best Practices](#best-practices)

---

## System Overview

The Interactive CLI is a ChatGPT-style REPL (Read-Eval-Print Loop) built on Node.js with TypeScript, providing natural language conversations with AI providers while maintaining conversation context and persistent state.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Terminal                         │
│  (Input via readline, Output to stdout)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                    REPLSession                           │
│  • readline interface management                         │
│  • Input routing (slash commands vs natural language)   │
│  • Autocomplete & command history                        │
│  • Graceful shutdown handling                            │
└───────────┬─────────────────────────┬───────────────────┘
            │                         │
            ↓                         ↓
┌─────────────────────┐   ┌──────────────────────────────┐
│ SlashCommandRegistry│   │   ConversationContext        │
│  • Command storage  │   │    • Message history         │
│  • Alias resolution │   │    • Agent state             │
│  • Command dispatch │   │    • Workflow state          │
│  • Input parsing    │   │    • Variables               │
└─────────┬───────────┘   │    • Snapshots               │
          │               └──────────┬───────────────────┘
          ↓                          │
┌─────────────────────┐             ↓
│   Command Classes   │   ┌──────────────────────────────┐
│  • HelpCommand      │   │    Database (SQLite)         │
│  • AgentCommand     │   │  • conversations table       │
│  • WorkflowCommand  │   │  • messages table            │
│  • SaveCommand      │   │  • ConversationDAO           │
│  • etc (13 total)   │   │  • MessageDAO                │
└─────────┬───────────┘   └──────────────────────────────┘
          │                          ↓
          │               ┌──────────────────────────────┐
          │               │   StreamingHandler           │
          │               │  • ora spinner               │
          │               │  • Loading feedback          │
          └───────────────┴──────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│              External Systems                            │
│  • ProviderRouterV2 (Claude/Gemini/OpenAI)              │
│  • AgentRegistry (21 specialized AI personas)           │
│  • WorkflowEngine (automated task execution)            │
│  • FileService (code memory search)                     │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Separation of Concerns** - Each component has a single, well-defined responsibility
2. **Dependency Injection** - Components receive dependencies via constructor, enabling testing
3. **Event-Driven** - readline events drive the REPL loop
4. **Stateful Context** - ConversationContext maintains all conversation state
5. **Extensible** - New commands can be added without modifying core code

---

## Component Breakdown

### 1. REPLSession

**Responsibility:** Main REPL manager with readline interface

**File:** `src/cli/interactive/REPLSession.ts` (309 LOC)

**Key Features:**
- Creates and manages readline interface
- Routes input to slash commands or natural language handler
- Provides Tab autocomplete for commands
- Handles graceful shutdown (CTRL+C, CTRL+D, `/exit`)
- Auto-saves conversation every 5 messages
- Displays professional welcome message

**Constructor Dependencies:**
```typescript
constructor(
  private db: Database,                        // SQLite database
  private providerRouter: ProviderRouterV2,   // AI provider routing
  private agentRegistry: AgentRegistry,        // Agent management
  private commandRegistry: SlashCommandRegistry, // Command execution
  options: REPLOptions = {}                    // Configuration
)
```

**Key Methods:**

**`start()`** - Initialize REPL and start event loop
```typescript
async start(): Promise<void> {
  this.displayWelcome();

  this.rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: this.options.prompt,
    completer: this.autocomplete.bind(this)
  });

  this.rl.on('line', async (line) => {
    await this.handleInput(line.trim());
  });

  this.rl.prompt();
}
```

**`handleInput(input)`** - Route input to appropriate handler
```typescript
private async handleInput(input: string): Promise<void> {
  if (input.startsWith('/')) {
    await this.handleSlashCommand(input);
  } else {
    await this.handleNaturalLanguage(input);
  }
}
```

**`handleNaturalLanguage(input)`** - Send to AI provider
```typescript
private async handleNaturalLanguage(input: string): Promise<void> {
  this.streamingHandler.startThinking();

  this.conversationContext.addMessage('user', input);

  const recentMessages = this.conversationContext.getRecentMessages(5);
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant...' },
    ...recentMessages
  ];

  const response = await this.providerRouter.request({ messages });

  this.streamingHandler.stop();
  this.conversationContext.addMessage('assistant', response.content);

  console.log(response.content);

  // Auto-save every 5 messages
  if (this.state.messageCount % 5 === 0) {
    await this.conversationContext.saveToDB();
  }
}
```

**`stop()`** - Save conversation and exit
```typescript
async stop(): Promise<void> {
  if (this.conversationContext.getMessageCount() > 0) {
    console.log('Saving conversation to database...');
    await this.conversationContext.saveToDB();
    console.log('✓ Conversation saved');
  }

  this.rl.close();
  process.exit(0);
}
```

---

### 2. ConversationContext

**Responsibility:** Manages conversation state and persistence

**File:** `src/cli/interactive/ConversationContext.ts` (370 LOC)

**Key Features:**
- In-memory message storage (fast access)
- SQLite persistence (auto-save every 5 messages)
- Agent and workflow state tracking
- Context variables (key-value store)
- Snapshot/restore for save/load to JSON

**Constructor:**
```typescript
constructor(
  private db: Database,
  userId: string,
  conversationId?: string  // Optional: resume existing conversation
)
```

**Key Methods:**

**`addMessage(role, content)`** - Add message to conversation
```typescript
addMessage(role: 'user' | 'assistant' | 'system', content: string): Message {
  const message: Message = {
    id: randomUUID(),
    conversationId: this.conversationId,
    role,
    content,
    timestamp: new Date(),
    metadata: {}
  };

  this.messages.push(message);
  this.updatedAt = new Date();

  return message;
}
```

**`getRecentMessages(limit)`** - Get last N messages for context
```typescript
getRecentMessages(limit: number = 10): Message[] {
  return this.messages.slice(-limit);
}
```

**`saveToDB()`** - Persist to SQLite
```typescript
async saveToDB(): Promise<void> {
  try {
    const { ConversationDAO } = await import('../../database/dao/ConversationDAO.js');
    const { MessageDAO } = await import('../../database/dao/MessageDAO.js');

    const conversationDAO = new ConversationDAO(this.db);
    const messageDAO = new MessageDAO(this.db);

    // Upsert conversation
    const existing = conversationDAO.getById(this.conversationId);
    if (existing) {
      conversationDAO.update({
        id: this.conversationId,
        metadata: {
          activeAgent: this.activeAgent,
          activeWorkflow: this.activeWorkflow,
          variables: this.variables
        }
      });
    } else {
      conversationDAO.create({
        agentId: this.activeAgent || 'system',
        userId: this.userId,
        title: `Conversation ${this.conversationId.slice(0, 8)}`,
        metadata: { /* ... */ }
      });
    }

    // Create new messages (immutable)
    for (const msg of this.messages) {
      if (!messageDAO.getById(msg.id)) {
        messageDAO.create({
          id: msg.id,
          conversationId: this.conversationId,
          role: msg.role,
          content: msg.content,
          tokens: msg.tokensUsed || 0,
          metadata: msg.metadata || {}
        });
      }
    }
  } catch (error) {
    console.error('[ConversationContext] Failed to save:', error.message);
    // Don't throw - allow REPL to continue
  }
}
```

**`loadFromDB(db, conversationId)`** - Restore from database
```typescript
static async loadFromDB(db: Database, conversationId: string): Promise<ConversationContext | null> {
  try {
    const { ConversationDAO } = await import('../../database/dao/ConversationDAO.js');
    const { MessageDAO } = await import('../../database/dao/MessageDAO.js');

    const conversationDAO = new ConversationDAO(db);
    const messageDAO = new MessageDAO(db);

    const conv = conversationDAO.getById(conversationId);
    if (!conv) return null;

    const messages = messageDAO.getByConversation(conversationId);

    const context = new ConversationContext(db, conv.userId, conversationId);

    // Restore messages
    context.messages = messages.map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: new Date(m.createdAt * 1000),
      tokensUsed: m.tokens,
      metadata: m.metadata
    }));

    // Restore state
    const metadata = conv.metadata as any;
    context.activeAgent = metadata?.activeAgent;
    context.activeWorkflow = metadata?.activeWorkflow;
    context.variables = metadata?.variables || {};

    return context;
  } catch (error) {
    console.error('[ConversationContext] Failed to load:', error.message);
    return null;
  }
}
```

**State Management:**
```typescript
// Agent management
setActiveAgent(agentName: string | undefined): void
getActiveAgent(): string | undefined

// Workflow management
setActiveWorkflow(workflowPath: string | undefined): void
getActiveWorkflow(): string | undefined

// Variable management
setVariable(key: string, value: unknown): void
getVariable(key: string): unknown
getVariables(): Record<string, unknown>

// Snapshot/restore
getSnapshot(): ContextSnapshot
restoreFromSnapshot(snapshot: ContextSnapshot): void
```

---

### 3. SlashCommandRegistry

**Responsibility:** Command registration and execution

**File:** `src/cli/interactive/SlashCommandRegistry.ts` (133 LOC)

**Key Features:**
- Register commands with aliases
- Conflict detection (duplicate names/aliases)
- Input parsing (slash removal, argument splitting)
- Command lookup by name or alias

**Key Methods:**

**`register(command)`** - Add command to registry
```typescript
register(command: SlashCommand): void {
  // Check for name conflict
  if (this.commands.has(command.name)) {
    throw new Error(`Command '${command.name}' is already registered`);
  }

  // Check for alias conflicts
  if (command.aliases) {
    for (const alias of command.aliases) {
      if (this.aliases.has(alias)) {
        throw new Error(`Alias '${alias}' is already registered`);
      }
    }
  }

  // Register command
  this.commands.set(command.name, command);

  // Register aliases
  if (command.aliases) {
    for (const alias of command.aliases) {
      this.aliases.set(alias, command.name);
    }
  }
}
```

**`execute(input, context)`** - Parse and run command
```typescript
async execute(input: string, context: CommandContext): Promise<void> {
  const { commandName, args } = this.parseInput(input);

  const command = this.get(commandName);
  if (!command) {
    throw new Error(`Unknown command: /${commandName}`);
  }

  await command.execute(args, context);
}
```

**`parseInput(input)`** - Extract command name and args
```typescript
private parseInput(input: string): { commandName: string; args: string[] } {
  // Remove leading slash
  const trimmed = input.startsWith('/') ? input.slice(1) : input;

  // Split by whitespace
  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);

  return {
    commandName: parts[0] || '',
    args: parts.slice(1)
  };
}
```

**Command Interface:**
```typescript
interface SlashCommand {
  name: string;              // Primary command name
  description: string;       // Help text
  usage: string;             // Usage example
  aliases?: string[];        // Alternative names
  category?: string;         // Grouping category
  execute(args: string[], context: CommandContext): Promise<void>;
}
```

---

### 4. Command Classes

**Responsibility:** Individual command implementations

**Location:** `src/cli/interactive/commands/` (13 files, 985 LOC total)

**Command Interface Implementation:**
```typescript
export class ExampleCommand implements SlashCommand {
  name = 'example';
  description = 'Example command description';
  usage = '/example <arg>';
  aliases = ['ex'];

  async execute(args: string[], context: CommandContext): Promise<void> {
    // Access conversation context
    const conversationId = context.conversationId;
    const activeAgent = context.activeAgent;

    // Command logic here
    console.log('Command executed!');
  }
}
```

**Context-Aware Commands:**

Some commands need access to ConversationContext:

```typescript
export class ContextCommand implements SlashCommand {
  private conversationContext?: ConversationContext;

  // Injected after registration
  setConversationContext(context: ConversationContext): void {
    this.conversationContext = context;
  }

  async execute(args: string[], context: CommandContext): Promise<void> {
    // Access full conversation state
    const messageCount = this.conversationContext?.getMessageCount();
    const messages = this.conversationContext?.getMessages();

    // Display conversation info
    console.log(`Messages: ${messageCount}`);
  }
}
```

**Command Categories:**

1. **Core (3 commands)**
   - HelpCommand - List all commands
   - ExitCommand - Graceful shutdown
   - ClearCommand - Clear terminal

2. **Conversation (2 commands)**
   - ContextCommand - Show conversation state
   - HistoryCommand - Display message history

3. **Agent (2 commands)**
   - AgentCommand - Set/clear active agent
   - AgentsCommand - List all agents

4. **System (2 commands)**
   - StatusCommand - System health check
   - ConfigCommand - Show configuration

5. **Data (2 commands)**
   - SaveCommand - Export to JSON
   - LoadCommand - Import from JSON

6. **Integration (2 commands)**
   - MemoryCommand - Search code index
   - WorkflowCommand - Execute workflow

---

### 5. StreamingHandler

**Responsibility:** Professional loading indicators

**File:** `src/cli/interactive/StreamingHandler.ts` (98 LOC)

**Key Features:**
- ora spinner with "Thinking..." message
- Elapsed time tracking
- Success/error states
- Cyan color theme

**Key Methods:**

```typescript
startThinking(): void {
  this.startTime = Date.now();
  this.spinner = ora({
    text: chalk.gray('Thinking...'),
    color: 'cyan',
    spinner: 'dots'
  }).start();
}

stop(): void {
  if (this.spinner) {
    this.spinner.stop();
    this.spinner = null;
  }
}

stopSuccess(message?: string): void {
  if (this.spinner) {
    const elapsed = this.getElapsedTime();
    this.spinner.succeed(chalk.green(`${message} ${chalk.gray(`(${elapsed})`)}`));
  }
}

stopError(message: string): void {
  if (this.spinner) {
    this.spinner.fail(chalk.red(message));
  }
}
```

---

## Data Flow Patterns

### Pattern 1: Natural Language Flow

```
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
```

### Pattern 2: Slash Command Flow

```
1. User types: "/agent BackendAgent"
2. REPLSession.handleInput() detects slash
3. REPLSession.handleSlashCommand() called
4. SlashCommandRegistry.execute() parses input
   → commandName: "agent"
   → args: ["BackendAgent"]
5. Registry looks up "agent" command
6. AgentCommand.execute(['BackendAgent'], context)
7. Command validates agent exists
8. ConversationContext.setActiveAgent('BackendAgent')
9. Display success message
```

### Pattern 3: Persistence Flow

**Auto-save (every 5 messages):**
```
1. User sends message #5, #10, #15, etc.
2. ConversationContext.saveToDB() triggered
3. Check if conversation exists in DB
4. If exists: ConversationDAO.update(metadata)
   If new: ConversationDAO.create(conversation)
5. For each new message: MessageDAO.create(message)
6. Silent save (no user feedback)
```

**Manual save:**
```
1. User types: "/save my-session.json"
2. SaveCommand.execute()
3. ConversationContext.getSnapshot()
4. JSON.stringify(snapshot)
5. fs.writeFile(filename, json)
6. Display success message
```

**Exit save:**
```
1. User types: "/exit" or CTRL+C
2. REPLSession.stop() called
3. ConversationContext.saveToDB()
4. Display "Saving conversation..."
5. Display "✓ Conversation saved"
6. process.exit(0)
```

---

## Extension Guide

### Adding a New Slash Command

**Step 1: Create Command File**

```typescript
// src/cli/interactive/commands/MyCommand.ts
import type { SlashCommand, CommandContext } from '../types.js';
import chalk from 'chalk';

export class MyCommand implements SlashCommand {
  name = 'mycommand';
  description = 'Does something useful';
  usage = '/mycommand <arg>';
  aliases = ['mc', 'my'];
  category = 'custom';

  async execute(args: string[], context: CommandContext): Promise<void> {
    // Validate arguments
    if (args.length === 0) {
      console.log(chalk.red('❌ Error: Missing argument'));
      console.log(chalk.gray(`Usage: ${this.usage}`));
      return;
    }

    // Access conversation context
    const conversationId = context.conversationId;
    const activeAgent = context.activeAgent;

    // Your logic here
    const arg = args[0];
    console.log(chalk.green(`✓ Command executed with: ${arg}`));
  }
}
```

**Step 2: Register Command**

```typescript
// src/cli/commands/cli.ts
import { MyCommand } from '../interactive/commands/MyCommand.js';

// ... in launchCLI() function:
const commandRegistry = new SlashCommandRegistry();
commandRegistry.register(new MyCommand());
// ... register other commands
```

**Step 3: Add Tests**

```typescript
// src/cli/interactive/commands/__tests__/MyCommand.test.ts
import { describe, it, expect } from 'vitest';
import { MyCommand } from '../MyCommand.js';
import type { CommandContext } from '../../types.js';

describe('MyCommand', () => {
  it('should execute successfully with argument', async () => {
    const command = new MyCommand();
    const context: CommandContext = {
      conversationId: 'test',
      userId: 'user',
      activeAgent: null,
      activeWorkflow: null,
      variables: {},
      db: {} as any,
      providerRouter: {} as any,
      agentRegistry: {} as any
    };

    await expect(command.execute(['test-arg'], context)).resolves.not.toThrow();
  });

  it('should fail without argument', async () => {
    const command = new MyCommand();
    const context = createMockContext();

    // Should not throw, but should log error
    await command.execute([], context);
  });
});
```

### Adding Context-Aware Features

For commands that need access to ConversationContext:

```typescript
export class MyContextCommand implements SlashCommand {
  private conversationContext?: ConversationContext;

  name = 'mycontext';
  description = 'Context-aware command';
  usage = '/mycontext';

  // Called after registration
  setConversationContext(context: ConversationContext): void {
    this.conversationContext = context;
  }

  async execute(args: string[], context: CommandContext): Promise<void> {
    if (!this.conversationContext) {
      console.log(chalk.red('❌ Error: No conversation context'));
      return;
    }

    // Access conversation state
    const messageCount = this.conversationContext.getMessageCount();
    const messages = this.conversationContext.getMessages();
    const activeAgent = this.conversationContext.getActiveAgent();

    console.log(`Messages: ${messageCount}`);
    console.log(`Active Agent: ${activeAgent || 'None'}`);
  }
}

// In cli.ts:
const myContextCommand = new MyContextCommand();
myContextCommand.setConversationContext(repl.getConversationContext());
commandRegistry.register(myContextCommand);
```

---

## Testing Guide

### Unit Testing Commands

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyCommand } from '../MyCommand.js';
import type { CommandContext } from '../../types.js';

describe('MyCommand', () => {
  let command: MyCommand;
  let mockContext: CommandContext;

  beforeEach(() => {
    command = new MyCommand();
    mockContext = {
      conversationId: 'test-conversation',
      userId: 'test-user',
      activeAgent: null,
      activeWorkflow: null,
      variables: {},
      db: {} as any,
      providerRouter: {} as any,
      agentRegistry: {} as any
    };
  });

  it('should execute with valid arguments', async () => {
    await expect(command.execute(['arg1', 'arg2'], mockContext))
      .resolves.not.toThrow();
  });

  it('should handle missing arguments gracefully', async () => {
    // Should not throw, but handle gracefully
    await command.execute([], mockContext);
  });
});
```

### Testing ConversationContext

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ConversationContext } from '../ConversationContext.js';

describe('ConversationContext', () => {
  let db: Database.Database;
  let context: ConversationContext;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Create minimal schema
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        agent_id TEXT,
        user_id TEXT,
        title TEXT,
        metadata TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        role TEXT,
        content TEXT,
        tokens INTEGER,
        metadata TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
    `);

    context = new ConversationContext(db, 'test-user');
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  it('should add messages correctly', () => {
    context.addMessage('user', 'Hello');
    context.addMessage('assistant', 'Hi there!');

    expect(context.getMessageCount()).toBe(2);
    const messages = context.getMessages();
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi there!');
  });

  it('should track active agent', () => {
    context.setActiveAgent('BackendAgent');
    expect(context.getActiveAgent()).toBe('BackendAgent');

    context.setActiveAgent(undefined);
    expect(context.getActiveAgent()).toBeUndefined();
  });
});
```

### Integration Testing

```typescript
describe('Interactive CLI Integration', () => {
  it('should handle full conversation flow', async () => {
    const db = new Database(':memory:');
    // ... setup database schema

    const providerRouter = createMockProviderRouter();
    const agentRegistry = createMockAgentRegistry();
    const commandRegistry = new SlashCommandRegistry();

    const repl = new REPLSession(
      db,
      providerRouter,
      agentRegistry,
      commandRegistry
    );

    // Simulate user input
    await repl.handleInput('/agent BackendAgent');
    await repl.handleInput('what is a REST API?');

    // Verify state
    const context = repl.getConversationContext();
    expect(context.getActiveAgent()).toBe('BackendAgent');
    expect(context.getMessageCount()).toBeGreaterThan(0);
  });
});
```

---

## Best Practices

### 1. Error Handling

**Always handle errors gracefully:**
```typescript
async execute(args: string[], context: CommandContext): Promise<void> {
  try {
    // Command logic
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    // Don't throw - allow REPL to continue
  }
}
```

### 2. User Feedback

**Provide clear, color-coded feedback:**
```typescript
// Success
console.log(chalk.green('✓ Operation completed'));

// Error
console.log(chalk.red('❌ Operation failed'));

// Info
console.log(chalk.gray('ℹ Additional information'));

// Warning
console.log(chalk.yellow('⚠ Warning message'));
```

### 3. Input Validation

**Validate arguments before processing:**
```typescript
async execute(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0) {
    console.log(chalk.red('❌ Missing required argument'));
    console.log(chalk.gray(`Usage: ${this.usage}`));
    return;
  }

  const value = args[0];
  if (!isValid(value)) {
    console.log(chalk.red('❌ Invalid argument'));
    return;
  }

  // Process valid input
}
```

### 4. Async Operations

**Use async/await for all I/O:**
```typescript
async execute(args: string[], context: CommandContext): Promise<void> {
  // Database operations
  await context.db.exec('...');

  // File operations
  await fs.writeFile('...', '...');

  // AI requests
  const response = await context.providerRouter.request({...});
}
```

### 5. Testing

**Test both success and failure cases:**
```typescript
describe('MyCommand', () => {
  it('should succeed with valid input', async () => {
    await expect(command.execute(['valid'], context))
      .resolves.not.toThrow();
  });

  it('should handle invalid input', async () => {
    await command.execute(['invalid'], context);
    // Verify error handling (don't expect throw)
  });

  it('should handle missing input', async () => {
    await command.execute([], context);
    // Verify graceful handling
  });
});
```

---

## Performance Considerations

1. **Message History Limit**
   - Only send last 5 messages to AI (balance context vs cost)
   - Configurable via `getRecentMessages(limit)`

2. **Auto-save Frequency**
   - Default: Every 5 messages (balance safety vs performance)
   - Configurable via `contextSaveInterval` option

3. **Database Queries**
   - Use prepared statements (already in DAO layer)
   - Batch operations where possible
   - Index frequently queried columns

4. **Memory Usage**
   - Message history grows indefinitely in-memory
   - Consider pruning very old messages
   - Monitor with `process.memoryUsage()`

---

## Security Considerations

1. **API Keys**
   - Store in environment variables only
   - Never commit to version control
   - Mask in `/config` output

2. **Conversation Data**
   - Contains all user inputs and AI responses
   - May include sensitive information
   - Treat database file as confidential

3. **File Operations**
   - Validate file paths in `/save` and `/load`
   - Prevent path traversal attacks
   - Check permissions before write

4. **Input Sanitization**
   - Sanitize user input before database storage
   - Validate command arguments
   - Prevent injection attacks

---

## Troubleshooting

### Issue: Command not found

**Symptom:** `Unknown command: /mycommand`

**Solutions:**
1. Ensure command is registered in `cli.ts`
2. Check command name spelling
3. Verify aliases are registered correctly

### Issue: Context not available

**Symptom:** `No conversation context`

**Solutions:**
1. Ensure `setConversationContext()` is called
2. Verify command is registered after context injection
3. Check injection happens in `cli.ts`

### Issue: Database errors

**Symptom:** `Failed to save to DB`

**Solutions:**
1. Check database connection
2. Verify schema is created (run migrations)
3. Check file permissions
4. Review DAO implementation

---

## Additional Resources

- [User Guide](./interactive-mode.md) - Complete user documentation
- [README.md](../../README.md) - Quick start and examples
- [API Reference](../api/) - Detailed API documentation
- [Examples](../../examples/) - Code examples and patterns

---

**Document Version:** 1.0
**Last Updated:** 2025-01-11
**Status:** Production Ready
**Maintainers:** AutomatosX Team
