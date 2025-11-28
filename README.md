<p align="center">
  <img src="docs/assets/logo.png" alt="AutomatosX" width="200" />
</p>

<h1 align="center">AutomatosX</h1>

<p align="center">
  <strong>AI Agent Orchestration Platform with Multi-Provider Intelligence</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@defai.digital/automatosx"><img src="https://img.shields.io/npm/v/@defai.digital/automatosx?color=blue" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green" alt="license" /></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.7+-blue" alt="TypeScript" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Node.js-24+-green" alt="Node.js" /></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey" alt="platform" /></a>
</p>

<p align="center">
  <strong>v11.0.0-alpha.0 | Production Ready</strong>
</p>

---

> **AutomatosX** seamlessly orchestrates AI agents across Claude Code, Gemini CLI, and OpenAI Codex with persistent memory and intelligent routing—all working invisibly behind your existing tools.

---

## The Problem

Working with AI coding assistants today is fragmented and frustrating:

- **Provider Lock-in** — Tied to a single AI provider with no fallback when it's slow or unavailable
- **Context Amnesia** — Every session starts fresh; past work forgotten; repeating yourself endlessly
- **Single-Agent Limits** — One agent doing everything; no specialization; no coordination
- **Token Waste** — No intelligent routing; using expensive models for simple tasks
- **No Observability** — Black box execution; no metrics; no insight into what's happening

## The Solution

AutomatosX provides an intelligent orchestration layer that:

- **Multi-Provider Routing** — Automatically selects the best available provider based on health, latency, and cost
- **Persistent Memory** — SQLite FTS5-powered search across all past conversations and decisions
- **Specialized Agents** — 20+ pre-defined agents (backend, frontend, security, devops, etc.) with delegation support
- **Smart Fallback** — Circuit breaker pattern ensures continuity when providers fail
- **Full Visibility** — Comprehensive metrics, session tracking, and debugging tools

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Workflow                            │
│    Claude Code  •  Gemini CLI  •  VS Code  •  Terminal          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AutomatosX (Invisible)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Agents    │  │   Memory    │  │    Provider Router      │  │
│  │  Registry   │  │   Manager   │  │  Health • Latency • Cost│  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌────────────┐      ┌────────────┐      ┌────────────┐
    │   Claude   │      │   Gemini   │      │   OpenAI   │
    │    Code    │      │    CLI     │      │   Codex    │
    └────────────┘      └────────────┘      └────────────┘
```

**You continue using your existing tools.** AutomatosX works behind the scenes, providing intelligent routing, persistent memory, and multi-agent coordination.

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/defai-digital/automatosx.git
cd AutomatosX
pnpm install && pnpm build
```

### 2. Initialize

```bash
# Setup AutomatosX in your project
ax setup
```

This creates:
- `.automatosx/` — Runtime directory (agents, memory, sessions)
- `ax.config.json` — Configuration with sensible defaults

### 3. Use

```bash
# Run a task with an agent
ax run backend "Create a REST API for user authentication"

# Search past work
ax memory search "authentication"

# Check system status
ax status
```

---

## Natural Language Examples

### "Build me a caching layer for the API"

**What happens automatically:**
1. **Agent Selection** — Routes to `backend` agent (Bob) with database expertise
2. **Provider Selection** — Chooses Claude Code (healthy, 234ms latency)
3. **Memory Context** — Retrieves 3 relevant past implementations
4. **Execution** — Generates caching layer with Redis integration
5. **Memory Storage** — Saves result for future reference

### "Review this code for security vulnerabilities"

**What happens automatically:**
1. **Agent Selection** — Routes to `security` agent (Steve) with OWASP expertise
2. **Context Loading** — Pulls related security decisions from memory
3. **Analysis** — Comprehensive security audit with threat modeling
4. **Delegation** — Optionally delegates to `quality` agent for test coverage

### "Deploy the new feature to staging"

**What happens automatically:**
1. **Agent Selection** — Routes to `devops` agent (Oliver) with CI/CD expertise
2. **Provider Fallback** — If Claude is slow, automatically tries Gemini
3. **Session Tracking** — Links to existing deployment session
4. **Execution** — Kubernetes deployment with health checks

---

## Key Features

### Multi-Provider Intelligence

| Provider | Integration | Health Check | Auto-Fallback |
|----------|-------------|--------------|---------------|
| Claude Code | MCP (stdin/stdout) | Real-time | Yes |
| Gemini CLI | MCP (stdin/stdout) | Real-time | Yes |
| OpenAI Codex | Bash command | Periodic | Yes |
| ax-cli | SDK + MCP | Real-time | Yes |

**Smart Routing:**
- Provider health monitoring with circuit breaker pattern
- Latency-based scoring (faster providers preferred)
- Success rate tracking (reliable providers preferred)
- Priority-based fallback (configured order)

### Persistent Memory

```
Memory System
├── SQLite FTS5 — Full-text search across all entries
├── Relevance Ranking — Algorithm-based result scoring
├── Hybrid Cleanup — LRU + age + importance strategies
├── Import/Export — Backup and restore capabilities
└── Access Tracking — Usage statistics and patterns
```

**Search your history:**
```bash
ax memory search "authentication API"
ax memory search "database" --agent backend
ax memory list --limit 20
```

### 20+ Specialized Agents

| Agent | Name | Expertise |
|-------|------|-----------|
| `backend` | Bob | Go, Rust, Python, APIs, databases |
| `frontend` | Frank | React, Next.js, Vue, UI development |
| `devops` | Oliver | Kubernetes, Docker, CI/CD |
| `security` | Steve | Security audits, threat modeling |
| `quality` | Queenie | Testing, QA, test automation |
| `architect` | Alex | System design, architecture |
| `performance` | Peter | Optimization, profiling |
| `product` | Paris | Requirements, roadmaps |
| ... | ... | 12+ more specialized agents |

**Delegation Support:**
Agents can delegate to each other with cycle detection and depth limits.

### Session Management

```bash
# Create a session for complex workflows
ax session create --agent backend --task "Build microservice"

# Track progress across multiple tasks
ax session list
ax session info <session-id>

# Complete when done
ax session complete <session-id>
```

---

## Architecture

### Package Structure

```
AutomatosX/
├── packages/
│   ├── schemas/          # @ax/schemas — Zod validation (base layer)
│   ├── algorithms/       # @ax/algorithms — ReScript performance algorithms
│   ├── providers/        # @ax/providers — AI provider integrations
│   ├── core/             # @ax/core — Orchestration engine
│   ├── cli/              # @ax/cli — Command-line interface
│   ├── mcp/              # @ax/mcp — Model Context Protocol server
│   └── vscode-extension/ # automatosx — VS Code integration
```

### Dependency Graph

```
@ax/schemas (no dependencies)
     │
     ├──────────────────────┬──────────────────┐
     ▼                      ▼                  ▼
@ax/algorithms         @ax/providers      better-sqlite3
     │                      │                  │
     └──────────┬───────────┘                  │
                ▼                              │
           @ax/core ◄──────────────────────────┘
                │
     ┌──────────┴──────────┐
     ▼                     ▼
  @ax/cli              @ax/mcp
```

---

## CLI Reference

### Core Commands

```bash
ax setup                           # Initialize AutomatosX
ax run <agent> "<task>"            # Execute agent task
ax status                          # System status
ax doctor                          # Run diagnostics
```

### Agent Management

```bash
ax agent list                      # List all agents
ax agent info <name>               # Get agent details
ax agent list --team development   # Filter by team
```

### Memory Operations

```bash
ax memory search "<query>"         # Search memory
ax memory list --limit 20          # List entries
ax memory stats                    # Show statistics
ax memory export > backup.json     # Export backup
ax memory clear --before "date"    # Cleanup old entries
```

### Session Management

```bash
ax session create --agent backend  # Create session
ax session list                    # List sessions
ax session complete <id>           # Mark complete
```

### Provider Operations

```bash
ax provider list                   # List providers
ax provider health                 # Check health status
ax provider test <name>            # Test provider
```

### Global Options

```bash
ax --debug <command>               # Enable debug output
ax --quiet <command>               # Suppress output
ax --help                          # Show help
ax --version                       # Show version
```

---

## VS Code Extension

### Installation

```bash
# From CLI
ax extension install

# Or manually install the .vsix file
```

### Features

- **Sidebar Panels** — Agents, sessions, memory, system status
- **Code Lens** — Analyze, explain, test, review actions above functions
- **Hover Info** — Agent suggestions and quick actions
- **Context Menu** — Right-click for agent actions
- **Keyboard Shortcuts:**
  - `Cmd+Shift+A` — Run Task
  - `Cmd+Shift+Alt+A` — Run with Agent
  - `Cmd+Shift+E` — Analyze Selection

### Configuration

```json
{
  "automatosx.defaultAgent": "standard",
  "automatosx.defaultProvider": "claude",
  "automatosx.enableCodeLens": true,
  "automatosx.streamOutput": true
}
```

---

## Configuration

### ax.config.json

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 3,
      "timeout": 2700000,
      "healthCheck": { "enabled": true, "interval": 300000 },
      "circuitBreaker": { "failureThreshold": 3, "recoveryTimeout": 60000 }
    },
    "gemini-cli": { "enabled": true, "priority": 2 },
    "openai": { "enabled": true, "priority": 1 }
  },
  "memory": {
    "maxEntries": 10000,
    "persistPath": ".automatosx/memory",
    "autoCleanup": true,
    "cleanupDays": 30
  },
  "orchestration": {
    "delegation": { "maxDepth": 2, "enableCycleDetection": true }
  }
}
```

### Environment Variables

```bash
CLAUDE_CODE_COMMAND=claude         # Claude Code command
GEMINI_CLI_COMMAND=gemini          # Gemini CLI command
AX_DEBUG=1                         # Enable debug logging
AX_CONFIG_PATH=ax.config.json      # Config file location
```

---

## MCP Server

AutomatosX exposes an MCP server for IDE integrations:

```bash
# Start the MCP server
ax mcp serve
```

**Available Tools:**
- `ax_run` — Execute agent tasks
- `ax_memory_search` — Search memory
- `ax_session_create` — Create sessions
- `ax_agent_list` — List agents
- And more...

---

## Development

### Prerequisites

- Node.js 24.0.0+
- pnpm 9.14.2+
- One or more AI providers (Claude Code, Gemini CLI, OpenAI Codex)

### Building

```bash
pnpm install                       # Install dependencies
pnpm build                         # Build all packages
pnpm dev                           # Watch mode
pnpm test                          # Run tests
pnpm lint                          # Lint code
pnpm format                        # Format code
```

### Package-Specific Builds

```bash
pnpm --filter @ax/core build       # Build core only
pnpm --filter @ax/cli build        # Build CLI only
pnpm --filter automatosx build     # Build VS Code extension
```

---

## Troubleshooting

### Provider Unavailable

```bash
# Check provider health
ax provider health

# Run diagnostics
ax doctor

# Verify provider commands are installed
which claude gemini codex
```

### Memory Database Locked

```bash
# Check for multiple instances
pgrep -f "ax memory"

# Export and rebuild if needed
ax memory export > backup.json
rm .automatosx/memory/memories.db
ax memory import backup.json
```

### Debug Mode

```bash
# Enable verbose logging
ax --debug run backend "Task"
```

---

## Project Status

| Package | Status | Description |
|---------|--------|-------------|
| @ax/schemas | Complete | Zod validation schemas |
| @ax/algorithms | Complete | ReScript performance algorithms |
| @ax/providers | Complete | Multi-provider integrations |
| @ax/core | Complete | Orchestration engine |
| @ax/cli | Complete | Command-line interface |
| @ax/mcp | Complete | MCP server |
| automatosx | Complete | VS Code extension |

**Overall Status:** Production Ready (v11.0.0-alpha.0)

---

## License

Apache-2.0 © [DEFAI Private Limited](https://defai.digital)

---

## Links

- **Repository:** [github.com/defai-digital/automatosx](https://github.com/defai-digital/automatosx)
- **Documentation:** See `docs/` directory
- **Issues:** [GitHub Issues](https://github.com/defai-digital/automatosx/issues)

---

<p align="center">
  <strong>Built with TypeScript, Zod, ReScript, and SQLite</strong>
</p>
