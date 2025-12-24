# CLI Commands Reference

Complete reference for all AutomatosX CLI commands.

## Command Overview

| Command | Description |
|---------|-------------|
| [`run`](#run) | Execute a workflow |
| [`list`](#list) | List available workflows |
| [`call`](#call) | Direct AI provider call |
| [`iterate`](#iterate) | Autonomous multi-step execution |
| [`agent`](#agent) | Agent management |
| [`session`](#session) | Collaboration session management |
| [`review`](#review) | AI-powered code review |
| [`scaffold`](#scaffold) | Contract-first scaffolding |
| [`guard`](#guard) | Governance checks |
| [`trace`](#trace) | Execution trace inspection |
| [`ability`](#ability) | Ability management |
| [`doctor`](#doctor) | System health check |
| [`setup`](#setup) | Initial configuration |
| [`config`](#config) | Configuration management |
| [`status`](#status) | System status |
| [`history`](#history) | Run history |
| [`resume`](#resume) | Resume from checkpoint |
| [`cleanup`](#cleanup) | Data cleanup |
| [`mcp`](#mcp) | MCP server |
| [`help`](#help) | Help information |
| [`version`](#version) | Version information |

---

## Core Commands

### run

Execute a workflow by ID.

```bash
ax run <workflow-id> [options]
```

**Arguments:**
- `<workflow-id>` - The workflow to execute

**Options:**
- `--input <json>` - JSON input for the workflow
- `--format <type>` - Output format: `text` (default) or `json`
- `--verbose` - Show detailed output

**Examples:**
```bash
# Run a workflow
ax run code-reviewer

# Run with input
ax run developer --input '{"feature": "Add user authentication"}'

# Run with JSON output
ax run analyst --format json
```

---

### list

List available workflows.

```bash
ax list [options]
```

**Options:**
- `--format <type>` - Output format: `text` (default) or `json`

**Examples:**
```bash
# List all workflows
ax list

# List as JSON
ax list --format json
```

---

### call

Direct AI provider call.

```bash
ax call <provider> <prompt> [options]
```

**Arguments:**
- `<provider>` - AI provider: `claude`, `gemini`, `codex`, `qwen`, `glm`, `grok`
- `<prompt>` - The prompt to send

**Options:**
- `--file <path>` - Include file contents as context
- `--model <name>` - Specific model to use
- `--system <prompt>` - System prompt to prepend
- `--iterate` - Enable autonomous multi-step mode
- `--max-iterations <n>` - Max iterations for iterate mode (default: 20)
- `--max-time <duration>` - Max time for iterate mode (e.g., `5m`, `1h`)
- `--no-context` - Skip loading project context
- `--format <type>` - Output format: `text` (default) or `json`

**Examples:**
```bash
# Simple prompt
ax call claude "Explain dependency injection"

# With file context
ax call claude --file ./src/api.ts "Review this code for security issues"

# Different provider
ax call gemini "Summarize microservices architecture"

# Autonomous mode
ax call claude --iterate "Implement user authentication"
```

---

### iterate

Autonomous multi-step execution. Shorthand for `ax call --iterate`.

```bash
ax iterate <provider> <prompt> [options]
```

**Arguments:**
- `<provider>` - AI provider to use
- `<prompt>` - The task to complete autonomously

**Options:**
- `--max-iterations <n>` - Maximum iterations (default: 20)
- `--max-time <duration>` - Maximum time: `30s`, `5m`, `1h` (default: 5m)
- `--no-context` - Skip loading project context
- `--model <name>` - Specific model to use
- `--system <prompt>` - System prompt to prepend

**How It Works:**
1. Sends your prompt to the AI provider
2. AI works on the task and responds
3. If task incomplete, AI continues automatically
4. Pauses when AI needs your input (questions, decisions)
5. Stops when task is complete or budget exceeded

**Examples:**
```bash
# Basic iterate
ax iterate claude "implement user authentication"

# With limits
ax iterate gemini --max-iterations 50 "refactor the API layer"

# Time-limited
ax iterate codex --max-time 10m "add comprehensive unit tests"
```

---

## Agent Commands

### agent

Manage and run agents.

```bash
ax agent <subcommand> [options]
```

**Subcommands:**

#### `agent list`
List registered agents.

```bash
ax agent list [--format json]
```

#### `agent get`
Get agent details.

```bash
ax agent get <agent-id>
```

#### `agent run`
Execute an agent.

```bash
ax agent run <agent-id> [--input <json>]
```

#### `agent register`
Register a new agent from JSON input.

```bash
ax agent register < agent.json
```

#### `agent remove`
Remove an agent.

```bash
ax agent remove <agent-id>
```

**Examples:**
```bash
# List all agents
ax agent list

# Get agent details
ax agent get fullstack

# Run an agent
ax agent run code-reviewer --input '{"query": "Review the auth module"}'

# Register custom agent
cat my-agent.json | ax agent register
```

---

## Session Commands

### session

Manage collaboration sessions.

```bash
ax session <subcommand> [options]
```

**Subcommands:**

#### `session list`
List sessions.

```bash
ax session list [--status <status>] [--limit <n>]
```

#### `session get`
Get session details.

```bash
ax session get <session-id>
```

#### `session create`
Create a new session.

```bash
ax session create --input '{"initiator": "agent-id", "task": "description"}'
```

#### `session join`
Join an existing session.

```bash
ax session join <session-id> --agent <agent-id>
```

#### `session leave`
Leave a session.

```bash
ax session leave <session-id> --agent <agent-id>
```

#### `session complete`
Mark session as completed.

```bash
ax session complete <session-id> [--summary "..."]
```

#### `session fail`
Mark session as failed.

```bash
ax session fail <session-id> --error '{"code": "...", "message": "..."}'
```

---

## Code Analysis Commands

### review

AI-powered code review.

```bash
ax review <subcommand> [options]
```

**Subcommands:**

#### `review analyze`
Analyze code with focused review.

```bash
ax review analyze <paths...> [options]
```

**Options:**
- `--focus <mode>` - Focus mode: `security`, `architecture`, `performance`, `maintainability`, `correctness`, `all` (default)
- `--context <text>` - Additional context for the review
- `--max-files <n>` - Maximum files to analyze (default: 20)
- `--min-confidence <n>` - Minimum confidence 0-1 (default: 0.7)
- `--output-format <type>` - Output: `markdown` (default), `json`, `sarif`
- `--dry-run` - Show what would be analyzed

**Examples:**
```bash
# Security review
ax review analyze src/ --focus security

# Architecture review
ax review analyze src/services/ --focus architecture

# Performance review with context
ax review analyze src/api/ --focus performance --context "High-traffic endpoint"

# Comprehensive review
ax review analyze packages/core/ --focus all
```

#### `review list`
List recent reviews.

```bash
ax review list [--limit <n>] [--focus <mode>]
```

---

### scaffold

Contract-first scaffolding.

```bash
ax scaffold <subcommand> [options]
```

**Subcommands:**

#### `scaffold project`
Create a new project from template.

```bash
ax scaffold project <name> --domain <domain> [options]
```

**Options:**
- `-m, --domain <name>` - Primary domain name (required)
- `-t, --template <type>` - Template: `standalone` (default) or `monorepo`
- `-s, --scope <scope>` - NPM package scope (default: `@myorg`)
- `-d, --description <text>` - Project description
- `-o, --output <path>` - Output directory
- `--dry-run` - Preview without writing files

**Examples:**
```bash
# Standalone project
ax scaffold project my-app --domain order

# Monorepo with custom scope
ax scaffold project platform --domain user --template monorepo --scope @mycompany

# Preview
ax scaffold project my-app --domain payment --dry-run
```

#### `scaffold contract`
Generate Zod schemas and invariants.

```bash
ax scaffold contract <name> [options]
```

**Options:**
- `-d, --description <text>` - Domain description
- `-o, --output <path>` - Output directory
- `--dry-run` - Preview without writing files

#### `scaffold domain`
Generate domain implementation package.

```bash
ax scaffold domain <name> [options]
```

**Options:**
- `-s, --scope <scope>` - Package scope (default: `@automatosx`)
- `-o, --output <path>` - Output directory
- `--no-tests` - Skip test generation
- `--no-guard` - Skip guard policy generation
- `--dry-run` - Preview without writing files

#### `scaffold guard`
Generate guard policy.

```bash
ax scaffold guard <policy-id> [options]
```

**Options:**
- `-m, --domain <name>` - Domain name
- `-r, --radius <n>` - Change radius limit (default: 3)
- `-g, --gates <gates>` - Comma-separated gates
- `--dry-run` - Preview without writing files

---

### guard

Governance checks.

```bash
ax guard <subcommand> [options]
```

**Subcommands:**

#### `guard check`
Run governance gates on changed paths.

```bash
ax guard check --policy <policy-id> --changed-paths <paths>
```

**Options:**
- `--policy <id>` - Policy ID (required)
- `--changed-paths <paths>` - Comma-separated changed file paths
- `--target <name>` - Target identifier

#### `guard list`
List available policies.

```bash
ax guard list [--limit <n>]
```

#### `guard apply`
Apply a policy to a session.

```bash
ax guard apply --session <session-id> --policy <policy-id>
```

**Examples:**
```bash
# Check changes against policy
ax guard check --policy bugfix --changed-paths "src/service.ts,src/types.ts"

# List policies
ax guard list
```

---

## Tracing & History

### trace

Execution trace inspection.

```bash
ax trace [trace-id] [options]
```

**Options:**
- `--verbose` - Show detailed trace information
- `--limit <n>` - Number of traces to list
- `--format <type>` - Output format: `text` or `json`

**Examples:**
```bash
# List recent traces
ax trace

# View specific trace
ax trace abc123

# Detailed view
ax trace abc123 --verbose
```

---

### history

View past agent run history.

```bash
ax history [options]
```

**Options:**
- `--limit <n>` - Number of runs to show (default: 10)
- `--agent <id>` - Filter by agent
- `--status <status>` - Filter: `completed`, `failed`, `running`, `cancelled`
- `--verbose` - Show full details
- `--format <type>` - Output format: `text` or `json`

**Examples:**
```bash
# Show last 10 runs
ax history

# Show last 20 runs
ax history --limit 20

# Filter by agent
ax history --agent coder

# Show only failed runs
ax history --status failed
```

---

### resume

Resume agent execution from a checkpoint.

```bash
ax resume [options]
```

**Options:**
- `--agent <id>` - Resume latest checkpoint for agent
- `--checkpoint <uuid>` - Resume specific checkpoint
- `--session <id>` - Filter by session
- `--force` - Skip confirmation

**Subcommands:**

#### `resume list`
List available checkpoints.

```bash
ax resume list --agent <agent-id>
```

**Examples:**
```bash
# List checkpoints for an agent
ax resume list --agent coder

# Resume latest for agent
ax resume --agent coder

# Resume specific checkpoint
ax resume --checkpoint abc-123-def
```

---

## System Commands

### status

Display system health and status.

```bash
ax status [options]
```

**Options:**
- `--verbose` - Show detailed status
- `--format <type>` - Output format: `text` or `json`

**Output includes:**
- Overall system health
- Provider availability
- Active sessions count
- Pending checkpoints count

---

### doctor

Check system health and provider availability.

```bash
ax doctor [provider] [options]
```

**Arguments:**
- `[provider]` - Specific provider to check (optional)

**Options:**
- `--verbose` - Show detailed diagnostics

**Examples:**
```bash
# Check all providers
ax doctor

# Check specific provider
ax doctor claude

# Detailed check
ax doctor claude --verbose
```

---

### setup

Initialize AutomatosX configuration.

```bash
ax setup [options]
```

**Options:**
- `--force` - Force reconfiguration

---

### config

Configuration management.

```bash
ax config <subcommand> [options]
```

**Subcommands:**

#### `config show`
Show current configuration.

```bash
ax config show [--scope <scope>]
```

**Scope:** `global`, `local`, or `merged` (default)

#### `config get`
Get specific configuration value.

```bash
ax config get <path> [--scope <scope>]
```

#### `config set`
Set configuration value.

```bash
ax config set <path> <value> [--scope <scope>]
```

#### `config reset`
Reset configuration to defaults.

```bash
ax config reset
```

#### `config path`
Show configuration file paths.

```bash
ax config path
```

**Examples:**
```bash
# Show all config
ax config show

# Get specific value
ax config get logLevel

# Set value
ax config set logLevel debug

# Show config paths
ax config path
```

---

### cleanup

Clean up old data based on retention policies.

```bash
ax cleanup [options]
```

**Options:**
- `--force` - Actually perform cleanup (default is dry run)
- `--older-than <days>` - Clean data older than N days (default: 30)
- `--types <types>` - Comma-separated types: `checkpoints`, `sessions`, `traces`, `dlq`
- `--yes` - Skip confirmation prompt

**Examples:**
```bash
# Dry run - show what would be cleaned
ax cleanup

# Clean data older than 7 days
ax cleanup --force --older-than 7

# Clean only checkpoints
ax cleanup --force --types checkpoints
```

---

### ability

Ability management for agents.

```bash
ax ability <subcommand> [options]
```

**Subcommands:**

#### `ability list`
List available abilities.

```bash
ax ability list [--category <cat>] [--tags <tags>]
```

#### `ability inject`
Inject abilities into agent context.

```bash
ax ability inject --agent <agent-id> --task <description>
```

---

### mcp

Start the MCP (Model Context Protocol) server.

```bash
ax mcp server [options]
```

The MCP server provides tool integration for AI assistants like Claude Code.

See [MCP Tools Reference](./mcp-tools.md) for available tools.

---

### help

Show help information.

```bash
ax help [command]
```

---

### version

Show version information.

```bash
ax version
```

---

## Global Options

These options are available for all commands:

| Option | Description |
|--------|-------------|
| `--format <type>` | Output format: `text` or `json` |
| `--verbose` | Enable verbose output |
| `--help` | Show command help |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AX_STORAGE` | Storage mode: `sqlite` or `memory` | `sqlite` |
| `AX_MCP_TOOL_PREFIX` | Prefix for MCP tool names | `ax_` |
