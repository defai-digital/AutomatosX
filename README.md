# AutomatosX

**From Idea to Production in Minutes: The AI Workforce Platform with Persistent Memory**

AutomatosX is a pure CLI orchestration platform for AI agents. It wraps around `claude`, `gemini`, and `codex` commands to provide multi-agent orchestration, persistent memory, and workflow automation. Simple, focused, and easy to integrate with your existing AI workflow.

[![npm version](https://img.shields.io/npm/v/@defai.digital/automatosx.svg)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-2,423+%20passing-brightgreen.svg)](#)
[![npm](https://img.shields.io/npm/dt/%40defai.digital%2Fautomatosx.svg?label=total%20downloads&color=blue)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue.svg)](https://ubuntu.com)

**Status**: ✅ **Production Ready** | v8.4.8 | 20 Specialized Agents | Pure CLI Orchestration | Simplified Architecture

> 🎉 **NEW in v8.3.0**: Major simplification! Removed ~36,000 lines of code including policy routing, free-tier management, and SDK providers. AutomatosX is now a pure CLI orchestration wrapper around `claude`, `gemini`, and `codex` commands. Simpler, faster, easier to maintain. See [Migration Guide](MIGRATION.md) for upgrade details.

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
| 🔧 **Pure CLI Wrapper** | Works with your existing `claude`, `gemini`, `codex` CLIs. No API keys needed. | Simple integration |
| 🔍 **Complete Observability** | Trace every execution and decision. Debug with confidence. | Production-grade reliability |

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
#   ✅ Creates execution plan with cost estimates
#   ✅ Generates DAG for parallel execution
#   ✅ Scaffolds project structure
#   ✅ Generates comprehensive tests
#   ✅ Executes with policy-optimized routing
#   ✅ Tracks all decisions with trace logging

# 5. View the generated plan
ax gen plan workflow.ax.yaml

# 6. Execute the workflow (with cost optimization)
ax run workflow.ax.yaml
```

**Result**: Complete authentication system with database, API, security audit, and tests—generated and executed in minutes, not days.

---

## 🗣️ **Recommended**: Natural Language Interface

AutomatosX is designed to work seamlessly with AI assistants using natural language commands. This is the **recommended way** to use AutomatosX:

**✨ Key Feature**: AutomatosX **automatically selects the best agent(s)** for your task. You don't need to specify which agent to use - just describe what you want!

### Use with Claude Code, Gemini CLI, or OpenAI Codex

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

**Workflow Creation and Execution**:

```
# In Claude Code
"Create an AutomatosX workflow spec for a REST API with authentication, database,
and comprehensive tests. Then execute it with cost optimization."

"Generate a spec for refactoring the payment module with security audit and
backwards compatibility tests. Use the backend and security agents."

"Build a complete microservices architecture spec with service mesh, monitoring,
and deployment configs. Execute with Gemini for cost savings."
```

```
# In Gemini CLI
"Use AutomatosX to create and execute a workflow for migrating from MongoDB
to PostgreSQL. Include data validation and rollback procedures."

"Generate a spec for implementing rate limiting across all API endpoints.
Include security review and load testing."

"Create a workflow for adding GraphQL to our REST API. Include schema
generation, resolver tests, and performance benchmarks."
```

```
# In OpenAI Codex
"Work with AutomatosX to build a real-time notification system with WebSockets,
Redis, and push notifications. Generate the full workflow spec."

"Create and execute a spec for implementing OAuth2 with Google, GitHub, and
Facebook providers. Include security audit and integration tests."

"Generate a workflow for database migration with zero downtime. Include
blue-green deployment strategy and rollback automation."
```

**Multi-Agent Orchestration**:

```
# In Claude Code
"Use AutomatosX to build a complete e-commerce platform with requirements,
architecture, API, database, React UI, security audit, and comprehensive tests.
Use balanced policy for cost and speed."

"Work with AutomatosX to implement a data analytics pipeline with API,
ETL, and data warehousing."
```

**Long-Running Tasks with Iterate Mode**:

Iterate mode is perfect for autonomous, repeating tasks without constant questions:

```
# In Claude Code - Autonomous Bug-Finding (The Real Power!)
"Please use ax in iterate mode to find and fix bugs. Run 5 iterations."

# This will autonomously:
# - Iterate 1: Scan for parseInt/JSON.parse safety issues → Find & fix bugs
# - Iterate 2: Check array access patterns → Find & fix bugs
# - Iterate 3: Analyze async/await error handling → Find & fix bugs
# - Iterate 4: Search for race conditions → Find & fix bugs
# - Iterate 5: Verify resource cleanup → Find & fix bugs
# NO questions asked - just autonomous work!
```

```
# In Gemini CLI - Comprehensive Code Analysis
"Use ax in iterate mode to analyze the entire codebase for
performance issues. Set 120 minute timeout with balanced strictness."

# This runs multiple analysis passes autonomously:
# - Memory profiling across all modules
# - Database query optimization
# - API response time analysis
# - Resource utilization patterns
```

```
# In OpenAI Codex - Security Hardening
"Use ax to run a comprehensive security audit in iterate mode
with strict level. This is for production deployment."

# Autonomous security iterations:
# - SQL injection scanning
# - XSS vulnerability detection
# - Authentication bypass attempts
# - Authorization flaw discovery
# - Cryptography weakness analysis
```

**Why Iterate Mode is Powerful**:

- 🔄 **Autonomous Loops**: Repeats tasks without asking questions
- 🎯 **Systematic**: Each iteration focuses on different aspects
- 📊 **Comprehensive**: Covers more ground than manual analysis
- ✅ **Auto-Fix**: Finds AND fixes issues autonomously
- 🚀 **De Facto Best Practice**: Industry-standard autonomous workflows

### Why Natural Language?

- ✅ **Conversational**: Talk to AI assistants like teammates
- ✅ **Context-aware**: AI assistants maintain full conversation context
- ✅ **Flexible**: No need to remember exact command syntax
- ✅ **Integrated**: Works directly in your AI assistant workflow
- ✅ **Powerful**: Combines AI assistant capabilities with AutomatosX's memory and orchestration
- ✅ **Cost-Optimized**: AutomatosX automatically selects the cheapest provider based on your constraints
- ✅ **Production-Ready**: Full observability and trace logging for debugging

### Behind the Scenes

When you say "use AutomatosX to implement authentication", here's what happens:

1. AI assistant calls `ax run "implement user authentication"`
2. AutomatosX **automatically analyzes the task** and selects the best agent(s)
3. Routes to the optimal provider based on policy (cost, latency, reliability)
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
export AUTOMATOSX_CLI_ONLY=true

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

## 🤖 **NEW**: Iterate Mode - Autonomous Agent Execution (v6.5.0+)

**The Future of AI Agent Automation**

Iterate Mode enables agents to run autonomously without user intervention, automatically responding to confirmations while maintaining strict safety controls. This is perfect for long-running tasks, batch processing, or overnight automation.

### Natural Language Usage (Recommended)

Use iterate mode naturally through AI assistants - just ask them to use iterate mode:

```
# In Claude Code
"Please use AutomatosX in iterate mode to refactor the entire authentication
module. Set timeout to 60 minutes with balanced strictness."

"Use AutomatosX to run a comprehensive security audit in iterate mode with
strict level. This is for production code so be extra careful."

"Have AutomatosX run in iterate mode to generate tests for all untested
functions. Use dry-run first to preview what it will do."
```

```
# In Gemini CLI
"Use AutomatosX with iterate mode to implement the new payment gateway.
Set a 90 minute timeout and use balanced strictness."

"Run AutomatosX in iterate mode with strict level to audit the
codebase for vulnerabilities. Do a dry-run first."
```

```
# In OpenAI Codex
"Work with AutomatosX in autonomous iterate mode to refactor database
queries. Limit execution to 45 minutes with balanced strictness."

"Use AutomatosX in iterate mode to optimize all SQL queries. Run in dry-run
mode first to see the plan."
```

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

The AI assistant will:

1. Run dry-run first: `ax run backend "refactor authentication" --iterate --iterate-dry-run`
2. Show you the preview
3. Wait for your approval
4. Execute with safety controls: `ax run backend "refactor authentication" --iterate --iterate-strictness paranoid --iterate-timeout 30`

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
#   - Policy routing saves 60-80% on API costs
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
"Create an AutomatosX workflow spec for building a complete authentication system
with JWT, OAuth2, database integration, security audit, and comprehensive tests.
Optimize for cost and generate the full project structure."

"I need a spec for a microservices architecture with user service, payment service,
API gateway, and Redis caching. Include deployment configs and monitoring."

"Generate a workflow spec for refactoring our legacy authentication code.
Include security review, performance optimization, and backwards compatibility tests."
```

```
# In Gemini CLI
"Use AutomatosX to create a spec for an e-commerce checkout flow with Stripe,
inventory management, fraud detection, and integration tests."

"Build me a spec for a data pipeline that ingests CSV files, transforms them,
loads to PostgreSQL, and includes data validation tests."

"Create a workflow spec for API versioning migration from v1 to v2 with
backwards compatibility and comprehensive test coverage."
```

```
# In OpenAI Codex
"Work with AutomatosX to generate a spec for a real-time chat application
with WebSocket support, message persistence, and E2E tests."

"Create a spec for migrating from REST to GraphQL with schema generation,
resolver implementation, and query performance tests."

"Generate an AutomatosX workflow for implementing RBAC (role-based access control)
with permissions management, audit logging, and security tests."
```

**What happens behind the scenes:**

When you ask an AI assistant to create a spec, it uses `ax spec create "your description"` which:

1. Generates a complete YAML workflow spec in `.specify/`
2. Creates execution plan with cost estimates
3. Generates dependency DAG for parallel execution
4. Scaffolds project structure
5. Generates comprehensive test suite
6. All optimized based on your policy constraints (cost, latency, privacy)

### 1. Define Your Workflow in YAML

```yaml
# workflow.ax.yaml
metadata:
  id: user-auth-system
  name: User Authentication System

# Policy-driven routing: Optimize for cost
policy:
  goal: cost
  constraints:
    cost:
      maxPerRequest: 0.01
      maxDaily: 0.50
    latency:
      p95: 5000

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

### 3. Execute with Policy Optimization

```bash
# Run workflow with cost optimization
ax run workflow.ax.yaml

# AutomatosX automatically:
#   1. Filters providers by cost constraint ($0.01/request)
#   2. Selects cheapest provider (Gemini: $0.000125/1K tokens)
#   3. Executes actors in optimal order
#   4. Logs all decisions to trace file
#   5. Stays within budget ($0.50/day)
```

### 4. Debug with Complete Visibility

```bash
# View all routing decisions
ax providers trace --follow

# Output (real-time):
# 18:26:49  POLICY       gemini-cli      goal=cost, passed=2/3
# 18:26:50  SELECTION    gemini-cli      3 candidates → policy-based selection
# 18:26:51  EXECUTION    gemini-cli      ✓ 1234ms, $0.000375
```

**The Complete Workflow**:

```bash
# From idea to production in one command
ax spec create "Build e-commerce checkout with Stripe, inventory, and fraud detection" \
  && ax run workflow.ax.yaml

# AutomatosX handles:
#   ✅ Cost optimization (saves 60-80% vs Claude/GPT)
#   ✅ Parallel execution (3-5x faster)
#   ✅ Persistent memory (zero context repetition)
#   ✅ Auto-generated tests (60%+ coverage)
#   ✅ Complete observability (trace every decision)
```

---

## 💰 Policy-Driven Cost Optimization

> **Note**: Cost estimation is disabled by default (v6.5.11+). The routing and optimization features work the same, but cost estimates are not shown. See [Cost Estimation Configuration](#cost-estimation-configuration) to enable.

AutomatosX is the **only AI platform with built-in cost optimization**. Define your budget and constraints—AutomatosX automatically routes every request to the optimal provider.

### How It Works

```yaml
# Set your constraints in the spec
policy:
  goal: cost  # Options: cost, latency, reliability, balanced

  constraints:
    cost:
      maxPerRequest: 0.01    # Max $0.01 per request
      maxDaily: 1.00         # Max $1.00 per day

    latency:
      p95: 5000              # Max 5 seconds at P95

    privacy:
      allowedClouds: [gcp]   # Only Google Cloud providers
```

**AutomatosX Routes Intelligently**:

| Provider | Cost/1M Tokens | Speed (P95) | Free Tier | When AutomatosX Uses It |
|----------|----------------|-------------|-----------|-------------------------|
| **Gemini CLI** | $0.125-$0.375 | 3000ms | **1,500 req/day** | Cost-optimized workflows (default) |
| OpenAI (Codex) | $2.50-$10.00 | 2000ms | None | Speed-critical tasks |
| Claude Code | $3.00-$15.00 | 2500ms | None | High-reliability tasks |

**Real Savings** (1,000 requests/month, 10K tokens each):

```bash
# Traditional workflow (all Claude)
Monthly cost: $90,000
Annual cost:  $1,080,000

# Basic optimization (Gemini paid tier)
Monthly cost: $2,500   (97% savings)
Annual cost:  $30,000

# AutomatosX with free tier utilization
Monthly cost: $50      (99.6% savings!)
Annual cost:  $600

💰 Total annual savings: $1,079,400
```

**How We Achieve 99.6% Reduction**:

1. **Free Tier Utilization**: Automatic use of Gemini's 1,500 requests/day (100% free)
2. **Workload-Aware Routing**: Large tasks → Gemini (96% cheaper)
3. **Policy-Driven Selection**: Cost goals prioritize cheapest providers
4. **Predictive Quota Management**: Maximize free tier before paid usage

**Monitor Your Savings**:

```bash
# Check free tier utilization (Gemini)
ax free-tier status
# Shows: Daily requests/tokens used, % remaining, reset time

# View routing decisions in real-time
ax providers trace --follow
# Shows: Policy evaluation, free tier checks, provider selection

# View provider pricing and features
ax providers info gemini-cli
# Shows: Cost per 1M tokens, latency, free tier limits

# List providers by cost
ax providers list --sort cost
# Shows: All providers ranked by cost (Gemini = cheapest)

# Get usage summary
ax free-tier summary
# Shows: Weekly/monthly usage patterns, cost savings
```

**Learn More**:

- [Gemini Integration Guide](docs/providers/gemini.md) - Complete Gemini setup and optimization
- [Provider Comparison](docs/providers/overview.md) - Detailed provider comparison matrix
- [Cost Optimization Strategies](docs/providers/gemini.md#cost-optimization) - Advanced techniques

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
│     • Define actors, policy, constraints                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Spec-Kit Generation (ax gen)                           │
│     • Plan: Cost estimates, resource requirements, risks    │
│     • DAG: Dependency graph with change detection hash      │
│     • Scaffold: Complete project structure                  │
│     • Tests: Unit, integration, E2E with policy assertions  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Policy Evaluation (PolicyEvaluator)                     │
│     • Filter providers by constraints (cost, latency,       │
│       privacy, reliability)                                 │
│     • Score providers by optimization weights               │
│     • Select optimal provider                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Router Execution (Router)                               │
│     • Load providers in policy order                        │
│     • Execute with selected provider                        │
│     • Fallback on failure                                   │
│     • Log all decisions to trace file                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Memory & Context (MemoryManager)                        │
│     • Index: Save response to SQLite FTS5                   │
│     • Retrieve: Search < 1ms for future tasks               │
│     • Inject: Auto-add context to prompts                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Observability (RouterTraceLogger)                       │
│     • Log: JSONL trace to .automatosx/logs/                │
│     • View: ax providers trace --follow                     │
│     • Debug: Complete visibility into all decisions         │
└─────────────────────────────────────────────────────────────┘
```

### Cost Estimation Configuration

**As of v6.5.11**, cost estimation is **disabled by default** because users reported that pricing changes frequently, making estimates unreliable.

#### How to Enable Cost Estimation

Edit `automatosx.config.json`:

```json
{
  "costEstimation": {
    "enabled": true,  // Enable cost estimation
    "disclaimer": "Cost estimates are approximate and may be outdated."
  }
}
```

#### When Disabled (Default)

- ✅ Policy-driven routing **still works** (selects optimal provider)
- ✅ Free-tier prioritization **still works** (uses Gemini free tier)
- ✅ Provider selection **still works** (based on latency, reliability, privacy)
- ❌ Cost estimates show "N/A" in CLI output
- ❌ Cost constraints in specs are skipped (always pass)

#### When Enabled

- ✅ Cost estimates shown in `ax gen plan`, `ax providers info`, `ax providers trace`
- ✅ Cost constraints enforced (maxPerRequest, maxDaily)
- ⚠️ Pricing data from Oct 2024 (may be outdated)
- ⚠️ Verify current pricing on provider websites:
  - [OpenAI Pricing](https://openai.com/pricing)
  - [Gemini Pricing](https://ai.google.dev/pricing)
  - [Claude Pricing](https://anthropic.com/pricing)

---

## 📚 Real-World Examples

### Example 1: E-Commerce Checkout System

```yaml
# checkout.ax.yaml
metadata:
  id: ecommerce-checkout
  name: E-Commerce Checkout System

policy:
  goal: balanced  # Balance cost, speed, reliability
  constraints:
    cost:
      maxPerRequest: 0.02
      maxDaily: 2.00
    latency:
      p95: 3000

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
ax gen plan checkout.ax.yaml    # See cost: $0.012-$0.018
ax gen scaffold checkout.ax.yaml # Create project structure
ax gen tests checkout.ax.yaml    # Generate test suite
ax run checkout.ax.yaml          # Execute with cost optimization

# Result:
#   - Complete Stripe integration
#   - Fraud detection system
#   - PCI compliant
#   - 60%+ test coverage
#   - Total cost: $0.015 (vs $0.20 with Claude)
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

# Execute with policy routing
ax run workflow.ax.yaml

# Monitor costs and decisions
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
- **[Cost Calculation Configuration](docs/guides/cost-calculation-guide.md)** 💰 **[NEW]** - Enable/configure cost tracking
- [Policy-Driven Routing](docs/providers/overview.md) - Cost/latency optimization with providers
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
| **Policy-Driven Routing** | ✅ Cost/latency optimization | ❌ | ❌ | ❌ |
| **Persistent Memory** | ✅ SQLite FTS5 < 1ms | ❌ | ❌ | ❌ |
| **Multi-Agent Teams** | ✅ 20 specialists | ❌ | ❌ | ❌ |
| **Cost Optimization** | ✅ 60-80% savings | ❌ | ❌ | ❌ |
| **Complete Observability** | ✅ Trace logging | ❌ | ❌ | ❌ |
| **Parallel Execution** | ✅ DAG-based | ❌ | ❌ | ❌ |
| **Local-First** | ✅ 100% private | ⚠️ Hybrid | ⚠️ Cloud | ⚠️ Cloud |

**Bottom Line**: AutomatosX is the **only platform** that combines declarative workflows, cost optimization, persistent memory, and multi-agent orchestration in one tool.

---

## 🚦 Production Readiness

✅ **v7.0.0 Released** - Natural language-first design, unified setup
✅ **100% Complete** - Spec-Kit integration fully implemented
✅ **2,423+ Tests Passing** - Comprehensive test coverage
✅ **TypeScript Strict Mode** - Type-safe codebase
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

**After installing, you MUST run `ax setup` to set up AutomatosX:**

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
- ✅ Spec-Kit Integration (100%)
  - ✅ Plan generation
  - ✅ DAG generation
  - ✅ Scaffold generation
  - ✅ Test generation
  - ✅ Regeneration Detector (v6.5.6)
- ✅ Policy-Driven Routing
  - ✅ Cost/latency/privacy constraints
  - ✅ Provider metadata registry
  - ✅ Multi-factor scoring
- ✅ Router Trace Logging
  - ✅ JSONL format
  - ✅ Real-time following
  - ✅ Color-coded CLI

### Coming Soon (v7.2.0)

- ⏳ Advanced Conversation Features
  - Full-text search across conversations
  - Configurable themes and colors
  - SQLite-backed persistence
- ⏳ Cost-Aware Router
  - Pre-execution cost warnings
  - Budget protection
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
- ✅ Policy-driven routing unchanged
- ✅ Cost optimization unchanged
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

## 🎯 TL;DR

```bash
# Install
npm i -g @defai.digital/automatosx

# Initialize (REQUIRED - sets up agents and config)
cd your-project && ax setup

# Create workflow from natural language
ax spec create "Build auth system with API, tests, security audit"

# Execute with cost optimization
ax run workflow.ax.yaml  # 60-80% cheaper than Claude/GPT

# Debug with trace logs
ax providers trace --follow

# Result: Production-ready auth system in minutes
```

**AutomatosX**: The only AI platform with declarative workflows, cost optimization, persistent memory, and multi-agent orchestration.

**Try it now**: `npm i -g @defai.digital/automatosx && cd your-project && ax setup`

---

<p align="center">
  Made with ❤️ by <a href="https://defai.digital">DEFAI Digital</a>
</p>
