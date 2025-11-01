# AutomatosX Documentation

Welcome to the AutomatosX documentation! This guide will help you get started and master AI agent orchestration.

---

## 📚 Documentation Structure

### 🚀 Getting Started

Start here if you're new to AutomatosX:

1. **[3-Minute Quickstart](./getting-started/quickstart-3min.md)** ⚡ **[NEW]**
   - Get productive in under 3 minutes
   - Installation and first commands
   - Multi-agent collaboration examples
   - Pro tips and troubleshooting

2. **[Quick Start Guide](./getting-started/quick-start.md)** ⭐
   - Installation (npm install)
   - Initialize your first project
   - Run your first agent
   - Basic commands overview

3. **[Core Concepts](./getting-started/core-concepts.md)**
   - Understand agents, profiles, and abilities
   - Learn about memory and providers
   - Grasp the security model

4. **[Installation Guide](./getting-started/installation.md)**
   - Detailed installation instructions
   - Environment setup
   - Troubleshooting installation issues

### 📖 Guides

In-depth explanations of core features:

- **[Spec-Kit Usage Guide](./guides/spec-kit-guide.md)** 📋 **[NEW]**
  - YAML-driven workflow generation
  - Policy-driven provider selection
  - Dependency management and DAG generation
  - Project scaffolding and test generation
  - Complete examples and best practices

- **[Iteration Mode Guide](./guides/iteration-mode-guide.md)** 🔄 **[NEW]**
  - Multi-iteration autonomous analysis
  - Strictness levels (relaxed, balanced, strict)
  - Natural language usage patterns
  - Advanced features and best practices
  - Bug hunting and security audit examples

- **[Cost Calculation Configuration](./guides/cost-calculation-guide.md)** 💰 **[NEW]**
  - Why cost estimation is disabled by default
  - How to enable cost tracking
  - Policy configuration with cost constraints
  - Best practices for cost optimization
  - Migration guide for upgrading users

- **[Configuration Guide](./guides/configuration.md)** ⚙️
  - Complete configuration reference
  - Provider setup and authentication
  - Cost optimization strategies
  - Environment variables
  - Common scenarios

- **[Multi-Agent Orchestration](./guides/multi-agent-orchestration.md)** 🤝
  - Natural language delegation (7 syntaxes)
  - Session management
  - Capability-first strategy
  - Workspace isolation

- **[Agent Communication & Memory](./guides/agent-communication.md)** 🧠
  - How agents communicate (prompt passing vs memory)
  - SQLite FTS5 memory system
  - Long-term knowledge base
  - Memory vs delegation explained

- **[Team Configuration](./guides/team-configuration.md)** 👥
  - Team-based agent organization
  - Shared configuration
  - Provider management
  - 4 built-in teams

- **[Agent Templates](./guides/agent-templates.md)** 📝
  - Quick agent creation
  - 5 built-in templates
  - Template engine usage

- **[Spec-Driven Development](./guides/spec-driven-development.md)** 📋
  - Specification-first workflows
  - Test generation from specs
  - Implementation validation

- **[Checkpoints & Resume](./guides/checkpoints-and-resume.md)** 💾
  - Save execution state
  - Resume interrupted workflows
  - Recovery strategies

- **[Terminal Mode](./guides/terminal-mode.md)** 💻
  - Interactive terminal interface
  - Real-time agent interaction
  - Command shortcuts

### 🔌 Providers

Provider-specific documentation:

- **[Provider Overview](./providers/overview.md)** 📊
  - Compare Claude, Gemini, OpenAI
  - Cost analysis
  - Feature comparison
  - Choosing the right provider

- **[Provider Parameters](./providers/parameters.md)** ⚙️
  - Model parameter configuration
  - Temperature and maxTokens
  - Provider-specific settings

- **[Gemini Integration](./providers/gemini.md)** 🔮
  - Free tier setup (1,500 requests/day)
  - 99.6% cost savings vs OpenAI
  - Approval modes
  - Best practices

- **[OpenAI Codex](./providers/openai-codex.md)** 🤖
  - Codex CLI setup
  - Model configuration
  - Integration patterns

### 🎓 Tutorials

Step-by-step hands-on guides:

- **[Creating Your First Agent](./tutorials/first-agent.md)** ⭐
  - Write an agent profile
  - Add abilities
  - Test your agent

- **[Memory Management](./tutorials/memory-management.md)** 🧠
  - Automatic memory system
  - Search and explore memories
  - Export/import for backup
  - Multi-day workflows
  - Best practices

### 🖥️ Platform

Platform-specific documentation:

#### Windows

- **[Windows Setup](./platform/windows/setup.md)** 🪟
  - Installation on Windows
  - PATH configuration
  - Provider CLI setup
  - Environment variables

- **[Windows Troubleshooting](./platform/windows/troubleshooting.md)** 🔧
  - Common Windows issues
  - PowerShell vs CMD
  - Permission problems
  - Diagnostic commands

### 📚 Reference

Technical reference documentation:

- **[CLI Commands Reference](./reference/cli-commands.md)** 📖
  - All commands documented
  - Options and parameters
  - Usage examples
  - Exit codes and environment variables

- **[Observability API](./reference/api/observability.md)** 📊
  - Performance monitoring
  - Metrics collection
  - Debugging tools

### ⚡ Advanced

Advanced topics and optimization:

- **[Best Practices](./advanced/best-practices.md)** ✨
  - Production patterns
  - Security guidelines
  - Performance optimization
  - Error handling

- **[Performance Tuning](./advanced/performance.md)** 🚀
  - Optimization strategies
  - Benchmarking
  - Resource management
  - Profiling tools

- **[Caching](./advanced/caching.md)** 💾
  - Cache strategies
  - Configuration
  - Invalidation patterns
  - Performance impact

- **[Parallel Execution](./advanced/parallel-execution.md)** ⚡
  - Concurrent agent execution
  - Observability
  - Resource management
  - Best practices

### 🤝 Contributing

Contributing to AutomatosX:

- **[Testing Guide](./contributing/testing.md)** 🧪
  - Unit testing
  - Integration testing
  - Test coverage

- **[E2E Testing](./contributing/e2e-testing.md)** 🔄
  - End-to-end test setup
  - Test scenarios
  - CI/CD integration

- **[Test Writing Standards](./contributing/test-standards.md)** 📏
  - Testing best practices
  - Code coverage requirements
  - Mock strategies

- **[Conventional Commits](./contributing/conventional-commits.md)** 📝
  - Commit message format
  - Semantic versioning
  - Changelog generation

- **[Workspace Conventions](./contributing/workspace-conventions.md)** 📂
  - Project structure
  - File organization
  - Naming conventions

- **[Release Process](./contributing/release-process.md)** 🚀
  - Version management
  - Release checklist
  - Publishing workflow

- **[Project History](./contributing/project-history.md)** 📜
  - Development timeline
  - Major milestones
  - Evolution of features

---

## 🚀 Quick Links

**For End Users**:

- [3-Minute Quickstart](./getting-started/quickstart-3min.md) - Get productive in under 3 minutes ⚡
- [Quick Start](./getting-started/quick-start.md) - Get up and running in 5 minutes
- [Spec-Kit Guide](./guides/spec-kit-guide.md) - YAML-driven workflows
- [Iteration Mode Guide](./guides/iteration-mode-guide.md) - Multi-iteration analysis
- [CLI Commands](./reference/cli-commands.md) - Complete command reference
- [Core Concepts](./getting-started/core-concepts.md) - Understand the basics

**For Developers**:

- [Contributing Guide](../CONTRIBUTING.md) - Contribute to AutomatosX
- [Development Setup](../CONTRIBUTING.md#development-setup) - Local development
- [Testing Guide](./contributing/testing.md) - Write tests

**For Power Users**:

- [Best Practices](./advanced/best-practices.md) - Production patterns
- [Performance Tuning](./advanced/performance.md) - Optimization strategies
- [Provider Comparison](./providers/overview.md) - Choose the right provider

---

## 💡 What is AutomatosX?

AutomatosX is an **agent execution tool** designed for **Claude Code**. It allows you to:

✅ **Execute AI Agents**: Run specialized AI agents with a single command
✅ **Manage Memory**: Store and retrieve context with vector search
✅ **Use Multiple Providers**: Claude, Gemini, OpenAI support
✅ **Build Profiles**: YAML-based agent configuration
✅ **Reuse Abilities**: Markdown-based skill definitions

**Key Point**: AutomatosX is **not** a standalone chat application. It's a tool that Claude Code uses to execute agents and manage their state.

---

## 📦 Installation

Install AutomatosX via npm:

```bash
# Global installation
npm install -g @defai.digital/automatosx

# Or use npx
npx @defai.digital/automatosx --version
```

Initialize your project:

```bash
automatosx init
```

Run your first agent:

```bash
automatosx run assistant "What is TypeScript?"
```

See [Quick Start Guide](./getting-started/quick-start.md) for details.

---

## 🎯 Core Commands

AutomatosX provides 6 core commands:

```bash
automatosx init              # Initialize project
automatosx run <agent>       # Execute agent
automatosx list <type>       # List agents/abilities
automatosx status            # System health
automatosx config            # Configuration
automatosx memory <cmd>      # Memory operations
```

See [CLI Commands Reference](./reference/cli-commands.md) for complete documentation.

---

## 📖 Documentation Status

| Section | Status | Priority |
|---------|--------|----------|
| 3-Minute Quickstart | ✅ Complete | P0 |
| Spec-Kit Usage Guide | ✅ Complete | P0 |
| Iteration Mode Guide | ✅ Complete | P0 |
| Cost Calculation Configuration | ✅ Complete | P0 |
| Quick Start Guide | ✅ Complete | P0 |
| Core Concepts | ✅ Complete | P0 |
| CLI Commands Reference | ✅ Complete | P0 |
| Installation Guide | ✅ Complete | P0 |
| Configuration Guide | ✅ Complete | P0 |
| Agent Communication & Memory | ✅ Complete | P0 |
| Multi-Agent Orchestration | ✅ Complete | P0 |
| Tutorial: Memory Management | ✅ Complete | P0 |
| Tutorial: First Agent | ✅ Complete | P1 |
| Team Configuration | ✅ Complete | P1 |
| Agent Templates | ✅ Complete | P1 |
| Provider Parameters | ✅ Complete | P1 |
| Provider Overview | ✅ Complete | P1 |
| Gemini Integration | ✅ Complete | P1 |
| Best Practices | ✅ Complete | P1 |
| Performance Tuning | ✅ Complete | P2 |
| Tutorial: Custom Abilities | 📝 Planned | P2 |
| API Reference | 📝 Planned | P2 |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](../CONTRIBUTING.md) for:

- Development setup
- Code style guidelines
- Testing requirements
- Pull request process

Also check out our [contributing documentation](./contributing/) for detailed guides on testing, release process, and project conventions.

---

## 📄 License

AutomatosX is [MIT licensed](../LICENSE).

---

## 🔗 Links

- **GitHub**: [github.com/defai-digital/automatosx](https://github.com/defai-digital/automatosx)
- **Issues**: [github.com/defai-digital/automatosx/issues](https://github.com/defai-digital/automatosx/issues)
- **npm**: [npmjs.com/package/automatosx](https://npmjs.com/package/automatosx)

---

## 📮 Get Help

- **Documentation**: You're reading it!
- **Issues**: [Report bugs or request features](https://github.com/defai-digital/automatosx/issues)
- **Examples**: Check `.automatosx/agents/` after running `init`

---

**Happy coding with AutomatosX!** 🤖✨
