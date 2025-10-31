# Windows Setup Guide for AutomatosX

Complete installation and configuration guide for Windows 10 and Windows 11 users.

**Last Updated**: 2025-10-14
**Applies to**: AutomatosX v6.3.8+
**Platform**: Windows 10/11
**Tested on**: Windows 10, Windows 11

---

## 📋 Prerequisites

Before installing AutomatosX, ensure you have:

### Required

- ✅ **Node.js v20.0.0 or higher**
  - Download: https://nodejs.org/
  - Verify: `node --version`

- ✅ **npm v9.0.0 or higher**
  - Comes with Node.js
  - Verify: `npm --version`

### Optional (but recommended)

- ✅ **Windows Terminal** or **PowerShell 7+**
  - Better terminal experience than CMD
  - Download Windows Terminal: https://aka.ms/terminal

- ✅ **Git for Windows** (if using Codex provider)
  - Download: https://git-scm.com/download/win
  - Codex (OpenAI) provider requires git repository

---

## 🚀 Step 1: Install AutomatosX

### Method 1: Global Installation (Recommended)

```bash
npm install -g @defai.digital/automatosx
```

**Verify Installation**:
```bash
ax --version
# Expected output: 5.3.1 (or later)
```

### Method 2: Using npx (No Installation)

If you prefer not to install globally:

```bash
npx @defai.digital/automatosx --version
```

---

## 🔧 Step 2: Install Provider CLIs

AutomatosX requires at least one AI provider CLI. Install one or more:

### Option A: Claude CLI (Anthropic)

```bash
npm install -g @anthropic-ai/claude-cli
```

**Verify**:
```bash
claude --version
```

### Option B: Gemini CLI (Google)

```bash
npm install -g @google/generative-ai-cli
```

**Verify**:
```bash
gemini --version
```

### Option C: Codex CLI (OpenAI)

```bash
npm install -g openai
```

**Verify**:
```bash
codex --version
# or
openai --version
```

---

## 🏁 Step 3: Initialize Your Project

**Navigate to your project directory**, then initialize AutomatosX:

### Windows Command Prompt

```cmd
cd C:\Users\YourName\Documents\MyProject
ax init
```

### Windows PowerShell

```powershell
cd C:\Users\YourName\Documents\MyProject
ax init
```

**What This Does**:
- Creates `.automatosx/` directory with:
  - 12 specialized agents (Bob, Frank, Paris, etc.)
  - 15 abilities (coding standards, testing, documentation, etc.)
  - 4 teams (engineering, business, content, leadership)
- Sets up SQLite FTS5 memory database
- Creates shared workspace structure (`automatosx/PRD/`, `automatosx/tmp/`)
- Generates `automatosx.config.json`
- Initializes git repository (if not already initialized)

**Verify Initialization**:
```bash
ax status
# Expected output:
# ✅ System is healthy
# 12 agents available
# 15 abilities loaded
# 3 providers configured
```

---

## ✅ Step 4: Verify Provider Detection

AutomatosX v6.3.8+ automatically detects provider CLIs on Windows.

### Check Provider Status

```bash
ax status
```

**Expected Output**:
```
✅ System is healthy

Agents:      12 available
Abilities:   15 loaded
Memory:      0 entries
Providers:   3 configured
  ✅ Provider: claude-code (enabled, priority: 3)
  ✅ Provider: gemini-cli (enabled, priority: 2)
  ✅ Provider: openai (enabled, priority: 1)
```

### Verbose Mode (Shows Detected Paths)

```bash
ax status --verbose
```

**Expected Output**:
```
✅ System is healthy

Providers:
  ✅ Provider: claude-code (enabled, priority: 3)
     Path: C:\Users\YourName\AppData\Roaming\npm\claude.cmd
     Detection: PATH

  ✅ Provider: gemini-cli (enabled, priority: 2)
     Path: C:\Users\YourName\AppData\Roaming\npm\gemini.cmd
     Detection: PATH

ENV Variable Overrides:
  No overrides set (using automatic detection)
```

---

## 🎯 Step 5: Run Your First Agent

Test AutomatosX with a simple task:

```bash
ax run backend "Explain TypeScript in one sentence"
```

**Expected Result**: Agent responds with a concise explanation of TypeScript.

---

## 🔍 Troubleshooting Provider Detection

### Issue: Providers Not Detected

If `ax status` shows **no providers** or **providers disabled**, try these solutions:

#### Solution 1: Manual ENV Variable Override

**Windows Command Prompt**:
```cmd
set CLAUDE_CLI=C:\Users\YourName\AppData\Roaming\npm\claude.cmd
set GEMINI_CLI=C:\Users\YourName\AppData\Roaming\npm\gemini.cmd
set CODEX_CLI=C:\Users\YourName\AppData\Roaming\npm\openai.cmd
ax status
```

**Windows PowerShell**:
```powershell
$env:CLAUDE_CLI="C:\Users\YourName\AppData\Roaming\npm\claude.cmd"
$env:GEMINI_CLI="C:\Users\YourName\AppData\Roaming\npm\gemini.cmd"
$env:CODEX_CLI="C:\Users\YourName\AppData\Roaming\npm\openai.cmd"
ax status
```

**Find Exact Paths**:
```bash
# In CMD or PowerShell
where claude
where gemini
where openai
```

#### Solution 2: Configuration File (Permanent)

Create or edit `automatosx.config.json` in your project root:

```json
{
  "providers": {
    "claude-code": {
      "customPath": "C:\\Users\\YourName\\AppData\\Roaming\\npm\\claude.cmd",
      "minVersion": "2.0.0"
    },
    "gemini-cli": {
      "customPath": "C:\\Users\\YourName\\AppData\\Roaming\\npm\\gemini.cmd"
    },
    "openai": {
      "customPath": "C:\\Users\\YourName\\AppData\\Roaming\\npm\\openai.cmd"
    }
  }
}
```

**Note**: Use double backslashes (`\\`) in JSON files on Windows.

#### Solution 3: Verify npm Global Bin Path

```bash
# Check npm global bin directory
npm config get prefix
# Expected: C:\Users\YourName\AppData\Roaming\npm

# Check if it's in PATH
echo %PATH%
# Should contain: C:\Users\YourName\AppData\Roaming\npm
```

If npm bin is not in PATH, add it:
1. Open **System Properties** > **Environment Variables**
2. Under **User variables**, select **Path**
3. Click **Edit** > **New**
4. Add: `C:\Users\YourName\AppData\Roaming\npm`
5. Click **OK** and restart terminal

---

## 🧪 Testing with Mock Providers

If you don't have provider CLIs installed yet, you can test AutomatosX with mock providers:

**Windows Command Prompt**:
```cmd
set AUTOMATOSX_MOCK_PROVIDERS=true
ax run backend "Test message"
```

**Windows PowerShell**:
```powershell
$env:AUTOMATOSX_MOCK_PROVIDERS="true"
ax run backend "Test message"
```

**Result**: Agent responds with a mock response (no real API calls).

---

## 🪟 Windows-Specific Features

### Provider Detection Hierarchy (v5.3.1+)

AutomatosX uses a **three-layer detection system**:

1. **ENV Variables** (highest priority)
   - `CLAUDE_CLI`, `GEMINI_CLI`, `CODEX_CLI`
   - Temporary overrides, don't modify project config

2. **Config File** (second priority)
   - `automatosx.config.json` → `providers.<name>.customPath`
   - Permanent configuration per project

3. **PATH Detection** (fallback)
   - **Windows**: Uses `where.exe` + PATH×PATHEXT scanning
     - Supported extensions: `.CMD`, `.BAT`, `.EXE`, `.COM`
   - **Automatic**: No configuration needed if providers installed via npm

### Version Validation (Optional)

You can enforce minimum provider CLI versions:

```json
{
  "providers": {
    "claude-code": {
      "minVersion": "2.0.0"
    },
    "gemini-cli": {
      "minVersion": "0.8.0"
    }
  }
}
```

**Behavior**:
- AutomatosX checks provider version via `--version`
- Logs warning if version too old
- Rejects provider if requirement not met
- Permissive if version detection fails

---

## 🎓 Next Steps

### Learn the Basics

- **[Quick Start Guide](../getting-started/quick-start.md)** - Basic usage tutorial
- **[Core Concepts](../getting-started/core-concepts.md)** - Understand agents, memory, providers
- **[Terminal Mode Guide](../guides/terminal-mode.md)** - Complete CLI reference

### Explore Features

- **[Agent Communication & Memory](../guides/agent-communication.md)** - How agents remember context
- **[Multi-Agent Orchestration](../guides/multi-agent-orchestration.md)** - Natural language delegation
- **[Agent Directory](../../examples/AGENTS_INFO.md)** - All 12 available agents

### Troubleshooting

- **[Windows Troubleshooting](windows-troubleshooting.md)** - Common Windows issues
- **[FAQ](../../FAQ.md)** - Frequently asked questions
- **[General Troubleshooting](../../TROUBLESHOOTING.md)** - Cross-platform issues

---

## 📞 Getting Help

If you encounter issues:

1. **Check [Windows Troubleshooting Guide](windows-troubleshooting.md)**
2. **Search [GitHub Issues](https://github.com/defai-digital/automatosx/issues)**
3. **Create a new issue** with:
   - Windows version (10/11)
   - Node.js version (`node --version`)
   - AutomatosX version (`ax --version`)
   - Full error message
   - Output of `ax status --verbose`

---

## ✅ Setup Complete!

You're ready to use AutomatosX on Windows. Try these commands:

```bash
# Check system health
ax status

# List available agents
ax list agents

# Run your first multi-agent workflow
ax run Paris "Design a REST API for user authentication"
ax run Bob "Implement the auth API"     # Auto-receives Paris's design
ax run Steve "Security audit the code"  # Auto-receives design + implementation
```

**Welcome to the AutomatosX team!** 🚀

---

**Last Updated**: 2025-10-14
**Version**: AutomatosX v6.3.8
**Tested Platforms**: Windows 10, Windows 11
