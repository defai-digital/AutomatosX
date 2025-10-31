# AutomatosX Documentation

Welcome to the AutomatosX documentation! This guide will help you get started and master AI agent orchestration.

---

## 📚 Documentation Structure

### Getting Started

Start here if you're new to AutomatosX:

1. **[Quick Start Guide](./guide/quick-start.md)** ⭐
   - Installation (npm install)
   - Initialize your first project
   - Run your first agent
   - Basic commands overview

2. **[Core Concepts](./guide/core-concepts.md)**
   - Understand agents, profiles, and abilities
   - Learn about memory and providers
   - Grasp the security model

3. **[Installation Guide](./guide/installation.md)**
   - Detailed installation instructions
   - Environment setup
   - Troubleshooting installation issues

### Guides

In-depth explanations of core features:

- **[Multi-Agent Orchestration](./guide/multi-agent-orchestration.md)** 🤝
  - Natural language delegation (7 syntaxes)
  - Session management
  - Capability-first strategy
  - Workspace isolation

- **[Agent Communication & Memory](./guide/agent-communication.md)** 🧠 **NEW**
  - How agents communicate (prompt passing vs memory)
  - SQLite FTS5 memory system
  - Long-term knowledge base
  - Memory vs delegation explained

- **[Team Configuration](./guide/team-configuration.md)** 👥
  - Team-based agent organization
  - Shared configuration
  - Provider management
  - 4 built-in teams

- **[Configuration Guide](./guide/configuration.md)** ⚙️ **NEW**
  - Complete configuration reference
  - Provider setup and authentication
  - Cost optimization strategies
  - Environment variables
  - Common scenarios

- **[Provider Parameters](./guide/provider-parameters.md)** ⚙️
  - Model parameter configuration
  - Temperature and maxTokens
  - Provider-specific settings

- **[Agent Templates](./guide/agent-templates.md)** 📝
  - Quick agent creation
  - 5 built-in templates
  - Template engine usage

### Reference

Complete command and API documentation:

- **[CLI Commands Reference](./reference/cli-commands.md)** 📖
  - All commands documented
  - Options and parameters
  - Usage examples
  - Exit codes and environment variables

### Tutorials

Step-by-step hands-on guides:

- **[Creating Your First Agent](./tutorials/first-agent.md)** ⭐
  - Write an agent profile
  - Add abilities
  - Test your agent

- **[Memory Management](./tutorials/memory-management.md)** 🧠 **UPDATED**
  - Automatic memory system
  - Search and explore memories
  - Export/import for backup
  - Multi-day workflows
  - Best practices

### Troubleshooting

Common issues and solutions:

- **Common Issues** (coming soon)
  - Installation problems
  - Provider connection errors
  - Memory search issues

- **Error Codes** (coming soon)
  - Complete error reference
  - Debugging tips

### Examples

Real-world code examples:

- **Basic Agent** (coming soon)
- **Memory Usage** (coming soon)
- **Multi-Provider** (coming soon)

---

## 🚀 Quick Links

**For End Users**:

- [Quick Start](./guide/quick-start.md) - Get up and running in 5 minutes
- [CLI Commands](./reference/cli-commands.md) - Complete command reference
- [Core Concepts](./guide/core-concepts.md) - Understand the basics

**For Developers**:

- [Contributing Guide](../CONTRIBUTING.md) - Contribute to AutomatosX
- [Development Setup](../CONTRIBUTING.md#development-setup) - Local development
- [API Reference](./reference/api/) - Programmatic usage

**For Claude Code Users**:

- [Claude Code Integration](./guide/claude-code-integration.md) (coming soon)
- [Best Practices](./guide/best-practices.md) (coming soon)

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

See [Quick Start Guide](./guide/quick-start.md) for details.

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
| Quick Start Guide | ✅ Complete | P0 |
| Core Concepts | ✅ Complete | P0 |
| CLI Commands Reference | ✅ Complete | P0 |
| Installation Guide | ✅ Complete | P0 |
| **Agent Communication & Memory** | ✅ **Complete** | **P0** |
| Multi-Agent Orchestration | ✅ Complete | P0 |
| **Tutorial: Memory Management** | ✅ **Complete** | **P0** |
| Tutorial: First Agent | ✅ Complete | P1 |
| Team Configuration | ✅ Complete | P1 |
| Agent Templates | ✅ Complete | P1 |
| Provider Parameters | ✅ Complete | P1 |
| Configuration Guide | 📝 Planned | P2 |
| Tutorial: Custom Abilities | 📝 Planned | P2 |
| API Reference | 📝 Planned | P2 |
| Troubleshooting | 📝 Planned | P2 |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](../CONTRIBUTING.md) for:

- Development setup
- Code style guidelines
- Testing requirements
- Pull request process

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
