# AutomatosX

**The AI orchestration platform with built-in governance**

[![Version](https://img.shields.io/badge/version-13.1.16-green.svg)](https://github.com/defai-digital/automatosx/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)

---

## Two Reasons to Use AutomatosX

### For Individual Developers: Better AI Decisions

**The problem**: You ask Claude a question. You get an answer. But is it the best answer? Every AI model has blind spots. Claude might miss something Gemini catches. GPT might suggest something neither considered.

**The solution**: Ask multiple AIs at once and let them reach consensus.

```bash
ax discuss "Should I use microservices or monolith for a 5-person startup?"
```

AutomatosX sends your question to Claude, Gemini, GLM, and Grok simultaneously. They see each other's answers. One AI synthesizes a final recommendation that considers all perspectives.

**Result**: Better decisions because you're not limited to one model's opinion.

---

### For Teams & Enterprises: AI Governance

**The problem**: Your team uses AI for coding. But how do you ensure:
- AI doesn't introduce security vulnerabilities?
- Changes don't break architectural boundaries?
- There's an audit trail of what AI did?
- Policies are enforced before code is merged?

**The solution**: Contract-first AI orchestration.

AutomatosX has **29 contract domains** with **500+ behavioral invariants** that guarantee:

| Guarantee | What It Means |
|-----------|---------------|
| Every input/output is validated | No undefined behavior, no magic strings |
| Every AI call is traced | Full audit trail for compliance |
| Guard policies block violations | Changes checked before they land |
| Invariants are tested | Behavioral guarantees are enforced |

```bash
# Run governance checks before merging AI-generated code
ax guard check --policy bugfix --changed-files $(git diff --name-only)

# See what AI did
ax trace --verbose
```

**Result**: AI coding with enterprise-grade guardrails.

---

## Quick Start

```bash
# Install
npm install -g @defai.digital/automatosx

# Setup (detects your installed AI providers)
ax setup

# Verify
ax doctor
```

**Prerequisites**: Node.js 20+, at least one AI provider installed:

| Provider | Install |
|----------|---------|
| Claude | `npm install -g @anthropic-ai/claude-code` |
| Gemini | [gemini-cli](https://github.com/google-gemini/gemini-cli) |
| Codex | [codex](https://github.com/openai/codex) |
| Qwen | [qwen-code](https://github.com/QwenLM/qwen-code) |
| GLM/Grok | [ax-cli](https://github.com/defai-digital/ax-cli) |

---

## Core Features

### 1. Multi-Model Discussions

Get perspectives from multiple AIs on any question:

```bash
# Quick consensus
ax discuss "Best database for real-time analytics?"

# Structured debate with pros/cons
ax discuss --pattern debate "PostgreSQL vs MongoDB"

# Voting on options
ax discuss --pattern voting "React vs Vue vs Angular"
```

### 2. AI Code Review

Automated code review with specific focus areas:

```bash
ax review analyze src/ --focus security      # OWASP, injection, auth
ax review analyze src/ --focus performance   # N+1, memory leaks
ax review analyze src/ --focus architecture  # SOLID, coupling
```

### 3. Unified CLI

One command syntax for all AI providers:

```bash
ax call claude "Explain this error"
ax call gemini "Write tests for this function"
ax call grok "Review this PR"
```

### 4. Guard System (Governance)

Policy-based checks for AI-generated code:

```bash
# Check changes against policy
ax guard check --policy bugfix --target ./src

# Available policies
ax guard list
```

Built-in gates:
- **Path validation** - Ensure changes only touch allowed files
- **Change radius** - Limit how many packages can be modified
- **Dependency boundaries** - Enforce architectural layers
- **Secrets detection** - Block commits with API keys/passwords

### 5. Execution Tracing

Every AI interaction is logged:

```bash
ax trace                    # List recent traces
ax trace <id> --verbose     # See full execution details
```

---

## The Contract-First Architecture

What makes AutomatosX different from other AI tools:

```
┌─────────────────────────────────────────────────────────┐
│                    CLI / MCP Server                      │
├─────────────────────────────────────────────────────────┤
│                     Guard System                         │
│         (Policy enforcement before changes land)         │
├─────────────────────────────────────────────────────────┤
│                    Core Domains                          │
│   Workflow • Agent • Review • Discussion • Memory        │
│   Trace • Session • Routing • Resilience                 │
├─────────────────────────────────────────────────────────┤
│              Contracts (Zod Schemas)                     │
│      29 domains • 500+ invariants • Full validation      │
├─────────────────────────────────────────────────────────┤
│                  Provider Adapters                       │
│     Claude • Gemini • Codex • Qwen • GLM • Grok         │
└─────────────────────────────────────────────────────────┘
```

**Key principle**: Every input is validated. Every output is traced. Every guarantee is tested.

Example invariants:
- `INV-WF-001`: Steps execute in definition order (no surprises)
- `INV-RT-002`: High-risk tasks never use experimental models
- `INV-MEM-001`: Events are immutable after storage
- `INV-GD-001`: Forbidden paths always block (deny wins)

---

## Use Cases

### Individual Developer

```bash
# Get unstuck with multiple perspectives
ax discuss "Why is my React component re-rendering infinitely?"

# Quick code review before PR
ax review analyze src/features/auth/ --focus security

# Compare approaches
ax discuss --pattern debate "REST vs GraphQL for mobile app"
```

### Team Lead / Architect

```bash
# Enforce architectural boundaries
ax guard check --policy provider-refactor --changed-files adapters/

# Review AI-generated code
ax review analyze src/ --focus all --format sarif > report.sarif

# Track what AI is doing across the team
ax trace --limit 50
```

### Platform / DevOps

```bash
# Add to CI pipeline
ax guard check --policy bugfix --changed-files $(git diff origin/main --name-only)

# MCP server for AI assistants
ax mcp server
```

---

## MCP Server

Use AutomatosX tools from Claude Code or other AI assistants:

```bash
claude mcp add automatosx -- ax mcp server
```

Now you can use `ax_discuss`, `ax_review_analyze`, `ax_guard_check` directly in your AI assistant.

---

## FAQ

### Who is this for?

- **Individual developers** who want better AI decisions through multi-model consensus
- **Teams** who need governance over AI-generated code
- **Enterprises** who require audit trails and policy enforcement

### Why not just use Claude directly?

You can! AutomatosX adds value when you want:
- Multiple AI perspectives (not just one model's opinion)
- Code review with specific focus areas
- Governance and audit trails
- Consistent commands across providers

### Is this just a wrapper?

No. It's an orchestration platform. The key features are:
- **Multi-model collaboration** (AIs discuss with each other)
- **Contract validation** (every input/output is checked)
- **Guard policies** (changes blocked before they land)
- **Execution tracing** (full audit trail)

### Do I need all providers installed?

No. Works with whatever you have. Multi-model discussions need 2+ providers.

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

[GitHub](https://github.com/defai-digital/automatosx) | [Documentation](docs/) | [Issues](https://github.com/defai-digital/automatosx/issues)
