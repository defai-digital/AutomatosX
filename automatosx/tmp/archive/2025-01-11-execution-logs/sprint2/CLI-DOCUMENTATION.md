# AutomatosX v2 CLI Documentation

**Version**: 2.0.0
**Sprint**: Sprint 2
**Last Updated**: 2025-11-08

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Commands](#core-commands)
4. [Memory Commands](#memory-commands)
5. [Configuration Commands](#configuration-commands)
6. [Chaos Testing Commands](#chaos-testing-commands)
7. [Advanced Usage](#advanced-usage)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### From NPM

```bash
npm install -g @defai.digital/automatosx
```

### From Source

```bash
git clone https://github.com/defai-digital/automatosx
cd automatosx
npm install
npm run build
npm link
```

### Verify Installation

```bash
ax --version
# automatosx/2.0.0

ax --help
# Display help information
```

---

## Quick Start

### Run Your First Task

```bash
# Simple task execution
ax run backend "List all API endpoints"

# With streaming output
ax run backend "Implement user authentication" --streaming

# With memory context
ax run backend "Continue authentication work" --use-memory
```

### Search Memory

```bash
# Basic search
ax memory search "authentication"

# Search with filters
ax memory search "API" --agent backend --after 2025-01-01
```

### List Agents

```bash
# List all agents
ax list agents

# List by category
ax list agents --category development

# Show capabilities
ax list agents --capabilities
```

---

## Core Commands

### `ax run`

Execute tasks with AI agents.

**Syntax**:
```bash
ax run <agent> "<task>" [options]
```

**Arguments**:
- `<agent>` - Agent name (backend, frontend, devops, etc.)
- `<task>` - Task description (quoted)

**Options**:
- `--streaming` - Enable real-time streaming output
- `--parallel` - Execute sub-tasks in parallel
- `--resumable` - Enable checkpoint/resume for long tasks
- `--provider <name>` - Specify provider (claude, gemini, openai)
- `--timeout <ms>` - Request timeout in milliseconds
- `--use-memory` - Use memory for context (default: true)
- `--memory-limit <n>` - Maximum memories to retrieve (default: 10)
- `--max-retries <n>` - Maximum retry attempts (default: 3)
- `--verbose` - Enable verbose logging
- `--debug` - Enable debug mode
- `--json` - Output as JSON
- `--quiet` - Suppress non-error output

**Examples**:

```bash
# Basic execution
ax run backend "Implement user login endpoint"

# With streaming and memory
ax run backend "Continue API development" --streaming --use-memory --memory-limit 20

# Parallel execution with retry
ax run product "Build complete auth system" --parallel --max-retries 5

# Specific provider
ax run backend "Analyze code" --provider gemini

# Resumable long task
ax run backend "Refactor entire codebase" --resumable
```

**Exit Codes**:
- `0` - Success
- `1` - General error
- `2` - Validation error
- `3` - Agent not found
- `4` - Provider unavailable

---

### `ax list`

List available agents or resources.

**Syntax**:
```bash
ax list <resource> [options]
```

**Resources**:
- `agents` - List all agents

**Options**:
- `--category <cat>` - Filter by category
- `--enabled` - Show only enabled agents
- `--sort <field>` - Sort by field (name, category)
- `--capabilities` - Show agent capabilities
- `--json` - Output as JSON

**Examples**:

```bash
# List all agents
ax list agents

# Development agents only
ax list agents --category development

# With capabilities
ax list agents --capabilities

# JSON output
ax list agents --json
```

---

### `ax status`

Show system status and health.

**Syntax**:
```bash
ax status [options]
```

**Options**:
- `--memory` - Check memory system health
- `--providers` - Check provider health
- `--agents` - Check agent availability
- `--cache` - Show cache statistics
- `--filesystem` - Check filesystem access
- `--verbose` - Show detailed information
- `--json` - Output as JSON

**Examples**:

```bash
# Full status
ax status

# Provider health only
ax status --providers

# Detailed status
ax status --verbose

# JSON output for monitoring
ax status --json
```

**Output Example**:

```
System Status: ✅ Healthy

Memory System:     ✅ Operational
  Database:        Connected
  Memories:        1,247 entries
  Cache Hit Rate:  67.5%

Providers:         ✅ All Available
  Claude:          ✅ Available (150ms avg)
  Gemini:          ✅ Available (120ms avg)
  OpenAI:          ⚠️  Rate Limited

Agents:            ✅ 15 Available

Filesystem:        ✅ Read/Write OK
```

---

## Memory Commands

### `ax memory search`

Search the memory database.

**Syntax**:
```bash
ax memory search "<query>" [options]
```

**Options**:
- `--agent <name>` - Filter by agent
- `--tags <tags>` - Filter by tags (comma-separated)
- `--after <date>` - Filter after date (YYYY-MM-DD)
- `--before <date>` - Filter before date (YYYY-MM-DD)
- `--limit <n>` - Maximum results (default: 10)
- `--exact-match` - Exact phrase matching
- `--sort <field>` - Sort by (relevance, date)
- `--output <format>` - Output format (text, json, table)

**Examples**:

```bash
# Basic search
ax memory search "authentication"

# Advanced search
ax memory search "API" --agent backend --tags auth,security --after 2025-01-01

# Exact phrase
ax memory search "user authentication system" --exact-match

# JSON output
ax memory search "database" --json --limit 50
```

**Output Example**:

```
📝 Memory Search Results (10 found)

1. [2025-01-15] backend
   JWT implementation for user authentication
   Tags: auth, api, jwt
   Relevance: 0.95

2. [2025-01-14] backend
   User model design with email validation
   Tags: auth, database
   Relevance: 0.87
```

---

### `ax memory export`

Export memory database.

**Syntax**:
```bash
ax memory export <output-file> [options]
```

**Options**:
- `--format <type>` - Export format (json, csv)
- `--agent <name>` - Export specific agent
- `--after <date>` - Export after date

**Examples**:

```bash
# Export all memories
ax memory export backup.json

# Export backend memories
ax memory export backend-memories.json --agent backend

# Export recent memories
ax memory export recent.json --after 2025-01-01
```

---

### `ax memory import`

Import memory database.

**Syntax**:
```bash
ax memory import <input-file> [options]
```

**Options**:
- `--format <type>` - Import format (json, csv)
- `--merge` - Merge with existing (default: replace)

**Examples**:

```bash
# Import and replace
ax memory import backup.json

# Merge with existing
ax memory import new-memories.json --merge
```

---

### `ax memory clear`

Clear memory database.

**Syntax**:
```bash
ax memory clear [options]
```

**Options**:
- `--agent <name>` - Clear specific agent
- `--before <date>` - Clear before date
- `--confirm` - Skip confirmation prompt

**Examples**:

```bash
# Clear all (with confirmation)
ax memory clear

# Clear old memories
ax memory clear --before 2024-01-01 --confirm

# Clear agent memories
ax memory clear --agent backend --confirm
```

---

## Configuration Commands

### `ax config show`

Display configuration.

**Syntax**:
```bash
ax config show [key] [options]
```

**Options**:
- `--category <cat>` - Show category (providers, memory, execution)
- `--sources` - Show config sources
- `--json` - Output as JSON

**Examples**:

```bash
# Show all configuration
ax config show

# Show specific key
ax config show providers.claude.enabled

# Show provider configuration
ax config show --category providers

# Show with sources
ax config show --sources
```

---

### `ax config set`

Set configuration value.

**Syntax**:
```bash
ax config set <key> <value> [options]
```

**Options**:
- `--global` - Set globally
- `--project` - Set for project only

**Examples**:

```bash
# Set provider
ax config set providers.claude.enabled true

# Set timeout
ax config set execution.defaultTimeout 60000

# Global setting
ax config set memory.enabled true --global
```

---

### `ax config reset`

Reset configuration to defaults.

**Syntax**:
```bash
ax config reset [key] [options]
```

**Examples**:

```bash
# Reset all
ax config reset --confirm

# Reset specific key
ax config reset providers.claude
```

---

## Chaos Testing Commands

### `ax chaos enable`

Enable chaos testing mode.

**Syntax**:
```bash
ax chaos enable [options]
```

**Options**:
- `--failure-rate <rate>` - Failure probability (0.0-1.0)
- `--scenarios <list>` - Specific scenarios (comma-separated)
- `--seed <number>` - Random seed for deterministic chaos
- `--min-delay <ms>` - Minimum latency delay
- `--max-delay <ms>` - Maximum latency delay

**Scenarios**:
- `provider-failure` - Provider request failures
- `network-latency` - Network delays
- `timeout` - Operation timeouts
- `memory-corruption` - Memory errors
- `disk-full` - Disk full errors
- `cache-miss` - Forced cache misses
- `slow-query` - Database query delays
- `connection-error` - Connection failures

**Examples**:

```bash
# Enable with default settings
ax chaos enable

# Custom failure rate
ax chaos enable --failure-rate 0.3

# Specific scenarios
ax chaos enable --scenarios provider-failure,network-latency

# Deterministic chaos
ax chaos enable --failure-rate 0.5 --seed 12345
```

---

### `ax chaos disable`

Disable chaos testing mode.

**Syntax**:
```bash
ax chaos disable [options]
```

**Options**:
- `--reset` - Reset chaos statistics

**Examples**:

```bash
# Disable chaos
ax chaos disable

# Disable and reset stats
ax chaos disable --reset
```

---

### `ax chaos status`

Show chaos testing status.

**Syntax**:
```bash
ax chaos status [options]
```

**Options**:
- `--events` - Show event history
- `--stats` - Show statistics (default: true)
- `--json` - Output as JSON

**Examples**:

```bash
# Show status
ax chaos status

# Show events
ax chaos status --events

# JSON output
ax chaos status --json
```

---

### `ax chaos test`

Run chaos resilience tests.

**Syntax**:
```bash
ax chaos test [options]
```

**Options**:
- `--iterations <n>` - Number of test iterations
- `--failure-rate <rate>` - Failure injection rate
- `--scenario <name>` - Test specific scenario
- `--parallel` - Run tests in parallel
- `--timeout <ms>` - Test timeout

**Examples**:

```bash
# Basic test
ax chaos test --iterations 100

# High failure rate
ax chaos test --iterations 50 --failure-rate 0.5

# Specific scenario
ax chaos test --scenario provider-failure --iterations 20
```

---

## Advanced Usage

### Parallel Execution

Execute multiple tasks in parallel:

```bash
# Parallel sub-tasks
ax run product "Build auth system" --parallel

# Multiple commands
ax run backend "Task 1" & ax run frontend "Task 2" &
```

---

### Resumable Tasks

For long-running tasks:

```bash
# Start resumable task
ax run backend "Refactor codebase" --resumable
# Outputs: Run ID: abc-123

# If interrupted, resume
ax resume abc-123
```

---

### Memory-Augmented Tasks

Use past context:

```bash
# Auto-retrieve relevant memories
ax run backend "Continue API work" --use-memory

# Increase memory limit
ax run backend "Complex task" --use-memory --memory-limit 20
```

---

### JSON Output for Automation

```bash
# JSON output for scripting
ax status --json | jq '.memory.cacheHitRate'

# Pipe to monitoring
ax status --json | curl -X POST https://monitoring.example.com/metrics
```

---

### Environment Variables

Override configuration:

```bash
# Set provider
export AUTOMATOSX_PROVIDER=gemini
ax run backend "Task"

# Set database path
export AUTOMATOSX_DATABASE_PATH=~/.automatosx/custom.db
ax memory search "query"

# Debug mode
export AUTOMATOSX_DEBUG=true
ax run backend "Task"
```

---

## Troubleshooting

### Common Issues

#### "Agent not found"

```bash
# List available agents
ax list agents

# Check agent name spelling
ax run backend "task"  # ✓ Correct
ax run Backend "task"  # ✗ Wrong (case-sensitive)
```

---

#### "Provider unavailable"

```bash
# Check provider status
ax status --providers

# Try different provider
ax run backend "task" --provider gemini
```

---

#### "Database locked"

```bash
# Check for other AutomatosX processes
ps aux | grep ax

# Force close stale connections
killall ax
```

---

#### "Out of memory"

```bash
# Clear old memories
ax memory clear --before 2024-01-01 --confirm

# Check cache size
ax status --cache
```

---

### Debug Mode

Enable verbose logging:

```bash
# CLI debug flag
ax run backend "task" --debug

# Environment variable
export AUTOMATOSX_DEBUG=true
ax run backend "task"
```

---

### Performance Tips

1. **Use caching** - Default enabled, 60%+ hit rate typical
2. **Apply filters** - `--agent`, `--tags` narrow memory searches
3. **Batch operations** - Index entire directories at once
4. **Monitor cache** - `ax status --cache` to check hit rate

---

### Getting Help

```bash
# Command help
ax --help
ax run --help
ax memory --help

# Show version
ax --version

# Report issues
# https://github.com/defai-digital/automatosx/issues
```

---

## Appendix

### Agent Categories

| Category | Agents |
|----------|--------|
| Development | backend, frontend, fullstack, mobile |
| Architecture | architecture |
| Infrastructure | devops |
| Quality | quality, security |
| Data | data, data-scientist |
| Creative | design, writer, creative-marketer |
| Leadership | product, cto, ceo |
| Research | researcher, aerospace-scientist, quantum-engineer |

---

### Configuration Keys

| Key | Description | Default |
|-----|-------------|---------|
| `providers.claude.enabled` | Enable Claude provider | `true` |
| `providers.gemini.enabled` | Enable Gemini provider | `true` |
| `memory.enabled` | Enable memory system | `true` |
| `memory.maxEntries` | Maximum memory entries | `10000` |
| `execution.defaultTimeout` | Default timeout (ms) | `1500000` |
| `execution.maxRetries` | Maximum retries | `3` |

---

**Document Version**: 2.0.0
**Sprint**: Sprint 2
**Last Updated**: 2025-11-08
