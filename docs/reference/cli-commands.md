# CLI Commands Reference

Complete reference for all AutomatosX CLI commands.

---

## Global Options

Available for all commands:

```bash
-d, --debug    Enable debug mode with verbose output
-q, --quiet    Suppress non-essential output
-c, --config   Path to custom config file
-h, --help     Show help
-v, --version  Show version number
```

**Examples**:

```bash
# Enable debug output
automatosx run assistant "Hello" --debug

# Use custom config
automatosx --config ./custom-config.json status

# Show version
automatosx --version
```

---

## Commands Overview

AutomatosX provides **10 core commands**:

| Command | Purpose | Usage |
|---------|---------|-------|
| [`setup`](#init) | Initialize project | One-time setup |
| [`run`](#run) | Execute agent | Primary command |
| [`agent`](#agent) | Manage agents | Agent operations (v5.0.0+) |
| [`list`](#list) | List resources | Discovery |
| [`memory`](#memory) | Memory operations | Context management |
| [`session`](#session) | Multi-agent sessions | Orchestration (v4.7.0+) |
| [`workspace`](#workspace) | Workspace management | Cleanup & stats (v4.7.0+) |
| [`config`](#config) | Configuration | Setup & management |
| [`status`](#status) | System health | Diagnostics |
| [`update`](#update) | Update AutomatosX | Version management |

---

## `setup`

Set up AutomatosX in a directory.

### Syntax

```bash
automatosx setup [path] [options]
```

### Parameters

- `path` (optional) - Target directory (default: current directory)

### Options

```bash
-f, --force    Force initialization even if .automatosx exists
```

### Behavior

Creates the following structure:

```
project/
├── automatosx.config.json      # Configuration file
└── .automatosx/
    ├── agents/                 # Agent profiles (5 examples)
    │   ├── assistant.yaml
    │   ├── coder.yaml
    │   ├── reviewer.yaml
    │   ├── debugger.yaml
    │   └── writer.yaml
    ├── abilities/              # Abilities (15 examples)
    │   ├── web-search.md
    │   ├── code-analysis.md
    │   └── ...
    ├── memory/                 # Memory database
    │   └── memory.db
    ├── workspaces/             # Agent workspaces
    ├── teams/                  # Team configurations (v4.10.0+)
    └── .gitignore              # Git ignore patterns
```

### Examples

```bash
# Initialize in current directory
automatosx setup

# Initialize in specific directory
automatosx setup ./my-project

# Force reinitialize (overwrites existing)
automatosx setup --force

# Initialize with custom config
automatosx setup --config ./my-config.json
```

### Output

```
🤖 AutomatosX v6.3.8 - Project Setup

📁 Creating directory structure...
   ✓ Directories created
🤖 Installing example agents...
   ✓ 5 example agents installed
⚡ Installing example abilities...
   ✓ 15 example abilities installed
⚙️  Generating configuration...
   ✓ Configuration created
📝 Updating .gitignore...
   ✓ .gitignore updated

✅ AutomatosX initialized successfully!

Next steps:
  1. Review automatosx.config.json
  2. Explore example agents: automatosx list agents
  3. Run an agent: automatosx run assistant "Hello!"

Available example agents:
  • assistant  - General purpose helper
  • coder      - Code generation specialist
  • reviewer   - Code review expert
  • debugger   - Debug assistance
  • writer     - Content creation
```

---

## `run`

Execute an agent with a task.

### Syntax

```bash
automatosx run <agent> <task> [options]
```

### Parameters

- `agent` (required) - Agent name (from `.automatosx/agents/`)
- `task` (required) - Task description or prompt

### Options

```bash
--provider <name>     Override AI provider (claude, gemini, codex)
--model <name>        Override model name
--team <name>         Override team (v4.10.0+)
--session <id>        Join multi-agent session (v4.7.0+)
--memory              Enable memory context (default: from profile)
--no-memory           Disable memory context
--save-memory         Save interaction to memory
--verbose             Show detailed execution info
--format <type>       Output format: text, json, markdown
--save <path>         Save output to file
--timeout <ms>        Execution timeout in milliseconds (default: 1500000)
```

### Examples

```bash
# Basic usage
automatosx run assistant "What is TypeScript?"

# With specific provider
automatosx run coder "Refactor this function" --provider gemini

# With memory disabled
automatosx run assistant "Quick question" --no-memory

# Save output to file
automatosx run coder "Generate user model" --save ./models/user.ts

# JSON output
automatosx run assistant "Explain APIs" --format json

# Verbose mode
automatosx run debugger "Find the bug" --verbose

# With timeout
automatosx run assistant "Long task" --timeout 300
```

### Output

**Text Format** (default):

```
🤖 AutomatosX v6.3.8

Agent: assistant
Task: What is TypeScript?

─────────────────────────────────────

TypeScript is a strongly typed programming language that builds on
JavaScript, giving you better tooling at any scale.

Key features:
- Static type checking
- Enhanced IDE support
- Modern JavaScript features
- Compiles to clean JavaScript

─────────────────────────────────────

✓ Complete (1.2s)
```

**JSON Format**:

```json
{
  "agent": "assistant",
  "task": "What is TypeScript?",
  "response": "TypeScript is a strongly typed...",
  "provider": "claude",
  "command": "claude",
  "duration": 1234,
  "timestamp": "2025-10-06T03:15:00.000Z",
  "memoryUsed": true,
  "memorySaved": true
}
```

---

## `agent`

Manage agents (create, list, show, remove). **v5.0.0+**

### Syntax

```bash
automatosx agent <subcommand> [options]
```

### Subcommands

- `templates` - List available agent templates
- `create` - Create agent from template
- `list` - List all agents
- `show` - Show agent details
- `remove` - Remove agent

### `agent templates`

List available agent templates.

```bash
automatosx agent templates
```

**Output**:
```
Available Agent Templates:

┌───────────────┬────────────┬──────────────────────────┐
│ Template      │ Team       │ Description              │
├───────────────┼────────────┼──────────────────────────┤
│ basic-agent   │ core       │ Minimal agent config     │
│ developer     │ engineering│ Software development     │
│ analyst       │ business   │ Business analysis        │
│ designer      │ design     │ UI/UX design            │
│ qa-specialist │ core       │ Quality assurance       │
└───────────────┴────────────┴──────────────────────────┘
```

### `agent create`

Create a new agent from a template.

**Syntax**:
```bash
automatosx agent create <name> [options]
```

**Options**:
```bash
--template <name>      Template to use (required)
--interactive, -i      Interactive mode with prompts
--display-name <name>  Agent display name
--role <role>          Agent role description
--team <team>          Team assignment (core, engineering, business, design)
--description <desc>   Agent description
--force, -f            Overwrite if exists
```

**Examples**:
```bash
# Interactive mode (guided prompts)
automatosx agent create backend --template developer --interactive

# One-line creation
automatosx agent create backend \
  --template developer \
  --display-name "Bob" \
  --role "Senior Backend Engineer" \
  --team engineering

# Create from basic template
automatosx agent create my-agent --template basic-agent

# Force overwrite existing agent
automatosx agent create backend --template developer --force
```

### `agent list`

List all agents.

**Syntax**:
```bash
automatosx agent list [options]
```

**Options**:
```bash
--by-team <team>    Filter by team (core, engineering, business, design)
--format <format>   Output format: table, json, yaml
```

**Examples**:
```bash
# List all agents
automatosx agent list

# List engineering team agents
automatosx agent list --by-team engineering

# JSON output
automatosx agent list --format json
```

### `agent show`

Show detailed information about an agent.

**Syntax**:
```bash
automatosx agent show <name>
```

**Example**:
```bash
automatosx agent show backend
```

### `agent remove`

Remove an agent.

**Syntax**:
```bash
automatosx agent remove <name> [options]
```

**Options**:
```bash
--force, -f    Skip confirmation prompt
```

**Examples**:
```bash
# With confirmation
automatosx agent remove old-agent

# Skip confirmation
automatosx agent remove old-agent --force
```

---

## `list`

List available resources (agents, abilities, providers).

### Syntax

```bash
automatosx list <type> [options]
```

### Parameters

- `type` (required) - Resource type: `agents`, `abilities`, or `providers`

### Options

```bash
--format <type>    Output format: table, json
--filter <name>    Filter by name pattern
```

### Examples

```bash
# List all agents
automatosx list agents

# List abilities
automatosx list abilities

# List providers
automatosx list providers

# JSON format
automatosx list agents --format json

# Filter by name
automatosx list agents --filter "code*"
```

### Output: List Agents

```
Available Agents (5):

┌─────────────┬──────────────────────────────┬──────────┬─────────┐
│ Name        │ Description                  │ Provider │ Version │
├─────────────┼──────────────────────────────┼──────────┼─────────┤
│ assistant   │ General purpose helper       │ claude   │ 1.0.0   │
│ coder       │ Code generation specialist   │ claude   │ 1.0.0   │
│ reviewer    │ Code review expert           │ claude   │ 1.0.0   │
│ debugger    │ Debug assistance             │ gemini   │ 1.0.0   │
│ writer      │ Content creation             │ claude   │ 1.0.0   │
└─────────────┴──────────────────────────────┴──────────┴─────────┘
```

### Output: List Abilities

```
Available Abilities (15):

┌──────────────────┬────────────────────────────────┐
│ Name             │ Description                    │
├──────────────────┼────────────────────────────────┤
│ web-search       │ Search the web for information │
│ code-analysis    │ Analyze code structure         │
│ file-operations  │ Read/write files               │
│ git-operations   │ Git commands                   │
│ database-query   │ Query databases                │
└──────────────────┴────────────────────────────────┘
```

### Output: List Providers

```
Configured Providers (2):

┌─────────────┬─────────┬──────────┬─────────┬─────────┐
│ Name        │ Enabled │ Priority │ Timeout │ Status  │
├─────────────┼─────────┼──────────┼─────────┼─────────┤
│ claude-code │ ✓       │ 1        │ 120s    │ Healthy │
│ gemini-cli  │ ✓       │ 2        │ 180s    │ Healthy │
└─────────────┴─────────┴──────────┴─────────┴─────────┘
```

---

## `status`

Display system status and health.

### Syntax

```bash
automatosx status [options]
```

### Options

```bash
--format <type>    Output format: table, json
--check-providers  Test provider connectivity
```

### Examples

```bash
# Basic status
automatosx status

# JSON format
automatosx status --format json

# Test providers
automatosx status --check-providers
```

### Output

```
🤖 AutomatosX v6.3.8 - System Status

📊 System Health: ✅ HEALTHY

Configuration:
  Config File: /project/automatosx.config.json
  Status: ✅ Valid

Providers:
  claude-code: ✅ Enabled (Priority 1)
  gemini-cli:  ✅ Enabled (Priority 2)

Memory:
  Database: /project/.automatosx/memory/memory.db
  Entries: 1,234
  Size: 3.2 MB
  Last Cleanup: 2 days ago

Agents:
  Available: 5
  Custom: 0

Performance:
  Startup Time: ~280ms
  Memory Usage: 57MB
  Last Run: 5 minutes ago

Workspace (v5.2+):
  PRD: /project/automatosx/PRD (shared documents)
  Tmp: /project/automatosx/tmp (temporary files)
  Total Size: 12.5 MB

Logs:
  Path: /project/.automatosx/logs
  Latest: app.log (234 KB)
```

---

## `config`

Manage configuration settings.

### Syntax

```bash
automatosx config [options]
```

### Options

```bash
--list                  List all configuration
--get <key>             Get specific config value
--set <key>             Set config value (requires --value)
--value <value>         Value to set (used with --set)
--reset                 Reset to defaults
--export <path>         Export config to file
--import <path>         Import config from file
```

### Examples

```bash
# View all configuration
automatosx config --list

# Get specific value
automatosx config --get providers.claude.enabled

# Set a value
automatosx config --set memory.maxEntries --value 20000

# Enable provider
automatosx config --set providers.gemini.enabled --value true

# Reset to defaults
automatosx config --reset

# Export config
automatosx config --export ./backup-config.json

# Import config
automatosx config --import ./custom-config.json
```

### Output

```bash
$ automatosx config --list

📋 AutomatosX Configuration

Providers:
  claude-code:
    enabled: true
    priority: 1
    timeout: 120000
  gemini-cli:
    enabled: true
    priority: 2
    timeout: 180000

Memory:
  maxEntries: 10000
  persistPath: .automatosx/memory
  autoCleanup: true
  cleanupDays: 30

Workspace (v5.2+):
  prdPath: automatosx/PRD
  tmpPath: automatosx/tmp
  autoCleanupTmp: true
  tmpCleanupDays: 7

Logging:
  level: info
  path: .automatosx/logs
  console: true
```

---

## `memory`

Memory management commands.

### Syntax

```bash
automatosx memory <command> [options]
```

### Subcommands

- `list` - List memory entries
- `search` - Search memories by semantic similarity
- `add` - Add a memory entry
- `delete` - Delete a memory entry
- `clear` - Clear all memories
- `export` - Export memories to file
- `import` - Import memories from file
- `stats` - Show memory statistics

---

### `memory list`

List memory entries.

**Syntax**:

```bash
automatosx memory list [options]
```

**Options**:

```bash
--type <type>       Filter by type (conversation, code, document, task)
--tags <tags>       Filter by tags (comma-separated)
--limit <number>    Max entries to show (default: 50)
--offset <number>   Skip N entries
--sort <field>      Sort by: date, access, relevance
--order <dir>       Sort order: asc, desc
--output <format>   Output format: table, json
```

**Examples**:

```bash
# List recent memories
automatosx memory list

# Filter by type
automatosx memory list --type code

# Filter by tags
automatosx memory list --tags typescript,react

# Limit results
automatosx memory list --limit 10

# JSON output
automatosx memory list --output json
```

---

### `memory search`

Search memories by semantic similarity (requires OpenAI API key).

**Syntax**:

```bash
automatosx memory search <query> [options]
```

**Parameters**:

- `query` (required) - Search query

**Options**:

```bash
--limit <number>       Max results (default: 10)
--threshold <number>   Min similarity score (0.0-1.0, default: 0.7)
--output <format>      Output format: table, json
```

**Examples**:

```bash
# Semantic search
automatosx memory search "How to use TypeScript generics"

# Limit results
automatosx memory search "React hooks" --limit 5

# Set similarity threshold
automatosx memory search "API design" --threshold 0.8

# JSON output
automatosx memory search "debugging" --output json
```

**Output**:

```
🔍 Memory Search Results

Query: "How to use TypeScript generics"

┌────┬────────────┬─────────────────────────────────┬──────────┐
│ ID │ Similarity │ Content                         │ Tags     │
├────┼────────────┼─────────────────────────────────┼──────────┤
│ 42 │ 0.91       │ TypeScript generics allow you   │ ts,code  │
│    │            │ to create reusable components   │          │
│ 18 │ 0.85       │ Generic types in TypeScript...  │ ts,types │
│ 97 │ 0.78       │ Function generics example...    │ ts,func  │
└────┴────────────┴─────────────────────────────────┴──────────┘

Found 3 results in 12ms
```

---

### `memory add`

Add a memory entry.

**Syntax**:

```bash
automatosx memory add <content> [options]
```

**Parameters**:

- `content` (required) - Memory content

**Options**:

```bash
--type <type>     Entry type: conversation, code, document, task, other
--tags <tags>     Comma-separated tags
--source <agent>  Source agent name
```

**Examples**:

```bash
# Add basic memory
automatosx memory add "TypeScript uses structural typing"

# With type and tags
automatosx memory add "React hooks simplify state" \
  --type knowledge \
  --tags react,hooks

# With source
automatosx memory add "Fixed bug in auth" \
  --type task \
  --source debugger
```

---

### `memory delete`

Delete a memory entry.

**Syntax**:

```bash
automatosx memory delete <id> [options]
```

**Parameters**:

- `id` (required) - Entry ID

**Options**:

```bash
-y, --confirm    Skip confirmation prompt
```

**Examples**:

```bash
# Delete with confirmation
automatosx memory delete 42

# Skip confirmation
automatosx memory delete 42 --confirm
```

---

### `memory clear`

Clear all memories.

**Syntax**:

```bash
automatosx memory clear [options]
```

**Options**:

```bash
--all            Clear all entries
--confirm        Skip confirmation
--type <type>    Clear only specific type
--older-than <days>  Clear entries older than N days
```

**Examples**:

```bash
# Clear all (with confirmation)
automatosx memory clear --all

# Clear specific type
automatosx memory clear --type conversation --confirm

# Clear old entries
automatosx memory clear --older-than 30 --confirm
```

---

### `memory export`

Export memories to JSON file.

**Syntax**:

```bash
automatosx memory export <output> [options]
```

**Parameters**:

- `output` (required) - Output file path

**Options**:

```bash
--format <type>     Export format: json, csv
```

**Examples**:

```bash
# Export to JSON
automatosx memory export ./backup.json

# Export to CSV
automatosx memory export ./memories.csv --format csv
```

---

### `memory import`

Import memories from file.

**Syntax**:

```bash
automatosx memory import <input> [options]
```

**Parameters**:

- `input` (required) - Input file path

**Options**:

```bash
--validate           Validate only, don't import
--batch-size <n>     Batch size for import (default: 100)
--skip-duplicates    Skip duplicate entries (default: true)
```

**Examples**:

```bash
# Import from file
automatosx memory import ./backup.json

# Validate first
automatosx memory import ./backup.json --validate

# Import all (including duplicates)
automatosx memory import ./backup.json --skip-duplicates=false
```

---

### `memory stats`

Show memory statistics.

**Syntax**:

```bash
automatosx memory stats [options]
```

**Options**:

```bash
--output <format>   Output format: table, json
```

**Examples**:

```bash
# Show stats
automatosx memory stats

# JSON format
automatosx memory stats --output json
```

**Output**:

```
📊 Memory Statistics

Database:
  Path: .automatosx/memory/memory.db
  Size: 3.2 MB
  Entries: 1,234

Breakdown by Type:
  conversation: 456 (37%)
  code: 321 (26%)
  document: 234 (19%)
  task: 123 (10%)
  other: 100 (8%)

Activity:
  Created Today: 12
  Accessed Today: 45
  Most Accessed: ID 789 (42 times)

Performance:
  Avg Query Time: 0.72ms
  Last Cleanup: 2 days ago
  Next Cleanup: in 28 days
```

---

## `session`

Multi-agent session management. **v4.7.0+**

### Syntax

```bash
automatosx session <subcommand> [options]
```

### Subcommands

- `create` - Create new multi-agent session
- `list` - List all sessions
- `add` - Add agent to session
- `complete` - Mark session as complete
- `show` - Show session details

### `session create`

Create a new multi-agent collaborative session.

**Syntax**:
```bash
automatosx session create <task> <agent> [options]
```

**Parameters**:
- `task` (required) - Session task description
- `agent` (required) - Primary agent name

**Options**:
```bash
--name <name>         Session name (auto-generated if not provided)
--description <desc>  Session description
--timeout <ms>        Session timeout in milliseconds
```

**Examples**:
```bash
# Create session with backend agent
automatosx session create "Build auth API" backend

# With custom name
automatosx session create "Build auth API" backend \
  --name "auth-implementation"

# With timeout
automatosx session create "Complex task" coordinator \
  --timeout 1800000  # 30 minutes
```

### `session list`

List all sessions.

**Syntax**:
```bash
automatosx session list [options]
```

**Options**:
```bash
--status <status>   Filter by status (active, completed, failed)
--format <format>   Output format: table, json
--limit <number>    Limit results
```

### `session add`

Add agent to existing session.

**Syntax**:
```bash
automatosx session add <session-id> <agent>
```

### `session complete`

Mark session as complete.

**Syntax**:
```bash
automatosx session complete <session-id> [options]
```

**Options**:
```bash
--success         Mark as successfully completed (default)
--failed          Mark as failed
--reason <text>   Failure reason (if --failed)
```

---

## `workspace`

Workspace management commands. **v4.7.0+**

### Syntax

```bash
automatosx workspace <subcommand> [options]
```

### Subcommands

- `stats` - Show workspace statistics
- `clean` - Clean up workspace files
- `list` - List agent workspaces

### `workspace stats`

Show workspace statistics.

**Syntax**:
```bash
automatosx workspace stats [options]
```

**Options**:
```bash
--agent <name>    Show stats for specific agent
--format <format> Output format: table, json
```

### `workspace clean`

Clean up workspace files.

**Syntax**:
```bash
automatosx workspace clean [options]
```

**Options**:
```bash
--agent <name>       Clean specific agent workspace
--older-than <days>  Clean files older than N days (default: 7)
--dry-run            Show what would be deleted without deleting
--force              Skip confirmation prompt
```

### `workspace list`

List all agent workspaces.

**Syntax**:
```bash
automatosx workspace list [options]
```

**Options**:
```bash
--format <format> Output format: table, json
--sort <field>    Sort by: name, size, modified
```

---

## `update`

Update AutomatosX to the latest version.

### Syntax

```bash
automatosx update [options]
```

### Options

```bash
--check          Check for updates without installing
--yes, -y        Skip confirmation prompt
--version <ver>  Update to specific version
```

### Examples

```bash
# Check for updates
automatosx update --check

# Update to latest
automatosx update

# Update without confirmation
automatosx update --yes

# Update to specific version
automatosx update --version 5.0.1
```

### Post-Update Steps

After updating, run:

```bash
# Update configuration and templates
ax setup --force

# Verify version
ax --version

# Test with simple command
ax status
```

---

## Exit Codes

All commands use standard exit codes:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Provider error |
| 4 | Memory error |
| 5 | Validation error |

**Example**:

```bash
automatosx run assistant "Hello"
echo $?  # 0 if successful, non-zero if error
```

---

## Environment Variables

Configure AutomatosX via environment variables:

```bash
# Gemini API key (if using Gemini)
export GEMINI_API_KEY="..."

# Debug mode
export AUTOMATOSX_DEBUG=true

# Mock providers (for testing)
export AX_MOCK_PROVIDERS=true

# Custom config path
export AUTOMATOSX_CONFIG_PATH="./custom-config.json"

# Quiet mode
export AUTOMATOSX_QUIET=true
```

---

## Next Steps

- [Quick Start Guide](../getting-started/quick-start.md) - Get started quickly
- [Core Concepts](../getting-started/core-concepts.md) - Understand the basics
- [Configuration Guide](../guides/configuration.md) - Configure AutomatosX
- [Troubleshooting](../troubleshooting/common-issues.md) - Fix common issues

---

**Questions?** [Open an issue](https://github.com/defai-digital/automatosx/issues)
