# Interactive CLI (ax-cli)

**Version**: 7.1.0-beta.1
**Status**: Beta Release
**Last Updated**: November 3, 2025

---

## Overview

The AutomatosX Interactive CLI (`ax-cli`) is a ChatGPT-style conversational interface that brings the full power of AutomatosX's multi-agent orchestration, persistent memory, and intelligent routing directly to your terminal.

### Key Features

- 🤖 **Conversational AI Interface** - Natural language interaction with AI assistants
- 🔄 **Real-time Streaming** - See responses as they're generated
- 💾 **Conversation Persistence** - Save, load, and manage conversation history
- 🎯 **Agent Delegation** - Route tasks to specialized agents mid-conversation
- 📝 **13 Slash Commands** - Quick access to powerful features
- 🎨 **Rich Terminal UI** - Color-coded, formatted output
- 🔌 **Multiple Providers** - Seamless switching between Gemini, Claude, OpenAI

---

## Quick Start

### Installation

```bash
# AutomatosX should already be installed
npm install -g @defai.digital/automatosx

# Verify installation
ax --version
```

### Launch Interactive CLI

```bash
# Start ax-cli
ax cli

# Alternative commands
ax interactive
ax chat
```

### Your First Conversation

```bash
ax cli

# You'll see:
╭─────────────────────────────────────────────────────╮
│   AutomatosX Interactive CLI v0.1.1                 │
│   Type /help for commands, /exit to quit            │
│   Using: Gemini 2.5 Flash (simulated)            │
╰─────────────────────────────────────────────────────╯

ax> Hello! How can you help me?

AI: I'm AutomatosX, your AI-powered development assistant...
```

---

## Basic Usage

### Natural Conversation

Simply type your questions or requests:

```bash
ax> Explain how async/await works in JavaScript

ax> Write a function to reverse a string

ax> What are the best practices for error handling?
```

### Agent Delegation

Route specific tasks to specialized agents:

```bash
# Using @agent syntax
ax> @backend implement a REST API endpoint for user authentication

# Using DELEGATE TO syntax
ax> DELEGATE TO quality: review this code for security issues

# List available agents
ax> /agents
```

### Conversation Management

```bash
# Save current conversation
ax> /save my-project-discussion

# List saved conversations
ax> /list

# Load a previous conversation
ax> /load my-project-discussion

# Start fresh conversation
ax> /new

# Delete a conversation
ax> /delete old-conversation
```

---

## Slash Commands Reference

All commands start with `/` and can be typed at any time:

### Essential Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show all available commands | `/help` |
| `/exit` | Exit ax-cli (also: `/quit`, `/q`) | `/exit` |
| `/clear` | Clear the screen | `/clear` |

### Conversation Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/new` | Start a new conversation | `/new` |
| `/save <name>` | Save current conversation | `/save project-chat` |
| `/load <name>` | Load a saved conversation | `/load project-chat` |
| `/list` | List all saved conversations | `/list` |
| `/delete <name>` | Delete a conversation | `/delete old-chat` |
| `/export` | Export to Markdown file | `/export` |

### Information Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/history` | Show conversation history | `/history` |
| `/stats` | Show conversation statistics | `/stats` |
| `/provider` | Show current AI provider | `/provider` |
| `/agents` | List available agents | `/agents` |

### Advanced Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/memory <query>` | Search AutomatosX memory | `/memory search auth` |

---

## Configuration

### Environment Variables

```bash
# Use mock providers (default for testing)
export AUTOMATOSX_MOCK_PROVIDERS=true

# Use real AI providers
export AUTOMATOSX_MOCK_PROVIDERS=false
```

### Config File

Edit `automatosx.config.json` to customize:

```json
{
  "cli": {
    "interactive": {
      "welcomeMessage": true,
      "colors": true,
      "autoSave": true,
      "autoSaveInterval": 30000,
      "maxMessages": 100
    }
  }
}
```

---

## Advanced Usage

### Multi-Agent Workflows

Combine natural conversation with agent delegation:

```bash
ax> I need to build a user authentication system

# First, get requirements from product agent
ax> @product what features should a modern auth system have?

# Then get implementation from backend agent
ax> @backend implement the auth endpoints based on the requirements above

# Finally, get security review
ax> @security review the implementation for vulnerabilities
```

### Conversation Persistence Workflow

```bash
# Day 1: Initial discussion
ax cli
ax> Let's plan the new feature...
ax> /save feature-planning

# Day 2: Continue from where you left off
ax cli
ax> /load feature-planning
ax> Based on yesterday's discussion, let's implement...
ax> /save feature-planning  # Overwrites with updates
```

### Export & Share

```bash
# Export conversation for documentation
ax> /export

# File saved: .automatosx/cli-conversations/conv-123-export.md

# Share with team
cat .automatosx/cli-conversations/conv-123-export.md
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Cancel current operation / Exit prompt |
| `Ctrl+D` | Exit ax-cli gracefully |
| `Ctrl+L` | Clear screen (same as `/clear`) |
| `↑` / `↓` | Navigate command history |
| `Tab` | Auto-complete commands |

---

## Providers

### Supported Providers

1. **Gemini 2.5 Flash** (Default)
   - Fast, cost-effective
   - 1500 free requests/day
   - Great for development

2. **Claude** (via AutomatosX routing)
   - High-quality responses
   - Best for complex reasoning

3. **OpenAI** (via AutomatosX routing)
   - GPT-4 and GPT-3.5
   - Widely compatible

### Provider Setup

```bash
# Gemini (recommended for free tier)
# Install gemini CLI:
# See: https://github.com/google-gemini/gemini-cli

# Verify
gemini --version

# Now run ax-cli in real mode
export AUTOMATOSX_MOCK_PROVIDERS=false
ax cli
```

---

## File Locations

All ax-cli data is stored in `.automatosx/`:

```
.automatosx/
├── cli-conversations/          # Saved conversations
│   ├── my-chat-abc123.json    # Conversation files
│   └── export-xyz789.md       # Markdown exports
├── .cli-history               # Command history
└── memory/                    # AutomatosX memory (shared)
```

---

## Troubleshooting

### CLI Won't Launch

```bash
# Check AutomatosX installation
ax --version

# Rebuild if needed
npm run build

# Try with debug mode
ax cli --debug
```

### Streaming Not Working

```bash
# Verify mock mode is enabled for testing
export AUTOMATOSX_MOCK_PROVIDERS=true
ax cli

# For real providers, check provider setup
ax doctor gemini
```

### Conversations Won't Save

```bash
# Check directory permissions
ls -la .automatosx/cli-conversations/

# Create directory if missing
mkdir -p .automatosx/cli-conversations

# Try saving again
ax> /save test-conversation
```

### Agent Delegation Fails

```bash
# List available agents
ax> /agents

# Check agent exists
ax agent list

# Verify syntax
ax> @backend test task        # Correct
ax> @ backend test task       # Incorrect (space)
```

---

## Performance Tips

1. **Use Mock Mode for Development**
   ```bash
   export AUTOMATOSX_MOCK_PROVIDERS=true
   ```

2. **Limit Context Size**
   - Conversations with 100+ messages may slow down
   - Start new conversations for unrelated topics
   - Use `/new` to reset context

3. **Save Frequently**
   - Auto-save is enabled by default (30s)
   - Manual save with `/save` is instant
   - Load times are < 100ms for most conversations

4. **Clean Up Old Conversations**
   ```bash
   # List all conversations
   ax> /list

   # Delete old ones
   ax> /delete old-conversation-name
   ```

---

## Best Practices

### 1. Organize Your Conversations

Use descriptive names:
```bash
✓ Good: /save feature-auth-implementation
✓ Good: /save bug-fix-session-2024-11-03
✗ Bad:  /save chat1
```

### 2. Use Agent Delegation Effectively

Match tasks to agent expertise:
```bash
# Backend work
ax> @backend implement database schema

# Frontend work
ax> @frontend create React component

# Quality assurance
ax> @quality write integration tests

# DevOps
ax> @devops configure CI/CD pipeline
```

### 3. Export Important Conversations

```bash
# Before major refactoring
ax> /export

# Before closing critical discussions
ax> /save critical-decision
ax> /export
```

### 4. Leverage Conversation History

```bash
# Reference previous context
ax> Based on our earlier discussion about the API design...

# Use /history to review
ax> /history
```

---

## Examples

### Example 1: Code Review Workflow

```bash
ax cli

ax> I have a TypeScript function that needs review

AI: I'd be happy to help! Please share the function.

ax> [paste code]

ax> @quality please review this for bugs, performance, and best practices

AI: [Quality agent provides detailed review]

ax> /save code-review-auth-function
ax> /export
```

### Example 2: Feature Planning

```bash
ax cli

ax> Let's plan a new user dashboard feature

AI: Great! Let's break this down...

ax> @product what metrics should we show?

AI: [Product agent suggests metrics]

ax> @backend how would we implement the data aggregation?

AI: [Backend agent provides technical approach]

ax> /save dashboard-feature-planning
```

### Example 3: Debugging Session

```bash
ax cli

ax> I'm getting a strange error in production...

AI: Let me help debug this. Can you share the error?

ax> [shares error logs]

ax> @backend analyze this stack trace

AI: [Analysis provided]

ax> That helped! The issue was X. Thanks!

ax> /save production-bug-fix-2024-11-03
```

---

## API Integration

For programmatic access to conversations:

```typescript
import { ConversationManager } from '@defai.digital/automatosx/cli-interactive';

const manager = new ConversationManager({
  conversationsPath: '.automatosx/cli-conversations',
  autoSaveInterval: 30000
});

// Add messages
manager.addMessage('user', 'Hello', {});
manager.addMessage('assistant', 'Hi!', { tokensUsed: 5 });

// Save
await manager.saveAs('my-conversation');

// Load
await manager.loadFromFile('path/to/conversation.json');

// Export
const markdown = manager.exportToMarkdown();
```

---

## FAQ

**Q: Can I use ax-cli without internet?**
A: Yes! Mock mode works offline. Real providers require internet.

**Q: Are conversations private?**
A: Yes! All data is stored locally in `.automatosx/`. Nothing is sent to servers except provider API calls.

**Q: Can I customize the AI personality?**
A: Agent personalities are defined in agent profiles. Edit `.automatosx/agents/*.yaml` to customize.

**Q: What's the difference between `ax cli` and `ax run`?**
A: `ax cli` is interactive (like ChatGPT). `ax run` executes single commands and exits.

**Q: Can I run ax-cli in CI/CD?**
A: Not recommended. Use `ax run` for automated workflows. ax-cli is for human interaction.

**Q: How do I update ax-cli?**
A: Update AutomatosX: `npm install -g @defai.digital/automatosx@latest`

---

## Changelog

### v7.1.0-beta.1 (2025-11-03)

**Added:**
- Initial release of interactive CLI
- Real-time streaming responses
- Conversation persistence (save/load/list/delete)
- 13 slash commands
- Agent delegation (@agent and DELEGATE TO syntax)
- Markdown export
- Auto-save (30s intervals)
- Mock provider for testing

**Fixed:**
- Welcome message duplication
- Goodbye message duplication

---

## Support

- **Documentation**: https://docs.automatosx.ai
- **Issues**: https://github.com/defai-digital/automatosx/issues
- **Discussions**: https://github.com/defai-digital/automatosx/discussions

---

## Related Documentation

- [AutomatosX Overview](../README.md)
- [Agent System](./guides/agents.md)
- [Memory System](./guides/memory.md)
- [Provider Configuration](./providers/overview.md)
- [Multi-Agent Orchestration](./guides/multi-agent-orchestration.md)

---

**Happy chatting with ax-cli!** 🚀
