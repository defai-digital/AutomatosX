# AutomatosX

**Give your AI assistant a long-term memory and a team of autonomous agents.**

AutomatosX is a CLI-first orchestration tool that transforms stateless AI assistants into a powerful, collaborative workforce. It provides persistent memory, intelligent agent delegation, and cross-provider support (Claude, Gemini, OpenAI), all running 100% locally.

[![npm version](https://img.shields.io/npm/v/@defai.digital/automatosx.svg)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-2,368%20passing-brightgreen.svg)](#)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/defai-digital/automatosx/ci.yml?branch=main&label=CI)](https://github.com/defai-digital/automatosx/actions)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-orange.svg)](https://ubuntu.com)

**Status**: ✅ Production Ready · **v5.8.5** · October 2025 · 19 Specialized Agents · 100% Resource Leak Free · Spec-Driven Development

**Latest (v5.8.0)**: Spec-Kit Integration - AutomatosX now supports spec-driven development! Define your project specs in `.specify/` directory (spec.md, plan.md, tasks.md) and let AutomatosX automatically orchestrate tasks based on your dependency graph. Features include: DAG-based task execution, cycle detection, LRU caching, and automatic spec detection. Perfect for structured, multi-step projects. [See full changelog →](CHANGELOG.md)

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

## 📋 Core Feature: Spec-Driven Development (✨ NEW in v5.8.0, Enhanced in v5.8.3)

**Transform AutomatosX from a tool into a platform.** Spec-Kit elevates AutomatosX from executing individual agent tasks to orchestrating complex, multi-agent workflows with automatic dependency management.

**NEW in v5.8.3**: Use natural language to create and execute workflows! No need to manually write spec files.

### 🎯 The Game Changer

**Before Spec-Kit** (Manual Coordination):
```bash
# You manually execute each task in order
ax run backend "Setup authentication"
ax run backend "Implement JWT"           # Wait for setup to finish
ax run security "Audit authentication"   # Wait for implementation
ax run quality "Write tests"             # Remember dependencies
ax run devops "Deploy to staging"        # Hope you got the order right
```

**Problems:**
- ❌ Manual coordination of every single task
- ❌ Easy to forget dependencies or run tasks in wrong order
- ❌ No progress tracking - can't resume if interrupted
- ❌ Can't parallelize independent tasks
- ❌ Difficult to share workflows with team

**With Spec-Kit** (Automated Orchestration):
```bash
# 1. Define your workflow once in .specify/tasks.md
- [ ] id:auth:setup ops:"ax run backend 'Setup authentication'"
- [ ] id:auth:impl ops:"ax run backend 'Implement JWT'" dep:auth:setup
- [ ] id:auth:audit ops:"ax run security 'Audit'" dep:auth:impl
- [ ] id:auth:test ops:"ax run quality 'Write tests'" dep:auth:impl
- [ ] id:deploy ops:"ax run devops 'Deploy'" dep:auth:audit,auth:test

# 2. Execute with one command
ax spec run --parallel

# AutomatosX automatically:
# ✅ Executes auth:setup first
# ✅ Runs auth:impl after setup completes
# ✅ Runs auth:audit AND auth:test in PARALLEL (both depend only on impl)
# ✅ Waits for both audit and test before deploying
# ✅ Saves progress - can resume if interrupted
```

### 💡 Key Benefits

#### 1. **Declarative Workflows** (Describe WHAT, not HOW)
You define the desired outcome and dependencies. AutomatosX figures out the execution order automatically.

#### 2. **Smart Dependency Management**
- **DAG (Directed Acyclic Graph)** automatically resolves execution order
- **Cycle Detection** prevents infinite loops
- **Topological Sorting** ensures tasks run when dependencies are ready

#### 3. **Parallel Execution**
AutomatosX identifies tasks that can run simultaneously:
```bash
ax spec run --parallel

# Execution plan:
# Level 1: auth:setup
# Level 2: auth:impl
# Level 3: auth:audit, auth:test  ← Run in parallel!
# Level 4: deploy
```

#### 4. **Progress Tracking & Resume**
```bash
ax spec status
# 📊 Progress: 3/5 tasks (60%)
# ✅ Completed: auth:setup, auth:impl, auth:test
# ⏳ Pending: auth:audit, deploy

# Interrupted? Resume from checkpoint:
ax spec run  # Automatically skips completed tasks
```

#### 5. **Multi-Agent Coordination**
Define complex workflows involving multiple specialized agents:
```bash
# .specify/tasks.md
- [ ] id:design ops:"ax run product 'Design user authentication API'"
- [ ] id:backend ops:"ax run backend 'Implement API'" dep:design
- [ ] id:frontend ops:"ax run frontend 'Build login UI'" dep:design
- [ ] id:test ops:"ax run quality 'Write E2E tests'" dep:backend,frontend
- [ ] id:security ops:"ax run security 'Security audit'" dep:backend
- [ ] id:docs ops:"ax run writer 'Write documentation'" dep:backend,frontend
- [ ] id:deploy ops:"ax run devops 'Deploy to production'" dep:test,security,docs
```

**Result**: Product, Backend, Frontend, Quality, Security, Writer, and DevOps agents collaborate automatically in the correct order!

### 📊 Spec-Kit vs Traditional Approach

| Feature | `ax run` (Manual) | `ax spec` (Automated) |
|---------|-------------------|----------------------|
| **Task Definition** | Command-line (temporary) | Files (Git-tracked, shareable) |
| **Dependency Management** | Manual memory | Automatic DAG resolution |
| **Execution Order** | You control | Automatic topological sort |
| **Parallel Execution** | Not supported | Automatic detection |
| **Progress Tracking** | None | Auto-saved to tasks.md |
| **Resume After Interrupt** | Start over | Resume from checkpoint |
| **Visualization** | None | Status, graphs, progress bars |
| **Team Collaboration** | Hard to share | `.specify/` in Git |
| **Best For** | Quick, one-off tasks | Production workflows, complex projects |

### 🎨 NEW: Natural Language Workflow (v5.8.3)

**The easiest way to use Spec-Kit** - just describe what you want in plain English:

```bash
# Method 1: Direct command
ax spec create "Build authentication with database, API, JWT, security audit, and tests"

# Method 2: Interactive prompt (automatically suggested for complex tasks)
ax run backend "Build complete authentication system with database, API, JWT, audit, and tests"
# → AutomatosX detects complexity and suggests spec-kit workflow
# → Generates .specify/ files automatically
# → Executes with parallel mode

# Method 3: Create and execute immediately
ax spec create "Build auth system" --execute
```

**What happens automatically**:
1. ✅ AI analyzes your description
2. ✅ Generates spec.md, plan.md, and tasks.md
3. ✅ Creates task dependencies intelligently
4. ✅ Selects appropriate agents for each task
5. ✅ Optionally executes with parallel mode

**Example Output**:
```
🎨 Spec-Kit: Create from Natural Language

📊 Complexity Analysis:
  Score: 8/10
  • Multiple technical components
  • Project-level scope
  • 5 items separated by commas

✓ Spec files generated

📁 Files:
  • .specify/spec.md - Project specification
  • .specify/plan.md - Technical plan
  • .specify/tasks.md - 8 tasks with dependencies

📋 Tasks Overview:
  • auth: 3 tasks
  • test: 2 tasks
  • security: 1 task
  • deploy: 2 tasks

🤖 Agents:
  • backend: 3 tasks
  • quality: 2 tasks
  • security: 1 task
  • devops: 2 tasks
```

### 🚀 Quick Start (Manual Method)

```bash
# 1. Initialize spec-kit in your project
ax init --spec-kit

# 2. Edit .specify/ files
.specify/
├── spec.md    # Requirements and success criteria
├── plan.md    # Technical approach and architecture
└── tasks.md   # Task breakdown with dependencies

# 3. Validate your spec
ax spec validate

# 4. Preview execution plan (dry-run)
ax spec run --dry-run

# 5. Execute the workflow
ax spec run --parallel

# 6. Track progress
ax spec status

# 7. Visualize dependencies
ax spec graph
ax spec graph --dot | dot -Tpng -o workflow.png
```

### 🎓 Real-World Example

**Scenario**: Building a complete user authentication feature

**.specify/tasks.md**:
```markdown
## Phase 1: Design
- [ ] id:design:api ops:"ax run product 'Design authentication API'"
- [ ] id:design:db ops:"ax run backend 'Design user schema'" dep:design:api

## Phase 2: Implementation
- [ ] id:impl:backend ops:"ax run backend 'Implement JWT auth'" dep:design:db
- [ ] id:impl:frontend ops:"ax run frontend 'Build login UI'" dep:design:api

## Phase 3: Quality & Security
- [ ] id:test:unit ops:"ax run quality 'Unit tests'" dep:impl:backend
- [ ] id:test:e2e ops:"ax run quality 'E2E tests'" dep:impl:backend,impl:frontend
- [ ] id:security ops:"ax run security 'Security audit'" dep:impl:backend

## Phase 4: Documentation & Deployment
- [ ] id:docs ops:"ax run writer 'Write docs'" dep:impl:backend,impl:frontend
- [ ] id:deploy:staging ops:"ax run devops 'Deploy staging'" dep:test:e2e,security
- [ ] id:deploy:prod ops:"ax run devops 'Deploy production'" dep:deploy:staging
```

**Execute**:
```bash
ax spec run --parallel

# Automatic execution:
# 1. design:api first
# 2. design:db and impl:frontend in parallel (both depend only on design:api)
# 3. impl:backend after design:db
# 4. test:unit, test:e2e, security, docs all run in parallel when ready
# 5. deploy:staging waits for test:e2e and security
# 6. deploy:prod waits for staging verification
```

**Key Features:**
-   **Automatic Spec Detection**: Just create `.specify/` and AutomatosX finds it
-   **DAG-Based Execution**: Tasks run in dependency order with cycle detection
-   **Parallel Execution**: Backend and frontend implement simultaneously
-   **Progress Persistence**: Resume from any checkpoint
-   **Multi-Agent Orchestration**: 7 different agents collaborate automatically
-   **Visualization**: See dependency graph and execution plan

### 💡 When to Use Spec-Kit

**Use `ax spec` for:**
- ✅ Complex, multi-step projects (5+ tasks)
- ✅ Workflows with dependencies
- ✅ Production environments requiring reliability
- ✅ Team collaboration (`.specify/` files in Git)
- ✅ Repeatable workflows (bug fixes, deployments)
- ✅ Projects requiring progress tracking

**Use `ax run` for:**
- ✅ Quick, exploratory tasks
- ✅ One-off commands
- ✅ Interactive development
- ✅ Learning and experimentation

**Both are powerful - choose based on your needs!**

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