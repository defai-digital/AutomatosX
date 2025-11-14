# AutomatosX Interactive CLI - User Guide

**Version:** 8.0.0
**Status:** Production Ready
**Last Updated:** 2025-01-11

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Command Reference](#command-reference)
4. [Advanced Features](#advanced-features)
5. [Workflows & Agents](#workflows--agents)
6. [Conversation Management](#conversation-management)
7. [Troubleshooting](#troubleshooting)
8. [Examples & Patterns](#examples--patterns)

---

## Introduction

The AutomatosX Interactive CLI Mode is a ChatGPT-style REPL (Read-Eval-Print Loop) interface that provides:

- **Natural language conversations** with AI providers (Claude, Gemini, OpenAI)
- **13 slash commands** for system control and workflow execution
- **Conversation persistence** with SQLite storage
- **Agent collaboration** for specialized AI tasks
- **Workflow integration** for automated code operations
- **Context-aware assistance** with conversation history

### Key Features

✅ **Interactive REPL** - Real-time conversation with intelligent assistants
✅ **Multi-provider support** - Claude 3.5 Sonnet, Gemini 2.0, OpenAI GPT-4
✅ **Persistent conversations** - Auto-save every 5 messages + on exit
✅ **Command autocomplete** - Tab completion for all commands
✅ **History navigation** - Arrow keys to browse command history
✅ **Professional UX** - Color-coded output with loading indicators

---

## Getting Started

### Installation

```bash
# Install AutomatosX (if not already installed)
npm install -g automatosx

# Or use from project root
npm install
npm run build
```

### Configuration

Set up your AI provider API keys:

```bash
# Required: At least one provider key
export ANTHROPIC_API_KEY="sk-ant-..."        # For Claude
export GEMINI_API_KEY="..."                   # For Gemini
export OPENAI_API_KEY="sk-..."                # For OpenAI
```

### Launching Interactive CLI

```bash
# From installed package
ax cli

# From project root
npm run cli -- cli
```

### First Session

```
╔══════════════════════════════════════════════════════════════╗
║          AutomatosX v8.0.0 - Interactive CLI                 ║
╚══════════════════════════════════════════════════════════════╝

Welcome to the AutomatosX Interactive CLI!

Type:
  /help     - Show all available commands
  your question - Ask anything in natural language
  /exit     - Exit the REPL

Tips:
  - Press TAB for command autocompletion
  - Press ↑/↓ to navigate command history
  - Press CTRL+C or CTRL+D to exit

─────────────────────────────────────────────────────────────

>
```

---

## Command Reference

All commands start with `/` and support aliases for faster typing.

### Core Commands

#### `/help` (Aliases: `/h`, `/?`)
Display all available commands with descriptions and usage.

```
> /help

AutomatosX Interactive CLI - Commands
══════════════════════════════════════

Core Commands:
  /help, /h, /?           Show this help message
  /exit, /quit, /q        Exit Interactive CLI
  /clear, /cls            Clear terminal screen

[... full command list ...]
```

#### `/exit` (Aliases: `/quit`, `/q`)
Exit the Interactive CLI and save conversation.

```
> /exit

Saving conversation to database...
✓ Conversation saved

👋 Exiting... Goodbye!
```

**Note:** Conversation is automatically saved on exit.

#### `/clear` (Alias: `/cls`)
Clear the terminal screen.

```
> /clear

[Terminal cleared]
```

---

### Conversation Commands

#### `/context` (Alias: `/ctx`)
Display current conversation context.

```
> /context

📋 Conversation Context

Conversation:
  ID: 576df299-9814-425a-8e6f-a26c87155270
  Messages: 12
  Started: 2025-01-11 14:30:22
  Updated: 2025-01-11 14:45:10

Active Agent: BackendAgent (Node.js/Express backend specialist)
Active Workflow: None

Variables:
  language: TypeScript
  framework: Express
  maxTokens: 2000
```

#### `/history` (Alias: `/h`)
View conversation message history.

```
> /history

📜 Conversation History (Last 10 messages)

[2025-01-11 14:30:30] User:
what is a REST API?

[2025-01-11 14:30:35] Assistant:
A REST API is an architectural style for building web services...

[2025-01-11 14:32:10] User:
show me an example in Express

[... more messages ...]
```

**Options:**
- `/history` - Show last 10 messages
- `/history 20` - Show last 20 messages
- `/history all` - Show entire conversation

---

### Agent Commands

#### `/agent <name>` (Alias: `/ag`)
Set or clear the active AI agent.

```
> /agent BackendAgent

✓ Active agent set to: BackendAgent
  Node.js/Express backend specialist

> /agent clear

✓ Active agent cleared
```

**See available agents:**
```
> /agents
```

#### `/agents` (Alias: `/ags`)
List all available agents with categories.

```
> /agents

🤖 Available Agents (12 total)

Backend (3):
  BackendAgent         - Node.js/Express backend specialist
  DatabaseAgent        - SQL/NoSQL database expert
  APIAgent             - REST/GraphQL API specialist

Frontend (4):
  ReactAgent           - React.js specialist
  VueAgent             - Vue.js specialist
  AngularAgent         - Angular specialist
  UIAgent              - UI/UX design specialist

[... more categories ...]
```

**Filter agents:**
```
> /agents backend

Backend (3):
  BackendAgent         - Node.js/Express backend specialist
  DatabaseAgent        - SQL/NoSQL database expert
  APIAgent             - REST/GraphQL API specialist
```

---

### System Commands

#### `/status` (Alias: `/st`)
Show system status and provider health.

```
> /status

🚀 AutomatosX System Status

Providers:
  ✓ Claude (Anthropic)   - Available
  ✓ Gemini (Google)      - Available
  ✗ OpenAI               - No API key

Database:
  Path: .automatosx/memory/code.db
  Size: 2.4 MB
  Conversations: 15
  Messages: 342

Memory Usage:
  RSS: 145.2 MB
  Heap: 82.3 MB
```

#### `/config` (Alias: `/cfg`)
Display current configuration.

```
> /config

⚙️  AutomatosX Configuration

Providers:
  claude:
    enabled: true
    priority: 1
    apiKey: sk-ant-****7890
    maxRetries: 3
    timeout: 30000

[... full config ...]
```

**Note:** API keys are masked for security.

---

### Data Commands

#### `/save <filename>` (Alias: `/sv`)
Export conversation to JSON file.

```
> /save my-conversation.json

✓ Conversation exported to: my-conversation.json
  12 messages saved
```

**File format:**
```json
{
  "conversationId": "576df299-...",
  "userId": "john-doe",
  "messages": [
    {
      "id": "msg-001",
      "role": "user",
      "content": "What is a REST API?",
      "timestamp": "2025-01-11T14:30:30.000Z"
    }
  ],
  "activeAgent": "BackendAgent",
  "variables": { "language": "TypeScript" }
}
```

#### `/load <filename>` (Alias: `/ld`)
Import conversation from JSON file.

```
> /load my-conversation.json

✓ Conversation loaded from: my-conversation.json
  12 messages restored
  Active agent: BackendAgent
```

---

### Integration Commands

#### `/memory search <query>`
Search code memory index.

```
> /memory search "getUserById"

🔍 Memory Search Results

Searching for: getUserById

1. src/services/UserService.ts:45
   function getUserById(id: string): Promise<User>

2. src/controllers/UserController.ts:12
   const user = await getUserById(req.params.id);

3 results found
```

**Delegates to:** `ax memory search <query>`

#### `/workflow run <name>`
Execute a workflow.

```
> /workflow run code-review

🔄 Running Workflow: code-review

Step 1/4: Analyzing code files...
Step 2/4: Running linters...
Step 3/4: Checking test coverage...
Step 4/4: Generating report...

✓ Workflow completed successfully
  Duration: 12.3s
  Report: reports/code-review-2025-01-11.md
```

**Delegates to:** `ax workflow run <name>`

---

## Advanced Features

### Context Variables

The Interactive CLI tracks context variables that persist across the conversation. These are accessible programmatically by agents and workflows.

**Setting variables:**
Use natural language or the `/context` command to view and manage variables.

**Example usage:**
```
> I'm working with TypeScript and Express

AI: Great! I'll help you with TypeScript and Express development.

> /context

Variables:
  language: TypeScript
  framework: Express
```

Variables are automatically saved with your conversation and restored when you load it.

### Auto-save Behavior

Conversations are automatically saved to SQLite:

- **Every 5 messages** (silent background save)
- **On exit** (with confirmation message)
- **Manual save** via `/save` to JSON

**Auto-save configuration:**
```typescript
// Default: Save every 5 messages
contextSaveInterval: 5

// Customize in .automatosxrc:
{
  "interactive": {
    "contextSaveInterval": 10
  }
}
```

### Conversation History

The AI maintains context from recent messages:

- **Last 5 messages** included by default
- Provides continuity in multi-turn conversations
- Helps AI understand context and references

**Example:**
```
> what is a REST API?
AI: A REST API is an architectural style...

> show me an example in Express
AI: Here's an Express REST API example...
[AI understands "example" refers to REST API from previous message]

> what about authentication?
AI: For authentication in your Express REST API...
[AI maintains full context]
```

---

## Workflows & Agents

### Working with Agents

Agents are specialized AI personas for specific tasks:

**1. Set an agent for your task:**
```
> /agent BackendAgent
✓ Active agent set to: BackendAgent
```

**2. Agent responds with specialized knowledge:**
```
> how do I handle database connections in Express?

BackendAgent: For Express database connections, I recommend using a connection pool...
```

**3. Clear agent when done:**
```
> /agent clear
✓ Active agent cleared
```

### Running Workflows

Workflows automate common development tasks:

**Available workflows:**
- `code-review` - Analyze code quality
- `test-gen` - Generate unit tests
- `refactor` - Suggest refactorings
- `doc-gen` - Generate documentation

**Example:**
```
> /workflow run test-gen

🔄 Running Workflow: test-gen

Analyzing source files...
Generating test cases...
Writing test files...

✓ Generated 15 test files
  Coverage: src/**/*.ts
  Framework: Vitest
```

---

## Conversation Management

### Saving Conversations

**Auto-save (default):**
Conversations save automatically every 5 messages and on exit.

**Manual export to JSON:**
```
> /save my-research-2025-01-11.json

✓ Conversation exported to: my-research-2025-01-11.json
  24 messages saved
```

**Use cases:**
- Backup important conversations
- Share conversations with team
- Archive research sessions
- Transfer between machines

### Loading Conversations

```
> /load my-research-2025-01-11.json

✓ Conversation loaded from: my-research-2025-01-11.json
  24 messages restored
  Active agent: BackendAgent
  Variables: { language: TypeScript, framework: Express }
```

**What gets restored:**
- All messages (full history)
- Active agent
- Context variables
- Timestamps
- Conversation ID

### Managing Multiple Conversations

**Current session:**
Each CLI launch creates a new conversation with unique ID.

**Future enhancement:**
- `/load recent` - Resume last conversation
- `/conversations` - List all conversations
- `/switch <id>` - Switch between conversations

---

## Troubleshooting

### Common Issues

#### Issue: "No AI provider available"

**Symptom:**
```
❌ Error: No AI provider available
```

**Solution:**
Set at least one provider API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# OR
export GEMINI_API_KEY="..."
# OR
export OPENAI_API_KEY="sk-..."
```

Verify with `/status`:
```
> /status

Providers:
  ✓ Claude (Anthropic)   - Available
```

---

#### Issue: "Database connection failed"

**Symptom:**
```
❌ Error: Database connection failed
```

**Solution:**
1. Check database path: `.automatosx/memory/code.db`
2. Ensure directory is writable
3. Delete corrupted database:
   ```bash
   rm -rf .automatosx/memory/code.db
   ```
4. Restart CLI (database recreates automatically)

---

#### Issue: "Command not found"

**Symptom:**
```
❌ Unknown command: /hlep
Type /help for available commands
```

**Solution:**
- Use `/help` to see all commands
- Check for typos (use Tab autocomplete)
- Ensure command starts with `/`

---

#### Issue: Slow response times

**Symptoms:**
- AI takes >30 seconds to respond
- "Thinking..." spinner runs too long

**Solutions:**
1. Check network connection
2. Verify provider API status
3. Check `/status` for provider health
4. Try different provider:
   ```
   # In .automatosxrc
   {
     "providers": {
       "claude": { "priority": 1 },
       "gemini": { "priority": 2 }
     }
   }
   ```

---

#### Issue: Conversation not saving

**Symptom:**
- Exit message shows "Saving..." but fails
- No conversation in database

**Solution:**
1. Check database permissions
2. Ensure no other process has database locked
3. Use `/save` to export to JSON as backup
4. Check logs for error messages

---

### Getting Help

**In-CLI help:**
```
> /help

[Lists all commands]
```

**System status:**
```
> /status

[Shows provider health, database status, memory usage]
```

**Configuration:**
```
> /config

[Shows current settings]
```

**Documentation:**
- User Guide: `docs/cli/interactive-mode.md` (this file)
- Architecture: `docs/cli/interactive-architecture.md`
- API Reference: `docs/api/`

**Community:**
- GitHub Issues: https://github.com/automatosx/automatosx/issues
- Discussions: https://github.com/automatosx/automatosx/discussions

---

## Examples & Patterns

### Example 1: Code Review Session

```
> /agent CodeReviewAgent
✓ Active agent set to: CodeReviewAgent

> I have a TypeScript function that handles user authentication. Can you review it?

CodeReviewAgent: I'd be happy to review your authentication function! Please share the code.

> [paste code]

CodeReviewAgent: Here's my analysis:

1. Security: ✓ Password hashing looks good
2. Error handling: ⚠️  Missing try-catch around database call
3. Validation: ✗ No email format validation
4. Performance: ✓ Using async/await properly

Recommendations:
[detailed recommendations...]

> how would you fix the email validation?

CodeReviewAgent: Here's an improved version with email validation:
[shows code with validation...]

> /save code-review-auth-2025-01-11.json
✓ Conversation exported

> /exit
```

---

### Example 2: Research Session

```
> what are the differences between REST and GraphQL?

AI: REST and GraphQL are both API architectures with key differences:

1. Data Fetching:
   - REST: Multiple endpoints, fixed responses
   - GraphQL: Single endpoint, flexible queries

[detailed explanation...]

> which one should I use for a mobile app?

AI: For mobile apps, I'd recommend GraphQL because:
[detailed recommendation...]

> what about performance?

AI: Performance comparison:
[detailed analysis...]

> /history

[Shows full conversation thread]

> /save graphql-research-2025-01-11.json
✓ Conversation exported
```

---

### Example 3: Workflow Automation

```
> /agent DevOpsAgent
✓ Active agent set to: DevOpsAgent

> I need to review code quality before deploying

DevOpsAgent: I can help with that! Let's run the code review workflow.

> /workflow run code-review

🔄 Running Workflow: code-review

Step 1/4: Analyzing code files...
  Found 45 TypeScript files

Step 2/4: Running linters...
  ESLint: 3 warnings, 0 errors
  TypeScript: No errors

Step 3/4: Checking test coverage...
  Coverage: 87.3%
  Missing coverage: src/utils/helpers.ts

Step 4/4: Generating report...
  ✓ Report: reports/code-review-2025-01-11.md

✓ Workflow completed successfully

> /memory search "helpers.ts"

🔍 Memory Search Results
1. src/utils/helpers.ts:12
   function formatDate(date: Date): string

> should I add tests for formatDate?

DevOpsAgent: Yes! Based on the code review, formatDate needs test coverage...
```

---

### Example 4: Multi-Agent Collaboration

```
> /agent FrontendAgent
✓ Active agent set to: FrontendAgent

> I need help with a React component

FrontendAgent: Sure! What component are you working on?

> a user profile card

FrontendAgent: [provides React component code]

> /agent BackendAgent
✓ Active agent set to: BackendAgent

> now I need the API endpoint for user data

BackendAgent: Here's the Express endpoint for user profiles:
[provides API code]

> /agent clear
✓ Active agent cleared

> how do I connect these together?

AI: To connect the React component to the API:
[provides integration code using both contexts]

> /save user-profile-implementation.json
✓ Conversation exported
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Autocomplete command |
| `↑` / `↓` | Navigate command history |
| `Ctrl+C` | Exit CLI (with save prompt) |
| `Ctrl+D` | Exit CLI (with save prompt) |
| `Ctrl+L` | Clear screen (same as `/clear`) |
| `Ctrl+A` | Move cursor to start of line |
| `Ctrl+E` | Move cursor to end of line |
| `Ctrl+K` | Delete from cursor to end of line |
| `Ctrl+U` | Delete from cursor to start of line |

---

## Configuration

### .automatosxrc Configuration

Create `.automatosxrc` in your project root:

```json
{
  "interactive": {
    "contextSaveInterval": 5,
    "welcomeMessage": "Custom welcome message",
    "prompt": "> ",
    "enableAutocomplete": true
  },
  "providers": {
    "claude": {
      "enabled": true,
      "priority": 1,
      "maxRetries": 3,
      "timeout": 30000
    },
    "gemini": {
      "enabled": true,
      "priority": 2
    }
  }
}
```

### Environment Variables

```bash
# Provider API Keys
export ANTHROPIC_API_KEY="sk-ant-..."
export GEMINI_API_KEY="..."
export OPENAI_API_KEY="sk-..."

# User ID (for multi-user systems)
export AUTOMATOSX_USER_ID="john-doe"

# Database Path
export AUTOMATOSX_DB_PATH=".automatosx/memory/code.db"
```

---

## Performance Tips

1. **Keep conversations focused** - Start new session for different topics
2. **Use agents** - Specialized agents give better, faster responses
3. **Export regularly** - Use `/save` to backup important conversations
4. **Clear old data** - Remove old conversations from database periodically
5. **Check `/status`** - Monitor system health and provider availability

---

## Security Notes

- **API Keys**: Never commit `.automatosxrc` with API keys to git
- **Conversation Data**: Contains all your prompts and responses
- **Export Files**: JSON exports may contain sensitive information
- **Database**: `.automatosx/memory/code.db` is local-only by default

**Recommended `.gitignore`:**
```
.automatosx/
.automatosxrc
*-conversation-*.json
```

---

## Version History

- **v8.0.0** (2025-01-11) - Initial release
  - 13 slash commands
  - Multi-provider support
  - SQLite persistence
  - Agent collaboration
  - Workflow integration

---

## Next Steps

1. **Try the Interactive CLI**: `ax cli`
2. **Explore commands**: `/help`
3. **Set up an agent**: `/agents` then `/agent <name>`
4. **Run a workflow**: `/workflow run code-review`
5. **Read architecture docs**: `docs/cli/interactive-architecture.md`

---

**Document Version:** 1.0
**Last Updated:** 2025-01-11
**Status:** Production Ready