# AutomatosX

**AI orchestration for teams who need governed, multi-provider automation**

[![macOS](https://img.shields.io/badge/macOS-26%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Windows](https://img.shields.io/badge/Windows-11%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)

---

## Install

```bash
npm install -g @defai.digital/automatosx
ax setup
ax doctor
```

## Why AutomatosX

- **Multi-provider routing** - Claude, Gemini, Codex, Qwen, GLM, Grok
- **Governed automation** - Policy-driven guardrails and audit-ready traces
- **Contract-first** - Zod schemas keep workflows and agents type-safe
- **MCP-native** - Ships with MCP server for IDE assistant integration

## Quick Start

```bash
# Call a provider
ax call claude "Explain this code"

# Run a workflow
ax run code-reviewer --input '{"files":["src/index.ts"]}'

# Review code
ax review analyze src/ --focus security

# Multi-model discussion
ax discuss "Compare REST vs GraphQL" --providers claude,gemini
```

## CLI Commands

```bash
ax setup                    # Initialize configuration
ax doctor                   # Check provider health
ax call <provider> "prompt" # Direct provider call
ax run <workflow>           # Execute workflow
ax agent run <id>           # Execute agent
ax review analyze <path>    # Analyze code
ax discuss "<topic>"        # Multi-model discussion
ax mcp server               # Start MCP server
```

## Documentation

Full documentation: https://github.com/defai-digital/automatosx

## License

Apache-2.0
