# AutomatosX

**From Idea to Production in Minutes: The AI Agent Platform with Persistent Memory**

AutomatosX is the only AI CLI that combines intelligent code search, 21 specialized agents, and persistent memory. Search across 44 programming languages, delegate tasks to AI specialists, and build complete workflows—while the system remembers everything and optimizes every decision.

[![npm version](https://img.shields.io/npm/v/@defai.digital/automatosx.svg)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![npm](https://img.shields.io/npm/dt/%40defai.digital%2Fautomatosx.svg?label=downloads&color=blue)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![Node.js](https://img.shields.io/badge/node.js-24.x-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-745+%20passing-brightgreen)](#)
[![Languages](https://img.shields.io/badge/languages-44-blue)](./src/parser)
[![Agents](https://img.shields.io/badge/agents-21-purple)](./src/agents)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-orange)](https://ubuntu.com/)
[![macOS](https://img.shields.io/badge/macOS-26-blue)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-11-blue)](https://www.microsoft.com/windows)

**Status**: ✅ **Production Ready** | v8.0.20 | 21 Specialized Agents | 44 Languages | 745+ Tests Passing

---

## ⚡ New to AutomatosX? [Start Here: 60-Second Quickstart](#-quick-start-60-seconds-to-your-first-agent)

Get productive in under a minute! Install, run your first command, and see intelligent code search in action. **Perfect for first-time users.**

---

## 🚀 The Only AI Platform with Complete Code Intelligence & Agent Memory

AutomatosX is **the only AI platform** that gives you:

| Feature | What It Does | Your Benefit |
|---------|--------------|--------------|
| 📋 **44-Language Code Search** | Tree-sitter AST parsing with SQLite FTS5 full-text search. Find any symbol, function, or pattern. | Never manually grep again |
| 💰 **Multi-Provider AI** | Claude, Gemini, and OpenAI with automatic fallback and health monitoring. | 99.9% uptime, zero vendor lock-in |
| 🧠 **Persistent Memory** | Every conversation and code search is remembered. Agents get perfect context automatically. | Never repeat yourself again |
| 🤝 **21 Specialized Agents** | Backend, Frontend, Security, DevOps, Quality, and 16 more experts collaborate on your behalf. | Focus on strategy, not micromanagement |
| 🔍 **Lightning Fast** | Query caching delivers <1ms response time. Index 2000+ files/sec. | Ship features 10x faster |

---

## ⚡ Quick Start: 60 Seconds to Your First Agent

```bash
# 1. Install AutomatosX (one command)
npm install -g @defai.digital/automatosx

# 2. Search your codebase instantly
ax find "getUserById"

# 3. Chat with AI agents
ax cli

# AutomatosX automatically:
#   ✅ Parses 44 programming languages
#   ✅ Indexes your code with full-text search
#   ✅ Connects to Claude/Gemini/OpenAI
#   ✅ Remembers all conversations
#   ✅ Delegates tasks to specialized agents

# 4. Build complete workflows
ax speckit spec "Build user authentication with tests"
```

**Result**: Intelligent code search, AI-powered development, and persistent memory—in 60 seconds.

---

## 💬 **Interactive CLI** - ChatGPT in Your Terminal

Experience a ChatGPT-style conversational interface directly in your terminal:

```bash
# Start interactive mode
ax cli

╭─────────────────────────────────────────────────────╮
│   AutomatosX Interactive CLI v8.0.20                │
│   Type /help for commands, /exit to quit            │
│   Using: Claude Sonnet 3.5                          │
╰─────────────────────────────────────────────────────╯

ax> I need to implement JWT authentication

AI: I'll help you implement JWT authentication. Let me search our
    codebase for existing auth patterns...

    Found 2 relevant patterns. Would you like me to:
    1. Show implementation plan
    2. Delegate to backend agent
    3. Start coding immediately

ax> Delegate to backend agent

AI: @backend implement JWT authentication with refresh tokens

    [Backend agent working...]
    ✓ Dependencies installed
    ✓ Auth middleware created
    ✓ Token refresh endpoint added
    ✓ Tests generated (12 passing)

ax> /save jwt-implementation
✓ Conversation saved: jwt-implementation

ax> /exit
```

### Key Features

- 🤖 **Natural Conversations** - Multi-turn discussions with full context
- 🔄 **Real-time Streaming** - See responses as they're generated
- 💾 **Save & Resume** - Continue conversations later with `/save` and `/load`
- 🎯 **Agent Delegation** - Route tasks to specialists: `@backend`, `@security`, `@quality`
- 📝 **15+ Slash Commands** - `/help`, `/memory`, `/agents`, `/workflow`, `/export`, and more
- 🎨 **Beautiful Output** - Markdown rendering and syntax-highlighted code blocks
- ⚡ **Fast & Efficient** - Powered by Claude, Gemini, or OpenAI

### Quick Examples

```bash
# Start a coding session
ax cli
ax> @backend create a REST API for user management
ax> @security audit the authentication code
ax> /save user-management-api

# Search your knowledge base
ax cli
ax> /memory search "authentication patterns"
ax> Show me the JWT implementation we used last time

# Work across sessions
ax cli
ax> /load user-management-api
ax> Let's add rate limiting to these endpoints
ax> /export  # Export to markdown for documentation
```

**Alternative Commands**: `ax interactive`, `ax chat`

---

## 📦 Installation

### For End Users (Recommended)

**Install globally with npm**:

```bash
npm install -g @defai.digital/automatosx

# Verify installation
ax --version

# Start using immediately
ax find "getUserById"
ax cli  # Launch interactive mode
```

### For Developers

**Clone and build from source**:

```bash
git clone https://github.com/defai-digital/automatosx.git
cd automatosx
npm install
npm run build
npm link

# Now you can use the CLI directly:
ax find "Calculator"
ax cli  # Interactive mode
```

### ⚠️ Installation Warnings

When installing AutomatosX, you may see warnings about tree-sitter peer dependencies. **These warnings are harmless and can be safely ignored.** AutomatosX uses tree-sitter v0.22.4 (compatible with Node.js 24), while some language parser packages list different peer dependencies. Everything works correctly.

---

## 📋 Requirements

- **Node.js**: v24.x or higher ([Download](https://nodejs.org/))
- **npm**: v10.0.0 or higher (included with Node.js)
- **Supported Operating Systems**:
  - **Ubuntu**: 24.04 LTS (Noble Numbat) or later
  - **macOS**: 26 (Tahoe) or later
  - **Windows**: 11 or later

---

## ✨ Core Features

### 1. Code Intelligence Engine
- 🔍 **Multi-language search** - 44 languages including TypeScript, Python, Go, Rust, Java, C++
- ⚡ **Lightning fast** - Query caching delivers <1ms response (10-100x speedup)
- 🎯 **Advanced filtering** - Filter by language, symbol kind, or file path
- 📊 **Smart indexing** - Batch operations process 2000+ files/sec

### 2. AI Agent System (21 Specialized Agents)
- 🤖 **Engineering Agents** - Backend, Frontend, DevOps, Security, Quality, Testing, Performance, Architecture
- 🔧 **Technical Specialists** - API, Database, Data, DataScience, Mobile, Infrastructure, Standards
- 👔 **Leadership Agents** - Product, CTO, CEO, Writer, Researcher
- 🔄 **Collaboration** - Agent-to-agent delegation and task coordination

### 3. Multi-Provider AI Integration
- 🌐 **Three Providers** - Claude (Anthropic), Gemini (Google), OpenAI
- 🔄 **Automatic Fallback** - Seamless failover with retry logic
- 📊 **Health Monitoring** - Real-time latency and error rate tracking
- ⚙️ **Smart Routing** - Priority-based provider selection

### 4. Workflow Orchestration
- 📋 **YAML/JSON Workflows** - Define complex multi-step processes
- 🔗 **Dependency Management** - Automatic topological sorting and parallel execution
- 💾 **Checkpoint/Resume** - Resume long-running workflows from any point
- 🎯 **ReScript State Machines** - Deterministic execution with type safety

### 5. SpecKit Auto-Generation ⭐ NEW
- 📝 **Spec Generator** - Natural language → YAML workflows (AI-powered)
- 📊 **Plan Generator** - Execution plans with cost/time estimates
- 🌐 **DAG Generator** - Dependency graphs (ASCII/DOT/Mermaid)
- 🏗️ **Scaffold Generator** - Project structure generation
- 🧪 **Test Generator** - Unit, integration, E2E test suites
- 📚 **ADR/PRD Generators** - Architecture decisions and product requirements

### 6. Iterate Mode ⭐ NEW
- 🔄 **Autonomous Retry** - Intelligent retry loops (max 10 iterations)
- 🎯 **10 Strategies** - Timeout, fallback, parallel, circuit breaker, etc.
- 🛡️ **Safety Levels** - Paranoid, normal, permissive with cost/time limits
- 📊 **Telemetry** - Strategy analytics and recommendations
- 🔍 **Error Analysis** - Classify and detect patterns (9 error types)

### 7. Natural Language Interface ⭐ NEW
- 🗣️ **Natural Commands** - `ax "run security audit"` → workflow execution
- 🎯 **40+ Intent Patterns** - Pattern matching + LLM fallback
- 🔍 **Entity Extraction** - Files, agents, filters, limits
- ❓ **Clarification** - Interactive prompts for ambiguous queries
- 📚 **Learning System** - Learns from user corrections

### 8. Validation System ⭐ NEW
- ✅ **Type-safe Validation** - Zod v4 with 20 schemas
- ⚡ **Ultra-fast** - 488k ops/sec, <0.01ms per operation
- 🎛️ **Feature Flags** - Disabled, log-only, enforce modes
- 📊 **Metrics** - Success rate, latency (P50/P95/P99)
- 🔄 **Sampling** - Gradual rollout (0-100%)
- 🛡️ **Production-ready** - 213 tests passing, deployment scripts

---

## 🌍 Supported Languages (44)

### Systems & Performance
C, C++, Rust, Go, Zig, Objective-C, AssemblyScript, CUDA (NVIDIA/AMD ROCm HIP)

### Frontend & Mobile
TypeScript, JavaScript, HTML, Swift, Kotlin, Dart (Flutter)

### Backend & Scripting
Python, Ruby, PHP, Java, Scala, C#, Bash, Zsh, Lua, Groovy, Perl

### Functional Programming
Haskell, OCaml, Elm, Elixir, Gleam

### Data & Config
SQL, JSON, YAML, TOML, Markdown, CSV, XML

### DevOps & Infrastructure
HCL (Terraform), Puppet, Makefile

### Messaging & RPC
Thrift (Apache Thrift IDL)

### Specialized
Solidity (Ethereum), Verilog, Julia, MATLAB, Regex

<details>
<summary><b>📊 Framework Coverage by Ecosystem</b></summary>

| Ecosystem | Coverage | Frameworks |
|-----------|----------|------------|
| **Frontend** | 100% | React, Vue, Angular, Svelte, Next.js, Elm, Flutter |
| **Backend** | 100% | NestJS, Express, Django, FastAPI, Flask, Spring Boot, Rails, Laravel, Phoenix |
| **Mobile** | 100% | Flutter, SwiftUI, Jetpack Compose, React Native |
| **ML/AI** | 100% | TensorFlow, PyTorch, HuggingFace, Qiskit, JAX, scikit-learn |
| **DevOps** | 100% | Terraform, Puppet, Kubernetes, Ansible, Jenkins, GitHub Actions, GitLab CI |
| **Messaging** | 100% | NATS, Kafka, Thrift, RabbitMQ, Redis, Apache Pulsar |
| **Blockchain** | 100% | Ethereum, Hardhat, Truffle, Solidity |

</details>

---

## 📚 Commands

### Code Intelligence Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ax find <query>` | Search code with optional filters | `ax find "lang:python login"` |
| `ax def <symbol>` | Find symbol definition | `ax def getUserById` |
| `ax flow <function>` | Show call flow | `ax flow handleLogin` |
| `ax index [dir]` | Index codebase | `ax index ./src` |
| `ax watch [dir]` | Auto-index with file watching | `ax watch ./src` |
| `ax status` | Show index & cache statistics | `ax status --verbose` |

### Interactive & Natural Language Commands ⭐ NEW

| Command | Description | Example |
|---------|-------------|---------|
| `ax cli` | Launch interactive ChatGPT-style CLI | `ax cli` |
| `ax "<natural>"` | Execute command via natural language | `ax "run security audit"` |

### SpecKit Generator Commands ⭐ NEW

| Command | Description | Example |
|---------|-------------|---------|
| `ax speckit spec <desc>` | Generate workflow from description | `ax speckit spec "CI/CD pipeline"` |
| `ax speckit adr <topic>` | Generate Architecture Decision Record | `ax speckit adr "database choice"` |
| `ax speckit prd <feature>` | Generate Product Requirements Doc | `ax speckit prd "auth system"` |
| `ax gen plan <workflow>` | Generate execution plan | `ax gen plan workflow.yaml` |
| `ax gen dag <workflow>` | Generate dependency graph | `ax gen dag workflow.yaml -f mermaid` |
| `ax gen scaffold <workflow>` | Generate project structure | `ax gen scaffold workflow.yaml` |
| `ax gen tests <workflow>` | Generate test suite | `ax gen tests workflow.yaml` |

### Workflow & Agent Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ax workflow run <file>` | Execute workflow | `ax workflow run cicd.yaml` |
| `ax workflow run --iterate` | Execute with retry mode | `ax workflow run cicd.yaml --iterate` |
| `ax agent list` | List all available agents | `ax agent list --filter backend` |
| `ax memory search <query>` | Search code memory | `ax memory search "authentication"` |

---

## 🔎 Query Syntax

### Natural Language Search

```bash
ax find "function that validates email addresses"
ax find "class for user authentication"
```

### Symbol Search

```bash
ax find getUserById
ax find UserService
```

### Language Filters

```bash
ax find "lang:python authentication"      # Python files only
ax find "lang:typescript getUserById"     # TypeScript files only
ax find "-lang:test handleUser"           # Exclude test files
```

### Kind Filters

```bash
ax find "kind:function getUserById"       # Functions only
ax find "kind:class User"                 # Classes only
ax find "-kind:constant MAX_USERS"        # Exclude constants
```

### File Path Filters

```bash
ax find "file:src/auth/ login"            # Files in src/auth/
ax find "file:*.ts getUserById"           # TypeScript files only
ax find "-file:*.spec.ts handleUser"      # Exclude spec files
```

### Combining Filters

```bash
ax find "lang:python kind:function file:src/ authentication"
```

---

## ⚙️ Configuration

Create `automatosx.config.json` in your project root:

```json
{
  "languages": {
    "typescript": { "enabled": true },
    "javascript": { "enabled": true },
    "python": { "enabled": true }
  },
  "search": {
    "defaultLimit": 10,
    "maxLimit": 100
  },
  "indexing": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**"
    ],
    "maxFileSize": 1048576
  },
  "database": {
    "path": ".automatosx/db/code-intelligence.db"
  },
  "performance": {
    "enableCache": true,
    "cacheMaxSize": 1000,
    "cacheTTL": 300000
  },
  "providers": {
    "claude": { "enabled": true, "priority": 1 },
    "gemini": { "enabled": true, "priority": 2 },
    "openai": { "enabled": true, "priority": 3 }
  }
}
```

### Environment Variables

Override config values with environment variables:

```bash
export AUTOMATOSX_SEARCH_DEFAULT_LIMIT=25
export AUTOMATOSX_DATABASE_WAL=false
export AUTOMATOSX_INDEXING_EXCLUDE_PATTERNS='["**/test/**"]'
```

---

## 📈 Performance

AutomatosX delivers exceptional performance across all systems:

| System | Metric | Value |
|--------|--------|-------|
| **Code Search** | Query latency (cached) | <1ms |
| | Query latency (uncached) | <5ms (P95) |
| | Indexing throughput | 2000+ files/sec |
| | Cache hit rate | 60%+ typical |
| **Validation** | Single validation | <0.01ms |
| | Batch (100 items) | <0.1ms |
| | Throughput | 488,056 ops/sec |
| **Testing** | Total tests | 745+ passing |
| | Test coverage | 85%+ |
| | Test pass rate | 100% |

### Performance Tips

1. **Use caching** - Repeated queries are 10-100x faster
2. **Filter early** - Use `lang:`, `kind:`, `file:` to narrow results
3. **Batch index** - Index entire directory at once for best performance
4. **Watch mode** - Use for active development to keep index updated
5. **Monitor cache** - Check hit rate with `ax status -v`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│  CLI • Web UI • LSP Server • VS Code Extension              │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────┴───────────┬─────────────────────────┐
    │                       │                         │
    ▼                       ▼                         ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Workflow        │  │  Agent           │  │  Code            │
│  Engine          │──│  System          │──│  Intelligence    │
│  (Orchestration) │  │  (21 Agents)     │  │  (44 Languages)  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         └─────────────────────┴──────────────────────┘
                              │
                ┌─────────────┴──────────────┐
                │                            │
                ▼                            ▼
      ┌──────────────────┐        ┌──────────────────┐
      │  Provider Router │        │  ReScript Core   │
      │  (Multi-AI)      │        │  (State Machines)│
      └──────────────────┘        └──────────────────┘
                │                            │
                └─────────────┬──────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  SQLite Database │
                    │  (FTS5 + Vector) │
                    └──────────────────┘
```

**Key Components**:
- **Parser Layer**: Tree-sitter for AST parsing (44 languages)
- **Database Layer**: SQLite with FTS5 for full-text search and BM25 ranking
- **Service Layer**: FileService orchestrates indexing and search
- **Agent System**: 21 specialized agents with memory and collaboration
- **Provider Router**: Multi-AI with automatic fallback (Claude/Gemini/OpenAI)
- **ReScript Core**: Deterministic state machines for workflow orchestration

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test FileService
```

**Test Statistics v8.0.20**:
- **Total tests**: 745+
- **Pass rate**: 100%
- **Coverage**: 85%+
- **Test categories**:
  - Core: 165 tests (Parser, DAO, Service, Cache, Config, CLI)
  - SpecKit: 171 tests (5 generators + utilities)
  - Validation: 213 tests (ADR-014 system)
  - Iterate Mode: 103 tests (strategies, safety, analysis)
  - Natural Language: 30 tests (intent, routing, clarification)
  - ReScript Core: 50 tests (state machines, workflow)
  - Additional: 13+ tests (LSP, Web UI, integrations)

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build CLI
npm run build:cli

# Run CLI locally
npm run cli -- find "query"

# Run tests
npm test

# Clean build artifacts
npm run clean
```

---

## 🔒 Privacy & Telemetry

**Privacy by Default**: AutomatosX does **NOT** collect any telemetry data by default.

### Opt-in Telemetry (Optional)

To help improve AutomatosX, you can optionally enable telemetry:

```bash
# Enable local-only telemetry (stored in SQLite)
ax telemetry enable

# Enable with anonymous remote submission
ax telemetry enable --remote

# View statistics
ax telemetry stats

# Disable anytime
ax telemetry disable
```

### What We Collect (if enabled)

✅ **We collect**:
- Command usage (which commands you run)
- Query performance (how long operations take)
- Error occurrences (what errors happen)
- Parser invocations (which languages are used)

❌ **We NEVER collect**:
- File paths or names
- Code content
- User identifiers
- Personal information

See [PRIVACY.md](./PRIVACY.md) for complete details.

---

## 📖 Documentation

- **[FAQ](./FAQ.md)** - Frequently asked questions
- **[INSTALLATION](./INSTALLATION.md)** - Detailed installation guide
- **[CHANGELOG](./CHANGELOG.md)** - Version history and release notes
- **[API Quick Reference](./API-QUICKREF.md)** - Command reference and examples
- **[AGENTS](./AGENTS.md)** - Complete agent directory
- **[CLAUDE.md](./CLAUDE.md)** - Developer guide for Claude Code users
- **[PRIVACY.md](./PRIVACY.md)** - Privacy policy and data collection

---

## 🗺️ Roadmap

### v8.0.20 (Current - ✅ Complete)
- ✅ 44 programming languages supported
- ✅ 21 specialized AI agents
- ✅ Multi-provider AI (Claude, Gemini, OpenAI)
- ✅ Interactive CLI with natural language interface
- ✅ SpecKit auto-generation (5 generators)
- ✅ Iterate Mode with 10 strategies
- ✅ Validation system (ADR-014)
- ✅ 745+ tests passing (100%)
- ✅ Optimized npm package (2.5 MB, zero test files)

### v8.1.0 (Next - 4-6 weeks)
- API Spec Generator (OpenAPI/Swagger)
- Configuration validation (remaining 12.5% gap)
- Streaming validation for large files
- Custom error messages per validation rule
- User documentation and migration guides
- Performance optimizations

### v8.2.0 (Future - 8-12 weeks)
- Automated rollback on high error rates
- Advanced metrics (histograms, time-series)
- Workflow templates library
- Custom strategy plugins
- Multilingual support (i18n)
- Enhanced Web UI dashboard

### v9.0.0 (Long-term)
- ML semantic search with hybrid BM25+semantic scoring
- Cross-project search
- Enhanced LSP features
- Desktop application
- Collaborative workflows
- Enterprise SSO/RBAC

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## 📄 License

**Apache License 2.0** - Copyright 2025 DEFAI Private Limited

AutomatosX is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for the full license text.

### Commercial Usage

The codebase is Apache 2.0 licensed, **free for**:
- ✅ Research and academic use
- ✅ Personal use and learning
- ✅ Startups and small businesses (under $2M annual revenue/funding)

**Commercial license required** for:
- ❌ Enterprises with $2M+ annual revenue or funding
- ❌ Competitive use with DEFAI's commercial API offerings
- ❌ Offering AutomatosX as a managed service or SaaS
- ❌ Embedding in commercial products for distribution

**For commercial licensing:**
Visit [https://license.defai.digital/automatox](https://license.defai.digital/automatox)

See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for detailed terms and FAQs.

---

## 🙏 Acknowledgments

Built with:
- [Tree-sitter](https://tree-sitter.github.io/) - Incremental parsing system
- [SQLite](https://www.sqlite.org/) - Embedded database with FTS5
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal string styling

---

**AutomatosX v8.0.20** - From Idea to Production in Minutes

Copyright 2025 DEFAI Private Limited | Apache License 2.0

Made with ❤️ by DEFAI Private Limited
