# AutomatosX

**AI-powered workflow automation with multi-provider orchestration**

[![Version](https://img.shields.io/badge/version-13.0.0-blue.svg)](https://github.com/defai-digital/automatosx)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)

---

## Overview

AutomatosX is a contract-first AI orchestration platform that unifies multiple LLM providers through CLI adapters. It provides deterministic model routing, event-sourced memory management, comprehensive execution tracing, and post-check governance for AI coding sessions.

**Core Principle**: AutomatosX is a pure orchestrator. All authentication and credentials are delegated to external CLI tools.

### Key Features

- **Multi-Provider Support**: Claude, Gemini, Codex, Qwen, GLM, Grok
- **Deterministic Routing**: Risk-level and capability-based model selection
- **Event-Sourced Memory**: Temporal consistency with full replay capability
- **Execution Tracing**: Complete audit trail for all AI decisions
- **Guard System**: Policy-driven governance for AI-generated code
- **MCP Server**: Model Context Protocol integration for AI assistants

---

## Installation

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.15.0
- At least one provider CLI installed (claude, gemini, codex, etc.)

### Setup

```bash
# Clone the repository
git clone https://github.com/defai-digital/automatosx.git
cd automatosx

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Initialize configuration
pnpm ax setup
```

### Verify Installation

```bash
# Check system health
pnpm ax doctor

# Check specific provider
pnpm ax doctor claude
```

---

## Quick Start

### 1. Configure Providers

AutomatosX uses external CLI tools for provider access. Install the CLIs you need:

| Provider | CLI Command | Installation |
|----------|-------------|--------------|
| Claude | `claude` | [Claude Code](https://github.com/anthropics/claude-code) |
| Gemini | `gemini` | [Gemini CLI](https://github.com/google-gemini/gemini-cli) |
| Codex | `codex` | [Codex CLI](https://github.com/openai/codex) |
| Qwen | `qwen` | [Qwen Code](https://github.com/QwenLM/qwen-code) |
| GLM | `ax-glm` | [AX GLM CLI](https://github.com/defai-digital/ax-cli) |
| Grok | `ax-grok` | [AX GROK CLI](https://github.com/defai-digital/ax-cli) |

### 2. Direct Provider Calls

```bash
# Call Claude directly
pnpm ax call claude "Explain this code"

# Call with file context
pnpm ax call claude --file ./src/index.ts "Review this implementation"

# Call Gemini
pnpm ax call gemini "Summarize the key points"
```

### 3. Execute Workflows

```bash
# List available workflows
pnpm ax list

# Run a workflow
pnpm ax run code-reviewer

# Run with input
pnpm ax run code-reviewer --input '{"files": ["src/index.ts"]}'
```

### 4. View Traces

```bash
# List recent traces
pnpm ax trace

# View specific trace
pnpm ax trace <trace-id> --verbose
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI / MCP Server                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Workflow   │  │   Routing    │  │    Guard     │          │
│  │   Engine     │  │   Engine     │  │   System     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Memory     │  │    Trace     │  │   Provider   │          │
│  │   Domain     │  │   Domain     │  │   Adapters   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      Contracts (Zod Schemas)                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Provider CLIs                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────┐│
│  │ claude │ │ gemini │ │ codex  │ │  qwen  │ │ ax-glm │ │grok ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └─────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Package Structure

| Package | Purpose |
|---------|---------|
| `@automatosx/contracts` | Zod schemas - Single Source of Truth |
| `@automatosx/workflow-engine` | Step-by-step workflow execution |
| `@automatosx/routing-engine` | Deterministic model selection |
| `@automatosx/memory-domain` | Event-sourced conversation state |
| `@automatosx/trace-domain` | Execution tracing and replay |
| `@automatosx/provider-adapters` | CLI-based LLM integration |
| `@automatosx/resilience-domain` | Rate limiting, circuit breakers, metrics |
| `@automatosx/sqlite` | SQLite persistence adapters |
| `@automatosx/guard` | Post-check governance gates |
| `@automatosx/mcp-server` | Model Context Protocol server |
| `@automatosx/cli` | Command-line interface |

---

## CLI Commands

### Core Commands

```bash
# System setup and health
ax setup                          # Initialize configuration
ax setup --force                  # Force reconfiguration
ax doctor                         # Check all providers
ax doctor claude --verbose        # Check specific provider

# Configuration management
ax config show                    # Show current config
ax config get logLevel            # Get specific value
ax config set logLevel debug      # Set value
ax config reset                   # Reset to defaults
ax config path                    # Show config file paths

# Workflow execution
ax run <workflow-id>              # Execute workflow
ax run my-workflow --input '{}'   # With JSON input
ax list                           # List workflows
ax list --format json             # JSON output

# Trace inspection
ax trace                          # List recent traces
ax trace <id>                     # View specific trace
ax trace <id> --verbose           # Detailed view
```

### Provider Commands

```bash
# Direct provider calls
ax call claude "Your prompt"
ax call gemini "Your prompt"
ax call codex "Your prompt"
ax call claude --file ./file.ts "Review this"
```

### Agent Commands

```bash
# Agent management
ax agent list                     # List registered agents
ax agent get <id>                 # Get agent details
ax agent register                 # Register from JSON input
ax agent run <id>                 # Execute an agent
ax agent run <id> --input '{}'    # With input
ax agent remove <id>              # Remove agent
```

### Session Commands

```bash
# Session management
ax session list                   # List sessions
ax session get <id>               # Get session details
ax session create --input '{}'    # Create new session
ax session join <id>              # Join a session
ax session leave <id>             # Leave a session
ax session complete <id>          # Complete a session
ax session fail <id>              # Mark session as failed
```

### Guard Commands

```bash
# Governance checks
ax guard check --policy <p> --target <t>
ax guard list                     # List policies
ax guard apply --policy <p>       # Apply policy
```

### Analysis Commands

```bash
# Bug detection
ax bugfix scan src/               # Scan for bugs
ax bugfix scan src/ --min-severity medium
ax bugfix run --bug-id <id>       # Fix a bug
ax bugfix list                    # List detected bugs

# Refactoring
ax refactor scan src/             # Scan for opportunities
ax refactor scan src/ --type extract-function
ax refactor apply --id <id>       # Apply refactoring
ax refactor list                  # List opportunities
```

---

## MCP Server

AutomatosX includes an MCP (Model Context Protocol) server for integration with AI assistants like Claude Code and other MCP-compatible tools.

### Starting the Server

```bash
# Start MCP server
node packages/mcp-server/dist/bin.js
```

### Available Tools

| Tool | Description |
|------|-------------|
| `run_agent` | Execute a specialized agent |
| `list_agents` | List available agents |
| `get_agent_context` | Get agent profile and context |
| `plan_multi_agent` | Create multi-agent execution plan |
| `orchestrate_task` | Orchestrate complex multi-agent tasks |
| `session_create` | Create collaborative session |
| `session_status` | Get session status |
| `session_complete` | Complete a session |
| `memory_add` | Add to persistent memory |
| `memory_list` | List memory entries |
| `search_memory` | Search memory with full-text search |
| `bugfix_scan` | Scan for bugs |
| `bugfix_run` | Run autonomous bug fixing |
| `refactor_scan` | Scan for refactoring opportunities |
| `refactor_run` | Run autonomous refactoring |
| `guard_check` | Run governance check |
| `get_status` | Get system status |

### Configuration for Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "automatosx": {
      "command": "node",
      "args": ["/path/to/automatosx/packages/mcp-server/dist/bin.js"]
    }
  }
}
```

---

## Configuration

### Config File Location

```bash
# Show config paths
ax config path
```

Default: `~/.config/automatosx/config.json`

### Example Configuration

```json
{
  "version": "1.0.0",
  "defaultProvider": "claude",
  "providers": [
    {
      "providerId": "claude",
      "priority": 90,
      "enabled": true
    },
    {
      "providerId": "gemini",
      "priority": 80,
      "enabled": true
    }
  ],
  "features": {
    "enableTracing": true,
    "enableMemoryPersistence": true,
    "enableGuard": true,
    "enableMetrics": false
  },
  "iterate": {
    "maxIterations": 20,
    "maxTimeMs": 300000,
    "autoConfirm": false
  },
  "workspace": {
    "dataDir": ".automatosx",
    "memoryDbPath": "memory.db",
    "traceDbPath": "traces.db",
    "sessionDbPath": "sessions.db"
  },
  "preferences": {
    "colorOutput": true,
    "verboseErrors": false,
    "confirmDestructive": true,
    "defaultOutputFormat": "text"
  }
}
```

---

## Guard System

The Guard system provides post-check governance for AI-generated code changes.

### Built-in Policies

| Policy | Use Case | Change Radius |
|--------|----------|---------------|
| `provider-refactor` | Provider adapter changes | 2 packages |
| `bugfix` | Bug fixes | 3 packages |
| `rebuild` | Major refactoring | 10 packages |

### Usage

```bash
# Check changes against policy
ax guard check --policy provider-refactor --target openai

# List available policies
ax guard list
```

### Gates

| Gate | Purpose |
|------|---------|
| `path_violation` | Enforce allowed/forbidden paths |
| `change_radius` | Limit number of packages modified |
| `dependency` | Check import boundaries |
| `contract_tests` | Verify contract tests pass |

---

## Development

### Building

```bash
# Build all packages
pnpm build

# Type check
pnpm typecheck

# Run linter
pnpm lint
pnpm lint:fix
```

### Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Run specific test file
pnpm vitest run tests/core/routing-engine.test.ts
```

### Validation

```bash
# Full validation (typecheck + lint + deps + tests)
pnpm validate

# Check dependency boundaries
pnpm deps:check

# Generate dependency graph
pnpm deps:graph
```

### Project Structure

```
automatosx/
├── packages/
│   ├── contracts/          # Zod schemas (Single Source of Truth)
│   ├── core/
│   │   ├── workflow-engine/   # Workflow execution
│   │   ├── routing-engine/    # Model selection
│   │   ├── memory-domain/     # Event-sourced state
│   │   ├── trace-domain/      # Execution tracing
│   │   └── resilience-domain/ # Rate limiting, metrics
│   ├── adapters/
│   │   ├── providers/      # LLM provider adapters
│   │   └── sqlite/         # SQLite persistence
│   ├── guard/              # Governance system
│   ├── cli/                # Command-line interface
│   └── mcp-server/         # MCP protocol server
├── tests/
│   ├── contract/           # Contract validation tests
│   ├── core/               # Domain logic tests
│   ├── integration/        # Integration tests
│   └── application/        # E2E tests
└── examples/
    ├── agents/             # Example agent definitions
    ├── workflows/          # Example workflow definitions
    └── config.json         # Example configuration
```

---

## Invariants

AutomatosX enforces strict invariants across all domains:

### Workflow Engine
- **INV-WF-001**: Steps execute in definition order exactly
- **INV-WF-002**: Retries are scoped to current step only
- **INV-WF-003**: All inputs/outputs validated against schemas
- **INV-WF-004**: No duplicate stepIds within workflow
- **INV-WF-005**: Workflow definition frozen after validation

### Routing Engine
- **INV-RT-001**: Identical inputs yield identical outputs
- **INV-RT-002**: High risk never selects experimental models
- **INV-RT-003**: All decisions include human-readable reasoning
- **INV-RT-004**: Fallbacks satisfy same constraints
- **INV-RT-005**: Selected model has all required capabilities

### Memory Domain
- **INV-MEM-001**: Events never modified after storage
- **INV-MEM-002**: Event handlers have no side effects
- **INV-MEM-003**: Events returned in version order
- **INV-MEM-004**: All events support correlationId
- **INV-MEM-005**: Version conflicts detected

### Trace Domain
- **INV-TR-001**: Every trace has run.start and run.end
- **INV-TR-002**: Events ordered by sequence number
- **INV-TR-003**: Traces enable full decision replay
- **INV-TR-004**: Each trace independent
- **INV-TR-005**: Errors include full context

### MCP Server
- **INV-MCP-001**: All tools validate inputs via Zod schemas
- **INV-MCP-002**: Tool outputs match declared output schemas
- **INV-MCP-003**: Idempotent tools safe to retry
- **INV-MCP-004**: Error codes from defined set only
- **INV-MCP-005**: No side effects from failed tools

---

## License

**Open Source Edition**: Apache License 2.0 - see [LICENSE](LICENSE) for details.

**Commercial Editions**: AutomatosX Pro and Enterprise editions are available with additional features, priority support, and enterprise compliance. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for details.

**© 2024-2025 DEFAI Private Limited. All rights reserved.**

---

## Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Zod Documentation](https://zod.dev/)
- [Claude CLI](https://docs.anthropic.com/claude-code)
- [OpenAI Codex](https://github.com/openai/codex)
