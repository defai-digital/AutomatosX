# @ax/cli

Command-line interface for AutomatosX.

## Installation

```bash
# Global installation
pnpm add -g @ax/cli

# Or use with npx
npx @ax/cli <command>
```

## Commands

### Setup

Initialize AutomatosX in your project:

```bash
ax setup              # Initialize in current directory
ax setup --force      # Reinitialize (overwrites existing)
ax setup --json       # JSON output
```

Creates:
- `.automatosx/` - Agent definitions, memory, sessions
- `ax.config.json` - Configuration file

### Run

Execute tasks with agents:

```bash
ax run <agent> "task description"

# Examples
ax run backend "Create a REST API for users"
ax run frontend "Build a login form with React"
ax run quality "Write tests for the auth module"

# Options
ax run backend "task" --timeout 300000   # Custom timeout (ms)
ax run backend "task" --json             # JSON output
ax run backend "task" --stream           # Stream output
```

If the agent is not found, the CLI will:
1. Suggest similar agent names (typo correction)
2. Auto-select best agent based on task keywords

### Agent

Manage agents:

```bash
ax agent list                    # List all agents
ax agent list --format json      # JSON output
ax agent list --format simple    # Names only
ax agent list --team development # Filter by team

ax agent info <name>             # Detailed agent info
ax agent info backend --json     # JSON output
```

### Memory

Manage persistent memory:

```bash
# Search
ax memory search "authentication"
ax memory search "API design" --limit 20

# List recent
ax memory list
ax memory list --limit 50

# Statistics
ax memory stats

# Export/Import
ax memory export > backup.json
ax memory import backup.json
ax memory import backup.json --merge  # Merge with existing

# Clear
ax memory clear --agent backend --force
ax memory clear --before "2024-01-01" --force
ax memory clear --all --force
```

### Provider

Manage AI providers:

```bash
ax provider list                 # List configured providers
ax provider status               # Health status of all providers
ax provider test claude          # Test specific provider
```

### Session

Manage sessions:

```bash
ax session list                  # List all sessions
ax session list --state active   # Filter by state
ax session list --agent backend  # Filter by agent

ax session info <id>             # Session details
ax session create --agent product --task "Design feature"
```

### System

System diagnostics and configuration:

```bash
ax status                        # Overall system status
ax config show                   # Display configuration
ax config get providers.default  # Get specific value
ax doctor                        # Run diagnostics
ax doctor --fix                  # Auto-fix issues
```

## Global Options

```bash
ax --help                        # Show help
ax --version                     # Show version
ax --debug <command>             # Enable debug output
ax --quiet <command>             # Minimal output
```

## Configuration

Configuration is read from `ax.config.json`:

```json
{
  "providers": {
    "default": "claude",
    "fallbackOrder": ["claude", "gemini", "openai"]
  },
  "execution": {
    "timeout": 1500000,
    "retry": { "maxAttempts": 3 }
  },
  "memory": {
    "maxEntries": 10000,
    "autoCleanup": true
  },
  "agents": {
    "defaultAgent": "standard",
    "enableAutoSelection": true
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |

## License

Apache-2.0
