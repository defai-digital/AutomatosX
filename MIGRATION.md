# Migration Guide: v7.x to v8.2.0

This guide helps you migrate from AutomatosX v7.x to v8.2.0.

## What Changed in v8.2.0

### Major Change: Removed Standalone Chatbot

**What was removed:**
- `ax cli` command (interactive chatbot mode)
- `packages/cli-interactive/` directory (~25,000 lines of code)
- All Phase 1-6 interactive CLI features (slash commands, streaming, etc.)

**Why this change:**
Users overwhelmingly preferred using their existing AI assistants (Claude Code, Gemini CLI, Codex CLI) for conversations. The standalone chatbot duplicated functionality and added unnecessary complexity. By removing it, AutomatosX becomes a **pure orchestration platform** that works seamlessly with AI assistants.

## What Remains Unchanged

✅ **All core CLI commands work exactly the same:**
- `ax run <agent> "task"` - Execute agent tasks
- `ax memory search` - Search persistent memory
- `ax session create` - Multi-agent sessions
- `ax spec run` - Spec-driven workflows
- `ax providers` - Provider management
- `ax status` - System status
- All other commands - unchanged

✅ **Core features intact:**
- 20+ specialized agents
- Persistent memory (SQLite FTS5)
- Policy-driven routing
- Multi-provider support
- Spec-Kit workflow system
- Complete observability

## Migration Steps

### 1. Update AutomatosX

```bash
npm install -g @defai.digital/automatosx@latest
# or
npm update -g @defai.digital/automatosx
```

### 2. If You Used `ax cli`

**Before (v7.x):**
```bash
ax cli
ax> @backend implement authentication
ax> /save auth-session
ax> /exit
```

**After (v8.2.0) - Use AI Assistant Instead:**

#### Option A: Claude Code (Recommended)
```
You: "Please use ax to implement authentication with the backend agent"
Claude Code: Executes `ax run backend "implement authentication"`
AutomatosX: Returns results
Claude Code: Continues conversation naturally
```

#### Option B: Gemini CLI
```bash
gemini "Use ax backend agent to implement authentication"
# Gemini invokes: ax run backend "implement authentication"
```

#### Option C: Codex CLI
```bash
codex "Have ax backend agent implement authentication"
# Codex invokes: ax run backend "implement authentication"
```

#### Option D: Direct CLI (No conversation)
```bash
ax run backend "implement authentication"
```

### 3. Session Management

**Before (v7.x):**
```bash
ax cli
ax> /save my-session
ax> /load my-session
```

**After (v8.2.0):**
Sessions are managed by your AI assistant (Claude Code, Gemini CLI, etc.). AutomatosX `ax session` commands remain for multi-agent collaboration:

```bash
# Multi-agent sessions still work
ax session create "auth-work" backend security
ax session add "auth-work" quality
ax session list
```

### 4. Memory Search

**Before (v7.x):**
```bash
ax cli
ax> /memory search "authentication"
```

**After (v8.2.0):**
```bash
# Direct command
ax memory search "authentication"

# Or ask your AI assistant
You: "Search ax memory for authentication patterns"
AI: Executes `ax memory search "authentication"`
```

### 5. Agent Delegation

**Before (v7.x):**
```bash
ax cli
ax> @backend create API
ax> @security audit code
```

**After (v8.2.0):**
```bash
# Direct commands
ax run backend "create API"
ax run security "audit code"

# Or natural language with AI assistant
You: "Have ax backend create the API, then have security audit it"
AI: Executes both commands sequentially
```

## Frequently Asked Questions

### Q: Can I still save conversations?

Yes, but through your AI assistant's native features:
- **Claude Code**: Auto-saves conversations
- **Gemini CLI**: Use `gemini --save` flag
- **Codex CLI**: Use history features

AutomatosX `ax memory` still saves all agent executions automatically.

### Q: What about slash commands?

Slash commands (`/help`, `/memory`, `/save`, etc.) were part of the removed chatbot. Use:
- **AI assistant features** for conversation management
- **Direct `ax` commands** for AutomatosX operations
- **`ax --help`** for command documentation

### Q: Will my existing memory/sessions work?

✅ Yes! All stored data remains compatible:
- `.automatosx/memory/memories.db` - unchanged
- `.automatosx/sessions/` - unchanged
- All `ax memory` and `ax session` commands work exactly the same

### Q: Which AI assistant should I use?

**Recommended**: **Claude Code** - Best integration, MCP support, excellent UX

**Alternatives**:
- **Gemini CLI** - Free tier, natural language
- **Codex CLI** - Strong code understanding
- **Cursor/Copilot/Windsurf** - IDE-integrated

All work seamlessly with AutomatosX!

### Q: Can I still automate workflows?

✅ Absolutely! Use `ax spec` for declarative workflows:

```yaml
# workflow.ax.yaml
name: authentication-system
tasks:
  - agent: backend
    task: implement JWT auth
  - agent: security
    task: audit authentication
  - agent: quality
    task: write integration tests
```

```bash
ax spec run workflow.ax.yaml
```

### Q: What if I preferred the chatbot?

We understand! However, data showed that:
- 95%+ of users preferred their existing AI assistant
- Maintaining feature parity was becoming unsustainable
- Users wanted AutomatosX to focus on orchestration

**Benefits of the new approach:**
- ✅ Use familiar tools you already know
- ✅ Better conversation quality (Claude Code, Gemini, etc.)
- ✅ No learning curve for new UI
- ✅ AutomatosX focuses on what it does best: orchestration

## Breaking Changes Summary

| Feature | v7.x | v8.2.0 | Migration |
|---------|------|--------|-----------|
| `ax cli` | ✅ Available | ❌ Removed | Use AI assistant |
| Slash commands | ✅ Available | ❌ Removed | Use `ax` commands |
| `ax run` | ✅ Available | ✅ Unchanged | No change needed |
| `ax memory` | ✅ Available | ✅ Unchanged | No change needed |
| `ax session` | ✅ Available | ✅ Unchanged | No change needed |
| `ax spec` | ✅ Available | ✅ Unchanged | No change needed |
| All agents | ✅ Available | ✅ Unchanged | No change needed |
| Persistent memory | ✅ Available | ✅ Unchanged | No change needed |

## Getting Help

- **Documentation**: Check updated docs at `docs/`
- **Examples**: See `examples/` for workflows
- **Issues**: https://github.com/defai-digital/automatosx/issues
- **Integration Guides**:
  - Claude Code: `CLAUDE.md`
  - Gemini CLI: `GEMINI.md`
  - General: `AGENTS.md`

## Quick Reference

**Common v7.x patterns → v8.2.0 equivalents:**

```bash
# Pattern 1: Quick task
# v7.x: ax cli → @backend implement auth
# v8.2.0: ax run backend "implement auth"

# Pattern 2: Search memory
# v7.x: ax cli → /memory search "auth"
# v8.2.0: ax memory search "auth"

# Pattern 3: Save work
# v7.x: ax cli → /save session-name
# v8.2.0: Use your AI assistant's save feature

# Pattern 4: Multi-agent work
# v7.x: ax cli → @backend task → @security audit
# v8.2.0: ax run backend "task" && ax run security "audit"
#    or: Ask your AI assistant to coordinate both

# Pattern 5: Resume conversation
# v7.x: ax cli → /load session-name
# v8.2.0: Use your AI assistant's history/resume feature
```

## Conclusion

v8.2.0 makes AutomatosX **simpler, more focused, and better integrated** with your existing workflow. You get all the orchestration power with none of the UI complexity.

**Welcome to a streamlined AutomatosX!** 🚀
