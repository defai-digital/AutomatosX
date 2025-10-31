# Quick Start Guide

Get started with AutomatosX in under 5 minutes.

---

## What is AutomatosX?

AutomatosX is a **CLI-based AI agent orchestration platform** that allows you to:

- Execute AI agents with a single command
- Manage agent memory and context
- Use multiple AI providers (Claude, Gemini, Codex)
- Build reusable agent profiles and abilities

**Key Point**: AutomatosX works anywhere as a general-purpose CLI tool, and is optimized for integration with Claude Code and other development environments.

---

## Prerequisites

- **Node.js** 20.0.0 or higher installed
- **npm** or **pnpm** package manager
- **Optional**: Claude Code, VS Code, or any terminal environment

**Check Your Node.js Version**:

```bash
node --version
# Should show: v20.0.0 or higher
```

**Windows Users**: Make sure Node.js and npm are in your PATH. If `node --version` doesn't work, reinstall Node.js from [nodejs.org](https://nodejs.org/).

---

## Installation

### Step 1: Install AutomatosX Globally

**All Platforms** (Windows, macOS, Linux):

```bash
npm install -g @defai.digital/automatosx
```

**Verify Installation**:

```bash
ax --version
# Expected output: 5.6.13 (or later)
```

**Windows-Specific Issues**:

If you see `'ax' is not recognized as an internal or external command`:

1. **Check npm global path**:
   ```bash
   npm config get prefix
   # Should show: C:\Users\<username>\AppData\Roaming\npm
   ```

2. **Ensure npm is in PATH**:
   - Open System Properties → Environment Variables
   - Add npm path to your PATH variable
   - Or simply use `npx @defai.digital/automatosx` instead of `ax`

3. **Alternative**: Use npx without installation:
   ```bash
   npx @defai.digital/automatosx --version
   npx @defai.digital/automatosx init
   npx @defai.digital/automatosx list agents
   ```

See [Windows Troubleshooting Guide](../troubleshooting/windows-troubleshooting.md) for more help.

**Update to latest version**:

```bash
# Use built-in update command
ax update

# Or via npm
npm install -g @defai.digital/automatosx@latest
```

### For Developers

If you want to contribute to AutomatosX development:

```bash
# Clone repository
git clone https://github.com/defai-digital/automatosx.git
cd automatosx

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

See [Contributing Guide](../CONTRIBUTING.md) for more details.

---

## Step 2: Initialize Your Project ⚠️ CRITICAL STEP

**Before using AutomatosX, you MUST initialize it in your project directory.**

### Why This Step Is Required

AutomatosX is project-specific. Each project needs its own:
- Agent profiles (24 specialized agents in v5.6.13)
- Memory database (SQLite FTS5)
- Configuration file
- Workspace directories
- Claude Code integration (CLAUDE.md with AutomatosX guidance)

**Without running `ax init`, you will see**:
- "0 agents" when running `ax status`
- "Agent not found" errors
- "System has issues" warnings

### How to Initialize

**Step 2.1**: Navigate to your project directory

```bash
# Windows (Command Prompt)
cd C:\Users\YourName\Projects\my-project

# Windows (PowerShell)
cd C:\Users\YourName\Projects\my-project

# macOS/Linux
cd ~/projects/my-project
```

**Step 2.2**: Run initialization

```bash
# Using ax (if installed globally)
ax init

# Or using npx (works without global install)
npx @defai.digital/automatosx init
```

**If you see "⚠️ AutomatosX is already initialized"**:

This means `.automatosx` folder already exists. If you're still having issues (0 agents, errors), use `--force` to reinitialize:

```bash
# Force reinitialize (overwrites existing files)
ax init --force

# Or with npx
npx @defai.digital/automatosx init --force
```

> **⚠️ Warning**: `--force` will overwrite any custom changes you made to agents or abilities.

**What This Creates**:

```
your-project/
├── .automatosx/
│   ├── agents/           # 24 specialized agents (backend, frontend, security, etc.)
│   ├── abilities/        # 56 shared abilities
│   ├── teams/            # 5 team configurations
│   ├── templates/        # 9 agent templates
│   ├── memory/           # SQLite FTS5 database
│   │   └── exports/      # Memory export directory
│   ├── sessions/         # Multi-agent session data
│   └── logs/             # System logs
├── .claude/
│   ├── commands/         # Slash commands (e.g., /ax-agent)
│   └── mcp/              # MCP server configuration
├── automatosx.config.json  # Project configuration
├── CLAUDE.md             # Claude Code integration guide (NEW in v5.6.14)
└── .gitignore            # Updated with AutomatosX entries
```

### Step 2.3: Verify Initialization

**Check system status**:

```bash
ax status
```

**Expected Output**:

```text
📊 AutomatosX Status

System:
  Version: 5.6.13
  Node: v20.12.2
  Platform: darwin arm64

Resources:
  ✓ agents (24 agents)
  ✓ abilities (56 abilities)
  ✓ teams (5 teams)
  ✓ memory (1 file, 8 KB)

Providers:
  ✓ claude-code: available (priority: 1)
  ✗ gemini-cli: unavailable (priority: 2)
  ✗ openai: unavailable (priority: 3)

Router:
  Health Checks: ✅ Enabled (60s interval)
  Checks Performed: 5
  Success Rate: 100.0%

✅ System is healthy
```

> **Note**: Providers showing "unavailable" is normal if you haven't installed provider CLIs yet. See Step 3 for testing without providers.

**List available agents**:

```bash
ax list agents
```

**Expected Output**: Should show 24 specialized agents including `backend`, `frontend`, `devops`, `security`, `quality`, `data`, `ml-engineer`, `best-practices`, `erp-integration`, `figma`, `iot`, `quantum`, `aerospace`, and more.

### Troubleshooting Initialization

**Still seeing "0 agents"?**

1. **Verify you're in the correct directory**:
   ```bash
   # Check current directory
   pwd          # macOS/Linux
   cd           # Windows (shows current directory)

   # List files
   ls -la       # macOS/Linux
   dir /a       # Windows
   ```
   You should see `.automatosx/` directory and `automatosx.config.json`

2. **Windows: Check directory was created**:
   ```bash
   dir .automatosx\agents
   # Should list 24 YAML files: backend.yaml, frontend.yaml, security.yaml, etc.
   ```

3. **Re-initialize if needed**:
   ```bash
   ax init --force
   # This overwrites existing config with latest defaults
   ```

### Force Reinitialize (Update Existing Installation)

If you want to update agents/abilities to latest templates:

```bash
ax init --force   # Overwrites with latest templates and config
```

⚠️ **Warning**: `--force` will overwrite custom changes to agents/abilities.

---

## Step 3: Run Your First Agent

### Testing Without Provider CLIs (Recommended for First-Time Users)

If you haven't installed provider CLIs (Claude, Gemini, OpenAI) yet, you can test with **mock providers**:

**Windows (Command Prompt)**:
```bash
set AUTOMATOSX_MOCK_PROVIDERS=true
ax run backend "Explain TypeScript in one sentence"
ax list agents
```

**Windows (PowerShell)**:
```powershell
$env:AUTOMATOSX_MOCK_PROVIDERS="true"
ax run backend "Explain TypeScript in one sentence"
ax list agents
```

**macOS/Linux**:
```bash
export AUTOMATOSX_MOCK_PROVIDERS=true
ax run backend "Explain TypeScript in one sentence"
ax list agents
```

**Expected Output**:
```
🤖 AutomatosX v6.3.8

Agent: backend (Bob)
Task: Explain TypeScript in one sentence

─────────────────────────────────────

[Mock Provider Response]
TypeScript is a strongly typed superset of JavaScript...

─────────────────────────────────────

✓ Complete (0.1s)
```

### Using Real Provider CLIs

Once you've verified AutomatosX works, install a provider CLI:

**Claude CLI** (Recommended):
```bash
npm install -g @anthropic-ai/claude-cli
claude --version
```

**Gemini CLI**:
```bash
npm install -g @google/gemini-cli
gemini --version
```

**OpenAI Codex CLI**:
```bash
npm install -g @openai/codex-cli
codex --version
```

Then run agents normally:

```bash
ax run backend "What is TypeScript?"
```

### Create Custom Agents from Templates (v5.0.0+)

Quickly create a custom agent:

```bash
# Interactive creation with prompts
ax agent create my-agent --template developer --interactive

# Or one-line creation
ax agent create my-agent \
  --template developer \
  --display-name "Mike" \
  --role "Backend Engineer" \
  --team engineering

# Run your new agent
ax run my-agent "Help me design an API"
```

**What happens**:

1. AutomatosX loads the `backend` agent profile
2. Sends your prompt to the configured AI provider (Claude, Gemini, etc.)
3. Returns the response
4. Optionally saves the interaction to memory

**Output**:

```
🤖 AutomatosX v6.3.8

Agent: backend
Task: What is TypeScript?

─────────────────────────────────────

TypeScript is a strongly typed programming language that builds on
JavaScript, giving you better tooling at any scale...

─────────────────────────────────────

✓ Complete (1.2s)
```

---

## Explore Available Agents

List all available agents:

```bash
automatosx list agents
```

Example output:

```
Available Agents (5):

┌─────────────┬──────────────────────────┬──────────┐
│ Name        │ Description              │ Provider │
├─────────────┼──────────────────────────┼──────────┤
│ backend     │ Backend development      │ claude   │
│ coder       │ Code generation expert   │ claude   │
│ reviewer    │ Code review specialist   │ claude   │
│ debugger    │ Debug assistance         │ gemini   │
│ writer      │ Content creation         │ claude   │
└─────────────┴──────────────────────────┴──────────┘
```

---

## Basic Commands

### Check Status

```bash
automatosx status
```

Shows:

- Configuration status
- Available providers
- Memory statistics
- System health

### Manage Configuration

```bash
# View all configuration
automatosx config --list

# Set a value
automatosx config --set memory.maxEntries --value 20000

# Get a specific value
automatosx config --get providers.claude.enabled
```

### Memory Management

```bash
# List memories
automatosx memory list

# Search memories
automatosx memory search "TypeScript concepts"

# Add a memory
automatosx memory add "TypeScript is a typed superset of JavaScript" --type knowledge

# Export memories
automatosx memory export ./backup.json

# Import memories
automatosx memory import ./backup.json
```

---

## Using with Claude Code

AutomatosX is designed to work seamlessly inside Claude Code:

### Workflow Example

1. **You ask Claude Code**: "Can you help me understand TypeScript generics?"

2. **Claude Code executes**:

   ```bash
   automatosx run backend "Explain TypeScript generics with examples"
   ```

3. **AutomatosX**:
   - Loads assistant agent profile
   - Sends prompt to AI provider
   - Returns response with examples
   - Saves to memory (if enabled)

4. **Claude Code displays** the result to you

### Why This Design?

- **No Duplication**: Claude Code already provides interactive chat
- **Single Responsibility**: AutomatosX focuses on agent execution
- **Memory Persistence**: Agents remember context across sessions
- **Provider Flexibility**: Use different AI providers for different tasks

---

## Configuration

### Basic Configuration

Edit `automatosx.config.json`:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1,
      "timeout": 1500000,
      "command": "claude"
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2,
      "timeout": 1500000,
      "command": "gemini"
    }
  },
  "memory": {
    "maxEntries": 10000,
    "persistPath": ".automatosx/memory",
    "autoCleanup": true,
    "cleanupDays": 30
  },
  "logging": {
    "level": "info",
    "path": ".automatosx/logs",
    "console": true
  }
}
```

### Provider Setup

AutomatosX calls provider CLI tools directly - **no API keys stored in AutomatosX**.

**Claude Code CLI**:
```bash
# Install (do NOT use sudo)
npm install -g @anthropic-ai/claude-code
# Or: curl -fsSL https://claude.ai/install.sh | bash
# Or: brew install --cask claude-code
# Docs: https://docs.claude.com/en/docs/claude-code/setup

# Authenticate (handled by CLI)
claude login
```

**Gemini CLI**:
```bash
# Install
npm install -g @google/gemini-cli
# Docs: https://github.com/google-gemini/gemini-cli

# Authenticate (handled by CLI)
gemini auth login
```

**Codex CLI (OpenAI)**:
```bash
# Install
npm install -g @openai/codex
# Or: brew install codex
# Docs: https://github.com/openai/codex

# Authenticate (handled by CLI)
codex auth login
```

**Important**: v4.0+ uses CLI tools for authentication. Each CLI manages its own API keys - AutomatosX never stores them.

---

## Next Steps

### Learn Core Concepts

- [Core Concepts](./core-concepts.md) - Understand agents, profiles, and abilities
- [Configuration Guide](./configuration.md) - Deep dive into configuration options

### Tutorials

- [Creating Your First Agent](../tutorials/first-agent.md)
- [Working with Memory](../tutorials/memory-management.md)
- [Custom Abilities](../tutorials/custom-abilities.md)

### Reference

- [CLI Commands](../reference/cli-commands.md) - Complete command reference
- [Configuration Schema](../reference/configuration-schema.md)
- [API Documentation](../reference/api/) - For programmatic usage

### Advanced

- [Memory Management Guide](../tutorials/memory-management.md)
- [Multi-Provider Configuration](../tutorials/advanced-usage.md#multi-provider)
- [Performance Optimization](../tutorials/advanced-usage.md#performance)

---

## Common Questions

**Q: Do I need to install Claude Code separately?**
A: Yes, AutomatosX is designed to run inside Claude Code. It's not a standalone application.

**Q: Can I use AutomatosX outside Claude Code?**
A: Yes, you can use it from any terminal, but it's optimized for Claude Code workflows.

**Q: Why isn't there a `chat` command?**
A: AutomatosX focuses on single-shot agent execution. Claude Code and other tools provide the interactive chat interface.

**Q: How do I update AutomatosX?**
A: Use the built-in command `ax update` or run `npm install -g @defai.digital/automatosx@latest`.

**Q: How do I create a custom agent?**
A: Use `ax agent create <name> --template <template>` to create from templates, or manually create `.automatosx/agents/<name>.yaml`.

**Q: Where is my data stored?**
A: All data is stored in `.automatosx/` directory in your project root. This includes configuration, memory, logs, and workspaces.

---

## Troubleshooting

**Command not found: automatosx**

```bash
# If installed globally
npm install -g @defai.digital/automatosx

# Or use npx
npx @defai.digital/automatosx --version
```

**Provider connection failed**

```bash
# Check provider status
automatosx status

# Test provider manually
claude --version  # for Claude
gemini --version  # for Gemini
```

**Memory search not returning results**

```bash
# Try broader search terms
automatosx memory search "auth"  # instead of specific phrases

# Or use mock provider for testing
export AUTOMATOSX_MOCK_PROVIDERS=true
```

For more help, see [Troubleshooting Guide](../troubleshooting/common-issues.md).

---

## Getting Help

- **Documentation**: [docs.automatosx.dev](https://github.com/defai-digital/automatosx/tree/main/docs) (coming soon)
- **GitHub Issues**: [github.com/defai-digital/automatosx/issues](https://github.com/defai-digital/automatosx/issues)
- **Examples**: Check `.automatosx/agents/` and `.automatosx/abilities/` after running `init`

---

**Ready to build your first agent?** → [Creating Your First Agent](../tutorials/first-agent.md)
