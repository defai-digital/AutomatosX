# ax-cli Configuration Directory

**Version**: v9.1.0+
**Purpose**: Configuration for ax-cli (Enterprise-Class AI CLI)

---

## Overview

This directory contains configuration and custom instructions for **ax-cli**, the multi-provider AI CLI used by AutomatosX.

**Key Files:**
- `settings.json` - ax-cli configuration (API keys, models, preferences)
- `CUSTOM.md` - Custom instructions for AI assistants
- `index.json` - File analysis cache index

---

## Quick Start

### 1. Using ax-cli via AutomatosX

```bash
# Interactive mode (uses default provider: GLM)
ax cli

# With specific model
ax cli --model glm-4.6

# With different provider
ax cli --provider xai --model grok-2
ax cli --provider openai --model gpt-4
ax cli --provider anthropic --model claude-3-5-sonnet

# Direct prompt (non-interactive)
ax cli "Design a REST API"
```

### 2. Configuration Options

**Via Command-Line Flags:**
```bash
ax cli --provider glm \
       --model glm-4.6 \
       --api-key your-key \
       --base-url https://custom-endpoint \
       --directory /path/to/project \
       --max-tool-rounds 400
```

**Via Environment Variables:**
```bash
export YOUR_API_KEY="your-api-key"
export AI_PROVIDER="glm"
export AI_MODEL="glm-4.6"
export AI_BASE_URL="https://custom-endpoint"

ax cli
```

**Via Configuration File** (`settings.json`):
```json
{
  "provider": "glm",
  "model": "glm-4.6",
  "apiKey": "your-api-key",
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "maxToolRounds": 400
}
```

---

## Supported Providers

### 1. GLM (Z.AI) - Default

**Models:** `glm-4.6`, `glm-4-plus`

```bash
# Using GLM (default)
ax cli --model glm-4.6

# With API key
export YOUR_API_KEY="your-glm-key"
ax cli
```

**Base URL**: `https://api.z.ai/api/coding/paas/v4`

### 2. xAI (Grok)

**Models:** `grok-2`, `grok-3-fast`, `grok-code-fast-1`

```bash
# Using xAI Grok
ax cli --provider xai --model grok-2

# With API key
export YOUR_API_KEY="xai-your-key"
ax cli --provider xai
```

**Base URL**: `https://api.x.ai/v1`

### 3. OpenAI

**Models:** `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`

```bash
# Using OpenAI
ax cli --provider openai --model gpt-4

# With API key
export YOUR_API_KEY="sk-your-openai-key"
ax cli --provider openai
```

**Base URL**: `https://api.openai.com/v1`

### 4. Anthropic (Claude)

**Models:** `claude-3-5-sonnet`, `claude-3-opus`, `claude-3-haiku`

```bash
# Using Anthropic Claude
ax cli --provider anthropic --model claude-3-5-sonnet

# With API key
export YOUR_API_KEY="sk-ant-your-key"
ax cli --provider anthropic
```

**Base URL**: `https://api.anthropic.com`

### 5. Ollama (Local)

**Models:** Any Ollama model (e.g., `llama3`, `codellama`, `mistral`)

```bash
# Using Ollama (local)
ax cli --provider ollama --model llama3

# With custom base URL
ax cli --provider ollama --model llama3 --base-url http://localhost:11434
```

---

## Configuration File Format

### Minimal Configuration

**`.ax-cli/settings.json`:**
```json
{}
```
Uses defaults and environment variables.

### Full Configuration

**`.ax-cli/settings.json`:**
```json
{
  "provider": "glm",
  "model": "glm-4.6",
  "apiKey": "your-api-key-here",
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "maxToolRounds": 400,
  "preferences": {
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

---

## Environment Variables Priority

When multiple configuration sources are present, ax-cli uses this priority order:

1. **Command-line flags** (highest priority)
   ```bash
   ax cli --model glm-4.6
   ```

2. **Environment variables**
   ```bash
   export AI_MODEL="glm-4.6"
   ```

3. **Configuration file** (`.ax-cli/settings.json`)
   ```json
   { "model": "glm-4.6" }
   ```

4. **Defaults** (lowest priority)
   - Provider: `glm`
   - Model: `glm-4.6`

---

## Custom Instructions (CUSTOM.md)

The `CUSTOM.md` file contains project-specific instructions for AI assistants.

**Purpose:**
- Provide context about the project structure
- Define coding conventions and standards
- Specify testing requirements
- Document development workflows

**Usage:**
ax-cli automatically includes `CUSTOM.md` content when communicating with AI providers, giving them context about your project.

---

## Advanced Features

### 1. IDE Integration

```bash
# VSCode integration
ax cli --vscode

# Include file context
ax cli --file src/index.ts --line-range 10-20

# Include git diff
ax cli --git-diff
```

### 2. JSON Output

```bash
# Get JSON responses (for scripting)
ax cli --json "What is 2+2?"
```

### 3. Tool Execution Rounds

```bash
# Limit tool execution rounds
ax cli --max-tool-rounds 100

# Unlimited rounds
ax cli --max-tool-rounds 0
```

---

## Migration from .grok/

If you previously used `.grok/settings.json`, see [.grok/README.md](../.grok/README.md) for migration instructions.

**Key Differences:**
- `.grok/` → `.ax-cli/` (directory name)
- Grok CLI → ax-cli (CLI tool)
- Single provider → Multi-provider support
- `grok` command → `ax cli` command

---

## Troubleshooting

### Issue: "ax-cli not found"

**Solution:**
```bash
# Install ax-cli globally
npm install -g @defai.digital/ax-cli

# Or use via AutomatosX
ax cli
```

### Issue: "API key not found"

**Solution:**
```bash
# Set environment variable
export YOUR_API_KEY="your-key-here"

# Or use command-line flag
ax cli --api-key your-key-here
```

### Issue: "Provider not responding"

**Solution:**
```bash
# Check provider availability
ax doctor

# Try different provider
ax cli --provider xai --model grok-2
```

---

## More Information

- **ax-cli Repository**: https://github.com/defai-digital/ax-cli
- **AutomatosX Documentation**: See `CLAUDE.md` in project root
- **Provider APIs**:
  - Z.AI (GLM): https://z.ai/developer
  - xAI (Grok): https://console.x.ai
  - OpenAI: https://platform.openai.com
  - Anthropic: https://console.anthropic.com

---

**Last Updated**: 2025-11-20
**AutomatosX Version**: v9.1.0+
