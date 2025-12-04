# AutomatosX Project `GEMINI.md`

This document provides a comprehensive overview of the AutomatosX project, its structure, and how to work with it. It is intended to be used as a quick reference for developers and as a context file for AI assistants.

## Project Overview

AutomatosX is a command-line tool that acts as a power-add-on for AI coding assistants like Claude Code and Codex CLI. It provides features like multi-agent orchestration, persistent memory, and cost-optimization by routing requests to different AI providers. The project is written in TypeScript and is designed to be a provider-agnostic AI orchestration platform.

The project is structured as a Node.js module and is distributed via npm as `@defai.digital/automatosx`. The main executable is `dist/index.js`, which is aliased to `automatosx` and `ax`.

## Building and Running

### Building the Project

To build the project, run the following command:

```bash
npm run build
```

This command uses `tsup` to compile the TypeScript code in the `src` directory and outputs the compiled JavaScript to the `dist` directory.

### Running in Development

To run the CLI in development mode without building, use the following command:

```bash
npm run dev
```

This command uses `tsx` to execute the main CLI entry point at `src/cli/index.ts` directly.

### Running Tests

The project has a comprehensive test suite that includes unit, integration, and smoke tests. To run all tests, use the following command:

```bash
npm test
```

You can also run specific types of tests:

*   **Unit Tests:** `npm run test:unit`
*   **Integration Tests:** `npm run test:integration`
*   **Smoke Tests:** `npm run test:smoke`

## Development Conventions

### Coding Style

The project uses ESLint to enforce a consistent coding style. To check for linting errors, run:

```bash
npm run lint
```

To automatically fix linting errors, run:

```bash
npm run lint:fix
```

### Type Checking

The project uses TypeScript for static type checking. to run the type checker, use the following command:

```bash
npm run typecheck
```

### Commit Messages

The project uses the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for commit messages. This is enforced by a `commit-msg` hook that is managed by `husky`. When you commit your changes, you'll be prompted to provide a structured commit message.

### Versioning and Releasing

The project uses `standard-version` for versioning and releasing. There are several npm scripts available for managing versions and creating releases:

*   `npm run version:patch`
*   `npm run version:minor`
*   `npm run version:major`
*   `npm run release`

These scripts handle version bumping, changelog generation, and git tagging.

---

# AutomatosX Integration for Gemini CLI

**IMPORTANT**: For the complete AutomatosX integration guide, **please read [AutomatosX-Integration.md](../AutomatosX-Integration.md)**.

This file provides Gemini CLI-specific tips and quick reference. For comprehensive documentation including all agents, commands, memory features, workflows, and troubleshooting, see [AutomatosX-Integration.md](../AutomatosX-Integration.md).

---

## Quick Start for Gemini CLI Users

### Natural Language Integration

Gemini CLI can invoke AutomatosX agents using natural language:

```
"Please use the ax backend agent to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
"Work with ax agent product to design this new feature"
"Use ax agent devops to set up the deployment pipeline"
```

Gemini CLI will understand your intent and invoke the appropriate AutomatosX agent for you. Just describe what you need in natural language - no special commands required!

### Essential Commands

```bash
# List all available agents
ax list agents

# Run an agent with a task
ax run backend "create a REST API for user management"

# Search memory for past conversations
ax memory search "authentication"

# View system status
ax status
```

---

## Gemini CLI-Specific Tips

### 1. Natural Language is Best

Custom slash commands have been removed. Instead, talk naturally to Gemini CLI:

**Natural Language Examples**:
```
"Use ax agent backend to create a REST API for authentication"
"Ask ax agent frontend to build a responsive navbar"
"Have ax agent security audit this code for vulnerabilities"
"Work with ax agent quality to write unit tests"
```

### 2. Direct CLI Access

For direct terminal usage:

```bash
# Run agents directly
ax run backend "task"

# Search memory
ax memory search "keyword"

# Check status
ax status
```

### 3. Workspace Conventions

AutomatosX uses specific directories:

- **`automatosx/PRD/`** - Design specs and planning documents
- **`automatosx/tmp/`** - Temporary files and scratch work

**Usage in Gemini CLI** (natural language):
```
"Use ax product agent to save the design to automatosx/PRD/auth-design.md"
"Have ax backend agent put the draft in automatosx/tmp/auth-draft.ts"
```

### 4. Provider Configuration

Gemini is typically configured with high priority for Gemini CLI users:

```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1,
      "command": "gemini"
    }
  }
}
```

Edit `ax.config.json` to customize.

---

## Available Agents

Quick reference (for full list, see [AutomatosX-Integration.md](../AutomatosX-Integration.md)):

- **backend** (Bob) - Backend development
- **frontend** (Frank) - Frontend development
- **fullstack** (Felix) - Full-stack development
- **mobile** (Maya) - Mobile development
- **devops** (Oliver) - DevOps and infrastructure
- **security** (Steve) - Security auditing
- **quality** (Queenie) - QA and testing
- **architecture** (Avery) - System architecture
- **data** (Daisy) - Data engineering
- **design** (Debbee) - UX/UI design
- **product** (Paris) - Product management
- **writer** (Wendy) - Technical writing

**Full list**: `ax list agents --format json`

---

## Memory System

AutomatosX automatically saves all agent conversations:

```bash
# Search memory
ax memory search "authentication"

# List recent memories
ax memory list --limit 10

# Export for backup
ax memory export > backup.json
```

**In Gemini CLI** (natural language):
```
"Search AutomatosX memory for authentication"
```

**Details**: Fast SQLite FTS5 search (< 1ms), 100% local, $0 API costs.

---

## Multi-Agent Collaboration

Agents can delegate tasks automatically:

```bash
ax run product "Build a complete user authentication feature"
# → Product designs system
# → Delegates to backend for implementation
# → Delegates to security for audit
```

**Gemini CLI Example**:
```
"Use ax product agent to build a complete user authentication feature"
```

---

## Troubleshooting

### Common Issues

**"Agent not found"**
```bash
ax list agents  # Case-sensitive names
```

**"Provider not available"**
```bash
ax status
ax doctor
```

**"Gemini CLI not found"**
```bash
npm install -g @google/gemini-cli
gemini --version
```

### Getting Help

```bash
# Command help
ax --help
ax run --help

# Debug mode
ax --debug run backend "task"
```

**In Gemini CLI** (natural language):
```
"Check AutomatosX system status"
"List all available agents"
```

---

## Advanced Features

For advanced usage, see [AutomatosX-Integration.md](../AutomatosX-Integration.md):

- **Spec-Driven Workflows** - YAML-based task definitions
- **Parallel Execution** - Run multiple agents concurrently
- **Resumable Runs** - Checkpoint and resume long tasks
- **Streaming Output** - Real-time AI responses
- **Provider Routing** - Intelligent multi-provider selection
- **Cost Optimization** - Free-tier prioritization
- **Custom Agents** - Create your own specialized agents

---

## Documentation

- **Complete Guide**: [AutomatosX-Integration.md](../AutomatosX-Integration.md) ← **Read this!**
- **GitHub**: https://github.com/defai-digital/automatosx
- **Agent Profiles**: `.automatosx/agents/`
- **Configuration**: `ax.config.json`

## Support

- **Issues**: https://github.com/defai-digital/automatosx/issues
- **NPM**: https://www.npmjs.com/package/@defai.digital/automatosx

---

**For complete AutomatosX documentation**, see [AutomatosX-Integration.md](../AutomatosX-Integration.md).


# List all available agents
ax list agents

# Run an agent with a task
ax run backend "create a REST API for user management"

# Search memory for past conversations
ax memory search "authentication"

# View system status
ax status
```

---

## Gemini CLI-Specific Tips

### 1. Natural Language is Best

Custom slash commands have been removed. Instead, talk naturally to Gemini CLI:

**Natural Language Examples**:
```
"Use ax agent backend to create a REST API for authentication"
"Ask ax agent frontend to build a responsive navbar"
"Have ax agent security audit this code for vulnerabilities"
"Work with ax agent quality to write unit tests"
```

### 2. Direct CLI Access

For direct terminal usage:

```bash
# Run agents directly
ax run backend "task"

# Search memory
ax memory search "keyword"

# Check status
ax status
```

### 3. Workspace Conventions

AutomatosX uses specific directories:

- **`automatosx/PRD/`** - Design specs and planning documents
- **`automatosx/tmp/`** - Temporary files and scratch work

**Usage in Gemini CLI** (natural language):
```
"Use ax product agent to save the design to automatosx/PRD/auth-design.md"
"Have ax backend agent put the draft in automatosx/tmp/auth-draft.ts"
```

### 4. Provider Configuration

Gemini is typically configured with high priority for Gemini CLI users:

```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1,
      "command": "gemini"
    }
  }
}
```

Edit `ax.config.json` to customize.

---

## Available Agents

Quick reference (for full list, see [AutomatosX-Integration.md](../AutomatosX-Integration.md)):

- **backend** (Bob) - Backend development
- **frontend** (Frank) - Frontend development
- **fullstack** (Felix) - Full-stack development
- **mobile** (Maya) - Mobile development
- **devops** (Oliver) - DevOps and infrastructure
- **security** (Steve) - Security auditing
- **quality** (Queenie) - QA and testing
- **architecture** (Avery) - System architecture
- **data** (Daisy) - Data engineering
- **design** (Debbee) - UX/UI design
- **product** (Paris) - Product management
- **writer** (Wendy) - Technical writing

**Full list**: `ax list agents --format json`

---

## Memory System

AutomatosX automatically saves all agent conversations:

```bash
# Search memory
ax memory search "authentication"

# List recent memories
ax memory list --limit 10

# Export for backup
ax memory export > backup.json
```

**In Gemini CLI** (natural language):
```
"Search AutomatosX memory for authentication"
```

**Details**: Fast SQLite FTS5 search (< 1ms), 100% local, $0 API costs.

---

## Multi-Agent Collaboration

Agents can delegate tasks automatically:

```bash
ax run product "Build a complete user authentication feature"
# → Product designs system
# → Delegates to backend for implementation
# → Delegates to security for audit
```

**Gemini CLI Example**:
```
"Use ax product agent to build a complete user authentication feature"
```

---

## Troubleshooting

### Common Issues

**"Agent not found"**
```bash
ax list agents  # Case-sensitive names
```

**"Provider not available"**
```bash
ax status
ax doctor
```

**"Gemini CLI not found"**
```bash
npm install -g @google/gemini-cli
gemini --version
```

### Getting Help

```bash
# Command help
ax --help
ax run --help

# Debug mode
ax --debug run backend "task"
```

**In Gemini CLI** (natural language):
```
"Check AutomatosX system status"
"List all available agents"
```

---

## Advanced Features

For advanced usage, see [AutomatosX-Integration.md](../AutomatosX-Integration.md):

- **Spec-Driven Workflows** - YAML-based task definitions
- **Parallel Execution** - Run multiple agents concurrently
- **Resumable Runs** - Checkpoint and resume long tasks
- **Streaming Output** - Real-time AI responses
- **Provider Routing** - Intelligent multi-provider selection
- **Cost Optimization** - Free-tier prioritization
- **Custom Agents** - Create your own specialized agents

---

## Documentation

- **Complete Guide**: [AutomatosX-Integration.md](../AutomatosX-Integration.md) ← **Read this!**
- **GitHub**: https://github.com/defai-digital/automatosx
- **Agent Profiles**: `.automatosx/agents/`
- **Configuration**: `ax.config.json`

## Support

- **Issues**: https://github.com/defai-digital/automatosx/issues
- **NPM**: https://www.npmjs.com/package/@defai.digital/automatosx

---

**For complete AutomatosX documentation**, see [AutomatosX-Integration.md](../AutomatosX-Integration.md).
