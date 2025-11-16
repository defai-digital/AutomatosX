# AutomatosX v8.0.22 Release Notes

**Release Date**: January 16, 2025

## 🔧 CLI Provider Configuration Fix

This release restores the complete v7.6.1 provider configuration system for proper CLI tool integration.

### What's Changed

#### ✨ Full v7.6.1 Provider Configuration Restored

- **Complete provider management system** from v7.6.1 with all advanced features
- **CLI-first architecture** - Prioritizes CLI tools (Codex, Gemini, Claude Code) over direct API keys
- **Comprehensive health monitoring** and circuit breaker patterns
- **Automatic fallback** between providers with intelligent routing

**Key Features**:
- ✅ Health check system with configurable intervals
- ✅ Circuit breaker for fault tolerance
- ✅ Process management with graceful shutdown
- ✅ Version detection and caching
- ✅ Usage limit tracking (daily/weekly)
- ✅ Workload-aware routing
- ✅ Free tier prioritization

#### 🎯 Default Provider Priority

1. **OpenAI Codex CLI** (`codex`) - Priority 1
2. **Gemini CLI** (`gemini`) - Priority 2
3. **Claude Code CLI** (`claude`) - Priority 3

The system automatically detects which CLI tools are installed and uses them in order of priority.

#### 📋 Configuration Structure

**Before (v8.0.21)**:
```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1,
      "type": "cli",
      "command": "gemini"
    }
  }
}
```

**After (v8.0.22)** - Complete v7.6.1 configuration:
```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 1,
      "timeout": 2700000,
      "command": "codex",
      "healthCheck": {
        "enabled": true,
        "interval": 300000,
        "timeout": 5000
      },
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,
        "recoveryTimeout": 60000
      },
      "processManagement": {
        "gracefulShutdownTimeout": 5000,
        "forceKillDelay": 1000
      },
      "versionDetection": {
        "timeout": 5000,
        "forceKillDelay": 1000,
        "cacheEnabled": true
      },
      "limitTracking": {
        "enabled": true,
        "window": "daily",
        "resetHourUtc": 0
      }
    }
  }
}
```

### Additional Configuration Sections

**New configuration sections added**:
- `execution` - Timeout, concurrency, retry logic, stages
- `orchestration` - Session management, delegation settings
- `memory` - Memory persistence and search configuration
- `abilities` - Ability caching and limits
- `workspace` - PRD/tmp path management
- `performance` - Multi-level caching (profile, team, provider, adaptive, response)
- `advanced` - Embedding, security, development settings
- `integration` - VS Code integration
- `cli` - CLI-specific defaults
- `router` - Health check and routing configuration

### Benefits

✅ **Robust provider management** - Health checks prevent cascading failures

✅ **Intelligent fallback** - Automatically switches to backup providers on failure

✅ **Production-ready** - Circuit breaker and retry logic for reliability

✅ **Performance optimized** - Multi-level caching reduces latency

✅ **Resource efficient** - Limit tracking prevents quota exhaustion

✅ **Battle-tested** - Based on proven v7.6.1 architecture

### Migration Guide

**For existing users**:

Your existing configuration will be automatically merged with the new defaults. If you have a simple configuration, it will be enhanced with all v7.6.1 features.

**For new users**:

Run `ax setup` to generate the complete configuration automatically, or the system will use intelligent defaults on first run.

### CLI Tool Detection

The system automatically detects installed CLI tools:

```bash
# Check which providers are available
ax provider status

# View provider health
ax provider health

# Force a specific provider
ax cli --provider gemini-cli
```

### Technical Details

**Configuration File**: `automatosx.config.json`

**Provider Detection**:
- System checks for CLI tools in PATH (`codex`, `gemini`, `claude`)
- Enables providers automatically if CLI is detected
- Falls back gracefully if a provider is unavailable

**Health Monitoring**:
- Periodic health checks (default: 5 minutes)
- Circuit breaker opens after 3 consecutive failures
- Automatic recovery after cooldown period (default: 60 seconds)

**Process Management**:
- Graceful shutdown with 5-second timeout
- Force kill after 1 second delay
- Prevents zombie processes

### Compatibility

- **Node.js**: v20.0.0 or higher (v24.x recommended)
- **Operating Systems**: macOS, Linux, Windows
- **CLI Tools**:
  - OpenAI Codex CLI (optional but recommended)
  - Google Gemini CLI (optional but recommended)
  - Claude Code CLI (optional)

### Breaking Changes

None. This is a backward-compatible enhancement.

---

## 📊 Version Details

- **Version**: 8.0.22
- **Previous Version**: 8.0.21
- **Release Type**: Patch (Configuration Enhancement)
- **Breaking Changes**: None
- **Migration Required**: No

## 🔗 Links

- **GitHub Repository**: https://github.com/defai-digital/automatosx
- **NPM Package**: https://www.npmjs.com/package/@defai.digital/automatosx
- **Documentation**: https://github.com/defai-digital/automatosx#readme
- **v7.6.1 Reference**: https://github.com/defai-digital/AutomatosX/releases/tag/v7.6.1
- **Issues**: https://github.com/defai-digital/automatosx/issues

## 🙏 Acknowledgments

This release restores the proven provider architecture from v7.6.1, ensuring robust CLI integration and production-grade reliability.

Special thanks to users who reported the provider configuration issues!

---

**Full Changelog**: https://github.com/defai-digital/automatosx/compare/v8.0.21...v8.0.22
