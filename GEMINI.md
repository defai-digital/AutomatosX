# GEMINI.md

This file provides guidance to Gemini CLI users when working with code in this repository.

---

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

You can interact with AutomatosX agents directly in Gemini CLI using natural language:

**Natural Language Examples**:
```
"Please use the ax backend agent to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
"Work with ax agent product to design this new feature"
"Use ax agent devops to set up the deployment pipeline"
```

Gemini CLI will understand your intent and invoke the appropriate AutomatosX agent for you. Just describe what you need in natural language - no special commands required!

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
"Use ax agent product to design a calculator with add/subtract features"
# Later...
"Ask ax agent backend to implement the calculator API"
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
"Use ax product agent to build a complete user authentication feature"
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
"Use ax agent my-agent for your custom task"
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

**Usage in Gemini CLI** (natural language):
```
"Use ax product agent to save the architecture design to automatosx/PRD/user-auth-design.md"
"Have ax backend agent put the draft implementation in automatosx/tmp/auth-draft.ts for review"
"Ask ax backend agent to implement the spec in automatosx/PRD/api-spec.md"
```

These directories are automatically created by `ax setup` and included in `.gitignore` appropriately.

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

**In Gemini CLI** (natural language):
```
"Search AutomatosX memory for authentication"
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

### Natural Language Interface (v7.0.0+)

**IMPORTANT**: As of v7.0.0, AutomatosX uses natural language only. Custom slash commands have been removed.

Instead of slash commands, simply talk naturally to Gemini CLI:

**Natural Language Examples**:
```
"Use ax agent backend to create a REST API for authentication"
"Ask ax agent frontend to build a responsive navbar"
"Have ax agent security audit this code for vulnerabilities"
"Work with ax agent quality to write unit tests"
```

### Direct CLI Usage

For direct AutomatosX CLI usage in your terminal:

```bash
# List all available agents
ax list agents

# Run an agent
ax run backend "create REST API"

# Search memory
ax memory search "authentication"

# Check system status
ax status
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

**"Provider not available"**
```bash
# Check system status
ax status

# View configuration
ax config show
```

**"Out of memory"**
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory stats
ax cache stats
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

**In Gemini CLI** (natural language):
```
"Check AutomatosX system status"
"List all available agents"
"Search memory for authentication conversations"
```

## Best Practices

1. **Use Natural Language in Gemini CLI**: Talk naturally to interact with AutomatosX agents
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

## Support

- Issues: https://github.com/defai-digital/automatosx/issues
- NPM: https://www.npmjs.com/package/@defai.digital/automatosx


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

You can interact with AutomatosX agents directly in Gemini CLI using natural language:

**Natural Language Examples**:
```
"Please use the ax backend agent to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
"Work with ax agent product to design this new feature"
"Use ax agent devops to set up the deployment pipeline"
```

Gemini CLI will understand your intent and invoke the appropriate AutomatosX agent for you. Just describe what you need in natural language - no special commands required!

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
"Use ax agent product to design a calculator with add/subtract features"
# Later...
"Ask ax agent backend to implement the calculator API"
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
"Use ax product agent to build a complete user authentication feature"
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
"Use ax agent my-agent for your custom task"
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

**Usage in Gemini CLI** (natural language):
```
"Use ax product agent to save the architecture design to automatosx/PRD/user-auth-design.md"
"Have ax backend agent put the draft implementation in automatosx/tmp/auth-draft.ts for review"
"Ask ax backend agent to implement the spec in automatosx/PRD/api-spec.md"
```

These directories are automatically created by `ax setup` and included in `.gitignore` appropriately.

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

**In Gemini CLI** (natural language):
```
"Search AutomatosX memory for authentication"
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

### Natural Language Interface (v7.0.0+)

**IMPORTANT**: As of v7.0.0, AutomatosX uses natural language only. Custom slash commands have been removed.

Instead of slash commands, simply talk naturally to Gemini CLI:

**Natural Language Examples**:
```
"Use ax agent backend to create a REST API for authentication"
"Ask ax agent frontend to build a responsive navbar"
"Have ax agent security audit this code for vulnerabilities"
"Work with ax agent quality to write unit tests"
```

### Direct CLI Usage

For direct AutomatosX CLI usage in your terminal:

```bash
# List all available agents
ax list agents

# Run an agent
ax run backend "create REST API"

# Search memory
ax memory search "authentication"

# Check system status
ax status
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

**"Provider not available"**
```bash
# Check system status
ax status

# View configuration
ax config show
```

**"Out of memory"**
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory stats
ax cache stats
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

**In Gemini CLI** (natural language):
```
"Check AutomatosX system status"
"List all available agents"
"Search memory for authentication conversations"
```

## Best Practices

1. **Use Natural Language in Gemini CLI**: Talk naturally to interact with AutomatosX agents
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

## Support

- Issues: https://github.com/defai-digital/automatosx/issues
- NPM: https://www.npmjs.com/package/@defai.digital/automatosx
