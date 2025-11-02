# ⚡ 3-Minute Quickstart

**Get started with AutomatosX in under 3 minutes**

---

## Prerequisites (30 seconds)

Before you begin, ensure you have:

- **Node.js >= 20.0.0** ([Download](https://nodejs.org/))
- **One AI provider CLI** installed:
  - **Gemini CLI** (recommended, free): `npm install -g @google/gemini-cli`
  - **Claude Code**: Already configured if you're using it now
  - **OpenAI Codex**: `npm install -g openai-cli`

---

## Install AutomatosX (30 seconds)

```bash
# Install globally
npm install -g @defai.digital/automatosx

# Initialize in your project
ax setup
```

Done! AutomatosX is now ready to use.

---

## 🗣️ Using AutomatosX with Natural Language (Recommended)

**The best way to use AutomatosX is through natural language in your AI assistant!**

AutomatosX is designed to work seamlessly with AI assistants. Instead of typing CLI commands, simply ask your AI assistant naturally. **Just say "ax" and it automatically selects the best agent(s) for your task** - you don't need to specify which agent to use!

### In Claude Code (claude.ai/code)

Simply talk to Claude naturally:

```
"Please use ax to implement user authentication"

"Use ax to audit this authentication code for security issues"

"Have ax write comprehensive tests for the login feature"

"Use ax to design a microservices architecture"
```

**What happens**: Claude Code automatically:
- Translates your request into `ax` commands
- `ax` analyzes the task and picks the best agent(s)
- Monitors progress and coordinates multi-agent work
- Reports results back to you

### In Gemini CLI

Talk to Gemini naturally:

```
"Please use ax to implement the API endpoints"

"Use ax to perform a vulnerability scan"

"Have ax generate unit tests for this feature"
```

**What happens**: Gemini CLI:
- Understands your intent
- Executes `ax run` with your task description
- `ax` automatically selects appropriate agents
- Shows you the results

### In OpenAI Codex

Talk to Codex naturally:

```
"Use ax to build the user interface"

"Use ax to set up CI/CD pipeline"

"Have ax design the database schema"
```

**What happens**: Codex:
- Interprets your request
- Runs `ax` with task description
- `ax` auto-selects the right agent(s)
- Returns the results

### Why Natural Language with Auto-Selection is Better

✅ **Smarter**: `ax` picks the optimal agent(s) for your task
✅ **Faster**: No need to remember agent names or command syntax
✅ **Easier**: Just say "ax" and describe what you want done
✅ **Multi-Agent**: Automatically coordinates multiple agents when needed
✅ **Context-aware**: AI assistants remember your conversation
✅ **Error-handling**: AI can retry or clarify if needed

---

## Your First Commands (1 minute)

**Note**: If you prefer direct CLI usage, you can use `ax run` with just your task description. AutomatosX will automatically select the best agent(s)!

### Let AutomatosX Choose the Right Agent (Recommended)

```bash
# AutomatosX analyzes task and picks the best agent
ax run "Explain this codebase structure"

# AutomatosX selects security agent for auditing
ax run "Audit src/auth.ts for vulnerabilities"

# AutomatosX picks quality agent for testing
ax run "Write tests for the authentication module"

# AutomatosX uses architecture agent for design
ax run "Design a microservices architecture for this project"
```

### Or Specify an Agent Directly (Optional)

```bash
# You CAN still specify agents if needed
ax run backend "Explain this codebase structure"
ax run security "Audit src/auth.ts for vulnerabilities"
ax run quality "Write tests for the authentication module"
```

### Check Available Agents

```bash
ax list agents
```

You'll see 20+ specialized agents including:
- `backend`, `frontend`, `fullstack`
- `security`, `quality`, `devops`
- `architecture`, `product`, `data`
- And more...

But remember: **You don't need to choose** - AutomatosX does it for you!

---

## Try Multi-Agent Collaboration (1 minute)

`ax` automatically coordinates multiple agents for complex tasks:

```bash
# ax analyzes this complex task and orchestrates multiple agents
ax run "Build a user authentication feature with database, API, and tests"
```

**What happens:**
1. 🎯 `ax` analyzes the full scope of your request
2. 📋 Selects **product agent** to design the system architecture
3. ⚙️ Delegates to **backend agent** to implement the API endpoints
4. 🔒 Brings in **security agent** to audit for vulnerabilities
5. ✅ Assigns **quality agent** to write comprehensive tests

All automatically, in optimal sequence!

**You can also specify agents if needed:**
```bash
ax run product "Build a user authentication feature with database, API, and tests"
```

---

## Next Steps

### Explore Memory

AutomatosX remembers everything automatically:

```bash
# Search past conversations
ax memory search "authentication"

# List recent memories
ax memory list --limit 10
```

### Check System Status

```bash
# View available providers
ax providers list

# Check provider health
ax doctor gemini-cli

# View free-tier quota
ax free-tier status
```

### Try Advanced Features

```bash
# Iteration mode for deep analysis (5 iterations)
ax run quality "Find bugs in src/" --iterate

# Parallel execution for faster workflows
ax run product "Build feature" --parallel

# Streaming output for real-time feedback
ax run backend "Explain codebase" --streaming

# Resumable execution for long tasks
ax run backend "Refactor entire codebase" --resumable
```

---

## Pro Tips

### 1. Memory is Automatic

All conversations are automatically saved and searchable. Reference past decisions:

```bash
# First conversation
ax run product "Design calculator with add/subtract"

# Later (automatically retrieves the design!)
ax run backend "Implement the calculator API"
```

### 2. Use Natural Language in Claude Code

If you're using Claude Code, you can ask naturally:

```
"Please work with the ax backend agent to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
```

Claude Code will automatically use AutomatosX for you!

### 3. Cost is Optimized Automatically

AutomatosX prioritizes free tiers:
- **Gemini**: 1,500 free requests/day (used first)
- **Fallback**: Paid providers only when needed
- **Smart routing**: Based on task requirements

Result: **60-80% cost reduction** compared to single-provider usage.

### 4. Parallel Execution Saves Time

For multi-step tasks:

```bash
ax run product "Complex project" --parallel
```

Independent tasks run simultaneously, cutting execution time by 50-70%.

### 5. Resume Support for Long Tasks

Never lose progress on long-running tasks:

```bash
# Start resumable task
ax run backend "Refactor codebase" --resumable

# If interrupted, resume with:
ax resume <run-id>

# List all resumable runs
ax runs list
```

---

## Troubleshooting

### "Provider not available"

**Check provider setup:**
```bash
ax doctor gemini-cli
ax doctor claude
ax providers list
```

**Fix:**
- Install missing provider CLI
- Check API keys are configured
- Verify network connectivity

### "Agent not found"

**Check agent name:**
```bash
ax list agents  # See all available agents
```

**Note**: Agent names are case-sensitive:
- ✅ Correct: `ax run backend "task"`
- ❌ Wrong: `ax run Backend "task"`

### "Slow performance"

**Try these flags:**
```bash
# Streaming output (see progress in real-time)
ax run backend "task" --streaming

# Parallel execution (faster for multi-step tasks)
ax run product "complex task" --parallel

# Check free-tier quota
ax free-tier status
```

---

## What You've Learned

In just 3 minutes, you've learned how to:
- ✅ Install and set up AutomatosX
- ✅ Run agents with natural language tasks
- ✅ Use multi-agent collaboration
- ✅ Search memory for past conversations
- ✅ Try advanced features (iteration, parallel, streaming)
- ✅ Troubleshoot common issues

---

## Deep Dive Guides

Ready to level up? Check out these comprehensive guides:

### Core Features
- **[Spec-Kit Guide](../guides/spec-kit-guide.md)** - YAML-driven workflows with dependency management
- **[Iteration Mode Guide](../guides/iteration-mode.guide.md)** - Multi-iteration autonomous analysis (2, 5, or 10 passes)
- **[Cost Configuration](../guides/cost-calculation-guide.md)** - Enable cost tracking (disabled by default)

### Advanced Topics
- **[Multi-Agent Orchestration](../guides/multi-agent-orchestration.md)** - Complex collaboration patterns
- **[Memory System Guide](../guides/memory.md)** - Deep dive into persistent memory
- **[Agent Creation](../guides/agents.md)** - Create custom agents

### Reference
- **[CLI Commands Reference](../reference/cli-commands.md)** - Complete command documentation
- **[Provider Comparison](../providers/overview.md)** - Compare AI providers
- **[Configuration Guide](../guides/configuration.md)** - Advanced configuration options

---

## Example Workflows

### Quick Code Review

```bash
# Review code quality
ax run quality "Review src/ for code smells and anti-patterns"

# Review security
ax run security "Audit authentication implementation"

# Review performance
ax run quality "Analyze src/core for performance bottlenecks"
```

### Feature Development

```bash
# 1. Design feature
ax run product "Design user profile feature with requirements"

# 2. Implement backend
ax run backend "Implement user profile API based on design"

# 3. Build frontend
ax run frontend "Build user profile UI based on design"

# 4. Write tests
ax run quality "Write tests for user profile feature"

# 5. Security audit
ax run security "Audit user profile implementation"
```

### Spec-Driven Project

For complex projects, use Spec-Kit:

```bash
# Create spec from natural language
ax spec create "Build authentication system with database, API, JWT, and tests"

# Generate execution plan
ax gen plan auth-system.yaml

# Generate dependency graph
ax gen dag auth-system.yaml --format mermaid

# Execute the entire workflow
ax run auth-system.yaml --parallel --streaming
```

---

## Getting Help

### Documentation
- **Main Docs**: `docs/` directory
- **Examples**: `examples/` directory
- **Configuration**: `automatosx.config.json`

### Commands
```bash
# General help
ax --help

# Command-specific help
ax run --help
ax spec --help
ax gen --help

# System diagnostics
ax status
ax doctor
```

### Community
- **Issues**: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/defai-digital/automatosx/discussions)
- **NPM**: [@defai.digital/automatosx](https://www.npmjs.com/package/@defai.digital/automatosx)

---

## Congratulations!

You're now ready to use AutomatosX productively. Start with simple tasks and gradually explore advanced features as you get comfortable.

**Happy automating! 🚀**

---

**Version**: 6.5.13
**Last Updated**: 2025-11-01
