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
</p>

---

## Quick Start (60 Seconds)

```bash
# 1. Clone and build
git clone https://github.com/defai-digital/AutomatosX.git
cd AutomatosX && pnpm install && pnpm build

# 2. Initialize in your project
cd /path/to/your/project
ax setup

# 3. Run your first task
ax run backend "Create a REST API endpoint for users"
```

**That's it!** AutomatosX is now orchestrating AI agents for you.

---

## What is AutomatosX?

AutomatosX is an **invisible orchestration layer** that works behind your existing AI tools (Claude Code, Gemini CLI, OpenAI Codex). It provides:

- **Smart Routing** — Automatically picks the best available AI provider
- **Persistent Memory** — Never repeat yourself; past conversations are searchable
- **Specialized Agents** — 20+ agents (backend, frontend, security, devops, etc.)
- **Auto-Fallback** — If one provider fails, it switches to another

```
Your Tools                    AutomatosX (Invisible)              Providers
───────────                   ─────────────────────              ─────────
Claude Code  ─┐                                                  ┌─ Claude
Gemini CLI   ─┼──►  Routing + Memory + Agents  ──►  ──►  ──►  ──┼─ Gemini
Terminal     ─┘                                                  └─ OpenAI
```

---

## Essential Commands

### Run Tasks with Agents

```bash
ax run backend "Build a REST API for authentication"
ax run frontend "Create a React component for user profile"
ax run security "Review this code for vulnerabilities"
ax run devops "Setup Docker compose for the project"
```

### Search Your History

```bash
ax memory search "authentication"        # Find past work
ax memory search "database" --agent bob  # Filter by agent
ax memory list --limit 10                # Recent entries
```

### Check System Status

```bash
ax status           # Overview
ax provider health  # Provider availability
ax doctor           # Run diagnostics
```

---

## Available Agents

| Agent | Name | Best For |
|-------|------|----------|
| `backend` | Bob | Go, Rust, Python, APIs, databases |
| `frontend` | Frank | React, Next.js, Vue, TypeScript |
| `devops` | Oliver | Docker, Kubernetes, CI/CD |
| `security` | Steve | Security audits, threat modeling |
| `quality` | Queenie | Testing, QA automation |
| `architect` | Alex | System design, architecture |
| `fullstack` | Felix | End-to-end features |
| `data` | Dana | Data pipelines, analytics |

```bash
ax agent list              # See all 20+ agents
ax agent info backend      # Get agent details
```

---

## Configuration

After running `ax setup`, you'll have:

```
your-project/
├── .automatosx/           # Runtime data
│   ├── agents/            # Custom agent definitions
│   ├── memory/            # SQLite memory database
│   └── sessions/          # Session tracking
└── ax.config.json         # Configuration file
```

### ax.config.json

```json
{
  "providers": {
    "claude-code": { "enabled": true, "priority": 3 },
    "gemini-cli": { "enabled": true, "priority": 2 },
    "openai": { "enabled": true, "priority": 1 }
  },
  "memory": {
    "maxEntries": 10000,
    "autoCleanup": true
  }
}
```

### Environment Variables

```bash
CLAUDE_CODE_COMMAND=claude    # Claude Code binary
GEMINI_CLI_COMMAND=gemini     # Gemini CLI binary
AX_DEBUG=1                    # Enable debug logging
```

---

## VS Code Extension

```bash
ax extension install
```

**Features:**
- Sidebar panels for agents, sessions, memory
- Code Lens actions (analyze, explain, test, review)
- Keyboard shortcuts: `Cmd+Shift+A` (run task)

---

## How It Works

### Example: "Build me a caching layer"

1. **Agent Selection** → Routes to `backend` agent (database expertise)
2. **Provider Selection** → Chooses Claude Code (healthy, fast)
3. **Memory Context** → Retrieves relevant past implementations
4. **Execution** → Generates caching layer with Redis
5. **Memory Storage** → Saves result for future reference

### Multi-Provider Routing

AutomatosX monitors provider health and automatically routes to the best option:

| Provider | Integration | Health Check | Fallback |
|----------|-------------|--------------|----------|
| Claude Code | MCP | Real-time | Yes |
| Gemini CLI | MCP | Real-time | Yes |
| OpenAI Codex | Bash | Periodic | Yes |

---

## CLI Reference

```bash
# Setup & Status
ax setup                              # Initialize AutomatosX
ax status                             # System overview
ax doctor                             # Run diagnostics

# Task Execution
ax run <agent> "<task>"               # Run agent task
ax run backend "Create API endpoint"

# Agent Management
ax agent list                         # List all agents
ax agent info <name>                  # Agent details

# Memory Operations
ax memory search "<query>"            # Search memory
ax memory list --limit 20             # List entries
ax memory stats                       # Statistics
ax memory export > backup.json        # Backup
ax memory clear --before "2024-01-01" # Cleanup

# Session Management
ax session create --agent backend     # Create session
ax session list                       # List sessions
ax session complete <id>              # Mark complete

# Provider Operations
ax provider list                      # List providers
ax provider health                    # Check health
ax provider test <name>               # Test provider

# Global Options
ax --debug <command>                  # Debug mode
ax --quiet <command>                  # Quiet mode
ax --help                             # Help
ax --version                          # Version
```

---

## Troubleshooting

### Provider Not Available

```bash
ax provider health          # Check all providers
ax doctor                   # Run diagnostics
which claude gemini codex   # Verify binaries installed
```

### Memory Issues

```bash
ax memory stats                      # Check database
ax memory export > backup.json       # Backup
rm .automatosx/memory/memories.db    # Reset if needed
ax memory import backup.json         # Restore
```

### Debug Mode

```bash
ax --debug run backend "Task description"
```

---

## Development

### Prerequisites

- Node.js 24.0.0+
- pnpm 9.14.2+
- At least one AI provider installed

### Build

```bash
pnpm install    # Install dependencies
pnpm build      # Build all packages
pnpm test       # Run tests
pnpm lint       # Lint code
```

### Architecture

```
packages/
├── schemas/      # @ax/schemas — Zod validation
├── algorithms/   # @ax/algorithms — ReScript algorithms
├── providers/    # @ax/providers — AI provider integrations
├── core/         # @ax/core — Orchestration engine
├── cli/          # @ax/cli — Command-line interface
├── mcp/          # @ax/mcp — MCP server
└── vscode-extension/  # VS Code integration
```

---

## License

Apache-2.0 © [DEFAI Private Limited](https://defai.digital)

---

<p align="center">
  <a href="https://github.com/defai-digital/AutomatosX">GitHub</a> •
  <a href="https://github.com/defai-digital/AutomatosX/issues">Issues</a> •
  <a href="docs/">Documentation</a>
</p>
