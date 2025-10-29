# AutomatosX

**Stop repeating yourself. Give your AI a brain and a team.**

AutomatosX is a local-first CLI that transforms stateless AI assistants into a persistent, collaborative workforce. It ends the cycle of repeating context and manually orchestrating tasks by providing a long-term memory and a team of autonomous agents that learn and work together.

[![npm version](https://img.shields.io/npm/v/@defai.digital/automatosx.svg)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-2,384%20passing-brightgreen.svg)](#)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/defai-digital/automatosx/ci.yml?branch=main&label=CI)](https://github.com/defai-digital/automatosx/actions)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-orange.svg)](https://ubuntu.com)

**Status**: ✅ Production Ready · **v5.8.7** · October 2025 · 19 Specialized Agents · 100% Resource Leak Free · Spec-Driven Development

---

## The Problem: AI Has No Memory

Standard AI assistants are stateless. They have no memory of past conversations, forcing you to re-explain requirements, manually coordinate every task, and lose valuable insights the moment a session ends. This is slow, repetitive, and inefficient.

## The Solution: A Local, Collaborative AI Workforce

AutomatosX provides the two things AI assistants are missing:

1.  **A Persistent Brain**: A local, zero-cost memory that ensures context is never lost.
2.  **A Team of Specialists**: Autonomous agents who can delegate tasks, share knowledge, and execute complex workflows.

---

## 🚀 How It Works: Core Concepts

AutomatosX is built on three pillars that enable a smarter, more autonomous workflow.

| Concept | Description |
|---|---|
| 🧠 **Persistent Memory** | Every conversation and decision is automatically saved to a local database. Agents instantly retrieve context for new tasks, so you never have to repeat yourself. |
| 🤝 **Autonomous Agents** | A team of 19 specialized agents (backend, frontend, security, etc.) can delegate tasks to each other to achieve a high-level goal. You manage the project, not the micromanagement. |
| 📋 **Declarative Workflows** | For complex projects, define your entire workflow in simple markdown. AutomatosX builds a dependency graph, executes tasks in parallel, and resumes from checkpoints automatically. |

---

## ⚙️ Get Started in 3 Steps

1.  **Install AutomatosX:**
    ```bash
    npm install -g @defai.digital/automatosx
    ```

2.  **Initialize Your Project:**
    ```bash
    cd your-project-folder
    ax init
    ```

3.  **Run Your First Agent:**
    ```bash
    # Run an agent directly from your terminal
    ax run product "Design a REST API for user management"
    ```

[➡️ **Full Quick Start Guide**](docs/guide/quick-start.md) | [**Installation Details**](docs/guide/installation.md)

---

## 💡 Why AutomatosX? The End of AI Amnesia

### The Problem: Stateless AI is Inefficient

Standard AI assistants suffer from digital amnesia. They have no memory of past conversations, forcing you to repeat context, re-explain requirements, and manually coordinate every single task. This is slow, repetitive, and inefficient.

-   ❌ **No Long-Term Memory**: Every session starts from zero.
-   ❌ **Constant Repetition**: You explain the same architecture and requirements over and over.
-   ❌ **Manual Coordination**: You are the single point of failure for orchestrating tasks.
-   ❌ **Knowledge is Lost**: Valuable insights and decisions disappear forever.

### The Solution: A Persistent, Collaborative AI Workforce

AutomatosX gives your AI a permanent brain and a team of specialists who learn and collaborate.

-   ✅ **Persistent Memory**: Agents remember everything. A local, zero-cost SQLite FTS5 database enables sub-millisecond context retrieval.
-   ✅ **Autonomous Delegation**: Agents intelligently delegate tasks to each other, creating workflows that run on their own.
-   ✅ **Context on Autopilot**: Agents automatically get the context they need from past conversations. Never repeat yourself again.
-   ✅ **A Team That Learns**: Your AI team gets smarter and more effective with every task, building a shared knowledge base over time.

**The result? You save hours per week, produce higher-quality work, and build a system that grows more valuable with every interaction.**

---

## 🧠 Core Feature: Persistent Memory

AutomatosX remembers every conversation, decision, and piece of code automatically. This knowledge is instantly searchable and injected into future tasks, ensuring perfect context every time.

### How It Works

```bash
# 1. A task is completed and automatically saved to memory.
ax run product "Design a calculator with add/subtract features"
# → Task and response are indexed in the local SQLite FTS5 database.

# 2. A related task is run later.
ax run backend "Implement the calculator"
# → Memory automatically finds the "calculator" design spec from the previous step.
# → The backend agent receives the design and can start work immediately.
```

-   **Technology**: SQLite with FTS5 for fast, local full-text search.
-   **Speed**: < 1ms search, even with thousands of entries.
-   **Cost**: $0. No embedding APIs, no cloud services.
-   **Privacy**: 100% local. Your data never leaves your machine.

[➡️ **Learn More: Memory System Guide**](docs/guide/agent-communication.md)

---

## 🤝 Core Feature: Multi-Agent Orchestration

Stop micromanaging. With AutomatosX, you can give a high-level goal to one agent, and it will create a plan, delegate tasks, and orchestrate a team of specialists to get the job done.

### How It Works

```typescript
// 1. You give a high-level task to a coordinator agent.
ax run product "Build a complete user authentication feature"

// 2. The Product agent creates a plan and delegates to other agents.
/*
  "I'll design the auth system with JWT and OAuth2.

   @backend Please implement the JWT authentication API based on this design.
   @security Please audit the implementation for security vulnerabilities."
*/

// 3. AutomatosX executes the plan automatically.
//    - The backend agent receives the spec and implements the API.
//    - The security agent receives the spec and the code, then performs an audit.
//    - Results are aggregated and returned.
```

-   **Natural Language Delegation**: Use simple `@mention` syntax to delegate.
-   **Autonomous Workflows**: Agents work in parallel to complete goals faster.
-   **Full Transparency**: The entire delegation chain is tracked and logged.

[➡️ **Learn More: Multi-Agent Orchestration Guide**](docs/guide/multi-agent-orchestration.md)

---

## 📋 Core Feature: Spec-Driven Development

For complex projects, AutomatosX can manage the entire workflow. Instead of running individual commands, you can define a high-level specification and let AutomatosX orchestrate the entire plan, run tasks in parallel, and even resume if interrupted.

### Natural Language Workflows (Recommended)

The easiest way to use this feature is to describe your goal in plain English. AutomatosX will analyze the request, generate a complete plan, and execute it.

```bash
# Describe a complex goal in one command
ax spec create "Build a complete user auth system with a database, API, JWT, security audit, and tests"

# AutomatosX automatically:
# 1. Generates a full project specification (.specify/)
# 2. Creates a dependency graph of all tasks
# 3. Assigns the right agents for each task
# 4. Executes the plan with parallel execution and progress tracking
```

This turns a multi-day coordination effort into a single command.

### Manual Workflows

You can also define workflows manually for full control:

```markdown
# .specify/tasks.md
- [ ] id:backend ops:"ax run backend 'Implement API'" dep:design
- [ ] id:frontend ops:"ax run frontend 'Build login UI'" dep:design
- [ ] id:test ops:"ax run quality 'Write E2E tests'" dep:backend,frontend
```

When you run `ax spec run --parallel`, AutomatosX executes this plan, running the `backend` and `frontend` tasks in parallel before starting the `test` task.

**Key Benefits:**
-   **Automated Orchestration**: Eliminates manual coordination.
-   **Parallel Execution**: Completes work faster.
-   **Progress Tracking & Resume**: Never lose work on an interruption.
-   **Reproducible Workflows**: Check your `.specify/` directory into Git to share your process.

[➡️ **Full Guide: Spec-Driven Development**](docs/guide/spec-driven-development.md)

---

## 🎭 19 Specialized Agents

AutomatosX comes with a pre-built team of 19 agents, each with a specific role and expertise. This ensures the right specialist is always available for the task at hand.

-   **Astrid** - Aerospace Scientist (Orbital mechanics, mission analysis, telemetry)
-   **Bob** - Backend Engineer (API design, databases, Go/Rust systems)
-   **Candy** - Creative Marketer (Content strategy)
-   **Daisy** - Data Engineer (ETL, SQL, modeling)
-   **Dana** - Data Scientist (ML strategy, statistical analysis)
-   **Debbee** - UX Designer (UX research, wireframes)
-   **Eric** - CEO (Business leadership)
-   **Felix** - Fullstack Engineer (Node.js/TypeScript + Python)
-   **Frank** - Frontend Engineer (React/Next.js/Swift UI)
-   **Maya** - Mobile Engineer (iOS/Android, Swift/Kotlin/Flutter)
-   **Oliver** - DevOps Engineer (CI/CD, infrastructure)
-   **Paris** - Product Manager (Roadmaps, strategy)
-   **Peter** - Best Practices Expert (SOLID, design patterns, clean code, refactoring, architecture) ✨ NEW in v5.6.21
-   **Queenie** - Quality Specialist (Testing, code reviews)
-   **Quinn** - Quantum Engineer (Quantum algorithms, Qiskit/Cirq, error correction)
-   **Rodman** - Researcher (Feasibility studies)
-   **Steve** - Security Engineer (Audits, threat modeling)
-   **Tony** - CTO (Technical strategy)
-   **Wendy** - Technical Writer (Documentation, reports)

**Governance**: Agents have clear roles, permissions, and delegation limits (`maxDelegationDepth`) to ensure efficient and safe collaboration while preventing infinite loops.

[➡️ **See the Full Agent Directory**](examples/AGENTS_INFO.md)

---

## 🚀 Two Ways to Use AutomatosX

### 1. Claude Code Integration (Recommended)

Use natural language to collaborate with agents directly within your editor. Claude Code acts as an intelligent coordinator, providing project context and validating results.

```
# Let Claude Code think, plan, and coordinate
"please work with ax agent to implement user authentication"
"please work with ax agent to refactor this module with best practices"
```

For simple, direct tasks, use slash commands: `/ax-agent backend, write a function to validate emails`.

### 2. Terminal/CLI Mode (For Power Users)

Run agents directly from your terminal for scripting, automation, and CI/CD pipelines.

```bash
# Run a multi-agent workflow from your command line
ax run product "Design REST API for users"
ax run backend "Implement the API"           # Auto-receives design from memory
ax run quality "Write tests for the API" # Auto-receives design + implementation
```

[➡️ **Read the Terminal Mode Guide**](docs/guide/terminal-mode.md)

---

## 🔄 Intelligent Provider Management (v5.7.0)

AutomatosX automatically handles provider usage limits so you never experience downtime.

### Automatic Limit Detection & Rotation

When you hit a provider's usage limit, AutomatosX instantly detects it and switches to the next available provider:

```bash
$ ax run backend "implement authentication API"
⚠️  Switched from openai → gemini-cli
   (OpenAI daily quota hit, resets at 2025-10-29 00:00 UTC)

✓ Task completed successfully with gemini-cli
```

### Auto-Recovery

The system tracks reset times (daily/weekly) and automatically restores providers when limits expire. No manual intervention needed.

### Monitor Status

Check your provider status anytime:

```bash
$ ax provider-limits
📊 Provider Limits Status

  ⚠️  openai:
     Status: limited
     Window: daily
     Resets: 2025-10-29 00:00:00 (6h)

  ✅ 2 provider(s) available
```

**Performance**: < 1ms overhead per request, O(1) limit checks, persistent state across restarts.

[➡️ **Learn More: Provider Management Guide**](CHANGELOG.md#570---2025-10-28)

---

## ✨ Key Features

| Feature | Traditional AI Chat | Claude Code | AutomatosX | AutomatosX + Spec-Kit |
|---|---|---|---|---|
| **Long-Term Memory** | ❌ No | ❌ No | ✅ **Yes (SQLite FTS5, <1ms)** | ✅ **Yes + Spec Context** |
| **Multi-Agent System** | ❌ No | ❌ No | ✅ **Yes (19 specialized agents)** | ✅ **Yes + Orchestration** |
| **Autonomous Delegation** | ❌ No | ❌ No | ✅ **Yes (Ad-hoc workflows)** | ✅ **Yes (Automated DAG)** |
| **Workflow Management** | ❌ No | ❌ No | ⚠️ **Manual** | ✅ **Declarative (Git-tracked)** |
| **Dependency Resolution** | ❌ No | ❌ No | ⚠️ **Manual** | ✅ **Automatic (DAG + Cycles)** |
| **Parallel Execution** | ❌ No | ❌ No | ⚠️ **Manual** | ✅ **Automatic Detection** |
| **Progress Tracking** | ❌ No | ❌ No | ⚠️ **Session Only** | ✅ **Persistent (tasks.md)** |
| **Resume After Interrupt** | ❌ No | ❌ No | ⚠️ **Start Over** | ✅ **From Checkpoint** |
| **Context Retention** | Manual Copy-Paste | Session Only | ✅ **Persistent & Automatic** | ✅ **+ Spec-Aware** |
| **Knowledge Sharing** | ❌ No | ❌ No | ✅ **Yes (Across agents)** | ✅ **Yes + Team Workflows** |
| **Privacy** | Cloud-Based | Claude Servers | ✅ **100% Local** | ✅ **100% Local** |
| **Cost** | Subscription | Included | ✅ **$0 (No API for memory)** | ✅ **$0 (No extra cost)** |
| **Best For** | Q&A | Development | **Complex Tasks** | **Production Workflows** |

---

## 📚 Documentation

-   **[Quick Start Guide](docs/guide/quick-start.md)**
-   **[Core Concepts](docs/guide/core-concepts.md)**
-   **[Full CLI Command Reference](docs/reference/cli-commands.md)**
-   **[Agent Directory](examples/AGENTS_INFO.md)**
-   **[Workspace Path Conventions](docs/workspace-conventions.md)**
-   **[Troubleshooting Guide](TROUBLESHOOTING.md)**

---

## 🤝 Contributing

AutomatosX is an open-source project. We welcome contributions!

-   [**Contributing Guide**](CONTRIBUTING.md)
-   [**Report an Issue**](https://github.com/defai-digital/automatosx/issues)
-   [**Request a Feature**](https://github.com/defai-digital/automatosx/issues/new)

---

## 📄 License

AutomatosX is [Apache 2.0 licensed](LICENSE).