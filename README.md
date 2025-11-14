# AutomatosX

> Production-ready code intelligence platform with AI agents and workflow orchestration

[![Node.js](https://img.shields.io/badge/node.js-24.x-brightgreen)](https://nodejs.org/)
[![Ubuntu](https://img.shields.io/badge/ubuntu-24.04%20LTS-orange)](https://ubuntu.com/)
[![macOS](https://img.shields.io/badge/macOS-26%20Tahoe+-blue)](https://www.apple.com/macos/)
[![Windows](https://img.shields.io/badge/windows-11-blue)](https://www.microsoft.com/windows/)
[![Tests](https://img.shields.io/badge/tests-165%20passing-brightgreen)](./src)
[![Coverage](https://img.shields.io/badge/coverage-85%25-green)](./src)
[![Languages](https://img.shields.io/badge/languages-45-blue)](./src/parser)
[![Agents](https://img.shields.io/badge/agents-21-purple)](./src/agents)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-8.0.0-blue.svg)](package.json)

AutomatosX is a comprehensive code intelligence platform combining:
- **Code Intelligence** - Tree-sitter AST parsing with SQLite FTS5 search for 45 languages
- **AI Agent System** - 21 specialized agents for development tasks
- **Multi-Provider AI** - Claude, Gemini, and OpenAI with automatic fallback
- **Workflow Orchestration** - ReScript state machines for complex multi-step tasks

## 📋 Requirements

- **Node.js**: v24.x or higher ([Download](https://nodejs.org/))
- **npm**: v10.0.0 or higher
- **Supported Operating Systems**:
  - **Ubuntu**: 24.04 LTS (Noble Numbat) or later
  - **macOS**: 26 (Tahoe) or later
  - **Windows**: 11 or later

## 🚀 Quick Start

```bash
# Install
npm install

# Build
npm run build

# Try examples
node examples/01-multi-agent-collaboration.ts

# Execute workflow
ax workflow execute workflows/cicd-pipeline.yaml
```

See [examples/README.md](./examples/README.md) for complete guides.

## ✨ Core Features

### Code Intelligence Engine
- 🔍 **Multi-language search** - 45 languages including TypeScript, Python, Go, Rust, Java, C++
- ⚡ **Lightning fast** - Query caching delivers 10-100x speedup (<1ms cached, <5ms uncached)
- 🎯 **Advanced filtering** - Filter by language, symbol kind, or file path
- 📊 **Smart indexing** - Batch operations process 2000+ files/sec

### AI Agent System (21 Specialized Agents)
- 🤖 **Engineering Agents** - Backend, Frontend, DevOps, Security, Quality, Testing, Performance, Architecture
- 🔧 **Technical Specialists** - API, Database, Data, DataScience, Mobile, Infrastructure, Standards
- 👔 **Leadership Agents** - Product, CTO, CEO, Writer, Researcher
- 🔄 **Collaboration** - Agent-to-agent delegation and task coordination

### Multi-Provider AI Integration
- 🌐 **Three Providers** - Claude (Anthropic), Gemini (Google), OpenAI
- 🔄 **Automatic Fallback** - Seamless failover with retry logic
- 📊 **Health Monitoring** - Real-time latency and error rate tracking
- ⚙️ **Smart Routing** - Priority-based provider selection

### Workflow Orchestration
- 📋 **YAML/JSON Workflows** - Define complex multi-step processes
- 🔗 **Dependency Management** - Automatic topological sorting and parallel execution
- 💾 **Checkpoint/Resume** - Resume long-running workflows from any point
- 🎯 **ReScript State Machines** - Deterministic execution with type safety

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
│  (Orchestration) │  │  (21 Agents)     │  │  (45 Languages)  │
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

## 🎯 Example Use Cases

### 1. Multi-Agent Code Review
```typescript
// Security, Quality, and Architecture agents collaborate
const runtime = new AgentRuntime(registry, router, db);

await runtime.executeTask({
  type: 'code-review',
  description: 'Comprehensive security and quality review',
  context: { repositoryPath: './src' },
});
```

### 2. CI/CD Pipeline Workflow
```yaml
# workflows/cicd-pipeline.yaml
name: cicd-pipeline
steps:
  - key: security-scan
    agent: security
  - key: run-tests
    agent: testing
    dependsOn: [security-scan]
  - key: deploy
    agent: devops
    dependsOn: [run-tests]
```

```bash
ax workflow execute workflows/cicd-pipeline.yaml
```

### 3. Provider Fallback
```typescript
// Automatically tries Claude → Gemini → OpenAI
const router = new ProviderRouterV2({
  providers: {
    claude: { enabled: true, priority: 1 },
    gemini: { enabled: true, priority: 2 },
    openai: { enabled: true, priority: 3 }
  }
});

const response = await router.request({
  messages: [{ role: 'user', content: 'Explain this code' }]
});
```

## 💬 Interactive CLI Mode

AutomatosX includes a ChatGPT-style Interactive CLI for natural language conversations with AI assistants.

### Quick Start

```bash
# Launch Interactive CLI
ax cli

# Set an agent for specialized help
> /agent BackendAgent

# Ask questions naturally
> how do I implement rate limiting in Express?

# Run workflows
> /workflow run code-review

# Save your session
> /save my-session.json
```

### Features

- 🤖 **Natural language conversations** with Claude, Gemini, and OpenAI
- ⚡ **13 slash commands** for system control and automation
- 💾 **Auto-save conversations** to SQLite (every 5 messages + on exit)
- 🎯 **Agent collaboration** with 21 specialized AI personas
- 🔄 **Workflow integration** for automated development tasks
- ⌨️  **Tab autocomplete** and command history navigation
- 🎨 **Professional UX** with color-coded output and loading indicators

### Interactive Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show all available commands | `/help` |
| `/agent <name>` | Set active AI agent | `/agent BackendAgent` |
| `/workflow run <name>` | Execute workflow | `/workflow run test-gen` |
| `/history [limit]` | View conversation history | `/history 20` |
| `/save <file>` | Export conversation to JSON | `/save session.json` |
| `/load <file>` | Import conversation from JSON | `/load session.json` |
| `/memory search <query>` | Search code index | `/memory search "login"` |
| `/context` | Show conversation state | `/context` |
| `/agents [filter]` | List all agents | `/agents backend` |
| `/status` | System health check | `/status` |
| `/config` | Show configuration | `/config` |
| `/clear` | Clear terminal screen | `/clear` |
| `/exit` | Exit CLI (auto-saves) | `/exit` |

### Example Session

```
> /agent BackendAgent
✓ Active agent set to: BackendAgent

> how do I implement database connection pooling in Express?

BackendAgent: For Express database connection pooling, I recommend using pg-pool
for PostgreSQL or mysql2 pool for MySQL. Here's a complete example:

[provides detailed code example with connection pool setup]

> what about error handling?

BackendAgent: Good question! For robust error handling with connection pools:

1. Always use try-catch with async/await
2. Implement retry logic for transient errors
3. Set proper timeout values
4. Monitor pool metrics

[provides error handling code examples]

> /save express-db-pooling-session.json
✓ Conversation exported to: express-db-pooling-session.json

> /exit
Saving conversation to database...
✓ Conversation saved
👋 Exiting... Goodbye!
```

**[Full Interactive CLI Documentation →](docs/cli/interactive-mode.md)**

---

## 🎨 System Capabilities

### Code Intelligence
- 🔍 **Multi-language search** - Natural language and symbol queries
- 🎯 **Advanced filtering** - Filter by language, kind, file patterns
- 📊 **Smart indexing** - Incremental updates, batch processing
- 🌐 **Complete ecosystem coverage** - DevOps, Messaging, Frontend, Backend, Mobile, ML
- 🎨 **Professional UX** - Color-coded output, progress indicators, helpful errors
- ⚙️ **Flexible configuration** - Hierarchical config with environment variables
- 🧪 **Production quality** - 165 tests passing, 85%+ coverage, zero known bugs

## 🌍 Supported Languages (45)

### Systems & Performance
C, C++, Rust, Go, Zig, Objective-C, AssemblyScript, CUDA (NVIDIA/AMD ROCm HIP)

### Frontend & Mobile
TypeScript, JavaScript, HTML, Swift, Kotlin, Dart (Flutter)

### Backend & Scripting
Python, Ruby, PHP, Java, Scala, C#, Bash, Zsh, Lua, Groovy, Perl

### Functional Programming
Haskell, OCaml, Elm, Elixir, Gleam

### Data & Config
SQL, JSON, YAML, TOML, Markdown, CSV

### DevOps & Infrastructure
HCL (Terraform), Puppet, Makefile

### Messaging & RPC
Thrift (Apache Thrift IDL)

### Specialized
Solidity (Ethereum), Verilog, SystemVerilog, Julia, MATLAB, Regex

<details>
<summary><b>📊 Framework Coverage by Ecosystem</b></summary>

| Ecosystem | Coverage | Frameworks |
|-----------|----------|------------|
| **Frontend** | 100% | React, Vue, Angular, Svelte, Next.js, Elm, Flutter |
| **Backend** | 100% | NestJS, Express, Django, FastAPI, Flask, Spring Boot, Rails, Laravel, Phoenix |
| **Mobile** | 100% | Flutter, SwiftUI, Jetpack Compose, React Native |
| **ML/AI** | 100% | TensorFlow, PyTorch, HuggingFace, Qiskit, JAX, scikit-learn |
| **DevOps** | 100% ✅ | Terraform, Puppet, Kubernetes, Ansible, Jenkins, GitHub Actions, GitLab CI |
| **Messaging** | 100% ✅ | NATS, Kafka, Thrift, RabbitMQ, Redis, Apache Pulsar |
| **Blockchain** | 100% | Ethereum, Hardhat, Truffle, Solidity |

</details>

## 🚀 Quick Start

### Installation

```bash
npm install -g automatosx-v2
```

### Basic Usage

```bash
# Index your codebase
ax index ./src

# Search for code
ax find "getUserById"

# Search with filters
ax find "lang:python authentication"

# Find symbol definition
ax def getUserById

# Show index statistics
ax status
```

## 📚 Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ax find <query>` | Search code with optional filters | `ax find "lang:python login"` |
| `ax def <symbol>` | Find symbol definition | `ax def getUserById` |
| `ax flow <function>` | Show call flow | `ax flow handleLogin` |
| `ax lint [pattern]` | Code linting | `ax lint src/**/*.ts` |
| `ax index [dir]` | Index codebase | `ax index ./src` |
| `ax watch [dir]` | Auto-index with file watching | `ax watch ./src` |
| `ax status` | Show index & cache statistics | `ax status --verbose` |

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

## 📈 Performance

AutomatosX v2 delivers significant performance improvements:

| Metric | Value |
|--------|-------|
| Query latency (cached) | <1ms |
| Query latency (uncached) | <5ms (P95) |
| Indexing throughput | 2000+ files/sec |
| Cache hit rate | 60%+ typical |
| Test coverage | 85%+ |
| Tests passing | 165/165 (100%) |

### Performance Tips

1. **Use caching** - Repeated queries are 10-100x faster
2. **Filter early** - Use `lang:`, `kind:`, `file:` to narrow results
3. **Batch index** - Index entire directory at once for best performance
4. **Watch mode** - Use for active development to keep index updated
5. **Monitor cache** - Check hit rate with `ax status -v`

## 🏗️ Architecture

AutomatosX v2 uses a multi-layer architecture:

```
┌─────────────────────────────────────┐
│         CLI Layer (Commander)        │
│  (Commands, Args, Output Formatting) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Service Layer (TypeScript)      │
│ (FileService, ConfigLoader, Caching) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Parser Layer (Tree-sitter)        │
│  (TS/JS/Python AST → Symbol Extract) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Database Layer (SQLite FTS5)      │
│ (Files, Symbols, Chunks, Full-Text)  │
└──────────────────────────────────────┘
```

**Key Components**:
- **Parser Layer**: Tree-sitter for AST parsing (45 languages: TypeScript, Python, Go, Rust, Java, C++, and 39 more)
- **Database Layer**: SQLite with FTS5 for full-text search and BM25 ranking
- **Service Layer**: FileService orchestrates indexing and search
- **Query Router**: Intelligent query intent detection (symbol vs natural language)
- **Cache Layer**: LRU cache with TTL for query result caching
- **Configuration**: Zod-based validation with hierarchical loading

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test FileService
```

**Test Statistics**:
- Total tests: 165
- Pass rate: 100%
- Coverage: 85%+
- Test categories: Parser, DAO, Service, Cache, Config, CLI, Integration

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

## 📖 Documentation

- **[P1 Final Action Plan](./automatosx/PRD/p1-final-action-plan.md)** - Comprehensive implementation plan
- **[CHANGELOG](./CHANGELOG.md)** - Version history and release notes
- **[API Quick Reference](./API-QUICKREF.md)** - Command reference and examples

## 🗺️ Roadmap

### v2.1 (Current - ✅ Complete)
- ✅ 45 programming languages supported
- ✅ 100% DevOps coverage (Terraform, Puppet, Ansible, Jenkins, etc.)
- ✅ 100% Messaging coverage (NATS, Kafka, Thrift, RabbitMQ, Redis)
- ✅ Go, Rust, and 30+ additional languages

### v2.2 (Next)
- Configuration CLI tools (`ax config validate`, `ax config init`)
- Enhanced FPGA support (Verilog/SystemVerilog)
- Performance optimizations for large codebases (100k+ files)

### P2 / v3.0 (Future)
- ML semantic search with hybrid BM25+semantic scoring
- Cross-project search
- Language Server Protocol (LSP) integration
- Protocol Buffers (.proto) support (pending npm availability)
- Desktop application

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

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

## 🙏 Acknowledgments

Built with:
- [Tree-sitter](https://tree-sitter.github.io/) - Incremental parsing system
- [SQLite](https://www.sqlite.org/) - Embedded database with FTS5
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal string styling

---

**AutomatosX v2.0.0** - Production-ready code intelligence

Copyright 2025 DEFAI Private Limited | Apache License 2.0

Made with ❤️ by DEFAI Private Limited
