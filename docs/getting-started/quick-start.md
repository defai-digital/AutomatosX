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

- **Node.js** 24.0.0 or higher installed
- **pnpm** package manager (recommended)
- **Optional**: Claude Code, VS Code, or any terminal environment

**Check Your Node.js Version**:

```bash
node --version
# Should show: v24.0.0 or higher
```

**Windows Users**: See [Windows Setup Guide](../platform/windows/setup.md) for PATH configuration and troubleshooting.

---

## Step 1: Install AutomatosX

### Install (project local, recommended)

```bash
pnpm add -D @defai.digital/automatosx
pnpm ax --version  # Expected: 12.7.x
```

### Alternative: Global install

```bash
npm install -g @defai.digital/automatosx
ax --version
```

### Update to Latest Version

```bash
pnpm up @defai.digital/automatosx
# Or use built-in update
pnpm ax update
```

**Troubleshooting**: If `ax` command not found, ensure your pnpm/npm bin directory is on PATH or use `pnpm ax`.

---

## Step 2: Initialize Your Project

**Navigate to your project directory**:

```bash
cd /path/to/your/project
```

**Set up AutomatosX**:

```bash
ax setup
```

**What this creates**:

```
your-project/
├── .automatosx/
│   ├── agents/           # 20 specialized agents
│   ├── abilities/        # 56 shared abilities
│   ├── teams/            # 5 team configurations
│   ├── templates/        # 9 agent templates
│   └── memory/           # SQLite FTS5 database
├── ax.config.json  # Project configuration
├── AGENTS.md             # AI assistant integration (universal standard)
├── CLAUDE.md             # Claude Code integration guide
├── GEMINI.md             # Gemini CLI integration guide
└── .gitignore            # Updated with AutomatosX entries
```

**Verify initialization**:

```bash
ax status
```

**Expected output**:

```
📊 AutomatosX Status

System:
  Version: 12.7.x
  Node: v24.0.0
  Platform: darwin arm64

Resources:
  ✓ agents (examples)
  ✓ abilities (examples)
  ✓ teams (examples)
  ✓ memory (1 file)

Providers:
  ✓ claude-code: available (priority: 1)
  ✗ gemini-cli: unavailable (priority: 2)
  ✗ openai: unavailable (priority: 3)

✅ System is healthy
```

> **Note**: Providers showing "unavailable" is normal if you haven't installed provider CLIs yet. Continue to Step 3 to test with mock providers.

**Troubleshooting**:
- **"0 agents"**: Run `ax setup --force` to reinitialize
- **Permission errors**: Don't use `sudo`, check file permissions
- **Already initialized**: Use `--force` flag to update templates

---

## Step 3: Run Your First Agent

### Quick Test (Mock Provider)

Test AutomatosX without installing provider CLIs:

```bash
# Set mock provider mode
export AX_MOCK_PROVIDERS=true  # macOS/Linux
# Or: set AX_MOCK_PROVIDERS=true  # Windows CMD
# Or: $env:AX_MOCK_PROVIDERS="true"  # Windows PowerShell

# Run your first agent
ax run backend "Explain TypeScript in one sentence"
```

**Expected output**:

```
🤖 AutomatosX v12.7.x

Agent: backend (Bob)
Task: Explain TypeScript in one sentence

─────────────────────────────────────

[Mock Provider Response]
TypeScript is a strongly typed superset of JavaScript...

─────────────────────────────────────

✓ Complete (0.1s)
```

### With Real Provider (Recommended)

Once you've verified AutomatosX works, install a provider CLI for real responses.

**Quick Provider Setup**:

```bash
# Claude CLI (recommended for quality)
npm install -g @anthropic-ai/claude-code
claude login

# Gemini CLI (recommended for cost-aware runs)
curl -fsSL https://gemini.google.com/install.sh | sh
gemini login

# OpenAI CLI
npm install -g @openai/openai
openai auth login
```

Then run normally:

```bash
ax run backend "What is TypeScript?"
```

**See [Configuration Guide](./configuration.md)** for detailed provider setup, cost optimization, and multi-provider configuration.

---

## Step 4: Explore Features

### List Available Agents

```bash
ax list agents
```

**Available agents**: backend, frontend, fullstack, mobile, devops, security, quality, product, data, writer, and more (examples bundled in `examples/agents/`).

### Search Conversation History

AutomatosX remembers all your conversations:

```bash
# Search past conversations
ax memory search "authentication"

# List recent memories
ax memory list --limit 10
```

### Create Custom Agents

```bash
# Interactive creation
ax agent create my-agent --template developer --interactive

# Quick creation
ax agent create my-agent \
  --template developer \
  --display-name "Mike" \
  --role "Backend Engineer"
```

### View Configuration

```bash
# View all configuration
ax config show

# Get specific value
ax config get providers.claude-code.priority

# List providers
ax providers list
```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `ax setup` | Set up AutomatosX in project |
| `ax run <agent> "task"` | Execute agent task |
| `ax list agents` | List all available agents |
| `ax memory search "keyword"` | Search conversation history |
| `ax status` | Check system status |
| `ax config show` | View configuration |
| `ax --debug run <agent> "task"` | Run with debug logging |
| `ax update` | Update to latest version |

**Complete command reference**: [CLI Commands](../reference/cli-commands.md)

---

## Using with AI Assistants

### Universal Standard (AGENTS.md)

AutomatosX follows the [AGENTS.md open standard](https://agents.md) for cross-tool compatibility. The `AGENTS.md` file works with all AI coding assistants:

- Codex CLI, Cursor, Cline, Aider
- Windsurf, Codeium, GitHub Copilot
- Any AI assistant with terminal access

See [AGENTS.md](../../AGENTS.md) for the universal integration guide.

### Platform-Specific Guides

For platform-specific features and optimizations:

#### Claude Code

AutomatosX integrates seamlessly with Claude Code. See [AX-GUIDE.md](../../AX-GUIDE.md#claude-code) for:

- Natural language patterns
- Multi-step workflows
- Best practices

Or use the brief [CLAUDE.md](../../CLAUDE.md) integration guide.

#### Gemini CLI

Use slash command syntax with Gemini. See [AX-GUIDE.md](../../AX-GUIDE.md#gemini-cli) for:

- Slash command syntax
- Custom Gemini commands
- Integration setup

Or use the brief [GEMINI.md](../../GEMINI.md) integration guide.

#### Other AI Assistants

Any AI assistant with terminal access can use AutomatosX. See [AX-GUIDE.md](../../AX-GUIDE.md#other-assistants) for:

- Generic bash command patterns
- Codex CLI integration
- Integration examples

---

## Next Steps

### Learn Core Concepts

- **[Core Concepts](./core-concepts.md)** - Understand agents, profiles, and abilities
- **[Configuration Guide](./configuration.md)** - Provider setup, cost optimization, advanced config
- **[Agent Communication & Memory](../guides/agent-communication.md)** - How agents remember and collaborate

### Hands-On Tutorials

- **[Creating Your First Agent](../tutorials/first-agent.md)** - Build a custom agent from scratch
- **[Memory Management](../tutorials/memory-management.md)** - Master the memory system
- **[Multi-Agent Orchestration](../guides/multi-agent-orchestration.md)** - Coordinate multiple agents

### Platform-Specific Guides

- **[Gemini Integration](../providers/gemini.md)** - Configure Gemini as a cost-aware provider
- **[Provider Comparison](../providers/overview.md)** - Compare Claude, Gemini, OpenAI
- **[Team Configuration](../guides/team-configuration.md)** - Organize agents into teams

### Reference Documentation

- **[CLI Commands Reference](../reference/cli-commands.md)** - Complete command documentation
- **[Agent Templates](./agent-templates.md)** - Pre-built agent templates
- **[Best Practices](../../advanced/best-practices.md)** - Production-ready patterns

---

## Troubleshooting

### Command not found: ax

**Solution**:
```bash
# Verify installation
npm list -g @defai.digital/automatosx

# Check npm global path
npm config get prefix

# Use npx as alternative
npx @defai.digital/automatosx --version
```

**Windows**: See [Windows Setup Guide](../platform/windows/setup.md) for PATH configuration.

### "0 agents" after setup

**Solution**:
```bash
# Verify you're in the correct directory
pwd  # macOS/Linux
cd   # Windows

# Check if .automatosx exists
ls -la .automatosx/  # macOS/Linux
dir .automatosx\     # Windows

# Reinitialize if needed
ax setup --force
```

### Provider connection failed

**Solution**:
```bash
# Check provider status
ax providers list
ax providers test --provider claude-code

# Test provider CLI directly
claude --version
gemini --version
codex --version

# Use mock provider for testing
export AX_MOCK_PROVIDERS=true
ax run backend "test"
```

### Out of memory / Slow searches

**Solution**:
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory statistics
ax cache stats

# Export backup before clearing
ax memory export > backup.json
```

**More help**: See [Troubleshooting Guide](../troubleshooting/common-issues.md) for comprehensive solutions.

---

## Common Questions

**Q: Do I need to install Claude Code separately?**
A: No, AutomatosX is a standalone CLI tool. It works inside Claude Code, VS Code, or any terminal.

**Q: Can I use AutomatosX without provider CLIs?**
A: Yes, use `AX_MOCK_PROVIDERS=true` for testing. For real responses, install at least one provider CLI.

**Q: Which provider should I use?**
A: Set provider priorities based on your goals: Gemini CLI for cost-aware runs, Claude Code for quality, OpenAI for speed/control. See [Provider Comparison](../providers/overview.md).

**Q: How do I update AutomatosX?**
A: Run `ax update` or `npm install -g @defai.digital/automatosx@latest`.

**Q: Where is my data stored?**
A: All data is stored in `.automatosx/` directory in your project root. Configuration: `ax.config.json`. Memory: `.automatosx/memory/`. 100% local, no external API calls for memory operations.

**Q: How do I create a custom agent?**
A: Use `ax agent create <name> --template <template>` for quick creation. See [Creating Your First Agent](../tutorials/first-agent.md) tutorial.

**Q: Can I use multiple providers?**
A: Yes! AutomatosX supports automatic fallback and priority-based routing. See [Configuration Guide](./configuration.md#multi-provider-fallback).

---

## Getting Help

- **Documentation**: [docs/](../../docs/)
- **GitHub Issues**: [github.com/defai-digital/automatosx/issues](https://github.com/defai-digital/automatosx/issues)
- **Examples**: Check `.automatosx/` after running `setup`
- **Support**: File issues on GitHub

---

**Ready to build?** → Start with [Creating Your First Agent](../tutorials/first-agent.md) tutorial!
