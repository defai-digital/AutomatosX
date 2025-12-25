# AutomatosX

**AI-powered workflow automation with multi-provider orchestration**

[![macOS](https://img.shields.io/badge/macOS-26%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Windows](https://img.shields.io/badge/Windows-11%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)
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

### Supported Platforms

| Platform | Minimum Version |
|----------|-----------------|
| macOS | 26+ |
| Windows | 11+ |
| Ubuntu | 24.04+ |

### Prerequisites

- Node.js >= 20.0.0
- At least one provider CLI installed (claude, gemini, codex, etc.)

### Install from npm (Recommended)

```bash
# Install globally (choose one)
npm install -g @defai.digital/automatosx    # Full package name
npm install -g @defai.digital/cli           # CLI package

# Initialize configuration and detect providers
ax setup

# Verify installation
ax doctor
```

### Install from Source

```bash
# Clone the repository
git clone https://github.com/defai-digital/automatosx.git
cd automatosx

# Install dependencies (requires pnpm >= 9.15.0)
pnpm install

# Build all packages
pnpm build

# Initialize configuration
pnpm ax setup
```

### Verify Installation

```bash
# Check system health
ax doctor

# Check specific provider
ax doctor claude
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
ax call claude "Explain this code"

# Call with file context
ax call claude --file ./src/index.ts "Review this implementation"

# Call Gemini
ax call gemini "Summarize the key points"
```

### 3. Execute Workflows

```bash
# List available workflows
ax list

# Run a workflow
ax run code-reviewer

# Run with input
ax run code-reviewer --input '{"files": ["src/index.ts"]}'
```

### 4. View Traces

```bash
# List recent traces
ax trace

# View specific trace
ax trace <trace-id> --verbose
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| **[Quickstart](docs/quickstart.md)** | Get running in 5 minutes |
| **[Building Software](docs/building-software.md)** | Complete guide to building quality software with ax |
| **[Improving Apps](docs/improving-apps.md)** | Modernize and improve existing applications |
| **[Multi-Model Discussion](docs/guides/discussion.md)** | Multi-provider collaboration and consensus |
| **[Scaffold Reference](docs/scaffold.md)** | Contract-first scaffolding documentation |

### Example Resources

| Resource | Description |
|----------|-------------|
| [Workflows](examples/workflows/) | Pre-built workflow templates (code-reviewer, developer, security-audit, etc.) |
| [Agents](examples/agents/) | Specialized agent profiles (fullstack, backend, security, architecture, etc.) |
| [Abilities](examples/abilities/) | Knowledge modules for agents (TypeScript, React, API design, etc.) |

### Quick Examples

```bash
# Create a new project with contract-first approach
ax scaffold project my-app --domain order --template standalone

# Review code for security issues
ax review analyze src/ --focus security

# Run the developer workflow
ax run developer --input '{"feature": "Add user authentication"}'

# Use a specialized agent
ax agent run fullstack --input '{"query": "Build a REST API for orders"}'
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
| `@defai.digital/contracts` | Zod schemas - Single Source of Truth |
| `@defai.digital/workflow-engine` | Step-by-step workflow execution |
| `@defai.digital/routing-engine` | Deterministic model selection |
| `@defai.digital/memory-domain` | Event-sourced conversation state |
| `@defai.digital/trace-domain` | Execution tracing and replay |
| `@defai.digital/discussion-domain` | Multi-model discussion orchestration |
| `@defai.digital/provider-adapters` | CLI-based LLM integration |
| `@defai.digital/resilience-domain` | Rate limiting, circuit breakers, metrics |
| `@defai.digital/sqlite` | SQLite persistence adapters |
| `@defai.digital/guard` | Post-check governance gates |
| `@defai.digital/mcp-server` | Model Context Protocol server |
| `@defai.digital/cli` | Command-line interface |

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

### Scaffold Commands

```bash
# Project scaffolding
ax scaffold project <name>        # Create new project
ax scaffold project my-app -m order -t standalone
ax scaffold project my-app --domain billing --template monorepo

# Contract scaffolding
ax scaffold contract <name>       # Generate Zod schemas + invariants
ax scaffold contract payment --dry-run

# Domain scaffolding
ax scaffold domain <name>         # Generate domain implementation
ax scaffold domain billing --no-tests --no-guard

# Guard policy scaffolding
ax scaffold guard <policy-id>     # Generate guard policy
ax scaffold guard payment-dev -r 3 -g path,dependency
```

### Review Commands

```bash
# Code review
ax review analyze src/            # Analyze code
ax review analyze src/ --focus security
ax review analyze src/ --focus architecture
ax review list                    # List recent reviews
```

### Discussion Commands

The Multi-Model Discussion System enables multiple AI providers and agents to collaborate on complex topics through structured dialogue patterns.

```bash
# Quick discussion (2-3 providers, single round synthesis)
ax discuss quick "What's the best approach for rate limiting?"
ax discuss quick "Compare REST vs GraphQL" --providers claude,gemini,codex

# Full discussion with pattern selection
ax discuss "Design a microservices architecture" --pattern synthesis
ax discuss "Should we use NoSQL or SQL?" --pattern voting --rounds 3
ax discuss "Review this security approach" --pattern critique --rounds 3

# Debate pattern (proponent, opponent, judge)
ax discuss "Monolith vs microservices for startups" --pattern debate --rounds 2

# Mixed participants (providers + agents)
ax discuss "API design review" --participants claude,reviewer:agent,security:agent
ax discuss "Architecture decision" --participants gemini,architect:agent --agent-weight 2.0

# With context
ax discuss "Optimize this code" --pattern critique --context "$(cat ./src/api.ts)"

# JSON output
ax discuss "Best testing strategy" --format json
```

**Discussion Patterns**:
- **synthesis**: Multiple providers discuss freely, then synthesize insights (default)
- **voting**: Providers vote on options, consensus by threshold
- **critique**: One proposes, others critique, revision cycle
- **debate**: Structured debate with proponent, opponent, judge roles

**Agent Participation**:
- Mix providers and agents as discussion participants using `--participants`
- Agents use their `providerAffinity` for provider selection
- Agent weight multiplier for consensus voting (default 1.5x, range 0.5-3.0)

**v13.1.2 Release**:
- Added `@defai.digital/automatosx` wrapper package for backwards compatibility
- Security fixes: SQL injection prevention, regex injection protection
- Bug fixes: formatCost display, checkpoint ordering, agent workflow config
- Refactoring: Centralized constants for file patterns, added `getErrorMessage` utility

---

## MCP Server

AutomatosX includes an MCP (Model Context Protocol) server for integration with AI assistants like Claude Code and other MCP-compatible tools.

### Starting the Server

```bash
# Start MCP server (when installed globally)
automatosx mcp server

# Or run directly
ax mcp server
```

### Available Tools

| Tool | Description |
|------|-------------|
| `ax_agent_run` | Execute a specialized agent |
| `ax_agent_list` | List available agents |
| `ax_agent_get` | Get agent profile and details |
| `ax_agent_register` | Register a new agent |
| `ax_agent_recommend` | Recommend best agent for a task |
| `ax_session_create` | Create collaborative session |
| `ax_session_status` | Get session status |
| `ax_session_complete` | Complete a session |
| `ax_memory_store` | Store value in memory |
| `ax_memory_retrieve` | Retrieve value from memory |
| `ax_memory_search` | Search memory entries |
| `ax_review_analyze` | AI-powered code review |
| `ax_discuss` | Multi-model discussion with patterns |
| `ax_discuss_quick` | Quick 2-3 provider consensus |
| `ax_guard_check` | Run governance check |
| `ax_guard_list` | List governance policies |
| `ax_workflow_run` | Execute a workflow |
| `ax_trace_list` | List execution traces |
| `ax_ability_inject` | Inject abilities into agent context |

### Configuration for Claude Code

After installing with `ax setup`, the MCP server is automatically configured for supported providers. To manually configure, add to your MCP settings:

```json
{
  "mcpServers": {
    "automatosx": {
      "command": "automatosx",
      "args": ["mcp", "server"]
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

### Discussion Domain
- **INV-DIS-001**: Minimum 2 providers for any discussion
- **INV-DIS-002**: Discussion continues if one provider fails
- **INV-DIS-003**: Synthesis produced even with partial participation
- **INV-DIS-004**: Provider responses tracked per round
- **INV-DIS-005**: Consensus method determines final outcome
- **INV-DIS-006**: All discussion results include provenance

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
