# Claude Code Integration Guide

**AutomatosX Native Integration for Claude Code**

AutomatosX provides native integration with Claude Code via the Model Context Protocol (MCP), enabling seamless multi-agent orchestration directly within your Claude Code sessions.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Usage](#usage)
- [Advanced](#advanced)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

### What is Claude Code Integration?

Claude Code integration allows you to:

- ✅ **Use Slash Commands** - `/agent-backend`, `/agent-frontend`, etc.
- ✅ **Orchestrate Multiple Agents** - Coordinate complex multi-agent workflows
- ✅ **Access Persistent Memory** - Leverage AutomatosX's memory system
- ✅ **Programmatic Integration** - MCP server for robust, programmatic access
- ✅ **Zero Configuration** - Auto-generated manifests from agent profiles

### How It Works

```
Claude Code → MCP Server (automatosx-mcp) → AutomatosX CLI → AI Providers
```

1. **You** invoke slash command in Claude Code (e.g., `/agent-backend "task"`)
2. **Claude Code** sends request to MCP server via stdio transport
3. **MCP Server** translates to AutomatosX CLI command
4. **AutomatosX** executes agent with task
5. **Results** returned to Claude Code for natural conversation

---

## Prerequisites

### Required

- **AutomatosX**: v10.0.0 or later
  ```bash
  npm install -g @defai.digital/automatosx@latest
  ```

- **Claude Code CLI**: Latest version
  - Download: [https://code.claude.com](https://code.claude.com)
  - Verify: `claude --version`

- **Node.js**: >= 24.0.0
  ```bash
  node --version
  ```

### Optional

- **Git**: For `.gitignore` management
- **npm**: For package installation (usually comes with Node.js)

---

## Installation

### Step 1: Install AutomatosX

```bash
# Global installation (recommended)
npm install -g @defai.digital/automatosx

# Verify installation
ax --version
# Should show: 10.0.0 or later
```

### Step 2: Install Claude Code

Visit [https://code.claude.com](https://code.claude.com) and follow installation instructions for your platform.

```bash
# Verify installation
claude --version
# Should show: Claude Code CLI version X.X.X
```

### Step 3: Initialize AutomatosX

```bash
# Navigate to your project directory
cd /path/to/your/project

# Initialize AutomatosX with Claude Code integration
ax setup --claude-code
```

**What This Does**:

1. ✅ Creates `.automatosx/` directory structure
2. ✅ Installs 20 specialized agents
3. ✅ Generates `ax.config.json` configuration
4. ✅ Initializes SQLite memory database
5. ✅ Generates Claude Code integration manifests
6. ✅ Registers MCP server with Claude Code

### Step 4: Verify Setup

```bash
# Run diagnostics
ax doctor --claude-code
```

**Expected Output**:

```
🔍 Claude Code Integration Diagnostics

✓ Claude Code CLI: Installed (v1.2.3)
✓ MCP Server Binary: Available (automatosx-mcp)
✓ MCP Registration: Registered with Claude Code
✓ Manifests: Generated (20 files)
✓ Manifest Validation: Valid

📊 Summary
✓ Passed: 5/5

✅ All checks passed! Claude Code integration is ready.
```

### Step 5: Restart Claude Code

Close and reopen Claude Code to activate the integration.

---

## Quick Start

### 1. Use Slash Commands

Run individual agents with slash commands:

```
/agent-backend "implement user authentication API"
```

```
/agent-frontend "create login form with React"
```

```
/agent-security "audit authentication code for vulnerabilities"
```

### 2. Multi-Agent Orchestration

Use the orchestration skill for complex tasks:

```
/automatosx
```

Then describe your task:

```
"Please implement a complete user authentication system with:
- Database schema
- REST API
- Frontend form
- Security audit
- Unit tests"
```

AutomatosX will:
1. Break the task into subtasks
2. Delegate to appropriate agents (backend, frontend, security, quality)
3. Execute in optimal order
4. Save decisions to memory
5. Present unified results

### 3. Search Memory

Access past decisions and designs:

```typescript
mcp__automatosx__search_memory({
  query: "authentication",
  limit: 10
})
```

---

## Features

### 1. Slash Commands (18 Agents)

Each agent has a dedicated slash command:

| Command | Agent | Specialty |
|---------|-------|-----------|
| `/agent-backend` | Bob | Backend development (Go/Rust/Node.js) |
| `/agent-frontend` | Frank | Frontend development (React/Next.js/Swift) |
| `/agent-security` | Steve | Security auditing and threat modeling |
| `/agent-quality` | Queenie | QA and testing |
| `/agent-devops` | Oliver | DevOps and infrastructure |
| `/agent-data` | Daisy | Data engineering and ETL |
| `/agent-mobile` | Maya | Mobile development (iOS/Android) |
| `/agent-architecture` | Avery | System architecture and ADR |
| `/agent-fullstack` | Felix | Full-stack development |
| `/agent-design` | Debbee | UX/UI design |
| `/agent-writer` | Wendy | Technical writing |
| `/agent-product` | Paris | Product management |
| `/agent-cto` | Tony | Technical strategy |
| `/agent-ceo` | Eric | Business leadership |
| `/agent-researcher` | Rodman | Research and analysis |
| `/agent-creative-marketer` | Candy | Creative marketing |
| `/agent-aerospace-scientist` | Astrid | Aerospace engineering |
| `/agent-standard` | Stan | Standards and best practices |

**Usage**:

```
/agent-<name> "task description"
```

**Example**:

```
/agent-backend "Design and implement REST API for user management with CRUD operations"
```

### 2. Orchestration Skill

The `/automatosx` skill provides multi-agent orchestration:

**Invoke**:

```
/automatosx
```

**What It Does**:

- Breaks complex tasks into agent-specific subtasks
- Searches memory for past decisions
- Executes agents in optimal dependency order
- Monitors progress and handles failures
- Summarizes results with memory references

**Example Workflow**:

```
User: "/automatosx please implement user authentication"

Coordinator:
1. Searches memory for past auth designs ✓
2. Runs product agent for requirements ✓
3. Runs backend agent for API implementation ✓
4. Runs security agent for threat review ✓
5. Runs quality agent for test coverage ✓
6. Saves decisions to memory ✓

Result: Complete authentication system with documentation
```

### 3. MCP Tools (17 Available)

Claude Code can directly invoke MCP tools:

**Core Tools**:

- `mcp__automatosx__run_agent` - Execute agent with task
- `mcp__automatosx__search_memory` - Search persistent memory
- `mcp__automatosx__session_create` - Create multi-agent session
- `mcp__automatosx__list_agents` - List all agents

**Memory Tools**:

- `mcp__automatosx__memory_add` - Add entry to memory
- `mcp__automatosx__memory_list` - List recent memories
- `mcp__automatosx__memory_clear` - Clear old memories
- `mcp__automatosx__memory_export` - Export memory to JSON

**Session Tools**:

- `mcp__automatosx__session_list` - List active sessions
- `mcp__automatosx__session_get` - Get session details
- `mcp__automatosx__session_add_task` - Add task to session
- `mcp__automatosx__session_close` - Close session

**System Tools**:

- `mcp__automatosx__config_get` - Get configuration
- `mcp__automatosx__status` - Get system status
- `mcp__automatosx__health_check` - Run health checks

**Example Usage in Claude Code**:

```typescript
// Run agent programmatically
mcp__automatosx__run_agent({
  agent: "backend",
  task: "implement user authentication",
  options: {
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.7
  }
})

// Search memory
mcp__automatosx__search_memory({
  query: "authentication design",
  limit: 10
})

// Create session
mcp__automatosx__session_create({
  name: "auth-implementation",
  agent: "backend"
})
```

### 4. Persistent Memory

All agent interactions are automatically saved to memory:

**Automatic**:
- Every agent conversation saved
- Full-text search with SQLite FTS5
- < 1ms search performance
- 100% private (local only)
- $0 API costs

**Search**:

```bash
ax memory search "authentication"
ax memory search "API design"
```

**Export**:

```bash
ax memory export > backup.json
```

### 5. Auto-Generated Manifests

Integration files are auto-generated from agent profiles:

```
.claude/
├── skills/
│   └── automatosx/
│       └── SKILL.md              # Orchestration skill
├── commands/
│   ├── agent-backend.md          # Slash command
│   ├── agent-frontend.md         # Slash command
│   └── ... (18 total)
└── agents/
    └── automatosx-coordinator/
        └── AGENT.md              # Sub-agent
```

**Regenerate** (if agent profiles change):

```bash
npm run generate:claude-manifests
```

---

## Usage

### Basic Workflows

#### 1. Single Agent Task

```
/agent-backend "implement REST API for user management"
```

**Result**: Bob (backend agent) implements the API

#### 2. Multi-Agent Task

```
/automatosx

Task: "Implement complete user authentication system"
```

**Result**: Coordinator orchestrates:
1. Product agent: Requirements
2. Backend agent: API implementation
3. Security agent: Threat review
4. Quality agent: Test coverage

#### 3. With Memory Context

```
/agent-backend "Implement the calculator API we designed earlier"
```

**Result**: Backend agent searches memory for "calculator design", finds past decisions, implements API based on that context

#### 4. Iterative Development

```
/agent-quality "Review the authentication code"
/agent-backend "Fix the issues found by quality agent"
/agent-security "Audit the fixes"
```

**Result**: Iterative refinement with automatic memory tracking

### Advanced Workflows

#### 1. Session-Based Collaboration

```typescript
// Create session
mcp__automatosx__session_create({
  name: "auth-work",
  agent: "backend"
})

// Add tasks
mcp__automatosx__session_add_task({
  sessionId: "session-uuid",
  task: "Design database schema"
})

mcp__automatosx__session_add_task({
  sessionId: "session-uuid",
  task: "Implement API endpoints"
})

// Close session
mcp__automatosx__session_close({
  sessionId: "session-uuid"
})
```

#### 2. Memory-Driven Development

```typescript
// Search for past designs
mcp__automatosx__search_memory({
  query: "authentication patterns",
  limit: 10
})

// Use results to inform current task
/agent-backend "Implement authentication using the pattern from memory entry #5"
```

#### 3. Multi-Provider Orchestration

```bash
# Configure providers in ax.config.json
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
  }
}

# AutomatosX automatically selects best provider
/agent-backend "complex task"
```

---

## Advanced

### Custom Agent Profiles

Create custom agents in `.automatosx/agents/`:

```bash
ax agent create my-agent --template developer --interactive
```

Then regenerate manifests:

```bash
npm run generate:claude-manifests
```

### Configuration

Edit `ax.config.json` to customize:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1
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

### Manual MCP Registration

If automatic registration fails:

```bash
claude mcp add --transport stdio automatosx -- automatosx-mcp
```

### Manual Manifest Generation

```bash
npm run generate:claude-manifests
```

### Diagnostics

```bash
# Full diagnostics
ax doctor --claude-code

# Verbose output
ax doctor --claude-code --verbose
```

---

## Troubleshooting

### Issue: Slash commands not working

**Symptoms**: `/agent-backend` not recognized

**Cause**: Claude Code not restarted or manifests not generated

**Fix**:

```bash
# Regenerate manifests
npm run generate:claude-manifests

# Restart Claude Code
# (Close and reopen)

# Verify
ax doctor --claude-code
```

### Issue: "MCP server not found"

**Symptoms**: Error when invoking slash commands

**Cause**: MCP server binary not installed

**Fix**:

```bash
# Reinstall AutomatosX
npm install -g @defai.digital/automatosx

# Verify
which automatosx-mcp
```

### Issue: "Agent not responding"

**Symptoms**: Command hangs or times out

**Cause**: Provider not available or timeout too short

**Fix**:

```bash
# Check provider status
ax doctor

# Increase timeout in ax.config.json
{
  "execution": {
    "defaultTimeout": 3000000  # 50 minutes
  }
}
```

### Issue: "Memory search not working"

**Symptoms**: Memory search returns no results

**Cause**: Memory database corrupted or not initialized

**Fix**:

```bash
# Reinitialize memory
rm -rf .automatosx/memory/memories.db
ax setup

# Or rebuild index
ax memory reindex
```

### Issue: "Diagnostics failing"

**Symptoms**: `ax doctor --claude-code` shows errors

**Cause**: Various setup issues

**Fix**:

```bash
# Run setup again
ax setup --claude-code

# Check each component
claude --version          # Claude Code CLI
which automatosx-mcp      # MCP server
ls .claude/              # Manifests
```

---

## FAQ

### Q: Do I need to be online to use Claude Code integration?

**A**: Yes, Claude Code requires internet connectivity to communicate with Claude AI. However, AutomatosX's memory system works offline.

### Q: Can I use AutomatosX without Claude Code?

**A**: Yes! Claude Code integration is optional. You can use AutomatosX with:
- Direct CLI (`ax run backend "task"`)
- Gemini CLI integration
- Grok CLI integration
- OpenAI Codex integration

### Q: How do I add custom agents?

**A**: Create agent profile in `.automatosx/agents/` then regenerate manifests:
```bash
ax agent create my-agent --template developer
npm run generate:claude-manifests
```

### Q: Can I modify the slash commands?

**A**: Yes, edit agent profiles then regenerate manifests. The command format is `/agent-<agent-name>`.

### Q: How much does Claude Code integration cost?

**A**: The MCP server is free. You pay standard rates for Claude API usage (handled by Claude Code). AutomatosX memory operations cost $0 (local SQLite).

### Q: Is my data private?

**A**: Yes. AutomatosX memory is stored locally in SQLite. Only the task descriptions and agent responses go through Claude Code (encrypted by Anthropic).

### Q: Can I use multiple providers?

**A**: Yes! Configure multiple providers in `ax.config.json`. AutomatosX automatically selects the best available provider.

### Q: How do I uninstall Claude Code integration?

**A**:
```bash
# Unregister MCP server
claude mcp remove automatosx

# Remove manifests
rm -rf .claude/

# AutomatosX itself remains unchanged
```

### Q: Does this work with other IDEs?

**A**: Currently, this integration is specific to Claude Code. However, AutomatosX CLI works in any terminal.

---

## Best Practices

### 1. Use Specific Tasks

❌ **Bad**: `/agent-backend "do something with authentication"`

✅ **Good**: `/agent-backend "Implement JWT-based authentication with refresh tokens, using bcrypt for password hashing"`

### 2. Leverage Memory

Search memory before starting new work:

```typescript
mcp__automatosx__search_memory({ query: "authentication" })
```

### 3. Use Orchestration for Complex Tasks

For tasks requiring multiple agents, use `/automatosx` instead of manual delegation.

### 4. Iterative Refinement

Use multiple agents in sequence:

```
/agent-backend "implement feature"
/agent-quality "review implementation"
/agent-backend "fix issues"
/agent-security "audit security"
```

### 5. Save Important Decisions

Add explicit memory entries for future reference:

```typescript
mcp__automatosx__memory_add({
  content: "We decided to use JWT with 15-minute expiry for security",
  metadata: { topic: "authentication", decision: "token-expiry" }
})
```

---

## Examples

### Example 1: Implement Authentication

```
/automatosx

Task: "Implement complete user authentication system with:
- PostgreSQL user table
- JWT-based authentication
- Password hashing with bcrypt
- Login/logout/refresh endpoints
- Security audit
- Unit and integration tests"

Result: Multi-agent orchestration:
1. Product agent: Requirement analysis ✓
2. Data agent: Database schema ✓
3. Backend agent: API implementation ✓
4. Security agent: Threat modeling ✓
5. Quality agent: Test suite ✓
6. Saved to memory for future reference ✓
```

### Example 2: Fix Bug with Context

```
/agent-backend "Fix the authentication bug we discussed earlier"

Result: Backend agent:
1. Searches memory for "authentication bug" ✓
2. Finds past conversation about token expiry ✓
3. Implements fix based on context ✓
4. Saves fix to memory ✓
```

### Example 3: Code Review Workflow

```
/agent-quality "Review src/auth/handler.ts for bugs and style issues"

/agent-backend "Fix the 5 issues found by quality agent"

/agent-security "Audit the fixes for security implications"

Result: Iterative refinement with full memory tracking
```

---

## Support

### Documentation

- **AutomatosX Docs**: [README.md](../../README.md)
- **Migration Guide**: [v10-claude-code-integration.md](../migration/v10-claude-code-integration.md)
- **Agent Profiles**: `.automatosx/agents/`

### Community

- **GitHub Issues**: [https://github.com/defai-digital/automatosx/issues](https://github.com/defai-digital/automatosx/issues)
- **Discussions**: [https://github.com/defai-digital/automatosx/discussions](https://github.com/defai-digital/automatosx/discussions)

### Contact

- **Email**: support@defai.digital
- **X (Twitter)**: [@automatosx](https://x.com/automatosx)

---

**Generated**: 2025-11-23
**Version**: AutomatosX v10.0.0
**Author**: AutomatosX Team
