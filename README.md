<h1><img src=".github/assets/axlogo.png" alt="AutomatosX Logo" width="36" /> <span style="font-size: 1.5em;">AutomatosX</span></h1>

*From Idea to Production in Minutes: The AI Workforce Platform with Persistent Memory*

AutomatosX is a pure CLI orchestration platform for AI agents. It wraps around `claude`, `gemini`, `grok`, and `codex` commands to provide multi-agent orchestration, persistent memory, and workflow automation. Simple, focused, and easy to integrate with your existing AI workflow.

[![npm version](https://img.shields.io/npm/v/@defai.digital/automatosx.svg)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-2,423+%20passing-brightgreen.svg)](#)
[![npm](https://img.shields.io/npm/dt/%40defai.digital%2Fautomatosx.svg?label=total%20downloads&color=blue)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue.svg)](https://ubuntu.com)

**Status**: ✅ **Production Ready** | v9.0.3 | 20 Specialized Agents | Pure CLI Orchestration | Enterprise MCP Support

> 🎉 **NEW in v8.5.3**: **Phase 4 MCP Complete!** Production-ready Model Context Protocol (MCP) server management with lifecycle logging, auto-installation, configuration hot-reload, performance monitoring, and resource enforcement. Transform your AI workflow with enterprise-grade server orchestration.

> 🔥 **NEW in v8.3.0**: Major simplification! Removed ~36,000 lines of code including policy routing, free-tier management, and SDK providers. AutomatosX is now a pure CLI orchestration wrapper around `claude`, `gemini`, `grok`, and `codex` commands. Simpler, faster, easier to maintain.

---

## ⚡ New to AutomatosX? [Start Here: 3-Minute Quickstart](docs/getting-started/quickstart-3min.md)

Get productive in under 3 minutes with our fast-track guide! Install, run your first agent, try multi-agent collaboration, and learn pro tips. **Perfect for first-time users.**

---

## 🚀 The Complete AI Workflow Platform

AutomatosX is **the only AI platform** that gives you:

| Feature | What It Does | Value |
|---------|--------------|-------|
| 📋 **Spec-Kit Integration** | Define workflows in YAML. Generate plans, DAGs, scaffolding, and tests automatically. | Ship projects 10x faster |
| 🧠 **Persistent Memory** | Every conversation is remembered. Agents get perfect context automatically. | Never repeat yourself again |
| 🤝 **Multi-Agent Orchestration** | 20 specialized agents delegate tasks to each other. You manage the project, not the details. | Focus on strategy, not micromanagement |
| 🔧 **Pure CLI Wrapper** | Works with your existing `claude`, `gemini`, `grok`, `codex` CLIs. No API keys needed for CLI mode. | Simple integration |
| 🔍 **Complete Observability** | Trace every execution and decision. Debug with confidence. | Production-grade reliability |
| 🎯 **Enterprise MCP** | Production-ready MCP server management: lifecycle logging, auto-install, hot-reload, metrics, resource limits. | Mission-critical reliability |

---

## ⚡ Quick Summary

```bash
# Install
npm i -g @defai.digital/automatosx

# Initialize (REQUIRED - sets up agents and config)
cd your-project && ax setup

# Create workflow from natural language
ax spec create "Build auth system with API, tests, security audit"

# Execute workflow
ax run workflow.ax.yaml

# Debug with trace logs
ax providers trace --follow

# Result: Production-ready auth system in minutes
```

**AutomatosX**: The only AI platform with declarative workflows, persistent memory, and multi-agent orchestration wrapped around existing AI CLI tools.

---

## ⚡ Quick Start: 60 Seconds to Your First Workflow

```bash
# 1. Install AutomatosX
npm install -g @defai.digital/automatosx

# 2. Change to your project folder
cd your-project

# 3. Set up AutomatosX (REQUIRED - sets up agents and configuration)
ax setup
# Or force reinitialize: ax setup -f

# ⚠️ IMPORTANT: You MUST run 'ax setup' before using AutomatosX
# This command:
#   - Creates .automatosx/ directory with all 20 specialized agents
#   - Sets up configuration files (automatosx.config.json)
#   - Initializes memory database and session management
#   - Configures the CLI environment for optimal performance

# 4. Create a workflow spec in natural language
ax spec create "Build user authentication with database, API, JWT, security audit, and tests"

# AutomatosX automatically:
#   ✅ Generates a complete project spec (.specify/)
#   ✅ Creates execution plan
#   ✅ Generates DAG for parallel execution
#   ✅ Scaffolds project structure
#   ✅ Generates comprehensive tests
#   ✅ Executes with configured provider
#   ✅ Tracks all decisions with trace logging

# 5. View the generated plan
ax gen plan workflow.ax.yaml

# 6. Execute the workflow
ax run workflow.ax.yaml
```

**Result**: Complete authentication system with database, API, security audit, and tests—generated and executed in minutes, not days.

---

## 🗣️ **Recommended**: Natural Language Interface

AutomatosX is designed to work seamlessly with AI assistants using natural language commands. This is the **recommended way** to use AutomatosX:

**✨ Key Feature**: AutomatosX **automatically selects the best agent(s)** for your task. You don't need to specify which agent to use - just describe what you want!

### Use with Claude Code, Gemini CLI, Grok CLI, or OpenAI Codex

**Natural Task Descriptions** (ax auto-selects agents for you):

```
# In Claude Code
"Please use ax to implement user authentication"
"Use ax to audit this code for vulnerabilities"
"Have ax write comprehensive tests for this feature"
"Use ax to design a microservices architecture"
```

```
# In Gemini CLI
"Use ax to find and fix bugs in the authentication system"
"Work with ax to optimize the database queries"
"Use ax to build the login UI"
```

```
# In Grok CLI
"Use ax to analyze and refactor this codebase"
"Work with ax to debug the performance bottleneck"
"Use ax to review code quality and suggest improvements"
"Have ax identify security vulnerabilities"
```

```
# In OpenAI Codex
"Use ax to build the user interface"
"Work with ax to set up CI/CD pipeline"
"Use ax to design the database schema"
```

**What Happens Behind the Scenes**:

- 🤖 `ax` analyzes your task description
- 🎯 Automatically selects the best agent(s) (backend, security, quality, etc.)
- 🔄 Coordinates multi-agent collaboration if needed
- 📝 All decisions stored in memory for context

### Natural Language Interaction Examples

#### Workflow Creation and Execution

```
# In Claude Code
"Create an ax workflow spec for a REST API with authentication, database,
and comprehensive tests. Then execute it."

"Generate a spec for refactoring the payment module with security audit and
backwards compatibility tests. Use the backend and security agents."

"Build a complete microservices architecture spec with service mesh, monitoring,
and deployment configs."
```

```
# In Gemini CLI
"Use ax to create and execute a workflow for migrating from MongoDB
to PostgreSQL. Include data validation and rollback procedures."

"Generate a spec for implementing rate limiting across all API endpoints.
Include security review and load testing."

"Create a workflow for adding GraphQL to our REST API. Include schema
generation, resolver tests, and performance benchmarks."
```

```
# In OpenAI Codex
"Work with ax to build a real-time notification system with WebSockets,
Redis, and push notifications. Generate the full workflow spec."

"Create and execute a spec for implementing OAuth2 with Google, GitHub, and
Facebook providers. Include security audit and integration tests."

"Generate a workflow for database migration with zero downtime. Include
blue-green deployment strategy and rollback automation."
```

```
# In Grok CLI
"Use ax to create a workflow for comprehensive code quality improvement.
Include refactoring, performance optimization, and security hardening."

"Generate and execute a spec for debugging and fixing production issues.
Include root cause analysis, fix implementation, and regression tests."

"Create a workflow for technical debt reduction with code analysis,
refactoring strategy, and validation tests."
```

#### Multi-Agent Orchestration

```
# In Claude Code
"Use ax to build a complete e-commerce platform with requirements,
architecture, API, database, React UI, security audit, and comprehensive tests."

"Work with ax to implement a data analytics pipeline with API,
ETL, and data warehousing."
```

```
# In Grok CLI
"Use ax to analyze and optimize the entire codebase with quality checks,
security audits, performance profiling, and comprehensive refactoring."

"Work with ax to debug complex multi-service issues with distributed
tracing, log analysis, and performance optimization."
```

#### Iterate Mode Tasks

```
# In Claude Code - Autonomous Bug-Finding
"Please use ax in iterate mode to find and fix bugs. Run 5 iterations."

# In Gemini CLI - Comprehensive Code Analysis
"Use ax in iterate mode to analyze the entire codebase for
performance issues. Set 120 minute timeout with balanced strictness."

# In OpenAI Codex - Security Hardening
"Use ax to run a comprehensive security audit in iterate mode
with strict level. This is for production deployment."
```

### Why Natural Language?

- ✅ **Conversational**: Talk to AI assistants like teammates
- ✅ **Context-aware**: AI assistants maintain full conversation context
- ✅ **Flexible**: No need to remember exact command syntax
- ✅ **Integrated**: Works directly in your AI assistant workflow
- ✅ **Powerful**: Combines AI assistant capabilities with AutomatosX's memory and orchestration
- ✅ **Production-Ready**: Full observability and trace logging for debugging

### Behind the Scenes

When you say "use ax to implement authentication", here's what happens:

1. AI assistant calls `ax run "implement user authentication"`
2. ax **automatically analyzes the task** and selects the best agent(s)
3. Routes to the configured provider
4. Persistent memory ensures perfect context across all interactions
5. Results are returned to your AI assistant with full context
6. The conversation continues naturally

**This natural language interface with auto-agent selection is how we expect users to work with AutomatosX daily.**

**Advanced: Direct Agent Specification** (Optional):
If you need a specific agent, you can still specify it:

- `ax run backend "task"` - Forces backend agent
- `ax run security "task"` - Forces security agent

But in most cases, auto-selection works better!

### CLI-Only Mode (No API Access Required)

If you only have CLI tools installed and **no API access** (no API keys or restricted network), you can force CLI-only mode:

```bash
# Set environment variable to enforce CLI-only mode
export AX_CLI_ONLY=true

# Now all providers will use CLI integration (subprocess), never API
ax run backend "implement user authentication"
```

**When to use CLI-only mode:**

- ✅ You have `codex`, `gemini`, or `claude` CLI tools installed
- ✅ You don't have API keys configured
- ✅ You're behind a corporate firewall blocking API access
- ✅ You want to avoid API connection attempts and retries

**What it does:**

- Forces `openai` provider to use CLI subprocess mode (`codex` command)
- Prevents OpenAI SDK API calls even if configured for SDK mode
- Eliminates "Unable to connect to API" errors and retry loops

**Note**: This only affects OpenAI provider. Claude and Gemini providers always use CLI mode by default.

---

### Direct CLI Usage

**Note**: You can let AutomatosX auto-select agents, or specify a particular agent if needed.

```bash
# Auto-selection (recommended) - AutomatosX picks the best agent
ax run "implement user authentication" --iterate

# With agent specified (optional)
ax run backend "implement user authentication" --iterate

# With time limit and strictness control
ax run "refactor codebase" --iterate --iterate-timeout 60 --iterate-strictness balanced

# For security-critical tasks
ax run "audit entire codebase for security vulnerabilities" --iterate --iterate-strictness strict

# Test execution plan without making changes (dry-run)
ax run "plan database migration" --iterate --iterate-dry-run

# Verbosity control (v8.5.8+)
ax run backend "task" --quiet              # Minimal output (perfect for AI assistants)
ax run backend "task"                       # Normal output (default, shows progress)
ax run backend "task" --verbose             # All details (for debugging)
```

### Key Features

| Feature | Description | Default |
|---------|-------------|---------|
| **Autonomous Execution** | Agents auto-respond to confirmation prompts | Enabled with `--iterate` |
| **Time Limits** | Configure execution timeouts to prevent runaway tasks | 120 minutes |
| **Safety Levels** | Choose from `paranoid`, `balanced`, `permissive` | `balanced` |
| **Dangerous Operation Detection** | Automatic classification of risky operations | Always active |
| **Dry Run Mode** | Test autonomous execution without making changes | Off |
| **Context History** | Maintains classification context for smarter decisions | Max 100 entries |
| **Workspace Protection** | Prevents access to files outside project directory | Always active |

### Safety Guardrails

Iterate Mode includes comprehensive safety protections:

- ✅ **Execution Timeout Protection**: Automatic shutdown after time limit
- ✅ **Workspace Boundary Protection**: Cannot access files outside project directory
- ✅ **Memory Leak Prevention**: Classification history bounded to prevent unbounded growth
- ✅ **Dangerous Operation Detection**: Auto-blocks risky operations in paranoid mode
- ✅ **Strictness Controls**: Three levels (paranoid/balanced/permissive) for risk tolerance
- ✅ **Dry Run Preview**: Test automation logic before making actual changes

### Use Cases

**Perfect For:**

- ✅ Long-running refactoring tasks
- ✅ Comprehensive code audits
- ✅ Batch processing multiple files
- ✅ Overnight automation jobs
- ✅ Large-scale testing and validation
- ✅ Multi-step workflow execution

**Not Recommended For:**

- ❌ Tasks requiring frequent user input
- ❌ Highly destructive operations without dry-run first
- ❌ Tasks where intermediate decisions are critical

### Configuration Options

```bash
# All iterate mode flags
ax run agent "task" \
  --iterate                           # Enable iterate mode
  --iterate-max-tokens 1000000        # Max total tokens (default: 1,000,000) [v8.6.0+]
  --iterate-max-tokens-per-iteration 100000  # Max per iteration (default: 100,000) [v8.6.0+]
  --iterate-timeout 60                # Max duration in minutes (default: 120)
  --iterate-strictness balanced       # Safety level: paranoid|balanced|permissive
  --iterate-dry-run                   # Test mode - no actual changes
```

### Performance

- **Classification Latency**: < 50ms per decision
- **Memory Usage**: Bounded to 100 classification entries
- **Context Cleanup**: Automatic expiration of old contexts
- **Timeout Enforcement**: Real-time monitoring with automatic shutdown

### Example Workflow

**Natural Language (Recommended)**:

```
# In Claude Code or Gemini CLI
"I need you to refactor the authentication module using ax backend agent.
First, do a dry run in iterate mode to show me what you plan to do.
Then if it looks good, run it in iterate mode with paranoid strictness
and a 30 minute timeout."
```

**More Natural Language Examples**:

```
# Comprehensive Bug Analysis (Long-running task)
"Please ultrathink to work with ax in iterate mode to find and fix bug"

# Large-Scale Refactoring
"Use ax backend agent in iterate mode to refactor the entire payment system.
Set timeout to 120 minutes and use balanced strictness."

# Security Audit with High Safety
"Work with ax security agent in iterate mode with paranoid strictness to audit
the entire codebase. This is for production so be very thorough."

# Performance Optimization
"Ask ax quality agent to analyze and optimize all database queries in iterate mode.
Use a 90 minute timeout with balanced strictness."

# Multi-File Test Generation
"Have ax quality agent run in iterate mode to generate tests for all untested
functions across the codebase. Set 60 minute timeout."
```

**Direct CLI Usage**:

```bash
# 1. Dry run to preview actions
ax run backend "refactor authentication module" \
  --iterate --iterate-dry-run

# 2. Run with tight safety controls
ax run backend "refactor authentication module" \
  --iterate \
  --iterate-strictness paranoid \
  --iterate-timeout 30

# 3. Monitor progress
tail -f .automatosx/logs/router-trace-*.jsonl
```

---

## 🎯 What Makes AutomatosX Different?

### Traditional AI Workflows

```bash
# ❌ Manual coordination
codex "Design auth system"
# → Copy/paste output

codex "Implement API from this design: [paste design]"
# → Repeat context, pay for duplicate tokens

codex "Write tests for this code: [paste code]"
# → Lost context, higher costs, manual orchestration

# Result: Slow, expensive, repetitive
```

### AutomatosX Workflows

```bash
# ✅ Declarative, automated, optimized
ax spec create "Build auth system with API, tests, and security audit"

# Result: Complete system generated and executed automatically
#   - Persistent memory eliminates context repetition
#   - Pure CLI orchestration - simple and reliable
#   - Parallel execution completes 3-5x faster
#   - Auto-generated tests provide 60%+ baseline coverage
```

---

## 📋 **NEW**: Spec-Kit Integration (v6.0+)

The game-changing feature that makes AutomatosX the most powerful AI workflow platform.

### Natural Language Spec Creation (Recommended)

Most users interact with AutomatosX through AI assistants (Claude Code, Gemini CLI, OpenAI Codex) using natural language. Here are practical examples:

```
# In Claude Code
"Create an ax workflow spec for building a complete authentication system
with JWT, OAuth2, database integration, security audit, and comprehensive tests.
Optimize for cost and generate the full project structure."

"I need a spec for a microservices architecture with user service, payment service,
API gateway, and Redis caching. Include deployment configs and monitoring."

"Generate a workflow spec for refactoring our legacy authentication code.
Include security review, performance optimization, and backwards compatibility tests."
```

```
# In Gemini CLI
"Use ax to create a spec for an e-commerce checkout flow with Stripe,
inventory management, fraud detection, and integration tests."

"Build me a spec for a data pipeline that ingests CSV files, transforms them,
loads to PostgreSQL, and includes data validation tests."

"Create a workflow spec for API versioning migration from v1 to v2 with
backwards compatibility and comprehensive test coverage."
```

```
# In OpenAI Codex
"Work with ax to generate a spec for a real-time chat application
with WebSocket support, message persistence, and E2E tests."

"Create a spec for migrating from REST to GraphQL with schema generation,
resolver implementation, and query performance tests."

"Generate an ax workflow for implementing RBAC (role-based access control)
with permissions management, audit logging, and security tests."
```

**What happens behind the scenes:**

When you ask an AI assistant to create a spec, it uses `ax spec create "your description"` which:

1. Generates a complete YAML workflow spec in `.specify/`
2. Creates execution plan
3. Generates dependency DAG for parallel execution
4. Scaffolds project structure
5. Generates comprehensive test suite
6. Ready to execute with your configured provider

### 1. Define Your Workflow in YAML

```yaml
# workflow.ax.yaml
metadata:
  id: user-auth-system
  name: User Authentication System

actors:
  - id: backend
    agent: backend
    description: Implement JWT authentication API

  - id: security
    agent: security
    description: Audit authentication implementation

  - id: quality
    agent: quality
    description: Generate comprehensive test suite
```

### 2. Generate Everything Automatically

```bash
# Generate execution plan with cost estimates
ax gen plan workflow.ax.yaml
# Output: Execution plan with phases, costs ($0.003-$0.008), risks

# Generate DAG for parallel execution
ax gen dag workflow.ax.yaml --format mermaid
# Output: Dependency graph with change detection hash

# Scaffold complete project structure
ax gen scaffold workflow.ax.yaml
# Output: Full directory structure, configs, READMEs

# Generate comprehensive test suite
ax gen tests workflow.ax.yaml
# Output: Unit, integration, E2E tests with policy assertions
```

### 3. Execute Workflow

```bash
# Run workflow
ax run workflow.ax.yaml

# AutomatosX automatically:
#   1. Executes actors with configured provider
#   2. Executes actors in optimal order
#   3. Logs all executions to trace file
#   4. Stores results in persistent memory
```

### 4. Debug with Complete Visibility

```bash
# View all executions
ax providers trace --follow

# Output (real-time):
# 18:26:49  EXECUTION    gemini-cli      Starting task...
# 18:26:50  EXECUTION    gemini-cli      Processing...
# 18:26:51  EXECUTION    gemini-cli      ✓ 1234ms, completed
```

**The Complete Workflow**:

```bash
# From idea to production in one command
ax spec create "Build e-commerce checkout with Stripe, inventory, and fraud detection" \
  && ax run workflow.ax.yaml

# AutomatosX handles:
#   ✅ Pure CLI orchestration (simple and reliable)
#   ✅ Parallel execution (3-5x faster)
#   ✅ Persistent memory (zero context repetition)
#   ✅ Auto-generated tests (60%+ coverage)
#   ✅ Complete observability (trace every execution)
```

---

## 🔌 Provider Configuration

AutomatosX is a pure CLI orchestration wrapper. It works with your existing AI CLI tools without requiring API keys (though API access is supported for some providers).

### Supported Providers

| Provider | CLI Command | API Support | Notes |
|----------|-------------|-------------|-------|
| **Claude Code** | `claude` | ✅ Yes | Official Anthropic CLI |
| **Gemini CLI** | `gemini` | ✅ Yes | Google's AI CLI |
| **Grok CLI** | `grok` | ✅ Yes | X.AI or Z.AI GLM 4.6 |
| **OpenAI Codex** | `codex` | ✅ Yes | OpenAI's development CLI |

### Configuration

```bash
# Configure default provider in automatosx.config.json
{
  "providers": {
    "default": "gemini",  # or claude, grok, codex
    "claude": { "enabled": true },
    "gemini": { "enabled": true },
    "grok": { "enabled": true },
    "codex": { "enabled": true }
  }
}

# Use specific provider for a task
ax run backend "task" --provider gemini
ax run security "audit" --provider claude

# Check provider status
ax doctor          # Check all providers
ax doctor grok     # Check specific provider
ax providers list  # List available providers
```

**Learn More**:

- [Gemini Integration Guide](docs/providers/gemini.md) - Gemini CLI setup
- [Grok Integration Guide](GROK.md) - Grok CLI setup (X.AI, Z.AI, or self-hosted)
- [Provider Comparison](docs/providers/overview.md) - Provider comparison

---

## 🧠 Persistent Memory: Context That Never Expires

AutomatosX **never forgets**. Every conversation, decision, and piece of code is automatically indexed in a local SQLite database with full-text search. Future tasks get perfect context automatically.

### The Problem with Traditional AI

```bash
# Day 1: Design a calculator
codex "Design a calculator with add/subtract"
# → Response: [Calculator design]

# Day 2: Implement it (context lost!)
codex "Implement the calculator"
# → Error: "What calculator? Please provide context."
# → You waste time and money re-explaining
```

### AutomatosX Solution

```bash
# Day 1: Design
ax run product "Design a calculator with add/subtract"
# → Automatically saved to memory

# Day 2: Implement (context auto-injected!)
ax run backend "Implement the calculator"
# → Memory finds "calculator" design from Day 1
# → Backend agent gets full context automatically
# → Zero context repetition, zero wasted tokens
```

### Memory Features

- **Speed**: < 1ms search with SQLite FTS5
- **Cost**: $0 (no embedding APIs)
- **Privacy**: 100% local (data never leaves your machine)
- **Search**: `ax memory search "calculator"`
- **Export**: `ax memory export > backup.json`

---

## 🤝 Multi-Agent Orchestration

Stop micromanaging AI. Give a high-level goal to one agent, and AutomatosX creates a plan, delegates tasks, and orchestrates a team of specialists.

### How It Works

```bash
# 1. Give a high-level goal
ax run product "Build complete user authentication"

# 2. Product agent analyzes and delegates
# Output:
# "I'll design auth with JWT and OAuth2.
#
#  @backend Please implement the JWT authentication API.
#  @security Please audit the implementation for vulnerabilities.
#  @quality Please write integration tests."

# 3. AutomatosX executes automatically
#    - Backend implements API
#    - Security audits code
#    - Quality writes tests
#    - All in parallel, all with full context
```

### 20 Specialized Agents

Each agent is an expert in their domain:

| Agent | Role | Use Cases |
|-------|------|-----------|
| **Bob** | Backend Engineer | API design, databases, Go/Rust systems |
| **Frank** | Frontend Engineer | React/Next.js, UI components, state management |
| **Avery** | Software Architect | System architecture, ADR management, architecture runway |
| **Steve** | Security Specialist | Threat modeling, vulnerability assessment, penetration testing |
| **Queenie** | QA Engineer | Test planning, E2E testing, quality assurance |
| **Oliver** | DevOps Engineer | CI/CD, Kubernetes, infrastructure automation |
| **Paris** | Product Manager | Requirements, roadmaps, stakeholder alignment |
| **Daisy** | Data Engineer | ETL pipelines, data warehouses, Spark |
| **Dana** | Data Scientist | ML models, statistical analysis, Python |
| **Tony** | CTO | Technical strategy, architecture, scaling |
| **Eric** | CEO | Business strategy, vision, leadership |
| **Wendy** | Technical Writer | Documentation, API docs, tutorials |
| **Stan** | Standards Expert | Best practices, design patterns, code review |

[See all 20 agents](docs/guides/agents.md) | [Create custom agents](docs/guides/agent-templates.md)

---

## 🏗️ Architecture: How It All Fits Together

```
┌─────────────────────────────────────────────────────────────┐
│  1. YAML Spec (workflow.ax.yaml)                           │
│     • Define actors and workflow steps                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Spec-Kit Generation (ax gen)                           │
│     • Plan: Execution plan with resource requirements       │
│     • DAG: Dependency graph with change detection hash      │
│     • Scaffold: Complete project structure                  │
│     • Tests: Unit, integration, E2E test suites            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. CLI Orchestration (Router)                             │
│     • Execute with configured provider                      │
│     • Wrap claude/gemini/grok/codex CLI calls              │
│     • Fallback on failure                                   │
│     • Log all executions to trace file                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Memory & Context (MemoryManager)                        │
│     • Index: Save response to SQLite FTS5                   │
│     • Retrieve: Search < 1ms for future tasks               │
│     • Inject: Auto-add context to prompts                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Observability (RouterTraceLogger)                       │
│     • Log: JSONL trace to .automatosx/logs/                │
│     • View: ax providers trace --follow                     │
│     • Debug: Complete visibility into all executions        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📚 Real-World Examples

### Example 1: E-Commerce Checkout System

```yaml
# checkout.ax.yaml
metadata:
  id: ecommerce-checkout
  name: E-Commerce Checkout System

actors:
  - id: backend
    agent: backend
    description: Implement Stripe integration and inventory management

  - id: security
    agent: security
    description: Implement fraud detection and PCI compliance checks

  - id: quality
    agent: quality
    description: E2E tests for checkout flow with Stripe test mode
```

```bash
# Generate and execute
ax gen plan checkout.ax.yaml     # Generate execution plan
ax gen scaffold checkout.ax.yaml # Create project structure
ax gen tests checkout.ax.yaml    # Generate test suite
ax run checkout.ax.yaml          # Execute workflow

# Result:
#   - Complete Stripe integration
#   - Fraud detection system
#   - PCI compliant
#   - 60%+ test coverage
```

### Example 2: Microservices API

```bash
# Natural language workflow
ax spec create "Build microservices API with user service, auth service, API gateway, and Docker deployment"

# AutomatosX generates:
#   - Service architecture design
#   - Three microservices in parallel
#   - API gateway with rate limiting
#   - Docker compose configuration
#   - Integration tests
#   - Documentation

# Execute workflow
ax run workflow.ax.yaml

# Monitor executions
ax providers trace --follow
```

---

## 🎨 Advanced Features

### Parallel Execution

```bash
# Execute tasks in parallel for 3-5x speedup
ax spec run --parallel

# AutomatosX automatically:
#   - Builds dependency graph
#   - Runs independent tasks concurrently
#   - Waits for dependencies before starting
#   - Aggregates results
```

### Checkpoints & Resume

```bash
# Long-running workflows save checkpoints
ax spec run --resumable

# Interrupt anytime (Ctrl+C)
# Resume from last checkpoint
ax resume <run-id>

# List all runs
ax runs list
```

### Change Detection

```bash
# Generate DAG with hash
ax gen dag workflow.ax.yaml -o dag.json

# DAG stores spec hash for change detection
# If spec changes, AutomatosX warns you before execution
ax run dag.json
# → Warning: Spec has changed. Regenerate DAG? (Y/n)
```

### 🎯 Enterprise MCP Server Management (Phase 4)

**NEW in v8.5.3**: Production-ready Model Context Protocol (MCP) server orchestration with comprehensive lifecycle management, auto-installation, and enterprise-grade monitoring.

#### **Phase 4A: Lifecycle Management**
```bash
# Start AutomatosX as MCP server for Claude Code
ax mcp server

# Monitor server status
ax mcp status

# View lifecycle events
ax mcp logs --follow

# All server events are logged to:
# .automatosx/logs/mcp/lifecycle-events.jsonl
```

**Features**:
- ✅ Comprehensive event logging (start/stop/restart/crash/health)
- ✅ Automatic log rotation when file exceeds size limit
- ✅ Event history retrieval for debugging
- ✅ JSONL format for machine-readable logs

#### **Phase 4B: Auto-Installation**
```bash
# Discover available MCP servers
ax mcp discover

# Install MCP server packages
ax mcp install @modelcontextprotocol/server-filesystem
ax mcp install @modelcontextprotocol/server-github
ax mcp install @modelcontextprotocol/server-git

# Install multiple packages in parallel
ax mcp install --batch filesystem github git

# Update installed servers
ax mcp update @modelcontextprotocol/server-filesystem
```

**Features**:
- ✅ NPM registry search and package discovery
- ✅ One-command installation for MCP servers
- ✅ Support for npm, yarn, and pnpm package managers
- ✅ Batch installation for faster setup
- ✅ Version management (update, uninstall)
- ✅ Dry-run mode for testing installations

#### **Phase 4C: Configuration Hot-Reload**
```bash
# Edit MCP configuration (changes apply automatically)
vim automatosx.config.json

# Configuration changes are detected and applied without restart!
# - Server configurations updated
# - Security limits adjusted
# - Health check settings modified
```

**Features**:
- ✅ Configuration hot-reload without server restart
- ✅ File watching with debounced change detection (1 second)
- ✅ Comprehensive validation with error and warning reporting
- ✅ Change event notifications for dynamic updates
- ✅ Default configuration fallback

#### **Phase 4D: Performance Monitoring**
```bash
# View real-time metrics for all servers
ax mcp metrics

# Show detailed metrics for specific server
ax mcp metrics filesystem-server

# View metrics summary
ax mcp metrics --summary

# Export metrics history
ax mcp metrics --export > metrics.json
```

**Metrics Collected**:
- ✅ CPU usage percentage per server
- ✅ Memory usage (MB) per server
- ✅ Server uptime (seconds)
- ✅ Total requests handled
- ✅ Failed requests count
- ✅ Average/min/max response times
- ✅ Restart count
- ✅ Time-series data with configurable retention (default: 24 hours)

#### **Phase 4E: Resource Limits & Security**
```bash
# View current resource limits
ax mcp limits

# Set custom limits for specific server
ax mcp limits filesystem-server --memory 1024 --cpu 75

# Configure enforcement mode (warn/throttle/kill)
ax config set mcp.security.enforcementMode throttle
```

**Security Features**:
- ✅ Resource limit enforcement (CPU, memory)
- ✅ Configurable enforcement modes:
  - `warn` - Log violations only
  - `throttle` - Temporarily pause violating processes (SIGSTOP/SIGCONT)
  - `kill` - Terminate violating processes (SIGKILL)
- ✅ Grace period before enforcement (default: 10 seconds)
- ✅ Per-server limit overrides
- ✅ Violation event logging and alerting
- ✅ Filesystem and network restrictions

#### **Configuration Example**
```json
{
  "mcp": {
    "enabled": true,
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-filesystem", "/allowed/path"],
        "enabled": true
      }
    ],
    "discovery": {
      "enabled": true,
      "packagePrefixes": ["@modelcontextprotocol/server-"]
    },
    "security": {
      "limits": {
        "maxServers": 10,
        "maxMemoryPerServer": 512,
        "maxCpuPerServer": 50
      },
      "filesystem": {
        "allowedPaths": ["/home/user/data"],
        "deniedPaths": ["/home/user/.ssh"]
      }
    },
    "healthCheck": {
      "enabled": true,
      "intervalMs": 60000,
      "restartOnFailure": true
    },
    "logging": {
      "logServerOutput": true,
      "logLevel": "info"
    }
  }
}
```

#### **Performance Impact**
- Memory overhead: ~8-10 MB (with 24h metrics retention)
- CPU overhead: ~3-5% (periodic monitoring tasks)
- Startup time: +50ms for Phase 4 initialization

**Production-Ready**: All Phase 4 features are fully backward compatible and opt-in. Enable what you need, when you need it.

---

## 📖 Documentation

### Getting Started

- **[3-Minute Quickstart](docs/getting-started/quickstart-3min.md)** ⚡ **[NEW]** - Get productive in under 3 minutes
- [Quick Start Guide](docs/getting-started/quick-start.md) - Get running in 5 minutes
- [Installation](docs/getting-started/installation.md) - Detailed installation instructions
- [Configuration](docs/guides/configuration.md) - Configure providers and settings

### Core Features

- **[Spec-Kit Usage Guide](docs/guides/spec-kit-guide.md)** 📋 **[NEW]** - Complete YAML workflow guide with examples
- **[Iteration Mode Guide](docs/guides/iteration-mode-guide.md)** 🔄 **[NEW]** - Multi-iteration autonomous analysis
- [Provider Configuration](docs/providers/overview.md) - Multi-provider CLI orchestration
- [Persistent Memory](docs/guides/agent-communication.md) - Context management
- [Multi-Agent Orchestration](docs/guides/multi-agent-orchestration.md) - Team coordination

### Advanced

- [Custom Agents](docs/guides/agent-templates.md) - Create your own specialists
- [Provider Configuration](docs/providers/overview.md) - Add AI providers
- [Performance & Caching](docs/advanced/performance.md) - Optimization techniques
- [Parallel Execution](docs/advanced/parallel-execution.md) - Scale your workflows

### Reference

- [Agent Directory](docs/guides/agents.md) - All 20 agents
- [CLI Reference](docs/reference/cli-commands.md) - All commands
- [Provider Comparison](docs/providers/overview.md) - Provider features and costs
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

---

## 🏆 Why AutomatosX Wins

| Capability | AutomatosX | Claude Code | Cursor | GitHub Copilot |
|------------|------------|-------------|--------|----------------|
| **Declarative Workflows** | ✅ YAML specs | ❌ | ❌ | ❌ |
| **Auto-Generation** | ✅ Plans, DAGs, scaffolds, tests | ❌ | ❌ | ❌ |
| **CLI Orchestration** | ✅ Pure wrapper around AI CLIs | ❌ | ❌ | ❌ |
| **Persistent Memory** | ✅ SQLite FTS5 < 1ms | ❌ | ❌ | ❌ |
| **Multi-Agent Teams** | ✅ 20 specialists | ❌ | ❌ | ❌ |
| **Multi-Provider Support** | ✅ Claude, Gemini, Grok, Codex | ⚠️ Claude only | ⚠️ Limited | ⚠️ Limited |
| **MCP Server Management** | ✅ Enterprise-grade (Phase 4) | ⚠️ Basic | ❌ | ❌ |
| **Complete Observability** | ✅ Trace logging + metrics | ❌ | ❌ | ❌ |
| **Parallel Execution** | ✅ DAG-based | ❌ | ❌ | ❌ |
| **Local-First** | ✅ 100% private | ⚠️ Hybrid | ⚠️ Cloud | ⚠️ Cloud |

**Bottom Line**: AutomatosX is the **only platform** that combines declarative workflows, persistent memory, multi-agent orchestration, enterprise MCP management, and pure CLI orchestration in one tool.

---

## 🚦 Production Readiness

✅ **v8.5.3 Released** - Enterprise MCP Phase 4 complete
✅ **v7.0.0 Released** - Natural language-first design, unified setup
✅ **100% Complete** - Spec-Kit integration + MCP management fully implemented
✅ **2,512+ Tests Passing** - Comprehensive test coverage
✅ **TypeScript Strict Mode** - Type-safe codebase
✅ **Enterprise MCP** - Production-ready server lifecycle, metrics, security
✅ **Zero Resource Leaks** - Clean shutdown guaranteed
✅ **Cross-Platform** - macOS, Windows, Ubuntu
✅ **Local-First** - No cloud dependencies, 100% private

---

## 💻 Installation

### NPM (Recommended)

```bash
npm install -g @defai.digital/automatosx
ax --version  # v7.0.0
```

### ⚠️ REQUIRED: Initialize Your Project

**After installing, you MUST run `ax setup` in your project directory to initialize the AutomatosX workspace:**

```bash
# Navigate to your project directory
cd your-project

# Set up AutomatosX (creates .automatosx/ with agents and config)
ax setup

# Or force reinitialize if you already have a .automatosx/ directory
ax setup -f
```

**What `ax setup` does:**

- ✅ Creates `.automatosx/` directory structure
- ✅ Installs all 20 specialized agents (backend, frontend, security, etc.)
- ✅ Generates `automatosx.config.json` with optimal defaults
- ✅ Initializes SQLite memory database
- ✅ Sets up session management
- ✅ Configures trace logging

**Without running `ax setup`, AutomatosX commands will not work properly!**

### ✨ Optional: AI-Powered Setup (v7.1.2+)

For a more advanced, AI-driven setup, you can use the `ax init` command. It analyzes your project to create a tailored integration guide (`ax.md`) for AI assistants.

```bash
# Run the interactive, AI-powered initialization
ax init
```
Use `ax setup` for the standard, essential setup. Use `ax init` for an enhanced AI integration experience.**

### Requirements

- **Node.js**: >= 20.0.0
- **AI Providers**: At least one:
  - [Gemini CLI](https://ai.google.dev/gemini-api/docs/cli) (recommended - cheapest)
  - [OpenAI Codex](https://platform.openai.com/docs/guides/code) (fastest)
  - [Claude Code](https://claude.ai/code) (most capable)
  - [Grok CLI](#-grok-cli-configuration-new-in-v831) (X.AI or self-hosted GLM 4.6)

[➡️ Full Installation Guide](docs/getting-started/installation.md)

### 🤖 Grok CLI Configuration (New in v8.3.1)

AutomatosX now supports Grok CLI with **two endpoints**:

#### Option 1: X.AI Official Grok (Recommended)

```bash
# 1. Run setup to create .grok/settings.json
ax setup

# 2. Edit .grok/settings.json
{
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast",
  "apiKey": "xai-your-key-here"
}

# 3. Enable in automatosx.config.json
"grok": { "enabled": true }

# 4. Verify
ax doctor grok
ax providers list
```

**Get X.AI API Key**: https://console.x.ai/api-keys

#### Option 2: Z.AI GLM 4.6 (Code-Optimized)

```bash
# Edit .grok/settings.json
{
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6",
  "apiKey": "your-zai-key"
}
```

**Get Z.AI API Key**: https://z.ai/developer

#### Option 3: Self-Hosted GLM 4.6 API Server

**Use your own local coding system with AutomatosX!**

You can point AutomatosX to your own GLM 4.6 API server for complete control:

```bash
# Edit .grok/settings.json
{
  "baseURL": "http://localhost:8000/v1",  # Your local API server
  "model": "glm-4.6",
  "apiKey": "your-local-api-key"  # Optional if your server requires it
}
```

**Benefits of Self-Hosted:**
- 🏠 Complete data privacy - all processing stays local
- 💰 No usage costs - run as much as you want
- ⚡ Lower latency - no network round trips
- 🔧 Full customization - fine-tune the model for your needs
- 🔒 Enterprise security - meets corporate requirements

**Popular GLM 4.6 API Server Implementations:**
- [vLLM](https://github.com/vllm-project/vllm) - Fast inference server
- [Text Generation Inference](https://github.com/huggingface/text-generation-inference) - HuggingFace's solution
- [Ollama](https://ollama.ai) - Easy local deployment
- Custom FastAPI/Flask wrapper around GLM 4.6

**Example Docker Setup:**
```bash
# Run GLM 4.6 API server locally
docker run -d \
  -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:latest \
  --model THUDM/glm-4-6 \
  --port 8000

# Configure AutomatosX to use it
# Edit .grok/settings.json with baseURL: "http://localhost:8000/v1"
```

**📄 License Note for Self-Hosted/Commercial Use:**

AutomatosX is licensed under Apache 2.0 for **non-commercial use**. For commercial use or to remove license restrictions:

- 💼 **Commercial License**: Visit https://license.defai.digital/automatosx
- 📋 **Custom Terms**: Available for enterprise deployments
- 🤝 **Volume Discounts**: Contact us for team/organization pricing

**See [GROK.md](GROK.md) for complete setup guide, including:**
- Model comparison (grok-3-fast vs glm-4.6)
- Environment variable configuration
- Switching between endpoints
- Troubleshooting guide
- Cost optimization tips

---

## 🗺️ Roadmap

### Completed (v6.0.0 - v7.0.0)

- ✅ **v7.0.0 - Natural Language First** (Latest)
  - ✅ Unified setup command (init→setup)
  - ✅ Natural language-only interaction
  - ✅ Enhanced force mode with complete cleanup
  - ✅ Removed slash command dependencies
- ✅ **v8.3.0 - Major Simplification** (Latest)
  - ✅ Removed policy routing, free-tier management (~36,000 lines)
  - ✅ Pure CLI orchestration wrapper
  - ✅ Streamlined architecture
  - ✅ Focus on core features
- ✅ Spec-Kit Integration (100%)
  - ✅ Plan generation
  - ✅ DAG generation
  - ✅ Scaffold generation
  - ✅ Test generation
  - ✅ Regeneration Detector (v6.5.6)
- ✅ CLI Orchestration
  - ✅ Multi-provider support (Claude, Gemini, Grok, Codex)
  - ✅ Pure CLI wrapper (no API key required for CLI mode)
  - ✅ Fallback and retry logic
- ✅ Router Trace Logging
  - ✅ JSONL format
  - ✅ Real-time following
  - ✅ Color-coded CLI

### Coming Soon (v8.5.3+)

- ⏳ Enhanced Spec Features
  - Advanced DAG visualization
  - Workflow templates library
  - Interactive spec builder
- ⏳ Enhanced Parallel Execution
  - Resource-aware scheduling
  - Priority-based execution

[View Full Roadmap](#roadmap)

---

## 🔄 Migration from v6.x

**v7.0.0 introduces breaking changes. Follow this guide to upgrade:**

### Breaking Changes

1. **Command Rename**: `ax init` → `ax setup`
   ```bash
   # ❌ v6.x (deprecated)
   ax init

   # ✅ v7.0.0 (new)
   ax setup
   ```

2. **Slash Commands Removed**: Natural language only
   - ❌ No more `.claude/commands/ax-*.md` files
   - ❌ No more `.gemini/commands/ax-*.toml` files
   - ✅ Use natural language with AI assistants instead

   ```
   # ✅ v7.0.0 - Natural language (recommended)
   "Please use ax to implement user authentication"
   "Work with ax to audit this code for security issues"
   "Have ax write tests for this feature"
   ```

3. **Enhanced Force Mode**: Complete cleanup on `ax setup --force`
   - Now removes `.automatosx/` directory completely
   - Removes all `.claude/commands/ax-*` files
   - Removes all `.gemini/commands/ax-*` files
   - Ensures clean reinstall with no leftover files

### Migration Steps

1. **Update AutomatosX**:
   ```bash
   npm update -g @defai.digital/automatosx
   ax --version  # Should show v7.0.0
   ```

2. **Clean Install** (Recommended):
   ```bash
   cd your-project
   ax setup --force  # Complete cleanup and reinstall
   ```

3. **Update Scripts**: Change any scripts using `ax init` to `ax setup`
   ```bash
   # Update in package.json, shell scripts, CI/CD configs
   sed -i '' 's/ax init/ax setup/g' package.json
   ```

4. **Remove Custom Slash Commands** (if you had any):
   ```bash
   # These are no longer needed
   rm -rf .claude/commands/ax-*
   rm -rf .gemini/commands/ax-*
   ```

5. **Update Documentation**: Search your docs for `ax init` references

### What Stays the Same

- ✅ All agent functionality unchanged
- ✅ Memory system works the same
- ✅ Spec-Kit features unchanged
- ✅ CLI orchestration works the same
- ✅ Multi-provider support unchanged
- ✅ CLI command syntax (except init→setup)

### Need Help?

- [CHANGELOG.md](CHANGELOG.md) - Full v7.0.0 changes
- [GitHub Issues](https://github.com/defai-digital/automatosx/issues) - Report migration issues
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common problems

[View Full Roadmap](#roadmap)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone the repo
git clone https://github.com/defai-digital/automatosx.git
cd automatosx

# Install dependencies
npm install

# Run in dev mode
npm run dev -- run backend "test task"

# Run tests
npm test

# Run type checking
npm run typecheck

# Build
npm run build
```

---

## 📄 License

AutomatosX is dual-licensed:

- **Apache License 2.0** - See [LICENSE](LICENSE) for code licensing
- **Commercial License with OpenRAIL-M** - See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for commercial use and model restrictions

### TL;DR - When Do You Need a Commercial License?

**✅ FREE for**:
- Research and academic use
- Personal projects
- Startups with < $2M revenue AND < $2M funding

**❌ Commercial License Required for**:
- Companies with ≥ $2M annual revenue OR ≥ $2M total funding
- Competitive products against DEFAI's offerings
- SaaS or managed services built on AutomatosX
- Commercial redistribution or embedding

**Learn more**: See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for full details.

**Get a commercial license**: https://license.defai.digital/automatox

Copyright 2025 DEFAI Private Limited

---

## 🌟 Star Us on GitHub

If AutomatosX saves you time and money, give us a star! ⭐

[⭐ Star on GitHub](https://github.com/defai-digital/automatosx)

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- **Email**: <support@defai.digital>

---


<p align="center">
  Made with ❤️ by <a href="https://defai.digital">DEFAI Digital</a>
</p>
