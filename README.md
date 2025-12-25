# AutomatosX

**AI orchestration for teams who need governed, multi-provider automation**

[![macOS](https://img.shields.io/badge/macOS-26%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Windows](https://img.shields.io/badge/Windows-11%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)

---

## Why AutomatosX

- **Multi-provider routing** - Claude, Gemini, Codex, Qwen, GLM, Grok with deterministic selection
- **Governed automation** - Policy-driven guardrails and audit-ready traces
- **Contract-first** - Zod schemas keep workflows and agents type-safe
- **Event-sourced memory** - Replayable timelines for debugging and compliance
- **MCP-native** - Ships with MCP server for IDE assistant integration

**Core principle**: AutomatosX never handles your secrets. Authentication stays in your provider CLIs.

---

## Install

```bash
npm install -g @defai.digital/automatosx
ax setup
ax doctor
```

**Prerequisites**: Node.js >= 20.0.0, at least one provider CLI installed

| Provider | CLI | Install |
|----------|-----|---------|
| Claude | `claude` | [claude-code](https://github.com/anthropics/claude-code) |
| Gemini | `gemini` | [gemini-cli](https://github.com/google-gemini/gemini-cli) |
| Codex | `codex` | [codex](https://github.com/openai/codex) |
| Qwen | `qwen` | [qwen-code](https://github.com/QwenLM/qwen-code) |
| GLM | `ax-glm` | [ax-cli](https://github.com/defai-digital/ax-cli) |
| Grok | `ax-grok` | [ax-cli](https://github.com/defai-digital/ax-cli) |

---

## Quick Start

```bash
# Call a provider directly
ax call claude "Explain this code"
ax call claude --file ./src/index.ts "Review this"

# Run a workflow
ax run code-reviewer --input '{"files":["src/index.ts"]}'

# Review code
ax review analyze src/ --focus security

# Multi-model discussion
ax discuss "Compare REST vs GraphQL" --providers claude,gemini

# View execution traces
ax trace
```

---

## CLI Reference

### System
```bash
ax setup                    # Initialize configuration
ax doctor                   # Check provider health
ax config show              # Show configuration
```

### Providers
```bash
ax call <provider> "prompt" # Direct provider call
ax call claude --file ./f   # With file context
```

### Workflows
```bash
ax list                     # List workflows
ax run <id>                 # Execute workflow
ax run <id> --input '{}'    # With JSON input
```

### Agents
```bash
ax agent list               # List agents
ax agent run <id>           # Execute agent
ax agent get <id>           # Get agent details
```

### Review
```bash
ax review analyze <path>    # Analyze code
ax review analyze src/ --focus security
ax review analyze src/ --focus architecture
```

### Discussion
```bash
ax discuss "<topic>"                    # Multi-model synthesis
ax discuss "<topic>" --pattern voting   # Voting consensus
ax discuss "<topic>" --pattern debate   # Structured debate
ax discuss quick "<topic>"              # Quick 2-3 provider discussion
```

### Guard
```bash
ax guard list               # List policies
ax guard check --policy <p> # Check against policy
```

### Scaffold
```bash
ax scaffold project <name>  # Create project
ax scaffold contract <name> # Generate Zod schemas
ax scaffold domain <name>   # Generate domain package
```

---

## MCP Server

AutomatosX includes an MCP server for AI assistant integration.

```bash
ax mcp server
```

**Configuration** (add to MCP settings):
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

**Available tools**: `ax_agent_run`, `ax_agent_list`, `ax_review_analyze`, `ax_discuss`, `ax_guard_check`, `ax_workflow_run`, `ax_trace_list`, `ax_memory_store`, `ax_memory_retrieve`, `ax_session_create`

---

## Configuration

Config location: `~/.config/automatosx/config.json`

```bash
ax config show              # View config
ax config get <key>         # Get value
ax config set <key> <value> # Set value
ax config path              # Show paths
```

---

## Development

```bash
# Clone and build
git clone https://github.com/defai-digital/automatosx.git
cd automatosx
pnpm install && pnpm build

# Development commands
pnpm test                   # Run tests
pnpm typecheck              # Type check
pnpm lint                   # Lint code
pnpm validate               # Full validation
```

### Project Structure

```
packages/
├── contracts/              # Zod schemas (source of truth)
├── core/                   # Domain logic
│   ├── workflow-engine/    # Workflow execution
│   ├── routing-engine/     # Model selection
│   ├── memory-domain/      # Event-sourced state
│   └── trace-domain/       # Execution tracing
├── adapters/               # External integrations
│   ├── providers/          # LLM provider adapters
│   └── sqlite/             # Persistence
├── guard/                  # Governance system
├── cli/                    # CLI interface
└── mcp-server/             # MCP protocol server
```

---

## License

Apache License 2.0 - see [LICENSE](LICENSE)

Commercial editions available. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)

---

[Documentation](docs/) | [Examples](examples/) | [GitHub](https://github.com/defai-digital/automatosx)
