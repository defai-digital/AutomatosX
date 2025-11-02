# Gemini CLI Integration for AutomatosX

This directory contains integration files for using AutomatosX with Gemini CLI.

## Using AutomatosX with Gemini CLI

**Natural Language Interaction (Recommended)**:

You can interact with AutomatosX agents using natural language in Gemini CLI. No special commands needed!

### Examples

```
"Please use the ax backend agent to create a REST API for authentication"
"Ask the ax frontend agent to build a responsive navbar"
"Have the ax security agent audit this code for security vulnerabilities"
"Work with ax agent quality to write unit tests for this feature"
```

Gemini CLI will understand your intent and invoke the appropriate AutomatosX agent for you.

### Available Agents

Use any of these agents by mentioning them in natural language:

- **backend** (Bob) - Backend development
- **frontend** (Frank) - Frontend development
- **security** (Steve) - Security auditing
- **quality** (Queenie) - QA and testing
- **devops** (Oliver) - DevOps and infrastructure
- **product** (Paris) - Product management
- **design** (Debbee) - UX/UI design
- And many more!

See the full list with: `ax list agents`

## Terminal Usage

You can also use AutomatosX directly from the terminal:

```bash
# Run any agent with a task
ax run backend "create a REST API for authentication"
ax run frontend "build a responsive navbar"
ax run security "audit code for vulnerabilities"

# Check status
ax status

# List agents
ax list agents

# Search memory
ax memory search "keyword"
```

## Setup

When you run `ax setup`, AutomatosX will configure your project for use with Gemini CLI.

## Syncing with Gemini CLI

```bash
# Register AutomatosX MCP server
ax gemini sync-mcp

# Check integration status
ax gemini status
```

## Notes

- Use natural language to work with agents - no special syntax required
- All conversations are saved to persistent memory
- Agents can delegate tasks to each other automatically
- See `GEMINI_INTEGRATION.md` for full integration guide
