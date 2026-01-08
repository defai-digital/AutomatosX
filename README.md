# AutomatosX

**One CLI to rule all your AI providers**

[![Version](https://img.shields.io/badge/version-13.1.16-green.svg)](https://github.com/defai-digital/automatosx/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)

AutomatosX lets you use Claude, Gemini, Codex, Qwen, GLM, and Grok from a single command line. Ask questions, review code, run multi-model discussions, and more.

---

## Quick Start (3 Steps)

### 1. Install

```bash
npm install -g @defai.digital/automatosx
```

### 2. Setup

```bash
ax setup
```

This detects your installed AI providers and configures AutomatosX.

### 3. Verify

```bash
ax doctor
```

You should see green checkmarks for your installed providers.

---

## Your First Commands

### Ask a question

```bash
ax call claude "What is the capital of France?"
ax call gemini "Explain quantum computing in simple terms"
```

### Review code

```bash
ax review analyze src/ --focus security
ax review analyze src/ --focus performance
```

### Multi-model discussion

```bash
ax discuss "What's the best database for a startup?"
```

### Iterate on a task

```bash
ax call claude --iterate "Build a REST API for user management"
```

---

## Supported Providers

| Provider | Command | Install Guide |
|----------|---------|---------------|
| Claude | `ax call claude` | [claude-code](https://github.com/anthropics/claude-code) |
| Gemini | `ax call gemini` | [gemini-cli](https://github.com/google-gemini/gemini-cli) |
| Codex | `ax call codex` | [codex](https://github.com/openai/codex) |
| Qwen | `ax call qwen` | [qwen-code](https://github.com/QwenLM/qwen-code) |
| GLM | `ax call glm` | [ax-cli](https://github.com/defai-digital/ax-cli) |
| Grok | `ax call grok` | [ax-cli](https://github.com/defai-digital/ax-cli) |

**Note**: Install at least one provider CLI before using AutomatosX.

---

## Common Use Cases

### Code Review

```bash
# Security-focused review
ax review analyze src/ --focus security

# Performance review
ax review analyze src/ --focus performance

# Full review
ax review analyze src/ --focus all
```

### Multi-Model Discussions

Get perspectives from multiple AI models:

```bash
# Quick consensus from 3 models
ax discuss quick "Should we use microservices or monolith?"

# Detailed debate
ax discuss --pattern debate "React vs Vue for enterprise apps"

# Custom providers
ax discuss --providers claude,gemini,grok "Best practices for API design"
```

### Autonomous Tasks

Let the AI work through complex tasks step by step:

```bash
ax call claude --iterate "Implement user authentication with JWT"
ax call gemini --iterate "Add unit tests for the payment module"
```

### Agents

Run pre-built agents for common tasks:

```bash
# List available agents
ax agent list

# Run an agent
ax agent run code-reviewer
ax agent run security
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `ax setup` | Initialize configuration |
| `ax doctor` | Check provider health |
| `ax call <provider> "prompt"` | Call an AI provider |
| `ax review analyze <path>` | AI code review |
| `ax discuss "topic"` | Multi-model discussion |
| `ax agent list` | List available agents |
| `ax agent run <id>` | Run an agent |
| `ax guard check --policy <p>` | Check code governance |
| `ax --help` | Show all commands |

---

## MCP Server Integration

Use AutomatosX as an MCP server with Claude Code or other AI assistants:

```bash
# Add to your AI assistant
claude mcp add automatosx -- ax mcp server
```

Or add manually to your MCP settings:

```json
{
  "mcpServers": {
    "automatosx": {
      "command": "ax",
      "args": ["mcp", "server"]
    }
  }
}
```

---

## Configuration

AutomatosX stores configuration in `~/.automatosx/`:

```bash
# Show current config
ax config show

# Change default provider
ax config set defaultProvider gemini

# Adjust timeout
ax config set execution.timeout 180000
```

---

## Troubleshooting

### "Provider not found"

Make sure you have at least one provider CLI installed:

```bash
# Check what's installed
ax doctor

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Re-run setup
ax setup
```

### "Command not found: ax"

The CLI wasn't installed globally:

```bash
npm install -g @defai.digital/automatosx
```

### Provider timing out

Increase the timeout:

```bash
ax call claude --timeout 300 "Complex task here"
```

---

## Development

```bash
git clone https://github.com/defai-digital/automatosx.git
cd automatosx
pnpm install && pnpm build
pnpm test
```

---

## What's New

### v13.1.16
- Fixed `ax review list` command
- Connected trace command to real storage
- Improved error handling

### v13.1.15
- Verified `ax` command alias

### v13.1.14
- Added Grok to default providers
- Extended provider timeout to 10 minutes
- Fixed debate pattern

[Full Changelog](https://github.com/defai-digital/automatosx/releases)

---

## License

Apache License 2.0 - see [LICENSE](LICENSE)

---

[Documentation](docs/) | [Examples](examples/) | [GitHub](https://github.com/defai-digital/automatosx) | [Issues](https://github.com/defai-digital/automatosx/issues)
