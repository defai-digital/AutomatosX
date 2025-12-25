# AutomatosX

**AI-powered workflow automation with multi-provider orchestration**

[![macOS](https://img.shields.io/badge/macOS-26%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Windows](https://img.shields.io/badge/Windows-11%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04%2B-blue.svg)](https://github.com/defai-digital/automatosx)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)

---

## Installation

```bash
npm install -g @defai.digital/automatosx
```

## Quick Start

```bash
# Initialize configuration and detect providers
ax setup

# Verify installation
ax doctor

# Make a provider call
ax call claude "Hello, world!"
```

## Features

- **Multi-Provider Support**: Claude, Gemini, Codex, Qwen, GLM, Grok
- **Deterministic Routing**: Risk-level and capability-based model selection
- **Event-Sourced Memory**: Temporal consistency with full replay capability
- **Execution Tracing**: Complete audit trail for all AI decisions
- **Guard System**: Policy-driven governance for AI-generated code
- **MCP Server**: Model Context Protocol integration for AI assistants

## CLI Commands

```bash
# System setup and health
ax setup                          # Initialize configuration
ax doctor                         # Check all providers

# Provider calls
ax call claude "Your prompt"      # Direct provider call
ax call gemini "Your prompt"

# Workflow execution
ax run <workflow-id>              # Execute workflow
ax list                           # List workflows

# Agent management
ax agent list                     # List agents
ax agent run <id>                 # Execute an agent

# Code review
ax review analyze src/            # Analyze code
ax review analyze src/ --focus security

# Multi-model discussion
ax discuss "Your topic" --pattern synthesis
ax discuss quick "Quick question"
```

## MCP Server

Start the MCP server for AI assistant integration:

```bash
automatosx mcp server
```

## Documentation

Full documentation available at: https://github.com/defai-digital/automatosx

## License

Apache-2.0 - See [LICENSE](https://github.com/defai-digital/automatosx/blob/main/LICENSE) for details.

**© 2024-2025 DEFAI Private Limited. All rights reserved.**
