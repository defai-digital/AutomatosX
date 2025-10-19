# AutomatosX

**Give your AI assistant a long-term memory and a team of autonomous agents.**

AutomatosX is a CLI-first orchestration tool that transforms stateless AI assistants into a powerful, collaborative workforce. It provides persistent memory, intelligent agent delegation, and cross-provider support (Claude, Gemini, OpenAI), all running 100% locally.

[![npm version](https://img.shields.io/npm/v/@defai.digital/automatosx.svg)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-1,667%20passing-brightgreen.svg)](#)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/defai-digital/automatosx/publish.yml?branch=main&label=CI)](https://github.com/defai-digital/automatosx/actions)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-orange.svg)](https://ubuntu.com)

**Status**: ✅ Production Ready · **v5.6.6** · October 2025

---

## 🚀 Get Started in 3 Steps

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
    # Use natural language in Claude Code
    "please work with ax agent to design a REST API for user management"

    # Or run directly in your terminal
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

## 🎭 16+ Specialized Agents

AutomatosX comes with a pre-built team of 16+ agents, each with a specific role and expertise. This ensures the right specialist is always available for the task at hand.

-   **Backend** (API design, databases)
-   **Frontend** (UI/UX, components)
-   **Fullstack** (End-to-end development)
-   **Mobile** (iOS/Android development)
-   **DevOps** (CI/CD, infrastructure)
-   **Security** (Audits, threat modeling)
-   **Data Science** (ML models, analysis)
-   **Data** (ETL, SQL, modeling)
-   **Quality** (Testing, code reviews)
-   **Design** (UX research, wireframes)
-   **Writer** (Documentation, reports)
-   **Creative Marketer** (Content strategy)
-   **Product** (Roadmaps, strategy)
-   **CTO** (Technical strategy)
-   **CEO** (Business leadership)
-   **Researcher** (Feasibility studies)

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

For simple, direct tasks, use slash commands: `/ax:agent backend, write a function to validate emails`.

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

## ✨ Key Features

| Feature | Traditional AI Chat | Claude Code | AutomatosX |
|---|---|---|---|
| **Long-Term Memory** | ❌ No | ❌ No | ✅ **Yes (SQLite FTS5, <1ms)** |
| **Multi-Agent System** | ❌ No | ❌ No | ✅ **Yes (16+ specialized agents)** |
| **Autonomous Delegation** | ❌ No | ❌ No | ✅ **Yes (Automatic workflows)** |
| **Context Retention** | Manual Copy-Paste | Session Only | ✅ **Persistent & Automatic** |
| **Knowledge Sharing** | ❌ No | ❌ No | ✅ **Yes (Across all agents)** |
| **Privacy** | Cloud-Based | Claude Servers | ✅ **100% Local** |
| **Cost** | Subscription | Included | ✅ **$0 (No API calls for memory)** |

---

## 📚 Documentation

-   **[Quick Start Guide](docs/guide/quick-start.md)**
-   **[Core Concepts](docs/guide/core-concepts.md)**
-   **[Full CLI Command Reference](docs/reference/cli-commands.md)**
-   **[Agent Directory](examples/AGENTS_INFO.md)**
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