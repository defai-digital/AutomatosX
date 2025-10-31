# Windows + Claude Code Integration Guide

**Last Updated**: 2025-10-14
**Applies To**: AutomatosX v6.3.8+
**Platform**: Windows 10/11 with Claude Code

---

## Overview

AutomatosX v6.3.8+ includes **automatic environment detection** for Claude Code and other AI IDEs. When running inside these environments, mock providers are automatically enabled, eliminating the need for external CLI tools.

---

## Quick Start

### Option 1: Automatic Detection (v5.3.5+)

**No configuration needed!** AutomatosX automatically detects Claude Code and enables mock providers:

```bash
# Just run your agent - it will work automatically
ax run cto "create PRD for todo app"
```

**Behind the scenes**:
- Detects Claude Code environment
- Auto-enables mock providers
- Logs: "Detected Claude Code environment - auto-enabling mock providers"

### Option 2: Explicit Configuration

If you want to explicitly control mock providers:

**Windows Command Prompt**:
```cmd
set AUTOMATOSX_MOCK_PROVIDERS=true
ax run cto "create PRD for todo app"
```

**Windows PowerShell**:
```powershell
$env:AUTOMATOSX_MOCK_PROVIDERS="true"
ax run cto "create PRD for todo app"
```

**Permanent Configuration** (`automatosx.config.json`):
```json
{
  "execution": {
    "useMockProviders": true
  }
}
```

---

## How It Works

### Environment Detection

AutomatosX v6.3.8+ automatically detects:

1. **Claude Code** - Checks for:
   - `CLAUDE_CODE=true` environment variable
   - `CLAUDE_DESKTOP=true` environment variable
   - `MCP_SERVER=true` (Model Context Protocol)
   - Parent process name contains "claude"

2. **Cursor IDE** - Checks for:
   - `CURSOR=true` environment variable
   - Parent process name contains "cursor"

3. **VS Code + Copilot** - Checks for:
   - `VSCODE_PID` + `GITHUB_COPILOT=true`

### Detection Priority

```
1. AUTOMATOSX_MOCK_PROVIDERS=true   → Force enable
2. AUTOMATOSX_MOCK_PROVIDERS=false  → Force disable
3. AI IDE detected                   → Auto-enable
4. Standalone CLI                    → Use real providers
```

### What Gets Auto-Enabled

When Claude Code is detected:
- ✅ Mock providers enabled (no external CLI needed)
- ✅ All agents available immediately
- ✅ Fast execution (no CLI spawn overhead)
- ✅ Better error messages with environment-specific suggestions

---

## Verification

### Check Detection Status

```bash
# Run status command - shows detected environment
ax status
```

**Expected Output (v5.3.5+)**:
```
[INFO] Detected Claude Code environment - auto-enabling mock providers

Providers:
✅ mock: available (auto-detected AI IDE environment)

Environment: Claude Code
Mock Providers: Enabled (auto-detected)
```

### Test Agent Execution

```bash
# Simple test
ax run backend "Hello, test message"
```

**Expected**:
- No "claude: command not found" errors
- Mock response returned successfully
- Log shows: "Mock providers enabled for claude-code"

---

## Disabling Auto-Detection

If you want to use real providers even in Claude Code:

```cmd
# Force disable mock mode (requires provider CLIs installed)
set AUTOMATOSX_MOCK_PROVIDERS=false
ax run cto "task"
```

**Note**: This requires actual provider CLIs to be installed and in PATH.

---

## Troubleshooting

### Issue 1: Still Getting "command not found"

**Cause**: Running older version (< v5.3.5)

**Solution**:
```bash
# Update to latest version
npm update -g @defai.digital/automatosx

# Verify version
ax --version
# Should be: v5.3.5 or later
```

### Issue 2: Want Real Providers, Not Mocks

**Cause**: Auto-detection enabled mock providers

**Solution**:
```cmd
# Disable mock mode and install provider CLIs
set AUTOMATOSX_MOCK_PROVIDERS=false

# Install provider CLI (choose one or more)
npm install -g @anthropic-ai/claude-cli
npm install -g @google-ai/gemini-cli
npm install -g @openai/codex-cli

# Test with real provider
ax run backend "test" --provider claude
```

### Issue 3: Detection Not Working

**Check Environment Variables**:
```cmd
# Windows Command Prompt
echo %CLAUDE_CODE%
echo %MCP_SERVER%

# PowerShell
$env:CLAUDE_CODE
$env:MCP_SERVER
```

**Manual Override**:
```cmd
set CLAUDE_CODE=true
ax status
```

### Issue 4: Want to See Detection Logs

**Enable Debug Mode**:
```cmd
set AUTOMATOSX_DEBUG=true
ax status
```

**Expected Debug Output**:
```
[DEBUG] Environment Detection
  environment: Claude Code
  mockProviders: enabled
  explicit: false

[DEBUG] Environment Details
  claudeCode: true
  cursor: false
  vscode: false
  aiIDE: true
```

---

## Migration from v5.3.4

### Before (v5.3.4 and earlier)

**Required manual configuration**:
```cmd
# Had to manually set environment variable
set AUTOMATOSX_MOCK_PROVIDERS=true
ax run cto "task"
```

**Or modify config file**:
```json
{
  "execution": {
    "useMockProviders": true
  }
}
```

### After (v5.3.5+)

**No configuration needed**:
```cmd
# Just works automatically
ax run cto "task"
```

**Auto-detection logs**:
```
[INFO] Detected Claude Code environment - auto-enabling mock providers
```

---

## Best Practices

### 1. Use Natural Language Mode (Recommended)

Instead of using `ax run`, let Claude Code coordinate directly:

```
✅ RECOMMENDED:
"Please create a comprehensive PRD for a unique todo web app.
 Work with the CTO and writer agents to ensure it's well-documented."
```

**Benefits**:
- Claude Code analyzes full context
- Automatically selects best agents
- Better error handling
- Can iterate and refine

### 2. Use Express Mode for Simple Tasks

For quick, well-defined tasks:

```bash
ax run cto "create PRD for todo app"
```

### 3. MCP Server Mode (Advanced)

For 90% faster execution with persistent state:

**Setup `claude_desktop_config.json`**:
```json
{
  "mcpServers": {
    "automatosx": {
      "command": "ax",
      "args": ["mcp"]
    }
  }
}
```

**Use MCP tools directly in Claude Code**.

---

## Configuration Examples

### Minimal (Auto-Detection)

No configuration needed! Just initialize:

```bash
ax init
ax run backend "test"
```

### Explicit Mock Mode

```json
{
  "execution": {
    "useMockProviders": true,
    "defaultTimeout": 1500000
  }
}
```

### Force Real Providers

```json
{
  "execution": {
    "useMockProviders": false
  },
  "providers": {
    "claude-code": {
      "enabled": true,
      "customPath": "C:\\Users\\YourName\\AppData\\Roaming\\npm\\claude.cmd"
    }
  }
}
```

---

## Support

**GitHub Issues**: https://github.com/defai-digital/automatosx/issues

**When reporting issues, include**:
1. AutomatosX version (`ax --version`)
2. Windows version (10/11)
3. Environment detection log (`ax status` with `AUTOMATOSX_DEBUG=true`)
4. Full error message
5. Configuration file (`automatosx.config.json`)

---

## See Also

- [Windows Troubleshooting Guide](windows-troubleshooting.md) - Comprehensive troubleshooting
- [Windows Quick Fix](windows-quick-fix.md) - Fast solutions for common issues
- [Installation Guide](../guide/installation.md) - Platform-specific installation
- [Best Practices](../../docs/BEST-PRACTICES.md) - Recommended usage patterns

---

**Created**: 2025-10-14
**Version**: AutomatosX v6.3.8+
**Status**: Active Guide
