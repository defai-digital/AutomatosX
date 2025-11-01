# AutomatosX Integration Guide

**Version**: 6.3.8 | **Updated**: October 31, 2025

---

## Table of Contents

- [Quick Start](#quick-start)
- [Using with Claude Code](#claude-code)
- [Using with Gemini CLI](#gemini-cli)
- [Using with Other AI Assistants](#other-assistants)
- [Core Concepts](#core-concepts)
- [Available Agents](#agents)
- [Memory System](#memory)
- [Workspace Conventions](#workspace)
- [Configuration](#configuration)
- [Advanced Features](#advanced)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Reference](#reference)

---

## Quick Start

### Installation Check

AutomatosX should already be initialized in this project. Verify:

```bash
# Check AutomatosX is available
ax --version

# List available agents
ax list agents

# Check system status
ax status
```

### Your First Agent Task

```bash
# Run a simple task with the backend agent
ax run backend "create a simple REST API endpoint"

# The agent will:
# 1. Process your request
# 2. Generate code
# 3. Save conversation to memory
# 4. Provide output
```

### Platform-Specific Quick Start

- **Claude Code Users**: Jump to [Using with Claude Code](#claude-code)
- **Gemini CLI Users**: Jump to [Using with Gemini CLI](#gemini-cli)
- **Other AI Assistants**: Jump to [Using with Other AI Assistants](#other-assistants)

---

## Using with Claude Code {#claude-code}

### Overview

Claude Code works best with **natural language** commands. Just describe what you want AutomatosX agents to do in your conversation.

### Recommended Pattern

```
"Please work with ax agent backend to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
```

Claude Code will:
1. Understand you want to delegate to an AutomatosX agent
2. Run the appropriate `ax` command
3. Return the agent's response
4. Continue the conversation with full context

### Alternative: Slash Commands

You can also use slash commands:

```
/ax-agent backend, create a REST API for user management
/ax-agent security, audit the authentication flow
/ax-agent quality, write unit tests for the API
```

### Multi-Step Workflows

Claude Code can coordinate complex multi-agent workflows:

```
"Please coordinate with AutomatosX agents to build a complete auth system:
1. Have the product agent design the architecture
2. Have the backend agent implement the API
3. Have the security agent audit the implementation
4. Have the quality agent write comprehensive tests"
```

### Best Practices for Claude Code

✅ **Do**:
- Use natural language (it's more powerful in Claude Code)
- Let Claude coordinate multi-step workflows
- Reference past conversations (Claude + AutomatosX memory = perfect context)
- Ask for explanations of agent outputs

❌ **Don't**:
- Manually run `ax` commands unless debugging
- Repeat context (Claude Code + memory handle this automatically)
- Use slash commands for complex workflows (natural language works better)

### Examples

**Product Development:**
```
"Work with ax agent product to design a user dashboard, then have the frontend agent implement it"
```

**Code Review:**
```
"Ask ax agent security to review this authentication code for vulnerabilities"
```

**Testing:**
```
"Have ax agent quality write integration tests for the API endpoints we just created"
```

---

## Using with Gemini CLI {#gemini-cli}

### Overview

Gemini CLI works best with **slash commands** using the comma syntax.

### Recommended Pattern

```
/ax backend, create a REST API for user management
/ax security, audit the authentication flow
/ax quality, write unit tests for the API
```

⚠️ **Important**: The comma is required to separate agent name from task.

### Command Syntax

**Format**: `/ax <agent>, <task>`

- Agent name can be:
  - Agent ID: `backend`, `frontend`, `security`
  - Display name: `bob`, `frank`, `steve`
- Task: Anything after the comma

**System Commands:**

| Command | Description | Example |
|---------|-------------|---------|
| `/ax-status` | Check system status | `/ax-status` |
| `/ax-list` | List agents | `/ax-list agents` |
| `/ax-memory` | Search memory | `/ax-memory search auth` |
| `/ax-init` | Initialize project | `/ax-init` |
| `/ax-clear` | Clear memory | `/ax-clear` |

### Alternative: Natural Language

You can also use natural language:

```
"Please use the ax backend agent to implement user authentication"
"Ask the ax security agent to audit this code"
```

### Multi-Step Workflows

For complex workflows, describe the full task:

```
/ax product, build a complete user authentication feature with database, API, JWT, and comprehensive tests
```

The product agent will:
1. Design the system
2. Delegate implementation to backend agent
3. Delegate security audit to security agent
4. Delegate testing to quality agent

### Best Practices for Gemini CLI

✅ **Do**:
- Use slash commands for quick tasks (faster than natural language)
- Use comma separator (required for syntax)
- Check agent names with `/ax-list agents` if unsure
- Use natural language for complex multi-step workflows

❌ **Don't**:
- Forget the comma (command will fail)
- Use incorrect case (agent names are case-sensitive)
- Mix multiple agents in one command (delegate instead)

### Examples

**Quick Tasks:**
```
/ax backend, create a simple calculator API
/ax frontend, build a responsive navbar
/ax security, audit this file for vulnerabilities
```

**Complex Workflows:**
```
/ax product, design and implement a complete e-commerce checkout flow
```

**Memory Search:**
```
/ax-memory search authentication
```

### Setting Up Gemini CLI Integration

If slash commands aren't working:

```bash
# Check integration status
ax gemini status

# Sync custom commands
ax gemini sync-mcp

# Restart Gemini CLI
# Your slash commands should now work
```

---

## Using with Other AI Assistants {#other-assistants}

### Overview

AutomatosX works with any AI coding assistant that can run bash commands.

### Generic Pattern

Most AI assistants can run commands via their terminal/bash tools. Use this pattern:

```bash
# List agents
ax list agents

# Run an agent
ax run <agent-name> "your task description"

# Examples
ax run backend "create a REST API for user management"
ax run security "audit the authentication flow"
ax run quality "write unit tests"
```

### Platform-Specific Guides

- **Cursor**: Use Ctrl+K or Cmd+K, then ask Cursor to run `ax` commands
- **GitHub Copilot**: Use Copilot Chat to run terminal commands
- **Codeium**: Use chat interface to execute `ax` commands
- **Tabnine**: Use Tabnine Chat to run commands

### Integration Pattern

1. Ask your AI assistant: "Please run: `ax run backend 'create a simple API'`"
2. The assistant executes the command
3. AutomatosX agent processes the request
4. Result is returned to your assistant
5. Continue the conversation

### Setting Up

```bash
# Initialize AutomatosX
ax init

# Verify installation
ax --version

# Test with a simple command
ax run backend "explain what you do"
```

---

## Core Concepts {#core-concepts}

### 1. Persistent Memory

Every agent conversation is automatically saved to a local SQLite database. Future tasks can access past decisions and designs.

**How it works:**
- All `ax run` commands save to memory
- Search with `ax memory search "keyword"`
- Agents automatically retrieve relevant past context
- 100% local (data never leaves your machine)
- Zero cost (no API calls for memory)

**Example:**
```bash
# Day 1: Design
ax run product "Design a calculator with add/subtract features"

# Day 2: Implementation (automatically gets Day 1 design from memory)
ax run backend "Implement the calculator API"
```

### 2. Multi-Agent Collaboration

Agents can delegate tasks to other agents automatically using the delegation syntax:

```
@agent-name task description
```

or

```
DELEGATE TO agent-name: task description
```

**Example:**

When you ask the product agent to "Build a complete auth system", it might respond:

```
I'll design the authentication system with JWT and OAuth2.

@backend Please implement the JWT authentication API.
@security Please audit the implementation for vulnerabilities.
@quality Please write integration tests.
```

AutomatosX automatically:
1. Parses the delegation requests
2. Runs each delegated agent
3. Collects results
4. Returns aggregated output

### 3. Policy-Driven Provider Routing

AutomatosX automatically selects the best AI provider based on your policy:

**Policies:**
- `cost`: Minimize cost (uses Gemini free tier)
- `latency`: Minimize response time
- `reliability`: Maximize success rate
- `balanced`: Balance all factors

**Configuration** (`automatosx.config.json`):
```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1
    },
    "claude-code": {
      "enabled": true,
      "priority": 2
    }
  },
  "router": {
    "enableFreeTierPrioritization": true
  }
}
```

---

## Available Agents {#agents}

### Core Development Agents

| Agent ID | Name | Expertise | When to Use |
|----------|------|-----------|-------------|
| `backend` | Bob | Go, Rust, databases, APIs | Backend systems, APIs, data processing |
| `frontend` | Frank | React, Next.js, Vue, Swift UI | Web frontends, mobile UI, component libraries |
| `architecture` | Avery | System architecture, ADRs, technical debt | Architecture governance, system design, ADR management |
| `fullstack` | Felix | Node.js, TypeScript | Full-stack web apps, both FE + BE |
| `mobile` | Maya | iOS, Android, Flutter, React Native | Mobile apps, cross-platform development |
| `devops` | Oliver | Kubernetes, Docker, CI/CD, AWS | Infrastructure, deployment, automation |

### Specialized Agents

| Agent ID | Name | Expertise | When to Use |
|----------|------|-----------|-------------|
| `security` | Steve | Threat modeling, OWASP, penetration testing | Security audits, vulnerability assessment |
| `quality` | Queenie | Test planning, E2E testing, QA | Writing tests, quality assurance |
| `data` | Daisy | ETL, Spark, data warehouses | Data pipelines, data engineering |
| `data-scientist` | Dana | ML, statistics, Python, PyTorch | Machine learning, data analysis |

### Product & Strategy Agents

| Agent ID | Name | Expertise | When to Use |
|----------|------|-----------|-------------|
| `product` | Paris | Requirements, roadmaps, stakeholder management | Feature design, product planning |
| `cto` | Tony | Technical strategy, architecture, scaling | Architecture decisions, tech strategy |
| `ceo` | Eric | Business strategy, vision, leadership | Business decisions, strategic planning |

### Documentation & Standards

| Agent ID | Name | Expertise | When to Use |
|----------|------|-----------|-------------|
| `writer` | Wendy | Technical writing, API docs, tutorials | Documentation, guides, README files |
| `standard` | Stan | Best practices, design patterns, code review | Code review, standards enforcement |
| `researcher` | Rodman | Research, analysis, literature review | Technology research, competitive analysis |

### Other Specialized Agents

| Agent ID | Name | Expertise | When to Use |
|----------|------|-----------|-------------|
| `design` | Debbee | UX/UI, Figma, design systems | User experience, interface design |
| `aerospace-scientist` | Astrid | Aerospace, orbital mechanics, mission design | Aerospace engineering projects |
| `quantum-engineer` | Quinn | Quantum computing, quantum algorithms | Quantum computing research |
| `creative-marketer` | Candy | Content strategy, creative marketing | Marketing content, campaigns |

**Total**: 20 specialized agents

**See full list**:
```bash
ax list agents
ax list agents --format json  # For programmatic access
```

---

## Memory System {#memory}

### How Memory Works

AutomatosX uses SQLite with FTS5 (Full-Text Search) for fast, local memory:

- **Automatic**: All `ax run` commands save to memory
- **Fast**: < 1ms search with SQLite FTS5
- **Local**: 100% private, data never leaves your machine
- **Cost**: $0 (no API calls)

### Searching Memory

```bash
# Basic search
ax memory search "authentication"

# Search with limit
ax memory search "API design" --limit 5

# List recent memories
ax memory list --limit 10

# Export memory
ax memory export > backup.json

# Import memory
ax memory import backup.json
```

### Memory in Practice

**Scenario**: Building an authentication system

```bash
# Day 1: Architecture design
ax run product "Design JWT authentication with refresh tokens"
# → Saved to memory

# Day 2: Implementation
ax run backend "Implement the authentication API"
# → Automatically retrieves Day 1 design from memory
# → Uses design as context for implementation

# Day 3: Security review
ax run security "Audit the authentication system"
# → Gets both design (Day 1) and implementation (Day 2) from memory
# → Can reference specific decisions made earlier

# Day 4: Documentation
ax run writer "Document the authentication system API"
# → Gets full context from all previous days
# → Writes accurate documentation based on actual implementation
```

### Memory Management

```bash
# Clear all memories
ax memory clear

# Clear memories before a date
ax memory clear --before "2024-01-01"

# View memory statistics
ax cache stats

# Check memory database
ls -lh .automatosx/memory/memories.db
```

### How Agents Use Memory

When you run `ax run backend "implement the calculator"`, the backend agent:

1. Searches memory for relevant past context:
   - Keyword search for "calculator"
   - Finds "Design a calculator with add/subtract" from previous task
2. Injects past context into the current prompt
3. Generates response with full context
4. Saves new conversation to memory

**Result**: Zero manual context copying, perfect continuity.

---

## Workspace Conventions {#workspace}

### Directory Structure

AutomatosX uses specific directories for organized file management:

```
your-project/
├── .automatosx/           # AutomatosX data (auto-created)
│   ├── agents/            # Custom agent profiles
│   ├── memory/            # SQLite memory database
│   ├── sessions/          # Session data
│   └── logs/              # Trace logs
├── automatosx/
│   ├── PRD/               # Product Requirements Documents
│   └── tmp/               # Temporary files (auto-cleaned)
└── [your project files]
```

### automatosx/PRD/ - Planning Documents

**Use for**: Long-lived planning and design documents

Examples:
- Architecture designs: `automatosx/PRD/auth-system-design.md`
- Feature specs: `automatosx/PRD/user-dashboard-spec.md`
- Technical requirements: `automatosx/PRD/api-requirements.md`
- Design decisions: `automatosx/PRD/database-schema.md`

**Characteristics**:
- Committed to git
- Referenced in future tasks
- Stable, long-lived content

### automatosx/tmp/ - Temporary Files

**Use for**: Scratch work, drafts, intermediate outputs

Examples:
- Draft code: `automatosx/tmp/draft-api-endpoints.ts`
- Test outputs: `automatosx/tmp/test-results.log`
- Analysis: `automatosx/tmp/performance-analysis.md`
- Experiments: `automatosx/tmp/experiment-v2.py`

**Characteristics**:
- **Not** committed to git (in .gitignore)
- Auto-cleaned periodically
- Safe to delete anytime

### Usage in AI Assistants

**Claude Code**:
```
"Please save the architecture design to automatosx/PRD/user-auth-design.md"
"Put the draft implementation in automatosx/tmp/auth-draft.ts for review"
"Work with ax agent backend to implement the spec in automatosx/PRD/api-spec.md"
```

**Gemini CLI**:
```
/ax product, save architecture design to automatosx/PRD/user-auth-design.md
/ax backend, put draft in automatosx/tmp/auth-draft.ts
```

**Bash**:
```bash
# Create planning document
ax run product "Design auth system" --output automatosx/PRD/auth-design.md

# Create temporary draft
ax run backend "Draft implementation" --output automatosx/tmp/draft.ts
```

---

## Configuration {#configuration}

### Main Configuration File

**Location**: `automatosx.config.json`

**Key sections**:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1
    },
    "gemini-cli": {
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

### Viewing Configuration

```bash
# Show all configuration
ax config show

# Get specific value
ax config get providers.claude-code.priority

# List all agents
ax list agents
```

### Customizing Agents

Create custom agents:

```bash
# Interactive creation
ax agent create my-agent --template developer --interactive

# From template
ax agent create my-agent --template backend

# List templates
ax agent templates
```

Agent files location: `.automatosx/agents/`

---

## Advanced Features {#advanced}

### Parallel Execution

Run multiple agents concurrently:

```bash
ax run product "Design auth system" --parallel
```

AutomatosX will:
1. Build dependency graph
2. Run independent tasks in parallel
3. Wait for dependencies
4. Aggregate results

### Resumable Runs

For long-running tasks:

```bash
# Enable checkpoints
ax run backend "Refactor entire codebase" --resumable

# If interrupted, resume
ax resume <run-id>

# List all runs
ax runs list
```

### Streaming Output

See real-time output:

```bash
ax run backend "Explain this codebase" --streaming
```

### Spec-Driven Development

For complex projects:

```bash
# Create spec from natural language
ax spec create "Build authentication with database, API, JWT, and tests"

# Run spec
ax spec run --parallel

# Check progress
ax spec status
```

### Custom Workflows

Create custom workflows with multiple agents:

```yaml
# workflow.ax.yaml
metadata:
  id: user-auth-system
  name: User Authentication System

actors:
  - id: backend
    agent: backend
    description: Implement JWT authentication API

  - id: security
    agent: security
    description: Audit authentication implementation

  - id: quality
    agent: quality
    description: Generate comprehensive test suite
```

```bash
# Run workflow
ax run workflow.ax.yaml
```

---

## Troubleshooting {#troubleshooting}

### Common Issues

#### "Agent not found"

**Problem**: Agent name is incorrect or doesn't exist.

**Solution**:
```bash
# List available agents
ax list agents

# Make sure name is correct (case-sensitive)
ax run backend "task"  # ✓ Correct
ax run Backend "task"  # ✗ Wrong
```

#### "Provider not available"

**Problem**: AI provider (Claude, Gemini, OpenAI) is not configured or unavailable.

**Solution**:
```bash
# Check system status
ax status

# View configuration
ax config show

# Check provider priority
ax config get providers.claude-code.enabled
```

#### "Out of memory"

**Problem**: Memory database is too large.

**Solution**:
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory stats
ax cache stats

# Check database size
du -h .automatosx/memory/memories.db
```

#### Slash commands not working (Gemini CLI)

**Problem**: Custom commands not registered with Gemini CLI.

**Solution**:
```bash
# Check Gemini integration status
ax gemini status

# Sync custom commands
ax gemini sync-mcp

# Restart Gemini CLI
```

### Debug Mode

Enable verbose logging:

```bash
# Run with debug mode
ax --debug run backend "task"

# Check logs
cat .automatosx/logs/router-trace-*.jsonl

# View provider trace
ax providers trace --follow
```

### Getting Help

```bash
# View command help
ax --help
ax run --help

# Search memory for similar tasks
ax memory search "similar task"
```

---

## Best Practices {#best-practices}

### 1. Use the Right Agent for the Job

✅ **Do**:
- `ax run backend` for API development
- `ax run frontend` for UI components
- `ax run security` for security audits
- `ax run quality` for testing

❌ **Don't**:
- Ask backend agent to design UI
- Ask frontend agent to write database queries

### 2. Leverage Memory

✅ **Do**:
- Reference past decisions: "Use the auth design from yesterday"
- Search before starting: `ax memory search "authentication"`
- Let agents access memory automatically

❌ **Don't**:
- Repeat context manually
- Copy/paste from previous conversations
- Ignore memory search results

### 3. Start Simple, Then Complex

✅ **Do**:
- Test with small tasks first
- Gradually increase complexity
- Use --parallel for proven workflows

❌ **Don't**:
- Start with huge multi-agent workflows
- Skip testing individual agents
- Assume parallel execution always works

### 4. Review and Customize Configuration

✅ **Do**:
- Check `automatosx.config.json` for your project
- Adjust timeouts for your use case
- Set appropriate provider priorities

❌ **Don't**:
- Use default config blindly
- Set timeouts too low (causes failures)
- Enable all providers if you only use one

### 5. Keep Agents Specialized

✅ **Do**:
- Use product agent for design
- Delegate implementation to backend/frontend
- Let agents delegate to specialists

❌ **Don't**:
- Ask one agent to do everything
- Micromanage delegation
- Override agent expertise

---

## Reference {#reference}

### Quick Command Reference

```bash
# Agents
ax list agents                          # List all agents
ax agent create <name> --template <T>   # Create custom agent
ax run <agent> "task"                   # Run agent task

# Memory
ax memory search "keyword"              # Search memory
ax memory list --limit 10               # List recent memories
ax memory clear                         # Clear all memories
ax memory export > backup.json          # Export memory

# Configuration
ax config show                          # Show all config
ax config get <key>                     # Get specific value
ax status                               # System status

# Advanced
ax run <agent> "task" --parallel        # Parallel execution
ax run <agent> "task" --resumable       # Enable checkpoints
ax resume <run-id>                      # Resume interrupted run
ax spec create "description"            # Create spec from natural language
ax spec run                             # Execute spec

# Debug
ax --debug run <agent> "task"           # Debug mode
ax providers trace --follow             # View routing decisions
```

### Key Files

| File | Purpose | Location |
|------|---------|----------|
| Configuration | Main config file | `automatosx.config.json` |
| Memory DB | Persistent memory | `.automatosx/memory/memories.db` |
| Agent Profiles | Custom agents | `.automatosx/agents/` |
| Planning Docs | PRDs, specs | `automatosx/PRD/` |
| Temp Files | Scratch work | `automatosx/tmp/` |
| Trace Logs | Router decisions | `.automatosx/logs/router-trace-*.jsonl` |

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `AUTOMATOSX_CONFIG_PATH` | Custom config path | `export AUTOMATOSX_CONFIG_PATH=./custom.json` |
| `AUTOMATOSX_DEBUG` | Enable debug mode | `export AUTOMATOSX_DEBUG=true` |
| `AUTOMATOSX_CLI_ONLY` | Force CLI mode (no API) | `export AUTOMATOSX_CLI_ONLY=true` |
| `AUTOMATOSX_MOCK_PROVIDERS` | Use mock providers (testing) | `export AUTOMATOSX_MOCK_PROVIDERS=true` |

### Links

- **AutomatosX Repository**: https://github.com/defai-digital/automatosx
- **NPM Package**: https://www.npmjs.com/package/@defai.digital/automatosx
- **Issues**: https://github.com/defai-digital/automatosx/issues
- **Documentation**: https://github.com/defai.digital/automatosx#readme

---

<!-- AutomatosX Integration Guide v6.3.8 - Generated 2025-10-31 -->
