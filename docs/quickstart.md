# AutomatosX Quickstart Guide

Get started with AutomatosX in 5 minutes. Build quality software with AI-powered workflows, agents, and governance.

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.15.0
- At least one AI provider CLI installed

## Installation

```bash
# Clone and setup
git clone https://github.com/defai-digital/automatosx.git
cd automatosx
pnpm install && pnpm build

# Initialize configuration
pnpm ax setup

# Verify installation
pnpm ax doctor
```

## Install a Provider CLI

AutomatosX uses external CLI tools for AI providers. Install at least one:

| Provider | Command | Install From |
|----------|---------|--------------|
| Claude | `claude` | [Claude Code](https://github.com/anthropics/claude-code) |
| Gemini | `gemini` | [Gemini CLI](https://github.com/google-gemini/gemini-cli) |
| Codex | `codex` | [Codex CLI](https://github.com/openai/codex) |
| Grok | `ax-grok` | [AX CLI](https://github.com/defai-digital/ax-cli) |

```bash
# Verify your provider is working
pnpm ax doctor claude
```

---

## Quick Examples

### 1. Direct AI Calls

```bash
# Simple prompt
pnpm ax call claude "Explain dependency injection in TypeScript"

# With file context
pnpm ax call claude --file ./src/api.ts "Review this code for security issues"

# Different providers
pnpm ax call gemini "Summarize microservices architecture benefits"
```

### 2. Autonomous Mode (Iterate)

Let AI work autonomously on complex tasks:

```bash
# Autonomous multi-step execution
pnpm ax iterate claude "implement user authentication"

# With limits
pnpm ax iterate gemini --max-iterations 50 "refactor the API layer"

# Time-limited
pnpm ax iterate codex --max-time 10m "add comprehensive unit tests"
```

### 3. Code Review

```bash
# Security-focused review
pnpm ax review analyze src/ --focus security

# Architecture review
pnpm ax review analyze src/services/ --focus architecture

# Performance review
pnpm ax review analyze src/api/ --focus performance

# Comprehensive review (all aspects)
pnpm ax review analyze src/ --focus all
```

### 4. Create a New Project

```bash
# Standalone project with 'order' domain
pnpm ax scaffold project my-ecommerce --domain order --template standalone

# Monorepo project
pnpm ax scaffold project platform --domain user --template monorepo --scope @myorg

# Preview without creating files
pnpm ax scaffold project my-app --domain payment --dry-run
```

### 5. Run Workflows

```bash
# List available workflows
pnpm ax list

# Run the code reviewer workflow
pnpm ax run code-reviewer

# Run with input
pnpm ax run developer --input '{"feature": "Add user authentication"}'

# Run ML/MLOps workflows
pnpm ax run mlops-deployment --input '{"model_name": "recommender", "version": "v2.1"}'
```

### 6. Use Agents

```bash
# List available agents
pnpm ax agent list

# Get agent details
pnpm ax agent get fullstack

# Run an agent
pnpm ax agent run code-reviewer --input '{"query": "Review the auth module"}'

# Get agent recommendation for a task
pnpm ax agent run architecture --input '{"query": "Design a caching strategy"}'
```

---

## System Management

### Check System Status

```bash
# View system health
pnpm ax status

# Detailed status
pnpm ax status --verbose
```

### View Run History

```bash
# Show last 10 runs
pnpm ax history

# Filter by agent
pnpm ax history --agent fullstack

# Show only failed runs
pnpm ax history --status failed
```

### Resume from Checkpoint

```bash
# List checkpoints for an agent
pnpm ax resume list --agent coder

# Resume latest checkpoint
pnpm ax resume --agent coder
```

### Cleanup Old Data

```bash
# Dry run - see what would be cleaned
pnpm ax cleanup

# Actually clean data older than 7 days
pnpm ax cleanup --force --older-than 7
```

---

## Common Workflows

### Build a New Feature

```bash
# 1. Scaffold the domain contract first
pnpm ax scaffold contract payment --description "Payment processing domain"

# 2. Generate the domain implementation
pnpm ax scaffold domain payment

# 3. Run the developer workflow
pnpm ax run developer --input '{"feature": "Implement Stripe integration"}'

# 4. Review the code
pnpm ax review analyze packages/core/payment-domain/ --focus all
```

### Improve Existing Code

```bash
# 1. Review current state
pnpm ax review analyze src/ --focus maintainability

# 2. Check for security issues
pnpm ax review analyze src/ --focus security

# 3. Run the refactoring workflow
pnpm ax run refactoring --input '{"target": "src/services/"}'
```

### Debug a Problem

```bash
# Run the debugger workflow
pnpm ax run debugger --input '{"issue": "API returns 500 on user creation"}'

# Or call AI directly with context
pnpm ax call claude --file ./src/api/users.ts "Why might this throw a 500 error?"
```

### ML/MLOps Tasks

```bash
# Deploy a model
pnpm ax run mlops-deployment --input '{"model_name": "classifier", "version": "v2.0"}'

# Track experiments
pnpm ax run ml-experiment-tracker --input '{"experiment_name": "hyperparameter_sweep"}'

# Monitor model performance
pnpm ax run ml-model-monitoring --input '{"model_id": "prod-recommender"}'
```

---

## Using the MCP Server

AutomatosX provides an MCP server for integration with AI assistants like Claude Code.

### Start the Server

```bash
pnpm ax mcp server
```

### Configure Claude Code

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

### Available MCP Tools

Once connected, you have access to 40+ tools:

| Category | Tools |
|----------|-------|
| **Agents** | `agent_list`, `agent_run`, `agent_get`, `agent_register`, `agent_recommend` |
| **Workflows** | `workflow_run`, `workflow_list`, `workflow_describe` |
| **Sessions** | `session_create`, `session_join`, `session_complete`, `session_list` |
| **Memory** | `memory_store`, `memory_retrieve`, `memory_search`, `memory_list` |
| **Guard** | `guard_check`, `guard_list`, `guard_apply` |
| **Scaffold** | `scaffold_contract`, `scaffold_domain`, `scaffold_guard` |
| **Review** | `review_analyze`, `review_list` |
| **Trace** | `trace_list`, `trace_get`, `trace_analyze` |

See [MCP Tools Reference](./reference/mcp-tools.md) for complete documentation.

---

## Next Steps

- **[Building Software Guide](./guides/building-software.md)** - Complete guide to building quality software
- **[Improving Apps Guide](./guides/improving-apps.md)** - Modernize and improve existing applications
- **[MLOps Guide](./guides/mlops-guide.md)** - Machine learning operations workflows
- **[CLI Reference](./reference/cli-commands.md)** - Complete CLI command reference
- **[Workflows Reference](./reference/workflows.md)** - Available workflow catalog
- **[Agents Reference](./reference/agents.md)** - Available agent catalog

---

## Quick Reference

### Core Commands

```bash
# Help
pnpm ax help
pnpm ax --help

# System health
pnpm ax doctor
pnpm ax doctor claude --verbose
pnpm ax status

# Configuration
pnpm ax config show
pnpm ax config get logLevel
pnpm ax config set logLevel debug

# Run history
pnpm ax history
pnpm ax history --limit 20

# Execution traces
pnpm ax trace
pnpm ax trace <trace-id> --verbose

# Cleanup
pnpm ax cleanup --force
```

### AI Interaction

```bash
# Direct calls
pnpm ax call <provider> "<prompt>"
pnpm ax call claude --file ./file.ts "Review this"

# Autonomous mode
pnpm ax iterate <provider> "<task>"

# Code review
pnpm ax review analyze <path> --focus <mode>
```

### Workflows & Agents

```bash
# Workflows
pnpm ax list
pnpm ax run <workflow-id>

# Agents
pnpm ax agent list
pnpm ax agent run <agent-id>
```
