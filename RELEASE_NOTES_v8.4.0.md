# AutomatosX v8.4.0 - Grok CLI Integration

**Release Date**: November 17, 2025

## 🎉 Major Features

### Grok CLI Integration with Native `.grok/` Support

AutomatosX now supports **Grok CLI** as the 4th AI provider, with native integration for both **X.AI Grok** and **Z.AI GLM 4.6** models.

**Key Highlights**:
- 🤖 **New `ax cli` command** - Launch Grok CLI with project configuration
- 📁 **Native `.grok/` directory support** - Follows Grok CLI conventions
- 🔑 **Automatic API key loading** - From project or global config
- 🌐 **Dual provider support** - X.AI Grok and Z.AI GLM models
- 🔒 **Secure configuration** - API key redaction and validation
- 📊 **Provider routing** - Priority 2 in the routing system

---

## 🚀 New Command: `ax cli`

Launch Grok CLI with AutomatosX project configuration:

```bash
# Quick setup
ax setup                     # Creates .grok/settings.json

# Launch Grok CLI
ax cli                       # Interactive mode
ax cli "Hello Grok!"         # Direct message
ax cli --model grok-4-latest # Override model
```

### Configuration Hierarchy

The `ax cli` command loads settings with the following priority:

1. **CLI arguments** (highest) - `--api-key`, `--model`, `--base-url`
2. **Project config** - `.grok/settings.json`
3. **Global config** - `~/.grok/user-settings.json`
4. **Environment variables** (lowest) - `GROK_API_KEY`, `GROK_BASE_URL`, `GROK_MODEL`

---

## 📋 Configuration Files

### Project-Level: `.grok/settings.json`

```json
{
  "apiKey": "your-api-key-here",
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast"
}
```

### For X.AI Grok (Official)

```json
{
  "apiKey": "xai-your-key",
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast"
}
```

**Get your API key**: https://console.x.ai/

### For Z.AI GLM 4.6 (Code-Optimized)

```json
{
  "apiKey": "your-zai-key.token",
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6"
}
```

**Get your API key**: https://bigmodel.cn/

---

## 🔧 Provider Integration

Grok is now fully integrated into the AutomatosX routing system:

```bash
# Use Grok provider explicitly
ax run backend "task" --provider grok

# Check Grok status
ax doctor grok

# View provider info
ax providers info grok

# List all providers
ax status
```

### Provider Priority

1. **Claude** (Priority 1) - Primary provider
2. **Grok** (Priority 2) - **NEW!** X.AI or Z.AI
3. **Gemini** (Priority 3) - Google's models
4. **OpenAI** (Priority 4) - GPT models

---

## 🐛 Bug Fixes

### Critical Fixes

1. **Zod v3.x Compatibility** - Fixed `error.errors` → `error.issues` API changes
   - `src/core/config.ts`
   - `src/agents/profile-loader.ts`
   - `src/providers/base-provider.ts`

2. **Schema Validation** - Fixed `circuitBreakerThreshold` optional field validation
   - `src/core/config-schemas.ts`

3. **Configuration Loading** - Improved error messages for missing/commented config fields
   - Detects `_apiKey` vs `apiKey` (commented fields)
   - Helpful guidance for setup

### Error Message Improvements

**Before**:
```
❌ No API key found
```

**After**:
```
⚠️  No Grok API key configured!

Config file exists but apiKey is not set:
  /path/to/.grok/settings.json

Remove the underscore prefix from _apiKey to activate it
Example: Change "_apiKey" → "apiKey"

   Get your API key from:
   • X.AI (Grok): https://console.x.ai/
   • Z.AI (GLM 4.6): https://bigmodel.cn/
```

---

## 🧪 Testing

### New Test Coverage

**46 new tests** added for Grok integration:

- **GrokProvider Tests** (15 tests)
  - Configuration validation
  - Error handling and retry logic
  - X.AI and Z.AI support
  - Health checks and metrics

- **CLI Command Tests** (13 tests)
  - Config loading from `.grok/settings.json`
  - Priority handling
  - Security (API key redaction)
  - Error messages

- **Integration Tests** (18 tests)
  - End-to-end workflows
  - Help command validation
  - Configuration formats
  - Security validation

**Test Results**:
```
✅ Total Tests: 2,420
✅ Passing: 2,354 (97.3%)
✅ Grok Tests: 46/46 passing
```

---

## 📚 Documentation

### Updated Documentation

- **Help Text** - Comprehensive `ax cli --help` with setup instructions
- **Configuration Guide** - Clear priority and file format documentation
- **Error Messages** - Context-aware guidance for common issues
- **Examples** - Real-world usage scenarios

### Quick Start Guide

```bash
# 1. Setup AutomatosX
ax setup

# 2. Configure Grok
# Edit .grok/settings.json and set:
#   - apiKey: your API key
#   - baseURL: https://api.x.ai/v1 (X.AI) or https://api.z.ai/... (Z.AI)
#   - model: grok-3-fast (X.AI) or glm-4.6 (Z.AI)

# 3. Test it!
ax cli "Hello Grok!"

# 4. Use in agent workflows
ax run backend "implement feature" --provider grok
```

---

## 🔒 Security

### Security Improvements

1. **API Key Redaction** - Keys are never exposed in logs
   ```
   hasApiKey: "[REDACTED]"
   ```

2. **Placeholder Detection** - Rejects `YOUR_API_KEY_HERE` placeholders

3. **Field Validation** - Ensures valid configuration before execution

4. **Secure Storage** - Configuration in `.grok/` directory (add to `.gitignore`)

---

## 🎯 Use Cases

### 1. Direct Grok CLI Access

```bash
ax cli "Explain this codebase"
```

### 2. Agent Task Execution

```bash
ax run backend "implement authentication" --provider grok
```

### 3. Multi-Provider Routing

```bash
# AutomatosX automatically selects best provider
ax run backend "task"  # May route to Grok based on availability
```

### 4. Cost Optimization

Use Z.AI GLM 4.6 for code-optimized tasks at lower cost than X.AI Grok.

---

## 📊 What's New in Config

### Updated `automatosx.config.json`

```json
{
  "providers": {
    "claude-code": { "enabled": true, "priority": 1 },
    "grok": { "enabled": true, "priority": 2 },  // NEW!
    "gemini-cli": { "enabled": true, "priority": 3 },
    "openai": { "enabled": true, "priority": 4 }
  }
}
```

### Auto-Generated Config

The `src/config.generated.ts` now includes Grok provider by default.

---

## 🔄 Migration from v8.3.x

### No Breaking Changes

v8.4.0 is **fully backward compatible** with v8.3.x.

### New Setup Required

If you want to use Grok:

1. Run `ax setup` to create `.grok/settings.json`
2. Add your API key (X.AI or Z.AI)
3. Start using `ax cli` or `--provider grok`

### Existing Users

All existing functionality continues to work unchanged. Grok is an optional addition.

---

## 📦 Installation

### NPM

```bash
npm install -g @defai.digital/automatosx@8.4.0
```

### Upgrade

```bash
npm update -g @defai.digital/automatosx
```

### Verify

```bash
ax --version  # Should show 8.4.0
ax status     # Should show 4 providers
```

---

## 🙏 Acknowledgments

- **X.AI** for Grok API and models
- **Z.AI** for GLM 4.6 code-optimized models
- **Grok CLI** (@vibe-kit/grok-cli) for the excellent CLI tool

---

## 📝 Changelog

### Added
- ✨ Grok CLI integration with X.AI and Z.AI support
- ✨ New `ax cli` command for Grok CLI launcher
- ✨ Native `.grok/` directory support
- ✨ Automatic config loading from project and global settings
- ✨ Provider routing with priority 2 for Grok
- ✨ 46 comprehensive tests for Grok integration
- ✨ Context-aware error messages and setup guidance

### Fixed
- 🐛 Zod v3.x API compatibility (`error.errors` → `error.issues`)
- 🐛 Schema validation for optional `circuitBreakerThreshold`
- 🐛 Config loading error messages
- 🐛 API key placeholder detection

### Changed
- 📝 Updated help text with Grok configuration instructions
- 📝 Enhanced error messages with actionable guidance
- 📝 Improved security with API key redaction

### Security
- 🔒 API key redaction in all logs
- 🔒 Placeholder API key rejection
- 🔒 Secure configuration validation

---

## 🔗 Links

- **GitHub Repository**: https://github.com/defai-digital/AutomatosX
- **NPM Package**: https://www.npmjs.com/package/@defai.digital/automatosx
- **Documentation**: https://github.com/defai-digital/AutomatosX#readme
- **Issues**: https://github.com/defai-digital/AutomatosX/issues
- **X.AI Console**: https://console.x.ai/
- **Z.AI Platform**: https://bigmodel.cn/

---

## 💬 Support

- **GitHub Issues**: https://github.com/defai-digital/AutomatosX/issues
- **Email**: support@defai.digital
- **Documentation**: See README.md and CLAUDE.md

---

## 🚀 What's Next

### Planned for v8.5.0
- Enhanced Grok CLI features
- Additional provider integrations
- Performance optimizations
- Extended test coverage

---

**Full Changelog**: https://github.com/defai-digital/AutomatosX/compare/v8.3.0...v8.4.0
