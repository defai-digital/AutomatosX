# AI Coding Tools Configuration Support
**Date**: 2025-11-08
**Status**: ✅ RESEARCH COMPLETE

## Summary

Comprehensive analysis of configuration file formats used by Claude Code, Gemini CLI, OpenAI Codex, and MCP servers to determine tree-sitter parser support requirements.

## Key Finding

**✅ All AI coding tools use file formats already supported by AutomatosX v2!**

No additional parsers needed - existing JSON, TOML, and Markdown parsers cover all configuration files.

## Detailed Analysis

### 1. Claude Code Configuration

**Tool**: Anthropic's Claude Code CLI and IDE integration

**Configuration Files**:
- `~/.claude/settings.json` - User-level settings (JSON)
- `.claude/settings.json` - Project-level shared settings (JSON)
- `.claude/settings.local.json` - Project-level local settings (JSON)
- `~/.claude/CLAUDE.md` - Global instructions (Markdown)
- `.claude/CLAUDE.md` - Project-level instructions (Markdown)
- `~/.claude.json` - Legacy configuration (JSON)

**File Formats**:
- ✅ **JSON** - Already supported
- ✅ **Markdown** - Already supported

**Example `settings.json`**:
```json
{
  "model": "claude-sonnet-4-5",
  "maxTokens": 8192,
  "temperature": 0.7,
  "permissions": {
    "deny": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**"
    ]
  },
  "experimental": {
    "multiline": true,
    "streaming": true
  }
}
```

**Example `CLAUDE.md`**:
```markdown
# Claude Code Configuration

## Project Instructions

This project uses TypeScript with strict mode enabled.

## Coding Standards

- Use ESM imports with .js extensions
- Prefer async/await over promises
- Write comprehensive JSDoc comments

## Testing

- Run `npm test` before committing
- Maintain >80% code coverage
```

**Recommendation**: ✅ **Already supported** via JSON and Markdown parsers

---

### 2. Gemini CLI Configuration

**Tool**: Google's Gemini command-line interface

**Configuration Files**:
- `~/.gemini/settings.json` - Main configuration (JSON)
- `~/.gemini/.env` - Environment variables (dotenv format)
- `~/.gemini/tmp/` - Logs and shell history

**File Formats**:
- ✅ **JSON** - Already supported (settings.json)
- ⚠️ **Dotenv (.env)** - Simple key-value format, no tree-sitter parser needed

**Configuration Location**: `~/.gemini/`

**Example `settings.json`** (Updated format as of v0.4.0, September 2025):
```json
{
  "model": {
    "name": "gemini-2.0-flash-exp",
    "temperature": 0.9,
    "topP": 0.95,
    "maxOutputTokens": 8192
  },
  "safety": {
    "harassmentThreshold": "BLOCK_MEDIUM_AND_ABOVE",
    "hateSpeechThreshold": "BLOCK_MEDIUM_AND_ABOVE",
    "sexuallyExplicitThreshold": "BLOCK_MEDIUM_AND_ABOVE",
    "dangerousContentThreshold": "BLOCK_MEDIUM_AND_ABOVE"
  },
  "systemInstruction": "You are a helpful coding assistant.",
  "tools": {
    "codeExecution": true,
    "googleSearch": false
  },
  "preferences": {
    "autoCommit": false,
    "verbose": true,
    "colorOutput": true
  }
}
```

**Example `.env`**:
```env
GOOGLE_API_KEY=your_api_key_here
GEMINI_PROJECT_ID=my-project-123
GEMINI_REGION=us-central1
ENABLE_DEBUG=true
MAX_RETRIES=3
```

**Recommendation**:
- ✅ **settings.json already supported** via JSON parser
- ⚠️ **.env files** - Simple format, no parser needed (can use text search)

---

### 3. OpenAI Codex Configuration

**Tool**: OpenAI's Codex CLI (open-sourced in 2025)

**Configuration Files**:
- `~/.codex/config.toml` - Main configuration (TOML)
- MCP server configurations (JSON)

**File Formats**:
- ✅ **TOML** - Already supported
- ✅ **JSON** - Already supported (for MCP servers)

**Configuration Location**: `~/.codex/config.toml`

**Access Method**:
- CLI: Edit `~/.codex/config.toml` directly
- IDE Extension: Click gear icon → Codex Settings → Open config.toml

**Example `config.toml`**:
```toml
# Model Configuration
model = "gpt-5-codex"
model_provider = "openai"

# OpenAI Provider Settings
[providers.openai]
name = "openai"
base_url = "https://api.openai.com/v1"
env_key = "OPENAI_API_KEY"

[providers.openai.settings]
max_retries = 3
timeout = 30000
request_timeout = 120000

# Azure Provider (Alternative)
[providers.azure]
name = "azure"
base_url = "https://your-resource.openai.azure.com"
env_key = "AZURE_OPENAI_API_KEY"

[providers.azure.settings]
api_version = "2024-02-15-preview"

# Approval Policies
[approval]
# "always" | "never" | "auto"
mode = "auto"
dangerous_commands = ["rm -rf", "sudo", "chmod 777"]

# Sandbox Settings
[sandbox]
enable_filesystem_access = true
enable_network_access = true
allowed_directories = ["/home/user/projects"]
blocked_directories = ["/etc", "/sys", "/root"]

# MCP Servers Configuration
[mcp.servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]

[mcp.servers.github]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]

[mcp.servers.github.env]
GITHUB_PERSONAL_ACCESS_TOKEN = "github_pat_..."

# Performance Settings
[performance]
parallel_requests = 5
cache_responses = true
cache_ttl = 3600

# Logging
[logging]
level = "info"
output = "~/.codex/logs/codex.log"
```

**Recommendation**: ✅ **Already supported** via TOML parser

---

### 4. MCP (Model Context Protocol) Server Configuration

**Tool**: Model Context Protocol - standardized protocol for AI tool integration

**Used By**: Claude Code, OpenAI Codex, Cursor, JetBrains IDEs, VS Code

**Configuration Files**:
- `.cursor/mcp.json` - Cursor IDE (project-level)
- `~/.cursor/mcp.json` - Cursor IDE (global)
- Embedded in `config.toml` for Codex
- Embedded in `settings.json` for Claude Code

**File Format**: ✅ **JSON** - Already supported

**Official Specification**:
- **TypeScript Schema**: Primary source of truth
- **JSON Schema**: Auto-generated from TypeScript
- **Documentation**: https://modelcontextprotocol.io/

**Configuration Structure**:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "command-to-run",
      "args": ["arg1", "arg2"],
      "env": {
        "KEY": "value"
      }
    }
  }
}
```

**Example MCP Configuration**:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Documents",
        "/Users/username/Projects"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "github_pat_..."
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost:5432/db"
      }
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "BSA..."
      }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_TEAM_ID": "T..."
      }
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

**Common MCP Servers**:
- `@modelcontextprotocol/server-filesystem` - File system access
- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-postgres` - PostgreSQL database
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-slack` - Slack integration
- `@modelcontextprotocol/server-memory` - Persistent memory
- `@modelcontextprotocol/server-puppeteer` - Browser automation
- `@modelcontextprotocol/server-sequential-thinking` - Reasoning

**Recommendation**: ✅ **Already supported** via JSON parser

---

## Environment Files (.env) Analysis

### Status
⚠️ **No tree-sitter parser available**

### Why Not Needed
1. **Simple Format**: Key-value pairs with basic syntax
2. **Text Search Works**: Grep/FTS5 sufficient for most use cases
3. **Parser Availability**: `tree-sitter-dotenv` exists on GitHub but:
   - Not published to npm
   - Marked as "Early experimentation; does not actually work"
   - Not actively maintained

### .env File Structure
```env
# Comments start with #
KEY=value
QUOTED="value with spaces"
SINGLE_QUOTED='value'
MULTI_LINE="line 1\nline 2"
INTERPOLATION="prefix ${OTHER_VAR} suffix"
COMMAND_SUBSTITUTION="$(echo result)"
EMPTY_VALUE=
```

### Alternative Approach
Since .env files are simple key-value pairs, AutomatosX can:
1. Use **Grep/FTS5** for full-text search (already supported)
2. Search for specific keys: `ax find "DATABASE_URL" --file .env`
3. Search for patterns: `ax find "API_KEY|TOKEN" --regex --file .env`

**Recommendation**: ⚠️ **Not available, but not needed** - text search is sufficient

---

## Summary Table

| Tool | Configuration Files | Format | Parser Status |
|------|---------------------|--------|---------------|
| **Claude Code** | settings.json, CLAUDE.md | JSON, Markdown | ✅ Supported |
| **Gemini CLI** | settings.json, .env | JSON, dotenv | ✅ JSON supported, .env not needed |
| **OpenAI Codex** | config.toml | TOML | ✅ Supported |
| **MCP Servers** | mcp.json, embedded configs | JSON | ✅ Supported |

## AutomatosX v2 Coverage

### ✅ Already Supported Formats

| Format | Parser | Use Cases |
|--------|--------|-----------|
| **JSON** | JsonParserService | Claude settings, Gemini settings, MCP configs |
| **Markdown** | MarkdownParserService | CLAUDE.md instruction files |
| **TOML** | TomlParserService | OpenAI Codex config.toml |

### ⚠️ Not Needed

| Format | Reason | Alternative |
|--------|--------|-------------|
| **.env** | Simple key-value, no parser on npm | Use text search (Grep/FTS5) |

## CLI Usage Examples

### Claude Code Configuration Search
```bash
# Index Claude Code configs
ax index ~/.claude/ .claude/

# Find all settings
ax find "settings" --lang json --file settings.json

# Search CLAUDE.md instructions
ax find "coding standards" --lang markdown --file CLAUDE.md

# Find permissions config
ax find "permissions" --lang json
```

### Gemini CLI Configuration Search
```bash
# Index Gemini configs
ax index ~/.gemini/

# Find model settings
ax find "model" --lang json --file settings.json

# Search safety thresholds
ax find "threshold" --lang json

# Search .env for API keys (text search)
ax find "API_KEY" --file .env
```

### OpenAI Codex Configuration Search
```bash
# Index Codex configs
ax index ~/.codex/

# Find provider configs
ax find "providers" --lang toml --file config.toml

# Search for MCP servers
ax find "mcp.servers" --lang toml

# Find approval policies
ax find "approval" --lang toml
```

### MCP Server Configuration Search
```bash
# Index MCP configs
ax index .cursor/ ~/.cursor/

# Find all MCP servers
ax find "mcpServers" --lang json --file mcp.json

# Search for specific server
ax find "github" --lang json --file mcp.json

# Find filesystem server config
ax find "server-filesystem" --lang json
```

## Configuration File Locations Summary

### Global (User-level)
```
~/.claude/
  ├── settings.json           # Claude Code user settings
  └── CLAUDE.md              # Claude Code global instructions

~/.gemini/
  ├── settings.json           # Gemini CLI settings
  └── .env                   # Gemini environment variables

~/.codex/
  └── config.toml            # OpenAI Codex configuration

~/.cursor/
  └── mcp.json               # Cursor MCP servers (global)
```

### Project-level
```
.claude/
  ├── settings.json           # Claude Code project settings (shared)
  ├── settings.local.json     # Claude Code local settings (not committed)
  └── CLAUDE.md              # Claude Code project instructions

.cursor/
  └── mcp.json               # Cursor MCP servers (project)
```

## Recommendations

### ✅ No Action Required

**All AI coding tool configurations are already supported!**

AutomatosX v2 can index and search:
- ✅ Claude Code settings (JSON + Markdown)
- ✅ Gemini CLI settings (JSON)
- ✅ OpenAI Codex config (TOML)
- ✅ MCP server configs (JSON)
- ⚠️ .env files (via text search, no parser needed)

### 📝 Documentation Recommendations

1. **Add usage examples** for AI tool configuration search to README
2. **Document common patterns** for finding settings across tools
3. **Create preset search queries** for common configuration tasks

### 🔍 Optional Enhancements

1. **Create .env text pattern matcher** (regex-based, not tree-sitter)
2. **Add MCP server discovery command** (scan for mcp.json files)
3. **Configuration validation** (JSON Schema validation for known formats)

## Conclusion

✅ **Zero additional parsers needed**
✅ **100% coverage of AI tool configurations**
✅ **Existing parsers handle all formats**:
   - JSON parser: Claude Code, Gemini CLI, MCP servers
   - Markdown parser: CLAUDE.md instruction files
   - TOML parser: OpenAI Codex config.toml
⚠️ **.env files**: Simple format, text search sufficient

AutomatosX v2 is fully equipped to handle all AI coding tool configurations out of the box!
