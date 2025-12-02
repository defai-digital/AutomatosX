# Frequently Asked Questions (FAQ)

Note: This FAQ applies to AutomatosX v9.2.0 (last updated 2025-11-22). For detailed release notes, see [GitHub Releases](https://github.com/defai-digital/automatosx/releases).

## Contents
- [General Questions](#general-questions)
  - [What AI providers are supported?](#what-ai-providers-are-supported)
  - [What happens if OpenAI or Gemini is not installed?](#what-happens-if-openai-or-gemini-is-not-installed)
  - [Does AutomatosX require Claude Code? Can Gemini or Codex CLI be the primary?](#does-automatosx-require-claude-code-can-gemini-or-openai-codex-be-the-primary)
  - [Do I need to run AutomatosX inside the Claude/Gemini/Codex CLI?](#do-i-need-to-run-automatosx-inside-the-claudegeminicodex-cli)
  - [Can I run AutomatosX with a fully offline model?](#can-i-run-automatosx-with-a-fully-offline-model)
- [Installation & Setup](#installation--setup)
  - [I'm on Windows and AutomatosX is not working](#im-on-windows-and-automatosx-is-not-working)
  - [What are the system requirements?](#what-are-the-system-requirements)
  - [How do I install AutomatosX?](#how-do-i-install-automatosx)
  - [How do I set up authentication?](#how-do-i-set-up-authentication)
  - [Can I use AutomatosX without any provider CLIs?](#can-i-use-automatosx-without-any-provider-clis)
- [Configuration](#configuration)
- [Agents & Abilities](#agents--abilities)
- [Memory System](#memory-system)
  - [Do I need any API for memory search?](#do-i-need-any-api-for-memory-search)
  - [Why don’t you use a vector database or Graphiti in the open-source edition?](#why-dont-you-use-a-vector-database-or-graphiti-in-the-open-source-edition)
- [Performance](#performance)
- [Development & Contributing](#development--contributing)
- [Security & Privacy](#security--privacy)
- [Licensing & Usage](#licensing--usage)

## General Questions

### What is AutomatosX?

AutomatosX is an AI agent orchestration platform that allows you to create, configure, and run AI agents with different capabilities and behaviors. It supports multiple AI providers (Claude, Gemini, Codex) with intelligent fallback, and features a powerful memory system with SQLite FTS5 full-text search.

<!-- Version-specific release notes removed to keep FAQ focused. See GitHub Releases for details. -->

### Can I migrate from older major versions?

Major version upgrades may include breaking changes (database schema, configuration format, directory structure). The recommended approach is to set up a fresh project and reconfigure agents/teams. For specifics, refer to the Migration notes in [GitHub Releases](https://github.com/defai-digital/automatosx/releases).

### What AI providers are supported?

AutomatosX supports multiple AI providers through their official CLI tools:

- **Claude** (via `claude` CLI): Latest Sonnet and other Claude models
- **Gemini** (via `gemini` CLI): gemini-1.5-pro, gemini-1.5-flash, and newer models
- **OpenAI** (via `codex` CLI): GPT-4, GPT-3.5, and other OpenAI models

**How it works**: AutomatosX calls your installed CLI commands (`claude`, `gemini`, `codex`). Each CLI uses its own authentication and automatically updates to the latest models.

You can use multiple providers simultaneously with automatic fallback.

### Can I run AutomatosX with a fully offline model?

Short answer: Not yet in the open-source edition. AutomatosX Community relies on provider CLIs (Claude, Gemini, OpenAI) which require internet access.

- Today (Community): The memory system is fully local, but model inference is done via cloud provider CLIs. Mock mode (`AX_MOCK_PROVIDERS=true`) is available for testing, but it does not run a real model.
- AutomatosX Pro: DEFAI offers offline model support (local inference) in the Pro edition.
- Roadmap: We plan to release offline provider support to open source in v6.0.

Considerations for offline inference:
- Hardware: Adequate CPU/GPU and RAM/VRAM for chosen models.
- Storage: Model checkpoints can be large (multi‑GB).
- Licensing: Ensure local models’ licenses permit your use case.

### What happens if OpenAI or Gemini is not installed?

As long as at least one provider CLI is installed and enabled (e.g., Claude/`claude`), AutomatosX will still run. The system automatically falls back to any available provider based on this priority:

- CLI override (`--provider`) → Team provider (with `fallbackChain`) → Agent provider (deprecated) → Global Router priority

If all configured providers are missing or disabled, execution fails with an error indicating that no providers are available.

Check availability and health:

```bash
ax status           # Shows available providers and priorities
ax run <agent> "task" --provider claude-code   # Force a specific provider
```

Notes:
- Mock mode (`AX_MOCK_PROVIDERS=true`) returns mock responses but does not bypass provider availability checks. If no CLI is installed, providers remain unavailable.
- Team-level `fallbackChain` (e.g., `openai → gemini-cli → claude`) ensures robust failover when the primary CLI is missing or unhealthy.

### How do I enable/disable providers?

Edit `ax.config.json` and toggle the `enabled` flag under `providers`:

```json
{
  "providers": {
    "openai": { "enabled": true },
    "gemini-cli": { "enabled": false },
    "claude-code": { "enabled": true }
  }
}
```

Troubleshooting checklist:
- Ensure the CLI is installed and in `PATH` (`claude --version`, `gemini --version`, `codex --version`).
- Verify the provider is `enabled` in `ax.config.json`.
- Use `--provider` to override selection temporarily.

### Does AutomatosX require Claude Code? Can Gemini or Codex CLI be the primary?

No. AutomatosX is provider-agnostic. Any supported provider can be primary. Set it at the team level (recommended) or override per command:

```yaml
# .automatosx/teams/engineering.yaml (Gemini as primary)
provider:
  primary: gemini-cli
  fallbackChain: [gemini-cli, openai, claude]

# .automatosx/teams/core.yaml (OpenAI as primary)
provider:
  primary: openai
  fallbackChain: [openai, gemini-cli, claude]
```

Per-command override:
```bash
ax run backend "implement API" --provider gemini-cli
ax run writer  "draft ADR"   --provider openai
```

Note: In the open-source edition, Claude Code is currently the most mature option and often recommended as default. We plan deeper first-class integration for Gemini and Codex in v6+.

### Do I need to run AutomatosX inside the Claude/Gemini/Codex CLI?

No. AutomatosX is a standalone CLI (`ax`) that orchestrates agents and invokes provider CLIs under the hood. You typically run:

```bash
ax run <agent> "your task"            # AutomatosX orchestrates
ax run <agent> "task" --provider openai
```

You can run provider CLIs by themselves (e.g., `gemini "prompt"`, `codex exec "prompt"`, `claude -p "prompt" --print`), but doing so bypasses AutomatosX features such as stages, abilities injection, memory, delegation, and sessions.

Roadmap: VS Code extension targeted for v5.5; deeper Gemini/Codex integration in v6+.

### How much does it cost to use?

AutomatosX itself is **free and open-source** (Apache-2.0 license).

**Pricing model**:
- You pay only for what you use via your existing CLI subscriptions
- No API keys stored in AutomatosX
- No additional subscription fees
- **10× more cost-effective** than expensive assistant APIs

**Provider costs** (pay directly to provider):
- **Claude**: ~$3-15 per 1M tokens (varies by model)
- **Gemini**: Free tier available, paid tier ~$0.35-7 per 1M tokens
- **OpenAI**: ~$0.02-0.06 per 1M tokens (via Codex CLI)

Actual costs depend on your usage patterns and chosen models.

## Installation & Setup

### I'm on Windows and AutomatosX is not working

See the [Windows Quick Fix Guide](docs/troubleshooting/windows-quick-fix.md) for common Windows issues and quick solutions.

For comprehensive Windows troubleshooting, see the [Windows Troubleshooting Guide](docs/troubleshooting/windows-troubleshooting.md).

### What are the system requirements?

- **Node.js**: 24.0.0 or higher
- **OS**: macOS, Linux, or Windows
- **Memory**: 512MB RAM minimum, 2GB recommended
- **Disk**: 100MB for installation

### How do I install AutomatosX?

```bash
# Step 1: Install AutomatosX CLI
npm install -g @defai.digital/automatosx

# Step 2: Install at least one provider CLI
# Option A: Claude Code CLI
npm install -g @anthropic-ai/claude-code
# Or: curl -fsSL https://claude.ai/install.sh | bash
# Or: brew install --cask claude-code

# Option B: Gemini CLI
npm install -g @google/gemini-cli

# Option C: Codex CLI (OpenAI)
npm install -g @openai/codex
# Or: brew install codex
# Docs: https://github.com/openai/codex

# Step 3: Verify installation
ax --version
```

**Alternative (no installation)**:
```bash
npx @defai.digital/automatosx --help
```

### How do I set up authentication?

AutomatosX uses CLI tools, which handle authentication separately:

```bash
# Each CLI has its own auth setup:

# Claude CLI
claude auth login
# Follow the prompts to authenticate

# Gemini CLI
gemini auth login
# Follow the prompts to authenticate

# Codex CLI (requires git repository)
codex auth login
# Follow the prompts to authenticate
# ⚠️ Important: Codex requires your project to have git initialized
# Run 'git init' if not already a git repository
```

**No API keys needed in AutomatosX** - the CLI tools handle all authentication!

If you used API keys directly before, follow each provider’s CLI authentication guide instead.

### Can I use AutomatosX without any provider CLIs?

No, you need at least one provider CLI installed and authenticated:

- **Recommended**: Install `claude` CLI (most capable)
- **Free option**: Gemini CLI offers generous free tier
- **For testing**: Use mock providers (`AX_MOCK_PROVIDERS=true`)

**Important**: Codex CLI CLI requires your project to be a git repository (`git init`). Other providers don't have this requirement.

```bash
# Test without real providers
export AX_MOCK_PROVIDERS=true
ax run backend "Hello"
```

## Configuration

### Where should I put my config file?

AutomatosX looks for config in this order:

1. `.automatosx/config.json` (project-specific) ⭐ **Recommended**
2. `ax.config.json` (project root)
3. `~/.automatosx/config.json` (user global)

Create project-specific config:

```bash
automatosx init
```

### How do I change the default provider?

Configure at team level:

```bash
# Edit team configuration
# .automatosx/teams/engineering.yaml
provider:
  primary: codex
  fallbackChain: [codex, gemini, claude]
```

**Per-command override**:

```bash
# Specify provider for single command
ax run backend "hello" --provider gemini

# Provider selection priority:
# 1. CLI option (--provider)
# 2. Team config
# 3. Agent config (deprecated)
# 4. Router fallback
```

### Can I have different configs for different projects?

Yes! Each project can have its own `.automatosx/config.json`:

```bash
cd project-a
automatosx init  # Creates .automatosx/config.json

cd ../project-b
automatosx init  # Creates separate .automatosx/config.json
```

### How do I reset configuration to defaults?

```bash
automatosx config --reset
```

## Agents & Abilities

### What are agent templates?

**Agent templates** are pre-configured agent blueprints that let you create new agents in seconds instead of writing YAML from scratch.

**5 Built-in Templates**:
- `basic-agent` - Minimal configuration (core team)
- `developer` - Software development (engineering team)
- `analyst` - Business analysis (business team)
- `designer` - UI/UX design (design team)
- `qa-specialist` - Quality assurance (core team)

**Quick Start**:
```bash
# Interactive creation (guided prompts)
ax agent create my-agent --template developer --interactive

# One-line creation
ax agent create backend --template developer \
  --display-name "Bob" \
  --role "Backend Engineer" \
  --team engineering
```

**Benefits**:
- ✅ 10-20x faster than manual creation
- ✅ Consistent structure and best practices
- ✅ Auto-assigned to appropriate teams
- ✅ Beginner-friendly with interactive mode

See [Agent Templates Guide](docs/guide/agent-templates.md) for details.

### What is team-based configuration?

**Team-based configuration** organizes agents into teams with shared settings, eliminating configuration duplication.

**4 Built-in Teams**:
- **core** - QA specialists (primary: claude)
- **engineering** - Software development (primary: codex)
- **business** - Product & planning (primary: gemini)
- **design** - Design & content (primary: gemini)

**Example**:
```yaml
# Agent inherits provider + shared abilities from team
name: backend
team: engineering        # Inherits codex provider + team abilities
role: Backend Engineer
abilities:
  - backend-development  # Agent-specific abilities
```

**Benefits**:
- ✅ No provider configuration duplication
- ✅ Change provider for entire team at once
- ✅ Shared abilities automatically included
- ✅ Clear organizational structure

See [Team Configuration Guide](docs/guide/team-configuration.md) for details.

### What's the difference between agents and abilities?

- **Agents**: High-level personas with goals and behaviors (YAML files)
- **Abilities**: Specific skills or tools agents can use (Markdown files)

Example:

```yaml
# Agent: .automatosx/agents/researcher.yaml
name: researcher
description: Research and analysis specialist
abilities:
  - web_search    # Ability
  - summarize     # Ability
  - code_analysis # Ability
```

### How do I update my agents to use teams?

**Migration Steps**:

1. **Identify common configurations** across your agents
2. **Choose appropriate team** (core, engineering, business, design)
3. **Update agent profile**:

```yaml
# Before
name: backend
provider: codex
temperature: 0.7
abilities:
  - code-generation
  - backend-development

# After
name: backend
team: engineering       # Add this line
abilities:
  - backend-development # Remove duplicated abilities
```

4. **Test the agent**:
```bash
ax agent show backend  # Verify team assignment
ax run backend "test"  # Test execution
```

Team abilities (like `code-generation`) are automatically inherited.

### How do I create a custom agent?

**Recommended**: Use agent templates:

```bash
# Interactive mode - guided creation
ax agent create my-agent --template developer --interactive

# One-line creation
ax agent create my-agent \
  --template developer \
  --display-name "Mike" \
  --role "Senior Backend Engineer" \
  --team engineering

# List available templates
ax agent templates

# Available templates: developer, analyst, designer, qa-specialist, basic-agent
```

**Manual creation (advanced)**:

```bash
# 1. Create agent profile (team-based config)
cat > .automatosx/agents/my-agent.yaml << EOF
name: my-agent
team: engineering              # Inherits provider from team
displayName: "Mike"
description: My custom agent
abilities:
  - search
  - code_analysis
systemPrompt: |
  You are a helpful assistant specialized in...
EOF

# 2. Test agent
ax run my-agent "Hello, introduce yourself"
# Or use display name: ax run Mike "..."
```

See [examples/agents/](./examples/agents/) for more examples.

### How do I create custom abilities?

```bash
# Create ability file
cat > .automatosx/abilities/my-ability.md << EOF
# My Ability

Description of what this ability does.

## Usage
\`\`\`
Example usage instructions
\`\`\`

## Examples
Concrete examples of using this ability
EOF
```

Abilities are referenced in agent profiles and injected into prompts.

### Can agents access my files?

Yes, but with security restrictions (v5.2+):

- **Read access**: Validated paths within your project directory
- **Write access**: Only to `automatosx/PRD/` and `automatosx/tmp/` (with path validation)
- **Prevented**: Path traversal attacks (`../../etc/passwd`), absolute paths, empty paths

This ensures agents can read your code but only write to controlled workspace directories.

## Memory System

### How does the memory system work?

AutomatosX uses pure SQLite FTS5 full-text search:

- **Storage**: `.automatosx/memory/memories.db`
- **Search**: FTS5 full-text search (< 1ms average)
- **No embeddings**: Removed OpenAI embedding dependency
- **Cost**: Zero - all local, no API calls
- **Privacy**: All data stays on your machine

Memories persist across sessions and can be searched instantly.

### How do I search memories?

```bash
# Full-text search
ax memory search "how to implement authentication"

# List all memories
ax memory list

# Limit results
ax memory search "query" --limit 10

# Special characters are automatically handled
ax memory search "config.json settings"  # Works!
ax memory search "coverage: 95%"         # Works!
ax memory search "timeout (300ms)"       # Works!
```

### Can I export/import memories?

```bash
# Export to JSON
ax memory export --output backup.json

# Import from JSON
ax memory import --input backup.json

# Clear all memories
ax memory clear
```

### How do I clear old memories?

```bash
# Clear all memories
ax memory clear

# Backup before clearing
ax memory export --output backup.json
ax memory clear

# Delete database manually (advanced)
rm -rf .automatosx/memory/
# Will be recreated on next use
```

### Do I need any API for memory search?

**No!**

- Memory search uses **pure SQLite FTS5** (local, no API calls)
- No embedding costs
- No external dependencies
- All data stays on your machine
- Blazing fast (< 1ms average)

External embedding APIs are not required.

### Why don’t you use a vector database or Graphiti in the open-source edition?

Short answer: cost-effectiveness, simplicity, and zero‑config. We previously used Milvus Lite; while semantic search is powerful, it introduces embedding costs, extra services, and operational complexity. For most AutomatosX Community use cases, SQLite FTS5 delivers excellent local performance at zero cost and with no background services.

- Cost & complexity: Vector search requires embeddings (paid) and heavier infra. Open-source users often value “install and go” with no fees.
- Offline/local-first: FTS5 works fully offline with minimal footprint and great speed.
- Scope fit: Most tasks benefit from fast keyword/context recall rather than full semantic retrieval.

When is Graphiti (graph DB) more suitable for OSS users?
- You need first-class relationship queries (e.g., delegation chains, cross‑artifact lineage, decision→rationale→outputs).
- You want path/graph analytics (impact analysis, neighborhoods, cycle checks beyond our built-in safeguards).
- You curate a knowledge graph (entities/relations) that must power reasoning or advanced navigation.

Pro vs. Community
- AutomatosX Pro: We justify vector DB + graph DB for advanced recall and reasoning at scale.
- Community (open source): Default remains SQLite FTS5 to keep zero‑config, zero‑cost, and portability.

Roadmap
- Before v6: Stay on SQLite FTS5 (Community default).
- v6+: Release offline LLM support with optional vector DB + graph DB backends.
- v7+: Release advanced knowledge management tooling (graph/semantic curation, richer retrieval/reranking).

## Performance

### Why is startup slow?

First run loads dependencies and initializes the database. Subsequent runs should be faster due to:

- Lazy loading (on-demand module loading)
- Filesystem caching
- Pre-warmed configurations

To warm the cache:

```bash
automatosx status
```

### How can I improve performance?

```bash
# Enable all performance optimizations
automatosx config --set performance.lazyLoad --value true
automatosx config --set performance.cache.enabled --value true

# Reduce memory limit if experiencing high RAM usage
automatosx config --set memory.maxEntries --value 5000

# Use faster models
automatosx config --set providers.claude.model --value claude-3-haiku-20240307
```

### Is there a rate limit?

AutomatosX itself has no rate limits, but AI providers do:

- **Claude**: 50 requests/min (tier 1), higher for paid tiers
- **Gemini**: 60 requests/min (free), higher for paid
- **OpenAI**: Varies by tier

AutomatosX has built-in retry logic with exponential backoff.

## Troubleshooting

### Tests are failing during installation

```bash
# Tests require mock providers
export AX_MOCK_PROVIDERS=true
npm test
```

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more solutions.

### `Error: database is locked`

Another AutomatosX process is using the database:

```bash
# Find and kill processes
ps aux | grep automatosx
pkill -f automatosx
```

### Configuration not being applied

Check which config file is being used:

```bash
automatosx config  # Shows config path
```

Ensure you're editing the right file based on priority order.

### Agent tasks timeout with "Request timeout after 300000ms"

**Problem**: Complex agent tasks fail with timeout errors even though the default agent timeout is longer.

**Cause**: Provider timeout is shorter than agent timeout, causing the provider to timeout first.

**Solution**: Update to the latest version, or manually update your config:

```bash
# Check your current version
automatosx --version

# Manually ensure provider timeouts are aligned with agent timeout:
automatosx config set providers.claude-code.timeout 1500000
automatosx config set providers.gemini-cli.timeout 1500000
automatosx config set providers.openai.timeout 1500000

# Or update to the latest version:
npm install -g @defai.digital/automatosx@latest
```

**Verify the fix**:
```bash
# Check provider timeout settings
automatosx config show | grep -A2 "timeout"
# Should show 1500000 (25 minutes) for all providers
```

### Agents delegate to wrong agents or delegation cycles occur

**Problem**: Agents incorrectly parse documentation examples as actual delegation requests, causing unwanted delegation cycles.

**Example Error**:
```
[ERROR] Delegation cycle detected: quality -> frontend -> frontend
[INFO] Parsed 6 delegation(s)  # Should be 0
```

**Cause**: Delegation parser was too aggressive and parsed quoted examples or numbered lists as real delegations.

**Solution**: Update to the latest version which includes improved delegation parsing and agent governance:

```bash
npm install -g @defai.digital/automatosx@latest
```

**Verification**:
```bash
# Test delegation parsing with documentation
ax run coordinator "Explain delegation syntax with examples"
# Should not trigger any false delegations
```

### FTS5 search fails with "syntax error near" message

**Problem**: Memory search fails with errors like `fts5: syntax error near "."` when query contains special characters.

**Cause**: FTS5 search used to not sanitize special characters properly in older builds.

**Solution**: Update to the latest version which includes enhanced FTS5 sanitization:

```bash
npm install -g @defai.digital/automatosx@latest
```

**Workaround (if can't update)**:
```bash
# Avoid special characters in memory searches
# Instead of: "config.json settings"
# Use: "config json settings"
```

### AutomatosX not working after upgrading from an older version

If you're experiencing errors or unexpected behavior after upgrading, it may be due to:

- **Old agent profiles** (YAML format or schema changes)
- **Outdated configuration** (incompatible settings from previous versions)
- **Old database format** (migration required)

**Solution**: Reinitialize your AutomatosX setup with the force flag:

```bash
# Force reinitialize (overwrites existing configuration)
ax init -f

# This will:
# - Create fresh .automatosx/ directory structure
# - Generate updated agent profiles
# - Create new SQLite database
# - Reset configuration to defaults
```

**⚠️ Warning**: This will overwrite existing configuration. If you have custom agents or abilities, back them up first:

```bash
# Backup custom files before reinitializing
cp -r .automatosx/agents ./backup-agents
cp -r .automatosx/abilities ./backup-abilities
cp .automatosx/config.json ./backup-config.json

# Reinitialize
ax init -f

# Restore custom agents/abilities if needed
cp ./backup-agents/* .automatosx/agents/
cp ./backup-abilities/* .automatosx/abilities/
```

### Memory search returns no results

Verify memories exist:

```bash
ax memory list

# If empty, try storing a memory first
ax run backend "Remember: Project Alpha launches Q1 2025"

# Then search
ax memory search "when does Alpha launch"
```

Note: AutomatosX uses FTS5 text search (no embedding API needed).

## Development & Contributing

### How do I contribute to AutomatosX?

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

Quick start:

```bash
git clone https://github.com/defai-digital/automatosx.git
cd automatosx
npm install
npm test
```

### How do I run tests?

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage

# Specific test
npm test memory-manager
```

### Where is the documentation?

- **README.md**: Quick start and overview
- **[GitHub Releases](https://github.com/defai-digital/automatosx/releases)**: Version history and release notes
- **FAQ.md**: This file
- **TROUBLESHOOTING.md**: Problem solving guide
- **API docs**: In `docs/` directory
- **Examples**: In `examples/` directory

### How do I report a bug?

1. Check [existing issues](https://github.com/defai-digital/automatosx/issues)
2. Create a [new issue](https://github.com/defai-digital/automatosx/issues/new)
3. Include:
   - AutomatosX version (`automatosx --version`)
   - Node version (`node --version`)
   - Steps to reproduce
   - Error messages with `--debug` flag

## Security & Privacy

### Is my data safe?

AutomatosX:

- Stores data locally in `.automatosx/` directory
- Only sends data to AI providers you configure
- Never sends data to third parties
- Uses path validation to prevent unauthorized file access

### Can agents access sensitive files?

No. AutomatosX implements security boundaries:

- Agents can only read files within project directory
- Path traversal attacks are prevented
- Agent writes are isolated to workspace directories

### Should I commit `.automatosx/` to git?

**No, add to .gitignore**:

```bash
echo ".automatosx/" >> .gitignore
```

The `.automatosx/` directory contains:

- Local database
- Conversation history
- Agent workspaces
- Session data

Note: API keys are not stored by AutomatosX (provider CLIs handle auth separately)

**Do commit**: Example agent profiles and abilities in `examples/` directory if you want to share them.

## Licensing & Usage

### What license does AutomatosX use?

Apache License 2.0 - free for commercial and personal use.

### Can I use AutomatosX commercially?

Yes! Apache 2.0 license allows commercial use with no restrictions.

### Do I need to credit AutomatosX?

Not required, but appreciated! You can mention:

```
Powered by AutomatosX (https://github.com/defai-digital/automatosx)
```

---

## Still Have Questions?

- **GitHub Issues**: [Report bugs, ask questions, or request features](https://github.com/defai-digital/automatosx/issues)
  - 🐛 Bug reports: Use the bug report template
  - ✨ Feature requests/Wishlist: Use the "enhancement" label
  - ❓ Questions: Use the "question" label
- **Email**: <support@defai.digital> for private inquiries
