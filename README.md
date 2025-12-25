# AutomatosX

**AI orchestration for teams who need governed, multi-provider automation**

[![macOS](https://img.shields.io/badge/macOS-26%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Windows](https://img.shields.io/badge/Windows-11%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)

---

## Why AutomatosX

AutomatosX solves the core problem of AI coding: **quality and governance**. While LLMs can generate code fast, ensuring that code is correct, safe, and maintainable requires structure.

- **Contracts** - Zod schemas as single source of truth for all inputs/outputs
- **Domains** - Isolated business logic with clear boundaries
- **Workflows** - Step-by-step execution with validation at each stage
- **Invariants** - Behavioral guarantees that must always hold
- **Guard** - Post-check governance gates before changes are accepted

**Core principle**: AutomatosX never handles your secrets. Authentication stays in your provider CLIs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLI / MCP Server                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Workflow   │  │   Agent     │  │   Review    │  │ Discussion │ │
│  │  Engine     │  │   Domain    │  │   Domain    │  │   Domain   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Guard     │  │   Memory    │  │   Trace     │  │  Routing   │ │
│  │   System    │  │   Domain    │  │   Domain    │  │  Engine    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    Contracts (Zod Schemas)                          │
│              Single Source of Truth + Invariants                    │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Provider Adapters                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│  │ Claude │ │ Gemini │ │ Codex  │ │  Qwen  │ │  GLM   │ │  Grok  │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quality Features for AI Coding

### Contracts

Every input and output is validated against Zod schemas. No magic strings, no undefined behavior.

```typescript
// All workflows, agents, and tools use typed contracts
import { WorkflowSchema, AgentSchema } from '@defai.digital/contracts';
```

### Domains

Business logic is isolated in domain packages with clear boundaries. Each domain owns its data and behavior.

```
packages/core/
├── workflow-engine/    # Step execution, retries, validation
├── agent-domain/       # Agent lifecycle, delegation
├── memory-domain/      # Event-sourced state
├── trace-domain/       # Execution audit trail
└── guard/              # Policy enforcement
```

### Workflows

Multi-step execution with validation, retries, and rollback. Each step is traced and auditable.

```bash
ax run code-reviewer --input '{"files":["src/index.ts"]}'
ax trace <id> --verbose   # See every decision
```

### Invariants

Behavioral guarantees documented and enforced. Examples:

| Domain | Invariant | Guarantee |
|--------|-----------|-----------|
| Workflow | INV-WF-001 | Steps execute in definition order |
| Routing | INV-RT-002 | High risk never selects experimental models |
| Memory | INV-MEM-001 | Events never modified after storage |
| Trace | INV-TR-001 | Every trace has start and end events |
| Guard | INV-GD-001 | Policy violations block execution |

### Guard System

Post-check governance for AI-generated code. Verify before accepting changes.

```bash
ax guard check --policy bugfix --target ./src
ax guard list   # See available policies
```

**Built-in policies:**
- `bugfix` - Limit change radius for bug fixes (3 packages)
- `provider-refactor` - Strict boundaries for adapter changes (2 packages)
- `rebuild` - Larger scope for refactoring (10 packages)

**Gates:**
- Path validation (allowed/forbidden paths)
- Change radius (limit packages modified)
- Dependency boundaries (import rules)
- Contract tests (schema validation)

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

# Review code with focus
ax review analyze src/ --focus security

# Multi-model discussion
ax discuss "Compare REST vs GraphQL" --providers claude,gemini

# Check governance
ax guard check --policy bugfix --target ./src

# View execution traces
ax trace
```

---

## CLI Reference

```bash
# System
ax setup                    # Initialize configuration
ax doctor                   # Check provider health

# Providers
ax call <provider> "prompt" # Direct provider call

# Workflows
ax run <id> --input '{}'    # Execute workflow
ax list                     # List workflows

# Agents
ax agent run <id>           # Execute agent
ax agent list               # List agents

# Review
ax review analyze <path>    # Code review
ax review analyze src/ --focus security

# Discussion
ax discuss "<topic>"        # Multi-model synthesis
ax discuss quick "<topic>"  # Quick consensus

# Guard
ax guard check --policy <p> # Check governance
ax guard list               # List policies

# Scaffold
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

**Tools**: `ax_agent_run`, `ax_review_analyze`, `ax_discuss`, `ax_guard_check`, `ax_workflow_run`, `ax_trace_list`, `ax_memory_store`

---

## Development

```bash
git clone https://github.com/defai-digital/automatosx.git
cd automatosx
pnpm install && pnpm build
pnpm test
pnpm validate   # typecheck + lint + deps + tests
```

---

## License

Apache License 2.0 - see [LICENSE](LICENSE)

Commercial editions available. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)

---

[Documentation](docs/) | [Examples](examples/) | [GitHub](https://github.com/defai-digital/automatosx)
