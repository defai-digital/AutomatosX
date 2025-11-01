# AutomatosX Integration

This project uses [AutomatosX](https://github.com/defai.digital/automatosx) - an AI agent orchestration platform with persistent memory and multi-agent collaboration.

## Quick Start

### Available Commands

```bash
# List all available agents
ax list agents

# Run an agent with a task
ax run <agent-name> "your task description"

# Example: Ask the backend agent to create an API
ax run backend "create a REST API for user management"

# Search memory for past conversations
ax memory search "keyword"

# View system status
ax status
```

### Using AutomatosX in Gemini CLI

You can interact with AutomatosX agents directly in Gemini CLI using custom commands or natural language:

**Slash Commands (Recommended)**:
```
/ax backend, create a REST API for user management
/ax security, audit the authentication flow
/ax quality, write unit tests for the API
```

**Natural Language**:
```
"Please use the ax backend agent to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
```

**System Commands**:
```
/ax-status          - Check AutomatosX system status
/ax-list agents     - List all available agents
/ax-memory search   - Search conversation history
/ax-init            - Initialize AutomatosX in current project
/ax-clear           - Clear memory cache
/ax-update          - Update AutomatosX to latest version
```

### Available Agents

This project includes the following specialized agents:

- **backend** (Bob) - Backend development (Go/Rust systems)
- **frontend** (Frank) - Frontend development (React/Next.js/Swift)
- **architecture** (Avery) - System architecture and ADR management
- **fullstack** (Felix) - Full-stack development (Node.js/TypeScript)
- **mobile** (Maya) - Mobile development (iOS/Android, Swift/Kotlin/Flutter)
- **devops** (Oliver) - DevOps and infrastructure
- **security** (Steve) - Security auditing and threat modeling
- **data** (Daisy) - Data engineering and ETL
- **quality** (Queenie) - QA and testing
- **design** (Debbee) - UX/UI design
- **writer** (Wendy) - Technical writing
- **product** (Paris) - Product management
- **cto** (Tony) - Technical strategy
- **ceo** (Eric) - Business leadership
- **researcher** (Rodman) - Research and analysis
- **data-scientist** (Dana) - Machine learning and data science
- **aerospace-scientist** (Astrid) - Aerospace engineering and mission design
- **quantum-engineer** (Quinn) - Quantum computing and algorithms
- **creative-marketer** (Candy) - Creative marketing and content strategy
- **standard** (Stan) - Standards and best practices expert

For a complete list with capabilities, run: `ax list agents --format json`

## Key Features

### 1. Persistent Memory

AutomatosX agents remember all previous conversations and decisions:

```bash
# First task - design is saved to memory
ax run product "Design a calculator with add/subtract features"

# Later task - automatically retrieves the design from memory
ax run backend "Implement the calculator API"
```

**Or in Gemini CLI**:
```
/ax product, design a calculator with add/subtract features
# Later...
/ax backend, implement the calculator API
```

### 2. Multi-Agent Collaboration

Agents can delegate tasks to each other automatically:

```bash
ax run product "Build a complete user authentication feature"
# → Product agent designs the system
# → Automatically delegates implementation to backend agent
# → Automatically delegates security audit to security agent
```

**Gemini CLI Example**:
```
/ax product, build a complete user authentication feature
```

### 3. Cross-Provider Support

AutomatosX supports multiple AI providers with automatic fallback:
- **Gemini** (Google) - Primary provider for Gemini CLI users
- **Claude** (Anthropic) - Alternative provider
- **OpenAI** (GPT) - Alternative provider

Configuration is in `automatosx.config.json`.

## Configuration

### Project Configuration

Edit `automatosx.config.json` to customize:

```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1,
      "command": "gemini"
    },
    "claude-code": {
      "enabled": true,
      "priority": 2
    }
  },
  "execution": {
    "defaultTimeout": 1500000,
    "maxRetries": 3
  },
  "memory": {
    "enabled": true,
    "maxEntries": 10000
  }
}
```

### Agent Customization

Create custom agents in `.automatosx/agents/`:

```bash
ax agent create my-agent --template developer --interactive
```

Then use them in Gemini CLI:
```
/ax my-agent, your custom task
```

### Workspace Conventions

**IMPORTANT**: AutomatosX uses specific directories for organized file management. Please follow these conventions when working with agents:

- **`automatosx/PRD/`** - Product Requirements Documents, design specs, and planning documents
  - Use for: Architecture designs, feature specs, technical requirements
  - Example: `automatosx/PRD/auth-system-design.md`

- **`automatosx/tmp/`** - Temporary files, scratch work, and intermediate outputs
  - Use for: Draft code, test outputs, temporary analysis
  - Auto-cleaned periodically
  - Example: `automatosx/tmp/draft-api-endpoints.ts`

**Usage in Gemini CLI**:
```
/ax product, save the architecture design to automatosx/PRD/user-auth-design.md
/ax backend, put the draft implementation in automatosx/tmp/auth-draft.ts for review
/ax backend, implement the spec in automatosx/PRD/api-spec.md
```

**Natural Language**:
```
"Please save the architecture design to automatosx/PRD/user-auth-design.md"
"Put the draft implementation in automatosx/tmp/auth-draft.ts for review"
"Implement the spec in automatosx/PRD/api-spec.md"
```

These directories are automatically created by `ax init` and included in `.gitignore` appropriately.

## Memory System

### Search Memory

```bash
# Search for past conversations
ax memory search "authentication"
ax memory search "API design"

# List recent memories
ax memory list --limit 10

# Export memory for backup
ax memory export > backup.json
```

**In Gemini CLI**:
```
/ax-memory search authentication
```

### How Memory Works

- **Automatic**: All agent conversations are saved automatically
- **Fast**: SQLite FTS5 full-text search (< 1ms)
- **Local**: 100% private, data never leaves your machine
- **Cost**: $0 (no API calls for memory operations)

## Advanced Usage

### Parallel Execution (v5.6.0+)

Run multiple agents in parallel for faster workflows:

```bash
ax run product "Design authentication system" --parallel
```

### Resumable Runs (v5.3.0+)

For long-running tasks, enable checkpoints:

```bash
ax run backend "Refactor entire codebase" --resumable

# If interrupted, resume with:
ax resume <run-id>

# List all runs
ax runs list
```

### Streaming Output (v5.6.5+)

See real-time output from AI providers:

```bash
ax run backend "Explain this codebase" --streaming
```

### Spec-Driven Development (v5.8.0+)

For complex projects, use spec-driven workflows:

```bash
# Create spec from natural language
ax spec create "Build authentication with database, API, JWT, and tests"

# Or manually define in .specify/tasks.md
ax spec run --parallel

# Check progress
ax spec status
```

## Gemini CLI Integration

### Custom Commands

AutomatosX provides custom Gemini CLI commands in `.gemini/commands/`:

| Command | Description | Example |
|---------|-------------|---------|
| `/ax` | Execute any agent | `/ax backend, create API` |
| `/ax-status` | Check system status | `/ax-status` |
| `/ax-list` | List agents/abilities | `/ax-list agents` |
| `/ax-memory` | Search memory | `/ax-memory search auth` |
| `/ax-init` | Initialize project | `/ax-init` |
| `/ax-clear` | Clear memory | `/ax-clear` |
| `/ax-update` | Update AutomatosX | `/ax-update` |

### Command Syntax

**Format**: `/ax <agent>, <task>`

- Use a **comma** to separate agent name and task
- Agent name can be display name (Bob, Frank) or ID (backend, frontend)

**Examples**:
```
/ax bob, create a REST API for authentication
/ax frank, build a responsive navbar
/ax steve, audit this code for security
/ax queenie, write unit tests
```

### Sync Commands

Register custom commands with Gemini CLI:

```bash
# Check Gemini CLI integration status
ax gemini status

# Sync custom commands
ax gemini sync-mcp

# List available commands
ax gemini list-commands
```

## Troubleshooting

### Common Issues

**"Agent not found"**
```bash
# List available agents
ax list agents

# Make sure agent name is correct
ax run backend "task"  # ✓ Correct
ax run Backend "task"  # ✗ Wrong (case-sensitive)
```

Or in Gemini CLI:
```
/ax-list agents
/ax backend, your task
```

**"Provider not available"**
```bash
# Check system status
ax status

# View configuration
ax config show
```

Or in Gemini CLI:
```
/ax-status
```

**"Out of memory"**
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory stats
ax cache stats
```

Or in Gemini CLI:
```
/ax-clear
```

**"Gemini CLI not found"**
```bash
# Install Gemini CLI
npm install -g @google/gemini-cli

# Verify installation
gemini --version

# Check AutomatosX integration
ax gemini status
```

### Getting Help

```bash
# View command help
ax --help
ax run --help

# Enable debug mode
ax --debug run backend "task"

# Search memory for similar past tasks
ax memory search "similar task"
```

**In Gemini CLI**:
```
/ax-status          # Check system health
/ax-list agents     # See available agents
/ax-memory search   # Find past conversations
```

## Best Practices

1. **Use Slash Commands in Gemini CLI**: Cleaner syntax than natural language
2. **Leverage Memory**: Reference past decisions and designs
3. **Start Simple**: Test with small tasks before complex workflows
4. **Review Configurations**: Check `automatosx.config.json` for timeouts and retries
5. **Keep Agents Specialized**: Use the right agent for each task type
6. **Use Agent Names or IDs**: Both work (Bob = backend, Frank = frontend)

## Documentation

- **AutomatosX Docs**: https://github.com/defai-digital/automatosx
- **Agent Directory**: `.automatosx/agents/`
- **Configuration**: `automatosx.config.json`
- **Memory Database**: `.automatosx/memory/memories.db`
- **Workspace**: `automatosx/PRD/` (planning docs) and `automatosx/tmp/` (temporary files)
- **Gemini Commands**: `.gemini/commands/` (custom slash commands)

## Support

- Issues: https://github.com/defai-digital/automatosx/issues
- NPM: https://www.npmjs.com/package/@defai.digital/automatosx
