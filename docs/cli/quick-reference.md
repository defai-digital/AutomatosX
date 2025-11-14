# Interactive CLI Quick Reference

**AutomatosX v8.0.0** | [Full Documentation](./interactive-mode.md) | [Architecture](./interactive-architecture.md)

---

## 🚀 Quick Start

```bash
# Launch Interactive CLI
ax cli

# Start conversation with an agent
> /agent BackendAgent
> how do I implement authentication?

# Save your session
> /save my-session.json

# Exit
> /exit
```

---

## ⌨️ All Commands (13 Total)

| Command | Args | Description | Example |
|---------|------|-------------|---------|
| `/help` | - | Show all commands | `/help` |
| `/agent` | `<name>` | Set active agent | `/agent BackendAgent` |
| `/status` | - | Show session info | `/status` |
| `/history` | `[limit]` | Show message history | `/history 10` |
| `/clear` | - | Clear conversation | `/clear` |
| `/context` | - | Show conversation context | `/context` |
| `/set` | `<var> <value>` | Set variable | `/set apiKey abc123` |
| `/get` | `<var>` | Get variable | `/get apiKey` |
| `/list` | - | List all variables | `/list` |
| `/save` | `<file>` | Save to JSON file | `/save backup.json` |
| `/load` | `<file>` | Load from JSON file | `/load backup.json` |
| `/export` | `<format>` | Export conversation | `/export markdown` |
| `/exit` | - | Exit Interactive CLI | `/exit` |

---

## 🤖 Available Agents (21 Total)

### Development Agents

- **BackendAgent** - Backend/API development
- **FrontendAgent** - Frontend/UI development
- **FullStackAgent** - Full-stack development
- **DevOpsAgent** - DevOps and infrastructure
- **DatabaseAgent** - Database design and optimization
- **TestingAgent** - Testing strategies and QA
- **SecurityAgent** - Security and compliance

### Technical Agents

- **ArchitectAgent** - System architecture and design
- **CodeReviewAgent** - Code review and best practices
- **DebugAgent** - Debugging and troubleshooting
- **PerformanceAgent** - Performance optimization
- **DocumentationAgent** - Technical documentation
- **APIDesignAgent** - API design and standards

### Leadership Agents

- **ProductAgent** - Product management and strategy
- **ProjectAgent** - Project management and planning
- **TechLeadAgent** - Technical leadership

### Creative Agents

- **UXAgent** - UX/UI design
- **ContentAgent** - Content creation and writing

### Science Agents

- **DataScienceAgent** - Data science and ML
- **ResearchAgent** - Research and analysis
- **MLOpsAgent** - MLOps and model deployment

---

## 💾 Export Formats

| Format | Output | Use Case |
|--------|--------|----------|
| `json` | Structured JSON | Programmatic access, backups |
| `markdown` | Formatted Markdown | Documentation, sharing |
| `text` | Plain text | Simple logs, copy-paste |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` | Previous command in history |
| `↓` | Next command in history |
| `Tab` | Autocomplete command name |
| `Ctrl+C` | Cancel current input |
| `Ctrl+D` | Exit Interactive CLI |
| `Ctrl+L` | Clear screen (terminal) |

---

## 🎯 Common Workflows

### 1. Quick Question

```bash
> /agent BackendAgent
> how do I rate limit an Express API?
> thanks!
> /exit
```

### 2. Extended Conversation

```bash
> /agent FullStackAgent
> I'm building a todo app with React and Node.js

# Conversation continues...
> how do I handle authentication?

# Later...
> can you help me with deployment?

# Save progress
> /save todo-app-session.json
```

### 3. Multi-Agent Collaboration

```bash
# Frontend questions
> /agent FrontendAgent
> how do I structure my React components?

# Switch to backend
> /agent BackendAgent
> what's the best way to design my REST API?

# Security review
> /agent SecurityAgent
> what security measures should I add?
```

### 4. Save and Resume

```bash
# Save current session
> /save project-session.json
> /exit

# Later, resume
$ ax cli
> /load project-session.json
> /agent FrontendAgent
> let's continue where we left off
```

### 5. Set Context Variables

```bash
# Set project context
> /set project my-ecommerce-app
> /set stack React,Node.js,PostgreSQL
> /set environment production

# Check context
> /context

# Variables persist across messages
> /agent BackendAgent
> given our stack, how should I structure the API?
```

---

## 🔍 Troubleshooting

### Command Not Found

```bash
❌ Error: Unknown command: /status
```

**Solution:** Use `/help` to see all available commands. Check for typos.

### Agent Not Found

```bash
❌ Error: Unknown agent: BackAgent
```

**Solution:** Use `/status` to see all 21 available agents. Agent names are case-sensitive.

### Save/Load Fails

```bash
❌ Error: Cannot save to /protected/path.json
```

**Solution:** Ensure you have write permissions. Use relative paths or `~/` for home directory.

### Conversation Too Long

```bash
⚠️ Warning: Conversation has 200+ messages
```

**Solution:** Use `/clear` to start fresh, or `/export markdown` to save before clearing.

### Context Variables Not Working

```bash
> /set myVar value
> /get myVar
```

**Solution:** Ensure variable names don't have spaces. Use quotes for multi-word values:
```bash
> /set projectName "My Project"
```

---

## 💡 Tips & Tricks

### 1. Use Tab Autocomplete

```bash
> /ag<Tab>  # Completes to /agent
```

### 2. Chain Commands with Semicolons

```bash
> /agent BackendAgent; /set stack Node.js; /status
```

*(Not implemented yet, planned for v8.1)*

### 3. Export Before Major Changes

```bash
> /export json > backup-$(date +%Y%m%d).json
> /clear
```

### 4. Use Variables for Repeated Context

```bash
> /set stack "React, TypeScript, Node.js, PostgreSQL"
> /agent FullStackAgent
> using our $stack, how do I structure the project?
```

### 5. History Navigation

- Press `↑` repeatedly to browse command history
- Use `/history 20` to see last 20 messages at once

### 6. Quick Agent Switch

```bash
# Don't clear conversation when switching agents!
> /agent BackendAgent
> # Ask backend question

> /agent FrontendAgent
> # Ask frontend question
# Both agents see the full context
```

---

## 📋 Status Information

### `/status` Output

```
╔══════════════════════════════════════════════════╗
║         Interactive CLI Session Status           ║
╚══════════════════════════════════════════════════╝

Active Agent: BackendAgent
Total Messages: 12
Variables Set: 3
  - project: my-app
  - stack: Node.js
  - environment: development

Session Duration: 15m 32s
Last Auto-save: 2025-01-12 14:23:11
```

### `/context` Output

```
Conversation Context:

Messages: 12
  - User: 6
  - Assistant: 6

Recent (last 5):
  [User] how do I implement rate limiting?
  [Assistant] Here's how to implement rate limiting...
  [User] what about distributed systems?
  [Assistant] For distributed rate limiting...
  [User] thanks!

Variables:
  project = my-app
  stack = Node.js
  environment = development
```

---

## 🎨 Output Formatting

### Color Coding

- 🟢 **Green**: Success messages, confirmations
- 🔵 **Blue**: Information, status updates
- 🟡 **Yellow**: Warnings, suggestions
- 🔴 **Red**: Errors, failures
- ⚪ **Gray**: Secondary information, timestamps

### Loading Indicators

```
⠋ Thinking...           # AI is processing
⠙ Saving...             # Auto-saving to database
✓ Saved successfully    # Operation complete
```

---

## 📚 More Resources

- **Full User Guide:** [interactive-mode.md](./interactive-mode.md)
- **Architecture Docs:** [interactive-architecture.md](./interactive-architecture.md)
- **Main README:** [../../README.md](../../README.md)
- **GitHub Issues:** [Report bugs](https://github.com/your-repo/issues)

---

## 🆘 Getting Help

### In the CLI

```bash
> /help              # Show all commands
> /status            # Check session status
> /context           # View conversation context
```

### External Resources

- **Documentation:** Read the full user guide
- **Issues:** Check GitHub issues for known problems
- **Community:** Ask in discussions

---

## 🔄 Auto-save Behavior

The Interactive CLI automatically saves your conversation:

- **Every 5 messages** - Background save (non-blocking)
- **On exit** - Final save when you quit
- **Storage:** SQLite database in `.automatosx/db/`

**Manual Save:**
```bash
> /save backup.json    # Save to JSON file anytime
```

---

## 📝 Quick Command Patterns

### Information Commands
```bash
/help                  # Show all commands
/status                # Session information
/context               # Conversation context
/history               # Message history
/list                  # List variables
```

### Action Commands
```bash
/agent <name>          # Set active agent
/set <var> <value>     # Set variable
/get <var>             # Get variable
/clear                 # Clear conversation
```

### File Commands
```bash
/save <file>           # Save to JSON
/load <file>           # Load from JSON
/export <format>       # Export conversation
```

### Exit Commands
```bash
/exit                  # Exit Interactive CLI
Ctrl+D                 # Alternative exit
```

---

**Last Updated:** 2025-01-12
**Version:** 8.0.0
**Status:** Production Ready
