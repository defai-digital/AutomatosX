# Migration Guide: v10.0.0 - Claude Code Integration

**Version**: AutomatosX v10.0.0
**Release Date**: TBD
**Migration Difficulty**: Easy (No breaking changes)

---

## Overview

AutomatosX v10.0.0 introduces **native Claude Code integration** via the Model Context Protocol (MCP). This eliminates the dependency on CLAUDE.md documentation files and provides a programmatic, robust integration.

### What's New

- ✅ **MCP Server** - Native integration with Claude Code via stdio transport
- ✅ **Auto-Generated Manifests** - Skills, commands, and sub-agents from agent profiles
- ✅ **One-Command Setup** - `ax setup --claude-code` for complete configuration
- ✅ **Comprehensive Diagnostics** - `ax doctor --claude-code` for health checks
- ✅ **Zero Documentation Dependency** - No more CLAUDE.md editing required

### What's Changed

**IMPORTANT**: This is a **non-breaking release**. All existing functionality remains unchanged.

- ✅ CLI commands work exactly as before
- ✅ Agent profiles are unchanged
- ✅ Configuration format is unchanged
- ✅ Memory system is unchanged
- ✅ No data migration required

The only change is the **addition** of Claude Code integration features.

---

## Prerequisites

### Required

- **Node.js**: >= 24.0.0 (unchanged from v9.x)
- **AutomatosX**: v9.2.4+ (recommended starting point)
- **Claude Code CLI**: Install from [https://code.claude.com](https://code.claude.com)

### Optional (for Claude Code integration)

- **npm**: For installing the MCP server binary
- **git**: For `.gitignore` management

---

## Migration Steps

### Step 1: Update AutomatosX

```bash
# Update to v10.0.0
npm install -g @defai.digital/automatosx@10.0.0

# Or if using locally
npm install @defai.digital/automatosx@10.0.0
```

### Step 2: Verify Installation

```bash
# Check version
ax --version
# Should show: 10.0.0

# Check if MCP server binary is available
which automatosx-mcp
# Should show: /path/to/node_modules/.bin/automatosx-mcp
```

### Step 3: Install Claude Code (if not already installed)

```bash
# Visit https://code.claude.com for installation instructions

# Verify installation
claude --version
# Should show: Claude Code CLI version X.X.X
```

### Step 4: Setup Claude Code Integration

**Option A: Fresh Installation**

```bash
# One command for everything
ax setup --claude-code
```

**Option B: Existing Installation**

```bash
# Add Claude Code integration to existing setup
ax setup --claude-code
```

This will:
1. ✅ Detect Claude Code CLI installation
2. ✅ Verify MCP server binary availability
3. ✅ Generate 20 manifest files from agent profiles
4. ✅ Register MCP server with Claude Code
5. ✅ Validate setup

### Step 5: Verify Integration

```bash
# Run diagnostics
ax doctor --claude-code
```

**Expected Output**:

```
🔍 Claude Code Integration Diagnostics

✓ Claude Code CLI: Installed (v1.2.3)
✓ MCP Server Binary: Available (automatosx-mcp)
✓ MCP Registration: Registered with Claude Code
✓ Manifests: Generated (20 files)
✓ Manifest Validation: Valid

📊 Summary

✓ Passed: 5/5

✅ All checks passed! Claude Code integration is ready.

Next Steps:
  1. Restart Claude Code to activate integration
  2. Use slash commands: /agent-backend, /agent-frontend, etc.
  3. Use skill: /automatosx for orchestration
```

### Step 6: Restart Claude Code

Close and reopen Claude Code to activate the integration.

---

## New Features in v10.0.0

### 1. MCP Server

AutomatosX now provides a native MCP server for Claude Code integration.

**Binary**: `automatosx-mcp`
**Transport**: stdio
**Protocol**: JSON-RPC 2.0
**Tools**: 17 MCP tools for agent orchestration

**MCP Tools Available**:

- `mcp__automatosx__run_agent` - Execute agent with task
- `mcp__automatosx__search_memory` - Search persistent memory
- `mcp__automatosx__session_create` - Create multi-agent session
- `mcp__automatosx__list_agents` - List all available agents
- And 13 more...

### 2. Auto-Generated Manifests

All Claude Code integration files are auto-generated from agent profiles.

**Generated Files**:

```
.claude/
├── skills/
│   └── automatosx/
│       └── SKILL.md              # Orchestration skill
├── commands/
│   ├── agent-backend.md          # /agent-backend command
│   ├── agent-frontend.md         # /agent-frontend command
│   └── ... (18 total)
└── agents/
    └── automatosx-coordinator/
        └── AGENT.md              # Coordinator sub-agent
```

**Regenerate Manifests** (if agent profiles change):

```bash
npm run generate:claude-manifests
```

### 3. Setup Command Enhancement

The `ax setup` command now supports Claude Code integration.

**New Flag**: `--claude-code`

```bash
# Fresh setup with Claude Code
ax setup --claude-code

# Add Claude Code to existing setup
ax setup --claude-code

# Setup without Claude Code (existing behavior)
ax setup
```

**What It Does**:

1. Checks prerequisites (Claude Code CLI, MCP server)
2. Generates all manifest files
3. Registers MCP server with `claude mcp add`
4. Validates setup
5. Provides clear success/failure messages

### 4. Doctor Command Enhancement

The `ax doctor` command now supports Claude Code diagnostics.

**New Flag**: `--claude-code`

```bash
# Check Claude Code integration
ax doctor --claude-code

# Check provider setup (existing behavior)
ax doctor
ax doctor openai
```

**Diagnostics Performed**:

- ✓ Claude Code CLI installed
- ✓ Claude Code version detected
- ✓ MCP server binary available
- ✓ MCP server registered with Claude Code
- ✓ Manifests generated (20 files)
- ✓ Manifests valid (frontmatter, content)

---

## Using Claude Code Integration

### Slash Commands (18 agents)

Each agent gets a dedicated slash command:

```
/agent-backend "implement user authentication"
/agent-frontend "create login form"
/agent-security "audit authentication code"
/agent-quality "write tests for auth"
```

**Available Commands**:

- `/agent-backend` - Bob (Backend Engineer)
- `/agent-frontend` - Frank (Frontend Developer)
- `/agent-security` - Steve (Security Expert)
- `/agent-quality` - Queenie (QA Engineer)
- `/agent-devops` - Oliver (DevOps Engineer)
- `/agent-data` - Daisy (Data Engineer)
- `/agent-mobile` - Maya (Mobile Engineer)
- `/agent-architecture` - Avery (System Architect)
- `/agent-fullstack` - Felix (Fullstack Engineer)
- `/agent-design` - Debbee (UX/UI Designer)
- `/agent-writer` - Wendy (Technical Writer)
- `/agent-product` - Paris (Product Manager)
- `/agent-cto` - Tony (CTO)
- `/agent-ceo` - Eric (CEO)
- `/agent-researcher` - Rodman (Research Analyst)
- `/agent-creative-marketer` - Candy (Creative Marketer)
- `/agent-aerospace-scientist` - Astrid (Aerospace Scientist)
- `/agent-standard` - Stan (Standards Expert)

### Orchestration Skill

Use the `/automatosx` skill for multi-agent orchestration:

```
/automatosx
```

This invokes the `automatosx-coordinator` sub-agent which:
- Breaks complex tasks into agent-specific subtasks
- Leverages memory for past decisions
- Executes agents in optimal dependency order
- Monitors progress and handles failures
- Summarizes results

**Example**:

```
User: "Please use /automatosx to implement user authentication with security audit"

AutomatosX Coordinator:
1. Searches memory for past auth designs
2. Runs product agent for requirements
3. Runs backend agent for API implementation
4. Runs security agent for threat review
5. Runs quality agent for test coverage
6. Saves decisions to memory
```

### MCP Tools

Claude Code can directly invoke MCP tools:

```typescript
// Run agent
mcp__automatosx__run_agent({
  agent: "backend",
  task: "implement user authentication"
})

// Search memory
mcp__automatosx__search_memory({
  query: "authentication",
  limit: 10
})

// Create session
mcp__automatosx__session_create({
  name: "auth-work",
  agent: "backend"
})
```

---

## Troubleshooting

### Issue: "Claude Code CLI not found"

**Cause**: Claude Code is not installed or not in PATH

**Fix**:

```bash
# Install Claude Code from https://code.claude.com
# Or add to PATH
export PATH="/path/to/claude-code/bin:$PATH"
```

### Issue: "MCP server binary not found"

**Cause**: npm dependencies not installed

**Fix**:

```bash
npm install
# Or
npm install -g @defai.digital/automatosx
```

### Issue: "MCP server not registered"

**Cause**: Setup not completed or registration failed

**Fix**:

```bash
# Re-run setup
ax setup --claude-code

# Or manually register
claude mcp add --transport stdio automatosx -- automatosx-mcp
```

### Issue: "Manifests not generated"

**Cause**: Setup not completed or generation failed

**Fix**:

```bash
# Regenerate manifests
npm run generate:claude-manifests

# Or re-run setup
ax setup --claude-code
```

### Issue: "Manifest validation failed"

**Cause**: Invalid agent profiles or corrupted manifests

**Fix**:

```bash
# Regenerate manifests
npm run generate:claude-manifests

# Check for invalid agent profiles
ax list agents --format json
```

### Issue: "Integration not working in Claude Code"

**Cause**: Claude Code not restarted after setup

**Fix**:

1. Close Claude Code completely
2. Reopen Claude Code
3. Verify integration:
   ```
   ax doctor --claude-code
   ```

---

## Rollback

If you need to rollback to v9.x:

```bash
# Downgrade AutomatosX
npm install -g @defai.digital/automatosx@9.2.4

# Remove Claude Code integration (optional)
claude mcp remove automatosx
rm -rf .claude/
```

**Note**: Rolling back is safe - no data loss. Your agent profiles, memory, and configuration remain unchanged.

---

## Breaking Changes

**NONE** - v10.0.0 is fully backward compatible with v9.x.

All existing commands, workflows, and integrations continue to work unchanged. The Claude Code integration is purely additive.

---

## FAQ

### Q: Do I need to update my agent profiles?

**A**: No, agent profiles are unchanged. The manifest generator reads existing profiles.

### Q: Do I need to update my configuration?

**A**: No, `ax.config.json` format is unchanged.

### Q: Will this affect my existing AutomatosX workflows?

**A**: No, all existing CLI commands and workflows continue to work unchanged.

### Q: Can I use AutomatosX without Claude Code?

**A**: Yes! Claude Code integration is completely optional. You can use AutomatosX with:
- Direct CLI (`ax run backend "task"`)
- Gemini CLI integration
- Grok CLI integration
- OpenAI Codex integration

### Q: What happens to CLAUDE.md?

**A**: CLAUDE.md remains for documentation purposes, but is no longer required for Claude Code integration. The MCP server provides programmatic integration.

### Q: Can I still edit CLAUDE.md?

**A**: Yes, but it won't affect Claude Code integration anymore. Use manifests instead.

### Q: How do I customize the integration?

**A**: Modify agent profiles in `.automatosx/agents/`, then regenerate manifests:
```bash
npm run generate:claude-manifests
```

### Q: Does this work with other AI assistants?

**A**: This release focuses on Claude Code integration. Gemini CLI, Grok CLI, and OpenAI Codex integrations remain unchanged.

### Q: Is there a performance impact?

**A**: Minimal. MCP server adds < 50ms startup overhead. CLI commands are unchanged.

### Q: Can I disable Claude Code integration?

**A**: Yes, simply don't run `ax setup --claude-code`. Integration is opt-in.

---

## Support

If you encounter issues during migration:

1. **Check Diagnostics**:
   ```bash
   ax doctor --claude-code
   ```

2. **Review Logs**:
   ```bash
   cat .automatosx/logs/router-trace-*.jsonl
   ```

3. **Regenerate Manifests**:
   ```bash
   npm run generate:claude-manifests
   ```

4. **GitHub Issues**: [https://github.com/defai-digital/automatosx/issues](https://github.com/defai-digital/automatosx/issues)

5. **Email**: support@defai.digital

---

## What's Next

### v10.1.0 - Enhanced Integration (Planned)

- Multi-transport support (stdio, HTTP, WebSocket)
- Custom manifest templates
- Integration with other AI assistants
- Persistent session history

### v10.2.0 - Advanced Features (Planned)

- Real-time collaboration across agents
- Visual workflow builder
- Integration with CI/CD pipelines

---

**Generated**: 2025-11-23
**Version**: AutomatosX v10.0.0
**Author**: AutomatosX Team
