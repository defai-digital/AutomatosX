# Introduction

Welcome to **AutomatosX v6.3.8** - a modern AI agent orchestration platform built with TypeScript. AutomatosX helps you build, manage, and scale AI agents with a simple, powerful, and developer-friendly approach.

## What is AutomatosX?

AutomatosX is a platform that makes it easy to:

- **Build AI Agents**: Define agents using simple YAML profiles and Markdown abilities
- **Manage Memory**: Store and retrieve agent memories with fast local FTS5 search
- **Orchestrate Providers**: Use multiple AI providers (Claude, Gemini, OpenAI) with automatic fallback
- **Scale Efficiently**: Optimized performance with caching and lazy loading

## Key Features

### 🚀 Modern TypeScript Architecture

Built from the ground up with TypeScript for type safety, better tooling, and excellent developer experience.

```typescript
import { AutomatosX } from 'automatosx';

const agent = new AutomatosX({
  profile: 'backend',
  memory: true
});

const response = await agent.run('Help me with this task');
```

### 🧠 Advanced Memory System

Powered by SQLite FTS5 for efficient full-text search with minimal overhead:

- **Lightning Fast**: < 1ms average query latency
- **Privacy First**: 100% local, no external API calls
- **Lightweight**: 2-5MB database size (efficient storage)
- **Semantic Search**: Find relevant memories by meaning, not just keywords
- **Export/Import**: Backup and restore your agent's memory

### 🔌 Multi-Provider Support

Seamlessly integrate with multiple AI providers:

- **Claude** (Anthropic)
- **Gemini** (Google)
- **OpenAI** (GPT models)
- **Custom Providers** (extend easily)

Features:

- Automatic fallback on failures
- Load balancing across providers
- Cost optimization with caching (30-40% API reduction)

### 📝 Profile-Based Agent Definition

Define agents with simple YAML profiles:

```yaml
# .automatosx/agents/backend.yaml
name: backend
version: 1.0.0
description: Backend development specialist

model:
  provider: claude
  command: claude
  temperature: 0.7

system: |
  You are a backend development specialist. Focus on API design, database modeling, and server-side implementation.

abilities:
  - web-search
  - code-analysis
  - file-operations
```

And Markdown abilities:

```markdown
# Web Search

Search the web for information.

## Usage

search(query: string): SearchResult[]

## Example

search("Latest AI news")
```

### 🔒 Security First

- **Path Validation**: Prevents path traversal attacks
- **Workspace Isolation**: Agents can only write to their workspace
- **Input Sanitization**: All user inputs validated
- **Resource Limits**: File size limits, rate limiting
- **Audit Trail**: Comprehensive logging

## Why v4.0?

### Key Improvements

- **Bundle Size**: <50MB (lightweight installation)
- **Dependencies**: 158 packages (minimal footprint)
- **Startup Time**: ~280ms (fast startup)
- **Memory Usage**: 57MB (efficient runtime)
- **API Efficiency**: 30-40% reduction in API calls via caching
- **Type Safety**: 100% TypeScript strict mode
- **Tests**: 705 tests, 100% passing

### What's New

**Architecture**:

- ✨ Complete TypeScript rewrite
- ✨ SQLite FTS5 for local full-text search
- ✨ Modern ESM modules
- ✨ Vitest for testing

**Features**:

- ✨ Advanced caching system
- ✨ Performance profiling
- ✨ Better error handling
- ✨ Improved CLI UX
- ✨ Backward compatibility support

**Quality**:

- ✨ 705 tests (100% passing)
- ✨ 67% test coverage
- ✨ 100% TypeScript strict mode
- ✨ Security audit passed
- ✨ Comprehensive documentation

## Use Cases

### 1. Personal Assistant

Build a personal development assistant that remembers conversations and helps with tasks:

```bash
npx @defai.digital/automatosx chat assistant
> Help me plan my week
> Remind me what we discussed yesterday
> Draft an email to my team
```

### 2. Code Analysis

Analyze codebases and answer questions about code:

```bash
npx @defai.digital/automatosx run code-analyzer "What does the Router class do?"
npx @defai.digital/automatosx run code-analyzer "Find all TypeScript errors"
```

### 3. Research Agent

Conduct research and summarize findings:

```bash
npx @defai.digital/automatosx run researcher "Summarize recent AI advancements"
npx @defai.digital/automatosx run researcher "Compare SQL full-text search solutions"
```

### 4. Multi-Agent Orchestration

Coordinate multiple agents for complex tasks:

```bash
npx @defai.digital/automatosx run orchestrator "Plan and execute a project"
# Coordinates: planner, researcher, developer, reviewer
```

## Getting Started

Ready to build your first agent?

1. **[Installation](./installation.md)** - Install and setup AutomatosX
2. See examples in the repository for common use cases

## Community & Support

- **GitHub** - Source code and issues (available with v4.0 launch)
- **Documentation** - Check the docs/ directory for guides and API reference

> **Note**: Get help via [GitHub Issues](https://github.com/defai-digital/automatosx/issues) - report bugs, ask questions, or request features (use "enhancement" label for wishlist).

## Next Steps

- [Install AutomatosX](./installation.md)
- Explore the [examples directory](../../examples/) for common use cases
- Check the [API documentation](../api/) for technical reference
