# Troubleshooting Guide

This guide helps you resolve common issues when using AutomatosX.

## Table of Contents

- [Installation Issues](#installation-issues)
  - [Updating AutomatosX to Latest Version](#updating-automatosx-to-latest-version)
  - [Error: Node version not supported](#error-node-version-not-supported)
  - [Error: SQLite compilation fails](#error-sqlite-compilation-fails)
  - [Error: Permission denied during global install](#error-permission-denied-during-global-install)
- [Configuration Problems](#configuration-problems)
  - [Initializing or Reinitializing AutomatosX](#initializing-or-reinitializing-automatosx)
    - [First Time Setup](#first-time-setup)
    - [Force Reinitialization (IMPORTANT)](#force-reinitialization-important)
  - [Error: Config file not found](#error-config-file-not-found)
  - [Error: Provider CLI not authenticated](#error-provider-cli-not-authenticated)
  - [Config priority not working as expected](#config-priority-not-working-as-expected)
- [Memory System Issues](#memory-system-issues)
  - [Database locked error](#database-locked-error)
  - [Memory search returns no results](#memory-search-returns-no-results)
  - [Memory export/import fails](#memory-exportimport-fails)
- [Provider Issues](#provider-issues)
  - [Claude API errors](#claude-api-errors)
  - [Gemini API errors](#gemini-api-errors)
  - [Provider selection not working](#provider-selection-not-working)
  - [Codex CLI requires git initialization](#openai-codex-requires-git-initialization)
- [Agent Execution Problems](#agent-execution-problems)
  - [Agent not found](#agent-not-found)
  - [Ability files not loaded](#ability-files-not-loaded)
  - [Agent execution timeout](#agent-execution-timeout)
  - [Path resolution errors](#path-resolution-errors)
- [Performance Issues](#performance-issues)
  - [Slow startup time](#slow-startup-time)
  - [High memory usage](#high-memory-usage)
  - [Memory search is slow](#memory-search-is-slow)
- [Error Messages](#error-messages)
  - [`ENOENT: no such file or directory`](#enoent-no-such-file-or-directory)
  - [`SQLITE_CANTOPEN: unable to open database file`](#sqlite_cantopen-unable-to-open-database-file)
  - [`SyntaxError: Unexpected token`](#syntaxerror-unexpected-token)
  - [`Error: Cannot find module`](#error-cannot-find-module)
  - [`Delegation cycle detected: agent -> agent -> agent`](#delegation-cycle-detected-agent---agent---agent)
  - [`fts5: syntax error near "."`](#fts5-syntax-error-near-)
- [Quick Reference](#quick-reference)
  - [Most Common Solutions](#most-common-solutions)
  - [Upgrade Checklist](#upgrade-checklist)
- [Platform-Specific Issues](#platform-specific-issues)
  - [Windows](#windows)
- [Getting More Help](#getting-more-help)

---

## Installation Issues

### Updating AutomatosX to Latest Version

**Recommended**: Use the built-in `ax update` command

```bash
# Check for updates and install latest version
ax update

# Or using full command name
automatosx update

# Check for updates without installing
ax update --check

# Update without confirmation prompt
ax update --yes
```

**Alternative**: Manual update via npm

```bash
# Update to latest version
npm install -g @defai.digital/automatosx@latest

# Update to specific version
npm install -g @defai.digital/automatosx@5.0.1

# Verify installation
ax --version
```

**What the update command does**:
1. Checks current installed version
2. Fetches latest version from npm registry
3. Shows changelog and what's new
4. Prompts for confirmation (unless `--yes` flag used)
5. Installs the update automatically

### Error: Node version not supported

**Symptom**: Installation fails with error about Node.js version

**Solution**:

```bash
# Check your Node version
node --version

# AutomatosX requires Node.js 24 or higher
# Install Node 24+ using nvm (recommended)
nvm install 24
nvm use 24

# Or use n
npm install -g n
n 24
```

### Error: SQLite compilation fails

**Symptom**: `better-sqlite3` or `sqlite-vec` fails to compile

**Solution**:

```bash
# On macOS
xcode-select --install

# On Ubuntu/Debian
sudo apt-get install build-essential python3

# On Windows
# Install windows-build-tools
npm install --global windows-build-tools

# Try clean install
rm -rf node_modules package-lock.json
npm install
```

### Error: Permission denied during global install

**Symptom**: `EACCES: permission denied` when running `npm install -g`

**Solution**:

```bash
# Option 1: Use npx (recommended)
npx automatosx --help

# Option 2: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then install again
npm install -g automatosx
```

---

## Configuration Problems

### Initializing or Reinitializing AutomatosX

#### First Time Setup

```bash
# Initialize in current directory
ax init

# Initialize in specific directory
ax init /path/to/project
```

#### Force Reinitialization (IMPORTANT)

**Use `--force` flag when you need to:**
- Update to new template structure (v5.0+)
- Fix broken or missing configuration files
- Reinstall example agents and abilities
- Reset to default configuration

```bash
# Force reinitialize (overwrites existing files)
ax init --force

# Or using short flag
ax init -f

# Force init in specific directory
ax init /path/to/project --force
```

**⚠️ Important**: By default, `ax init` will NOT overwrite existing files or folders if `.automatosx/` already exists. This prevents accidental data loss. **Use `--force` flag to overwrite.**

**What `ax init --force` does**:
1. ✅ Creates/overwrites `.automatosx/` directory structure
2. ✅ Installs/updates 5 example agents
3. ✅ Installs/updates 15 example abilities
4. ✅ Installs/updates 5 agent templates (v5.0+)
5. ✅ Creates/updates `ax.config.json`
6. ✅ Sets up Claude Code integration (`.claude/` directory)
7. ✅ Updates `.gitignore` with AutomatosX entries

**Common scenarios requiring `--force`**:

```bash
# After upgrading to v5.0+ (to get new templates)
npm install -g @defai.digital/automatosx@latest
ax init --force

# When .automatosx directory is corrupted
ax init --force

# To reset all example files to defaults
ax init --force
```

### Error: Config file not found

**Symptom**: `Configuration file not found`

**Solution**:

```bash
# Initialize configuration in your project
automatosx init

# Or force reinitialize if already exists
automatosx init --force

# Or manually create config
mkdir -p .automatosx
cat > .automatosx/config.json << EOF
{
  "$schema": "https://raw.githubusercontent.com/defai-digital/automatosx/main/schema/config.json",
  "version": "4.0.0",
  "providers": {
    "claude": {
      "apiKey": "sk-ant-..."
    }
  }
}
EOF
```

### Error: Provider CLI not authenticated

**Symptom**: `Authentication required` or `401 Unauthorized`

**Solution**: AutomatosX v4.0+ uses CLI tools for authentication. Each CLI manages its own credentials.

```bash
# Claude CLI authentication
claude auth login

# Gemini CLI authentication
gemini auth login

# Codex CLI authentication
codex auth login

# Verify authentication
claude --version
gemini --version
codex --version
```

### Config priority not working as expected

**Issue**: Config from wrong location is being used

**Explanation**: AutomatosX loads config in this priority order:

1. `.automatosx/config.json` (project-specific)
2. `ax.config.json` (project root)
3. `~/.automatosx/config.json` (user global)

**Solution**:

```bash
# Check which config file is being used
automatosx config

# Use --config flag to specify exact file
automatosx run backend "hello" --config /path/to/config.json
```

---

## Memory System Issues

### Database locked error

**Symptom**: `Error: database is locked`

**Solution**:

```bash
# Check for other AutomatosX processes
ps aux | grep automatosx

# Kill hanging processes
pkill -f automatosx

# If problem persists, backup and recreate database
cp .automatosx/memory.db .automatosx/memory.db.backup
rm .automatosx/memory.db
automatosx memory list  # Will recreate database
```

### Memory search returns no results

**Symptom**: Memory search returns empty results despite having data

**Solution**: AutomatosX uses FTS5 full-text search (no embeddings).

```bash
# Check if memories exist
automatosx memory list

# Check database exists
ls -lh .automatosx/memory/memories.db

# Try broader search terms
automatosx memory search "auth"  # Instead of "authentication API"

# Rebuild if corrupted
automatosx memory export --output backup.json
rm -rf .automatosx/memory/
automatosx memory import --input backup.json
```

### Memory export/import fails

**Symptom**: Export or import command fails with validation errors

**Solution**:

```bash
# Export with validation disabled (not recommended)
automatosx memory export --output backup.json --no-validate

# Check export file format
cat backup.json | jq '.[0]'
# Should have: content, timestamp, metadata, embedding

# Import with validation to see specific errors
automatosx memory import --input backup.json --validate
```

---

## Provider Issues

### Claude API errors

**Error**: `overloaded_error` or `rate_limit_error`

**Solution**:

```bash
# Wait and retry (AutomatosX has built-in retry logic)
# Or reduce request rate by adjusting config

automatosx config --set providers.claude.maxRetries --value 5
automatosx config --set providers.claude.retryDelay --value 2000
```

**Error**: `context_length_exceeded`

**Solution**:

```bash
# Use a model with larger context window
automatosx config --set providers.claude.model --value claude-3-opus-20240229

# Or reduce input size
# - Truncate long files
# - Summarize previous conversation history
# - Use fewer examples in prompts
```

### Gemini API errors

#### Free Tier Not Working

**Symptom**: Gemini always shows paid usage, never uses free tier

**Causes**:
1. Free tier quota already exhausted
2. Gemini CLI not authenticated
3. Free tier tracking disabled

**Solution**:

```bash
# Check authentication
gemini whoami

# Check free tier status
ax free-tier status

# Expected output:
# Daily Requests:  342 / 1,500 (23%)
# Daily Tokens:    256,789 / 1,000,000 (26%)
# Status: ✅ Healthy

# If exhausted, wait for midnight UTC reset
# Or enable fallback providers:
# Edit ax.config.json:
{
  "providers": {
    "gemini-cli": { "priority": 1 },
    "openai": { "priority": 2 }  // Fallback when free tier exhausted
  }
}

# Check tracking is enabled
cat ax.config.json | grep -A3 "limitTracking"
# Should show: "enabled": true, "window": "daily"
```

#### Error: `RESOURCE_EXHAUSTED`

**Cause**: Free tier limit reached (1,500 requests/day or 1M tokens/day)

**Solution**:

```bash
# Check current usage
ax free-tier status

# View usage history
ax free-tier history --days 7

# Options:
# 1. Wait for midnight UTC reset (automatic)
# 2. Enable fallback providers (automatic with multi-provider setup)
# 3. Upgrade to paid tier (10K requests/day, 10M tokens/day)

# Check when quota resets
ax free-tier status | grep "Resets in"
```

#### Error: "Authentication failed"

**Cause**: Gemini CLI not authenticated or credentials expired

**Solution**:

```bash
# Check authentication status
gemini whoami

# If not authenticated:
gemini login

# Follow the browser authentication flow
# Then verify:
ax providers test --provider gemini-cli
# Should show: ✓ gemini-cli: Available
```

#### Error: "Model not available"

**Cause**: Gemini CLI selecting unavailable model

**Solution**:

```bash
# Update Gemini CLI to latest version
gemini update

# Or reinstall:
brew upgrade gemini-cli  # macOS
apt upgrade gemini-cli   # Ubuntu

# Verify version
gemini --version
# Verify gemini is installed
```

#### Streaming Not Working

**Symptom**: Responses come all at once, not streamed

**Causes**:
1. Feature flag not enabled
2. Client doesn't support streaming

**Solution**:

```bash
# Check feature flag status
ax flags list
# Should show: gemini_streaming: 100% rollout

# If not 100%, increase rollout:
ax flags rollout gemini_streaming 100

# Verify streaming in provider info
ax providers info gemini-cli
# Features section should show: Streaming: ✓

# Test streaming
ax run backend "create hello world" --verbose
# Watch for incremental output
```

#### Parameter Warnings: "temperature not supported"

**Symptom**: Warning messages about unsupported parameters

**Cause**: Gemini CLI doesn't support `maxTokens`, `temperature`, `topP` parameters

**This is expected behavior**: Gemini CLI limitation ([Issue #5280](https://github.com/google-gemini/gemini-cli/issues/5280))

**Solution** (if you need parameter control):

```yaml
# Option 1: Use OpenAI for agents requiring parameters
# .automatosx/agents/qa-specialist.yaml
name: qa-specialist
provider:
  primary: openai  # Supports temperature=0 for determinism
  defaults:
    temperature: 0

# Option 2: Use role/prompt instead of parameters
# .automatosx/agents/qa-specialist.yaml
name: qa-specialist
role: Deterministic QA Specialist
systemPrompt: |
  Provide consistent, reproducible test results.
  Follow the same patterns every time.
provider:
  primary: gemini-cli  # Cost-effective, use prompt for determinism
```

#### Provider Not Being Used

**Symptom**: Policy set to `cost` but Gemini never selected

**Causes**:
1. Gemini CLI not installed
2. Provider disabled in config
3. Circuit breaker tripped (too many failures)

**Solution**:

```bash
# Check provider status
ax providers list
# Should show: ✅ gemini-cli (Priority: 1)

# If not available:
ax providers test --provider gemini-cli

# If test fails:
# 1. Check installation: gemini --version
# 2. Check authentication: gemini whoami
# 3. Check config: cat ax.config.json | grep -A5 "gemini-cli"

# View routing trace to debug
ax providers trace --follow
# Run a command in another terminal:
ax run backend "test"
# Check trace for why Gemini wasn't selected
```

See also: [Gemini Integration Guide](docs/guide/gemini-integration.md) for detailed troubleshooting

### Provider selection not working

**Symptom**: Wrong provider is being used

**Solution**:

```bash
# Check provider configuration
automatosx config --list | grep -A 20 "Providers"

# Set preferred provider
automatosx config --set providers.preferred --value claude

# Or specify provider in command
automatosx run backend "hello" --provider claude
```

### Codex CLI requires git initialization

**Symptom**: Codex provider fails with error or doesn't work as expected

**Cause**: Codex CLI CLI requires the project to be a git repository to function properly.

**Solution**:

```bash
# Check if current directory is a git repository
git status

# If not initialized, initialize git:
git init

# Configure git user (if not already configured)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Verify codex now works
ax run backend "Hello" --provider codex

# Or test with codex directly
codex --version
```

**Important Notes**:

- This is a requirement from the Codex CLI CLI, not AutomatosX
- The project must have `.git/` directory for codex to work
- You don't need to commit any files, just `git init` is sufficient
- Other providers (Claude, Gemini) do not have this requirement

**Alternative Solution** (if you can't use git):

```bash
# Use a different provider that doesn't require git
ax run backend "Hello" --provider claude
ax run backend "Hello" --provider gemini

# Or change your team's default provider
# Edit .automatosx/teams/<team-name>.yaml
provider:
  primary: claude  # Change from codex to claude
  fallbackChain: [claude, gemini, codex]
```

---

## Agent Execution Problems

### Agent not found

**Symptom**: `Agent profile not found: <name>`

**Solution**:

```bash
# List available agents
automatosx list agents

# Check agent paths configuration
automatosx config --get paths.agents

# Verify agent profile exists
ls -la .automatosx/agents/
ls -la ~/.automatosx/agents/

# Agent profile should be: <name>.yaml
cat .automatosx/agents/backend.yaml
```

### Ability files not loaded

**Symptom**: Agent cannot find abilities

**Solution**:

```bash
# List available abilities
automatosx list abilities

# Check abilities path
automatosx config --get paths.abilities

# Verify ability files exist (should be .md files)
ls -la .automatosx/abilities/
```

### Agent execution timeout

**Symptom**: `Error: Request timeout after 300000ms` or `Provider codex execution failed`

**Root Cause**: Provider timeout may be shorter than agent timeout.

**Solution**:

```bash
# Set all provider timeouts to 25 minutes (1500000ms)
automatosx config set providers.claude-code.timeout 1500000
automatosx config set providers.gemini-cli.timeout 1500000
automatosx config set providers.openai.timeout 1500000

# Verify the changes
automatosx config show | grep -A2 "timeout"
# All provider timeouts should show 1500000
```

#### 📝 For very long-running tasks (45+ minutes)

```bash
# Increase both agent and provider timeouts
automatosx config set execution.defaultTimeout 2700000  # 45 minutes
automatosx config set providers.claude-code.timeout 2700000
automatosx config set providers.gemini-cli.timeout 2700000
automatosx config set providers.openai.timeout 2700000
```

**Verification**:

```bash
# Run a complex task to test
automatosx run backend "Perform comprehensive code review"
# Should no longer timeout prematurely
```

### Path resolution errors

**Symptom**: `Path outside project boundary` or `Invalid path`

**Solution**:

```bash
# AutomatosX prevents path traversal for security
# Paths must be within project directory

# Check your project root
automatosx status

# Use absolute paths within project
automatosx run backend "analyze /full/path/to/project/src/file.ts"

# Not allowed:
automatosx run backend "analyze ../../etc/passwd"  # ❌ Path traversal
```

---

## Performance Issues

### Slow startup time

**Issue**: CLI takes long to start

**Solution**:

```bash
# Enable lazy loading (should be default)
automatosx config --set performance.lazyLoad --value true

# Warm cache for faster subsequent runs
automatosx status  # This warms the cache

# Check if cache is working
automatosx config --get performance.cache.enabled
```

### High memory usage

**Issue**: AutomatosX uses too much RAM

**Solution**:

```bash
# Reduce cache size
automatosx config --set performance.cache.maxSize --value 50

# Reduce memory entries limit
automatosx config --set memory.maxEntries --value 5000

# Clear old memories
automatosx memory list
# Delete old or unneeded memories manually
```

### Memory search is slow

**Issue**: Memory search takes too long (should be < 1ms with FTS5)

**Solution**:

```bash
# Check database size
ls -lh .automatosx/memory/memories.db

# Optimize database
sqlite3 .automatosx/memory/memories.db "VACUUM; ANALYZE;"

# Reduce search results
automatosx memory search "query" --limit 10  # Default is 50

# Clean old memories (v4.11.0+: pure FTS5 is very fast)
automatosx memory export --output backup.json
# Edit backup.json to remove old entries
rm -rf .automatosx/memory/
automatosx memory import --input backup.json
```

---

## Error Messages

### `ENOENT: no such file or directory`

**Cause**: Missing configuration or agent files

**Solution**: See [Agent not found](#agent-not-found) or [Config file not found](#error-config-file-not-found)

### `SQLITE_CANTOPEN: unable to open database file`

**Cause**: Insufficient permissions or missing directory

**Solution**:

```bash
# Check directory permissions
ls -la .automatosx

# Create directory with correct permissions
mkdir -p .automatosx
chmod 755 .automatosx

# Recreate database
rm .automatosx/memory.db
automatosx memory list
```

### `SyntaxError: Unexpected token`

**Cause**: Invalid JSON in config file

**Solution**:

```bash
# Validate JSON syntax
cat .automatosx/config.json | jq .

# If invalid, reset to defaults
automatosx config --reset
```

### `Error: Cannot find module`

**Cause**: Dependencies not installed properly

**Solution**:

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# For global installation
npm uninstall -g automatosx
npm install -g automatosx

# Or use npx
npx automatosx --help
```

### `Delegation cycle detected: agent -> agent -> agent`

**Symptom**: Error message showing delegation cycles like `quality -> frontend -> frontend`

**Cause**: Delegation parser may incorrectly parse documentation examples as actual delegation requests.

**Solution**: Avoid including delegation syntax examples in your agent instructions or system prompts. The parser automatically filters:

- Quoted examples: `"@frontend Create UI"`
- Documentation markers: "Example:", "Supported syntaxes:"
- Numbered lists: `1. "...", 2. "..."`
- Circular delegation cycles

### `fts5: syntax error near "."`

**Symptom**: Memory search fails with `Search failed: fts5: syntax error near "."` or similar errors for special characters

**Cause**: FTS5 search may have issues with special characters.

**Solution**: Remove special characters from your search queries:

```bash
# Instead of: "config.json settings"
automatosx memory search "config json settings"

# Instead of: "timeout (300ms)"
automatosx memory search "timeout 300ms"
```

---

## Quick Reference

### Most Common Solutions

1. **Update to latest version**: `ax update`
2. **Force reinitialize**: `ax init --force`
3. **Check system status**: `ax status`
4. **Enable debug mode**: `ax run <agent> "<task>" --debug`
5. **Verify configuration**: `ax config show`

### Upgrade Checklist

```bash
# 1. Update to latest version
ax update

# 2. Force reinitialize to get updated templates
ax init --force

# 3. Verify version
ax --version

# 4. Test with a simple command
ax run backend "Hello"
```

---

## Platform-Specific Issues

### Windows

If you're experiencing issues on Windows 10/11:

- **[Windows Quick Fix Guide](docs/troubleshooting/windows-quick-fix.md)** - Quick solutions for common Windows problems
  - Initialization issues (0 agents, 0 providers)
  - Mock provider testing
  - Expected vs actual results

- **[Windows Troubleshooting Guide](docs/troubleshooting/windows-troubleshooting.md)** - Comprehensive Windows troubleshooting
  - Path separator problems
  - PowerShell execution policy
  - npm global installation path
  - Long path issues
  - File permission issues
  - Provider CLI configuration
  - Full diagnostic commands

---

## Getting More Help

If your issue is not covered here:

1. **Check Documentation**:
   - [README.md](./README.md) - Getting started guide
   - [FAQ.md](./FAQ.md) - Frequently asked questions
   - [API Documentation](./docs/) - Detailed API reference

2. **Search Issues**: Check [GitHub Issues](https://github.com/defai-digital/automatosx/issues)

3. **Enable Debug Logging**:

   ```bash
   automatosx run backend "hello" --debug
   ```

4. **Get System Info**:

   ```bash
   automatosx status
   node --version
   npm --version
   ```

5. **Report a Bug**: [Create an issue](https://github.com/defai-digital/automatosx/issues/new)
   - Include debug output
   - Include system info
   - Describe steps to reproduce

6. **Get Help**:
   - GitHub Issues: [Report bugs, ask questions, or request features](https://github.com/defai-digital/automatosx/issues)
     - 🐛 Bug reports
     - ✨ Feature requests (use "enhancement" label)
     - ❓ Questions
