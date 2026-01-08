# AutomatosX

**Stop asking one AI. Start asking all of them.**

[![Version](https://img.shields.io/badge/version-13.1.16-green.svg)](https://github.com/defai-digital/automatosx/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)

---

## The Problem

You're building software and using AI to help. But here's what happens:

- You ask **Claude** about your architecture. It says "use microservices."
- You ask **Gemini** the same question. It says "start with a monolith."
- You ask **GPT**. It gives a third opinion.

**Which one is right?** You don't know. Each AI has blind spots and biases.

Now imagine you could ask all of them at once, let them discuss, debate, and reach consensus. That's AutomatosX.

---

## What AutomatosX Does

### 1. Multi-Model Discussions

Ask a question to multiple AI models and get a synthesized answer:

```bash
ax discuss "Should we use microservices or monolith for a 3-person startup?"
```

AutomatosX will:
- Send your question to Claude, Gemini, GLM, and more
- Let them see each other's responses
- Synthesize a final answer that considers all perspectives

**Result**: Better decisions because you're not limited to one AI's opinion.

### 2. AI Code Review

Get your code reviewed by AI with specific focus areas:

```bash
ax review analyze src/ --focus security
```

Focus options:
- `security` - Find vulnerabilities, injection risks, auth issues
- `performance` - Spot N+1 queries, memory leaks, slow algorithms
- `architecture` - Check coupling, SOLID principles, design patterns
- `all` - Comprehensive review

**Result**: Catch bugs before they reach production.

### 3. One CLI for All Providers

Stop switching between `claude`, `gemini`, `codex`, and other tools:

```bash
ax call claude "Explain this error"
ax call gemini "Write a test for this function"
ax call grok "Review this PR"
```

Same syntax, any provider. Your muscle memory works everywhere.

**Result**: Less context switching, more flow state.

---

## Real-World Scenarios

### Scenario 1: Making Architecture Decisions

**Before AutomatosX:**
1. Ask Claude about database choice
2. Copy response somewhere
3. Open Gemini, ask the same question
4. Compare manually
5. Still not sure which is right

**With AutomatosX:**
```bash
ax discuss --pattern debate "PostgreSQL vs MongoDB for an e-commerce platform with complex product relationships"
```

Get a structured debate with pros, cons, and a synthesized recommendation in one command.

### Scenario 2: Security Review Before Deployment

**Before AutomatosX:**
- Hope you remember to check for SQL injection
- Maybe run a linter
- Cross fingers

**With AutomatosX:**
```bash
ax review analyze src/api/ --focus security
```

AI scans your code for OWASP Top 10 vulnerabilities, auth issues, and data exposure risks.

### Scenario 3: Getting Unstuck

**Before AutomatosX:**
- Paste code into Claude, get an answer
- Not helpful? Try Gemini
- Still stuck? Try GPT
- Waste 30 minutes copying and pasting

**With AutomatosX:**
```bash
ax discuss "Why is this React component re-rendering infinitely?" --context "$(cat src/components/Dashboard.tsx)"
```

Multiple AIs analyze your code simultaneously and collaborate on the solution.

---

## Quick Start

### Step 1: Install

```bash
npm install -g @defai.digital/automatosx
```

### Step 2: Setup

```bash
ax setup
```

This detects which AI CLIs you have installed (Claude, Gemini, etc.).

### Step 3: Try It

```bash
# Check your setup
ax doctor

# Ask a question
ax call claude "What's the best way to handle errors in TypeScript?"

# Get multiple perspectives
ax discuss "Tabs vs spaces?"
```

---

## Prerequisites

You need at least one AI provider CLI installed:

| Provider | Install |
|----------|---------|
| Claude | `npm install -g @anthropic-ai/claude-code` |
| Gemini | [gemini-cli](https://github.com/google-gemini/gemini-cli) |
| Codex | [codex](https://github.com/openai/codex) |
| Qwen | [qwen-code](https://github.com/QwenLM/qwen-code) |
| GLM | [ax-cli](https://github.com/defai-digital/ax-cli) |
| Grok | [ax-cli](https://github.com/defai-digital/ax-cli) |

Run `ax doctor` to see which providers are available.

---

## Command Reference

### Basic Commands

```bash
ax call <provider> "prompt"     # Ask a single AI
ax discuss "topic"              # Multi-model discussion
ax review analyze <path>        # AI code review
ax agent list                   # Show available agents
ax agent run <name>             # Run a pre-built agent
```

### Discussion Patterns

```bash
ax discuss "question"                              # Quick synthesis
ax discuss --pattern debate "topic"                # Structured debate
ax discuss --pattern voting "option A vs B vs C"   # Voting with confidence
ax discuss --providers claude,gemini "question"    # Specific providers
```

### Code Review

```bash
ax review analyze src/                    # Full review
ax review analyze src/ --focus security   # Security focus
ax review analyze src/ --focus performance
ax review analyze src/ --focus architecture
```

### System

```bash
ax setup      # Configure AutomatosX
ax doctor     # Check provider health
ax config show # View configuration
ax --help     # All commands
```

---

## MCP Server

Use AutomatosX tools from Claude Code or other AI assistants:

```bash
claude mcp add automatosx -- ax mcp server
```

Now you can use AutomatosX tools directly in your AI assistant conversations.

---

## FAQ

### Why not just use Claude/Gemini directly?

You can! AutomatosX adds value when you:
- Want multiple AI perspectives on a decision
- Need structured code review with focus areas
- Want consistent commands across different AI providers
- Care about tracking what AI tools are doing in your codebase

### Is this just a wrapper?

It's an orchestrator. The key feature isn't calling one AI—it's coordinating multiple AIs to discuss, debate, and reach better conclusions than any single model.

### Do I need all providers installed?

No. AutomatosX works with whatever you have. Even with just Claude installed, you get the code review and agent features. Multi-model discussions require 2+ providers.

---

## What's New

**v13.1.16** - Bug fixes for review and trace commands
**v13.1.15** - CLI alias verification
**v13.1.14** - Added Grok, extended timeouts, fixed debate pattern

[Full Changelog](https://github.com/defai-digital/automatosx/releases)

---

## License

Apache License 2.0 - see [LICENSE](LICENSE)

---

[GitHub](https://github.com/defai-digital/automatosx) | [Issues](https://github.com/defai-digital/automatosx/issues) | [Documentation](docs/)
